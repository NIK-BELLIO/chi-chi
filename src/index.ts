type ChatMessage = { role: "user" | "assistant"; content: string };
import { handleSocial } from "./social";

const SYSTEM_PROMPT = `تو «چی‌چی»، یک دستیار فارسی برای انتخاب غذا و فیلم هستی.

قواعد قطعی:
1) هیچ اطلاعاتی را از خودت نساز. بودجه، رژیم، فصل، زمان، همراه یا سلیقه را فقط وقتی لحاظ کن که کاربر گفته باشد.
2) پیام کاربر را عنوان فیلم یا غذا فرض نکن، مگر واضحاً به‌عنوان گزینه معرفی شده باشد.
3) اگر کاربر ناراضی، عصبانی یا توهین‌آمیز بود، کوتاه عذرخواهی کن و بپرس کدام بخش انتخاب بد بود؛ پیشنهاد تازه نساز.
4) اگر دقیقاً دو گزینه داده شد، پاسخ را با «انتخاب من: [یکی از همان دو گزینه]» شروع کن. فقط یکی را انتخاب کن، یک دلیل روشن بده، مساوی اعلام نکن و گزینه سوم نساز.
5) اگر سؤال کلی مثل «شام چی بخورم؟» بود و هیچ محدودیتی ندادی، فقط یک سؤال کوتاه بپرس: «سبک و سریع، یا مفصل و خوشمزه؟» حدس نزن.
6) وقتی اطلاعات کافی است، یک انتخاب قاطع و دلیل کوتاه بده. فقط اگر کاربر خواست جایگزین معرفی کن.
7) فقط فارسی روان و محاوره‌ای بنویس؛ حداکثر 90 کلمه. مقدمه‌چینی و تکرار نکن.
8) درباره فیلم یا غذایی که نمی‌شناسی صادقانه بگو مطمئن نیستی و سؤال روشن‌کننده بپرس.

نمونه:
کاربر: «بین Parasite و Knives Out کدوم؟»
پاسخ: «انتخاب من: Knives Out 🎯 چون برای یک شب سرگرم‌کننده ریتم سبک‌تر و معمای جمع‌وجورتری دارد.»
کاربر: «ریدی»
پاسخ: «حق داری، انتخابم به دردت نخورد. کجاش بد بود: خود پیشنهاد یا دلیل انتخاب؟»`;

const NEGATIVE_FEEDBACK = /^(ریدی|چرت|مزخرف|افتضاح|بد بود|خوب نبود|به درد نخورد|نه بابا|احمق)([!.؟ ]*)$/i;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
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
    if (url.pathname.startsWith("/api/social/")) return handleSocial(request, env, url.pathname);
    if (url.pathname !== "/api/chat") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({ error: "روش درخواست نامعتبر است." }, 405);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return json({ error: "پیام بیش از حد طولانی است." }, 413);

    try {
      const body: unknown = await request.json();
      const messages = body && typeof body === "object" ? (body as Record<string, unknown>).messages : undefined;
      if (!validMessages(messages)) return json({ error: "پیام معتبر نیست." }, 400);

      const lastMessage = messages[messages.length - 1].content.trim();
      if (NEGATIVE_FEEDBACK.test(lastMessage)) {
        return json({ reply: "حق داری، انتخابم به دردت نخورد. کجاش بد بود: خود پیشنهاد یا دلیل انتخاب؟" });
      }

      const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 220,
        temperature: 0.35,
        top_p: 0.8,
      });
      const reply = typeof result === "object" && result !== null && "response" in result
        ? (result as { response?: unknown }).response
        : undefined;
      if (typeof reply !== "string" || !reply.trim()) throw new Error("Empty AI response");
      return json({ reply: reply.trim() });
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
