# Deployment checklist

- Runtime: Node.js 18+
- Start command: `npm start`
- Expose `PORT` (defaults to 3000).
- Set `PUBLIC_SITE_URL` to the real HTTPS international domain before checkout.
- Store Stripe and email secrets in the VPS secret manager.
- Configure Stripe webhook and test at least one completed Checkout event.
- Configure persistent storage for account/dashboard data.
- Rebuild sitemap and submit the real domain in Search Console.
