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
1. Set the real `PUBLIC_SITE_URL` and update product-schema URLs, `robots.txt`, and `sitemap.xml`.
2. Configure Stripe secret and webhook signing keys and test the webhook.
3. Configure a verified sender domain if using transactional email.
4. Confirm Google Analytics/AdSense settings and register the new domain in Search Console.
