# چی‌چی — دستیار انتخاب غذا و فیلم

یک چت‌بات فارسی و عمومی برای کمک به انتخاب غذا و فیلم، ساخته‌شده با Cloudflare Workers AI.

## اجرای محلی

```bash
npm install
npm run cf-typegen
npm run dev
```

## انتشار

1. پروژه را در یک مخزن GitHub قرار دهید.
2. در Cloudflare به **Workers & Pages → Create → Import a repository** بروید.
3. مخزن را انتخاب کنید؛ دستور انتشار `npx wrangler deploy` است.

یا پس از ورود به حساب Cloudflare، اجرا کنید:

```bash
npm run deploy
```

کلید API لازم نیست؛ اتصال Workers AI از طریق binding امن `AI` انجام می‌شود.
