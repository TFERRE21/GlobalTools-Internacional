# GlobalTools International

English-first international edition of GlobalTools, with free browser tools, business spreadsheets, finance dashboard subscriptions, multilingual navigation, and Stripe checkout in USD.

## Runtime
- Node.js 20+
- Start command: `npm start` (gateway plus core application server)
- Container runtime: the included Dockerfile uses Node.js 20 and exposes port 3000.
- Deploy to a Node.js VPS or container host; static-only hosting does not support the checkout/account APIs.

## Configuration
Configure `.env.example` variables in your hosting provider's secret/environment settings. Never commit real keys. The example domain is reserved for documentation; replace it with the real HTTPS domain before production.

## International Stripe catalog
Separate live USD Products/Prices have been created for the international catalog, independent of the Oolivo BRL Prices. Checkout uses hosted Stripe Checkout in English.

## Before production
1. Set `PUBLIC_SITE_URL` to the real HTTPS international domain. Canonical links, `robots.txt`, and `sitemap.xml` are generated from this URL at runtime.
2. Set the live Stripe secret key and webhook signing secret from the same Stripe account that owns the USD Prices. Configure the webhook endpoint as `https://YOUR-DOMAIN/api/stripe-webhook`; verify `checkout.session.completed` and subscription events.
3. Configure a verified sender domain and `RESEND_FROM_EMAIL` if using transactional email.
4. Confirm Google Analytics/AdSense settings and register the new domain in Search Console.
