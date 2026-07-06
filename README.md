# چی‌چی — دستیار انتخاب غذا و فیلم

یک چت‌بات فارسی و عمومی برای کمک به انتخاب غذا و فیلم، با بک‌اند Cloudflare Workers و هوش مصنوعی Pollinations.

## اجرای محلی

```bash
npm install
npm run cf-typegen
npm run dev
```

برای اجرای محلی، فایل `.dev.vars` بسازید و کلید محرمانه را فقط در آن قرار دهید:

```text
POLLINATIONS_API_KEY=کلید_محرمانه
```

## انتشار

1. پروژه را در یک مخزن GitHub قرار دهید.
2. در Cloudflare به **Workers & Pages → Create → Import a repository** بروید.
3. مخزن را انتخاب کنید؛ دستور انتشار `npx wrangler deploy` است.

یا پس از ورود به حساب Cloudflare، اجرا کنید:

```bash
npm run deploy
```

پس از اولین انتشار، کلید Pollinations را به‌صورت Secret در Cloudflare ثبت کنید:

```bash
npx wrangler secret put POLLINATIONS_API_KEY
```

کلید را هرگز داخل فایل‌های عمومی یا مخزن GitHub قرار ندهید.
