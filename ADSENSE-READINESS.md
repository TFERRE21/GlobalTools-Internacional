# AdSense Readiness — GlobalToolsNow.com

This checklist helps prepare the site for review. It is not a guarantee of approval; Google reviews the live site and the publisher account.

## Implemented in the repository

- The AdSense loader uses publisher ID `ca-pub-6472882150880001` and is injected once into public HTML pages that do not already include it.
- Ads are excluded from login, account, account-success and product-success pages.
- The root `ads.txt` file contains the publisher declaration and the server serves that file from the repository root.
- The sitemap and robots endpoints use the public domain.
- Public home, store, contact, support, policy and product pages have canonical URLs/navigation.
- A working contact form creates a support reference and stores requests in the configured data directory.
- The privacy policy explains analytics, advertising, tool processing and support-form data.
- Main tool pages have clearer English descriptions, examples and limitations, including honest notes about conversions and compression.
- Automated checks verify the sitemap, ads.txt, contact form, persistent support ticket storage, and that ads do not load on account pages.

## Required before requesting or repeating AdSense review

1. Deploy the latest `main` branch to the iContainer VPS and restart the Node.js application.
2. Verify the live pages below return the expected content:
   - `https://globaltoolsnow.com/`
   - `https://globaltoolsnow.com/robots.txt`
   - `https://globaltoolsnow.com/sitemap.xml`
   - `https://globaltoolsnow.com/ads.txt`
   - `https://globaltoolsnow.com/contato.html`
   - `https://globaltoolsnow.com/privacy.html`
3. In AdSense → Sites, confirm the site is connected and follow any displayed review or verification instructions. Google may take time to recrawl `ads.txt`.
4. In AdSense → Privacy & messaging, configure the appropriate consent message. When serving personalized ads to users in the EEA, UK or Switzerland, Google requires a Google-certified CMP integrated with the IAB TCF.
5. Manually test the main tools on desktop and mobile. Remove or repair any page that is broken, empty, misleading or not useful before review.
6. Do not click your own ads, ask others to click them, place ads beside download/navigation buttons, or use traffic sources that generate invalid clicks.
7. Check that the site remains accessible without a login and that contact, privacy, terms and refund links work.

## Support form note

The contact form stores tickets in `GLOBALTOOLS_DATA_DIR/support-tickets.json` (the configured default is `/var/lib/globaltools/support-tickets.json`). It does not send an automatic email notification. Configure a verified notification email or review that file regularly if you need timely follow-up.

## Official Google guidance

- [Check whether your site is ready for AdSense](https://support.google.com/adsense/answer/7299563?hl=en)
- [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en)
- [ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en)
- [Consent management requirements for publishers](https://support.google.com/adsense/answer/13554116?hl=en)
