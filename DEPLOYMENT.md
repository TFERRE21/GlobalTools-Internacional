# Deployment checklist

- Runtime: Node.js 18+
- Start command: `npm start`
- Expose `PORT` (defaults to 3000).
- Set `PUBLIC_SITE_URL` to the real HTTPS international domain before checkout.
- Store Stripe and email secrets in the VPS secret manager.
- Configure Stripe webhook and test at least one completed Checkout event.
- Configure persistent storage for account/dashboard data.
- Rebuild sitemap and submit the real domain in Search Console.

## Reverse proxy performance (iContainer / Nginx)

The frontend uses versioned JavaScript and CSS URLs (for example, `/app.js?v=20261013-03`). The Node server sends long-lived cache headers for these versioned assets. Keep the version query updated whenever an asset changes.

Check whether Nginx already enables gzip before adding directives. If compression is not enabled, add the following to the Nginx `http` or applicable `server` context (do not duplicate existing directives):

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/rss+xml image/svg+xml;
```

After deploying, verify compressed delivery and cache headers:

```bash
curl -sSI -H 'Accept-Encoding: gzip' 'https://globaltoolsnow.com/app.js?v=20261013-03' | grep -iE 'content-encoding|cache-control|vary'
```

Expected: `Content-Encoding: gzip` and a long-lived cache policy for the versioned asset. If these are absent, inspect the Nginx proxy configuration in the hosting panel. Re-run PageSpeed after deployment; changes in GitHub do not update the live VPS until the latest `main` branch is deployed.
