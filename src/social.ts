type SocialEnv = { DB: D1Database };
type Session = { id: string; nickname: string; intent: string; is_adult: number };

const encoder = new TextEncoder();

function response(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function session(request: Request, env: SocialEnv): Promise<Session | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.length < 32) return null;
  return env.DB.prepare(
    "SELECT id,nickname,intent,is_adult FROM profiles WHERE token_hash=?"
  ).bind(await sha256(token)).first<Session>();
}

function compatible(a: string, b: string): boolean {
  return a === "both" || b === "both" || a === b;
}

export async function handleSocial(request: Request, env: SocialEnv, path: string): Promise<Response> {
  if (path === "/api/social/register" && request.method === "POST") {
    const body = await request.json<Record<string, unknown>>();
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    const intent = typeof body.intent === "string" ? body.intent : "";
    const isAdult = body.isAdult === true;
    if (!/^[\p{L}\p{N}_‌ -]{2,24}$/u.test(nickname)) return response({ error: "نام مستعار معتبر نیست." }, 400);
    if (!['friendship','romantic','both'].includes(intent)) return response({ error: "نوع آشنایی معتبر نیست." }, 400);
    if ((intent === 'romantic' || intent === 'both') && !isAdult) return response({ error: "حالت عاطفی فقط برای افراد ۱۸ سال به بالا است." }, 400);
    const id = crypto.randomUUID();
    const tokenBytes = new Uint8Array(32); crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      await env.DB.prepare("INSERT INTO profiles(id,nickname,token_hash,intent,is_adult) VALUES(?,?,?,?,?)")
        .bind(id, nickname, await sha256(token), intent, isAdult ? 1 : 0).run();
      return response({ token, profile: { id, nickname, intent } }, 201);
    } catch { return response({ error: "این نام مستعار قبلاً انتخاب شده است." }, 409); }
  }

  const me = await session(request, env);
  if (!me) return response({ error: "ابتدا وارد پروفایل شوید." }, 401);

  if (path === "/api/social/tastes" && request.method === "PUT") {
    const body = await request.json<{ tastes?: Array<{ kind?: string; item?: string; score?: number }> }>();
    const tastes = body.tastes?.slice(0, 30) ?? [];
    const valid = tastes.filter((t) => ['movie','food'].includes(t.kind ?? '') && typeof t.item === 'string' && t.item.trim().length <= 80 && Number.isInteger(t.score) && t.score! >= 1 && t.score! <= 5);
    if (!valid.length) return response({ error: "حداقل یک سلیقه معتبر وارد کنید." }, 400);
    const statements = valid.map((t) => env.DB.prepare("INSERT INTO tastes(profile_id,kind,item,score) VALUES(?,?,?,?) ON CONFLICT(profile_id,kind,item) DO UPDATE SET score=excluded.score")
      .bind(me.id, t.kind, t.item!.trim(), t.score));
    await env.DB.batch(statements);
    return response({ saved: valid.length });
  }

  if (path === "/api/social/matches" && request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT p.id,p.nickname,p.intent,COUNT(*) common_count,
        ROUND(AVG(6-ABS(mine.score-theirs.score))*20) match_percent,
        GROUP_CONCAT(mine.item, '، ') common_items
      FROM tastes mine JOIN tastes theirs ON mine.kind=theirs.kind AND mine.item=theirs.item
      JOIN profiles p ON p.id=theirs.profile_id
      WHERE mine.profile_id=? AND theirs.profile_id<>? AND p.discoverable=1
        AND NOT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=p.id) OR (blocker_id=p.id AND blocked_id=?))
      GROUP BY p.id HAVING common_count>0 ORDER BY match_percent DESC,common_count DESC LIMIT 12
    `).bind(me.id, me.id, me.id, me.id).all<{id:string;nickname:string;intent:string;common_count:number;match_percent:number;common_items:string}>();
    return response({ matches: result.results.filter((m) => compatible(me.intent, m.intent) && (me.is_adult || m.intent === 'friendship')) });
  }

  if (path === "/api/social/request" && request.method === "POST") {
    const body = await request.json<{ profileId?: string }>();
    if (!body.profileId || body.profileId === me.id) return response({ error: "کاربر نامعتبر است." }, 400);
    await env.DB.prepare("INSERT INTO introductions(sender_id,receiver_id) VALUES(?,?) ON CONFLICT(sender_id,receiver_id) DO NOTHING").bind(me.id, body.profileId).run();
    const mutual = await env.DB.prepare("SELECT 1 ok FROM introductions WHERE sender_id=? AND receiver_id=? AND status<>'declined'").bind(body.profileId, me.id).first();
    if (mutual) await env.DB.batch([
      env.DB.prepare("UPDATE introductions SET status='accepted' WHERE sender_id=? AND receiver_id=?").bind(me.id, body.profileId),
      env.DB.prepare("UPDATE introductions SET status='accepted' WHERE sender_id=? AND receiver_id=?").bind(body.profileId, me.id),
    ]);
    return response({ matched: Boolean(mutual) });
  }

  if (path === "/api/social/block" && request.method === "POST") {
    const body = await request.json<{ profileId?: string }>();
    if (!body.profileId) return response({ error: "کاربر نامعتبر است." }, 400);
    await env.DB.prepare("INSERT INTO blocks(blocker_id,blocked_id) VALUES(?,?) ON CONFLICT DO NOTHING").bind(me.id, body.profileId).run();
    return response({ blocked: true });
  }

  if (path === "/api/social/report" && request.method === "POST") {
    const body = await request.json<{ profileId?: string; reason?: string }>();
    const reason = body.reason?.trim() ?? "";
    if (!body.profileId || reason.length < 3 || reason.length > 300) return response({ error: "گزارش معتبر نیست." }, 400);
    await env.DB.prepare("INSERT INTO reports(id,reporter_id,reported_id,reason) VALUES(?,?,?,?)")
      .bind(crypto.randomUUID(), me.id, body.profileId, reason).run();
    await env.DB.prepare("INSERT INTO blocks(blocker_id,blocked_id) VALUES(?,?) ON CONFLICT DO NOTHING")
      .bind(me.id, body.profileId).run();
    return response({ reported: true, blocked: true });
  }

  return response({ error: "مسیر پیدا نشد." }, 404);
}
