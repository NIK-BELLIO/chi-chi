import { ensureAnalytics } from "./analytics";

type AdminEnv = { DB: D1Database; ADMIN_TOKEN?: string };

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let different = av.length ^ bv.length;
  for (let i = 0; i < av.length; i += 1) different |= av[i] ^ bv[i];
  return different === 0;
}

async function authorized(request: Request, env: AdminEnv): Promise<boolean> {
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(env.ADMIN_TOKEN && supplied && await secureEqual(supplied, env.ADMIN_TOKEN));
}

export async function handleAdmin(request: Request, env: AdminEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "روش درخواست نامعتبر است." }, 405);
  if (!env.ADMIN_TOKEN) return json({ error: "کلید مدیریت هنوز در Cloudflare تنظیم نشده است." }, 503);
  if (!await authorized(request, env)) return json({ error: "کلید مدیریت درست نیست." }, 401);

  try {
    await ensureAnalytics(env);
    const results = await env.DB.batch([
      env.DB.prepare(`SELECT
        COUNT(*) total_users,
        SUM(CASE WHEN created_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) new_24h,
        SUM(CASE WHEN created_at >= datetime('now','-7 day') THEN 1 ELSE 0 END) new_7d
        FROM profiles`),
      env.DB.prepare("SELECT intent,COUNT(*) count FROM profiles GROUP BY intent ORDER BY count DESC"),
      env.DB.prepare("SELECT kind,COUNT(*) count,COUNT(DISTINCT profile_id) users FROM tastes GROUP BY kind"),
      env.DB.prepare("SELECT kind,item,COUNT(*) count FROM tastes GROUP BY kind,item ORDER BY count DESC LIMIT 20"),
      env.DB.prepare("SELECT status,COUNT(*) count FROM introductions GROUP BY status"),
      env.DB.prepare("SELECT (SELECT COUNT(*) FROM blocks) blocks,(SELECT COUNT(*) FROM reports) reports"),
      env.DB.prepare(`SELECT event_type,COUNT(*) count
        FROM analytics_events WHERE created_at >= datetime('now','-30 day')
        GROUP BY event_type ORDER BY count DESC`),
      env.DB.prepare(`SELECT date(created_at) day,COUNT(*) count
        FROM analytics_events WHERE created_at >= datetime('now','-13 day')
        GROUP BY date(created_at) ORDER BY day`),
      env.DB.prepare(`SELECT r.id,r.reason,r.created_at,
        reporter.nickname reporter,reported.nickname reported
        FROM reports r
        LEFT JOIN profiles reporter ON reporter.id=r.reporter_id
        LEFT JOIN profiles reported ON reported.id=r.reported_id
        ORDER BY r.created_at DESC LIMIT 20`),
    ]);

    return json({
      overview: results[0].results[0] ?? {},
      intents: results[1].results,
      tasteSummary: results[2].results,
      popularTastes: results[3].results,
      introductions: results[4].results,
      safety: results[5].results[0] ?? {},
      events: results[6].results,
      daily: results[7].results,
      recentReports: results[8].results,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("admin stats failed", error instanceof Error ? error.message : String(error));
    return json({ error: "خواندن آمار با خطا روبه‌رو شد." }, 500);
  }
}
