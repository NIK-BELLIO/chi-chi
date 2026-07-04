type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `تو «چی‌چی»، یک دستیار صمیمی و خوش‌سلیقه‌ی فارسی برای تصمیم‌گیری هستی.
کار اصلی تو کمک به انتخاب غذا و فیلم است. کوتاه، طبیعی و فقط فارسی بنویس.
اگر اطلاعات کافی نیست، حداکثر یک سؤال مشخص بپرس. اگر کافی است، یک انتخاب اصلی قاطعانه بده،
دلیلش را در یک جمله بگو و دو جایگزین کوتاه هم پیشنهاد کن. انتخاب‌ها باید متناسب با بودجه، زمان،
رژیم غذایی، حال‌وهوا، ژانر و همراهان کاربر باشند. ادعای دسترسی به اطلاعات زنده یا موجودی فروشگاه نکن.
برای موضوعات خارج از غذا و فیلم، مؤدبانه بگو تمرکزت روی همین دو موضوع است.`;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function validMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const message = item as Record<string, unknown>;
    return (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.trim().length > 0 && message.content.length <= 1200;
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/chat") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({ error: "روش درخواست نامعتبر است." }, 405);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return json({ error: "پیام بیش از حد طولانی است." }, 413);

    try {
      const body: unknown = await request.json();
      const messages = body && typeof body === "object" ? (body as Record<string, unknown>).messages : undefined;
      if (!validMessages(messages)) return json({ error: "پیام معتبر نیست." }, 400);

      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 420,
        temperature: 0.75,
      });

      const response = typeof result === "object" && result !== null && "response" in result
        ? (result as { response?: unknown }).response
        : undefined;
      if (typeof response !== "string" || !response.trim()) throw new Error("Empty AI response");

      return json({ reply: response.trim() });
    } catch (error) {
      console.error(JSON.stringify({
        message: "chat request failed",
        error: error instanceof Error ? error.message : String(error),
        path: url.pathname,
      }));
      return json({ error: "فعلاً نتونستم فکر کنم؛ یک‌بار دیگه امتحان کن." }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
