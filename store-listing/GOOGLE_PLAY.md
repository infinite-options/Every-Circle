# Google Play store listing fixes

Use these values in Play Console → Store presence → Main store listing (and App content → Child Safety Standards).

## Why the listing was flagged

1. **Impersonation** — Google cited the hi-res icon and title. Keep the official name **`everyCircle`** (camelCase). If the listing previously used **Every Circle** (two words) or mixed spellings, align title, developer branding, and icon wordmark on **everyCircle** everywhere so it reads as one consistent brand—not a lookalike of other “Circle” apps.
2. **Metadata** — The old full description was vague, had typos, and did not clearly describe core features.
3. **Child Safety Standards** — Google requires a **public HTML** page that explicitly prohibits CSAE. The in-app policy alone is not enough; `https://everycircle.com/child-safety` must serve crawlable standards (now `public/child-safety.html`).

## Title (≤ 30 characters)

**Keep:** `everyCircle`

Use this exact spelling in the Play title, icon wordmark, and descriptions. Do not use `Every Circle`, `EveryCircle`, or a bare `Circle`.

## Short description (≤ 80 characters)

```
Earn rewards for trusted referrals. Businesses pay only when recommendations convert.
```

## Full description (paste as-is)

```
everyCircle is a professional networking and referral-rewards app for individuals and businesses.

WHAT YOU CAN DO
• Build a trusted network of friends, colleagues, customers, and professionals
• Share and request recommendations for products and services
• List business offerings and seeking requests
• Message people in your network about opportunities
• Earn a bounty when your recommendation leads to a qualifying purchase
• For businesses: reward advocates and pay only when a recommendation becomes a sale

HOW IT WORKS
1. Create your profile (individual or business).
2. Connect with people you know and grow your circle.
3. Recommend businesses, products, or services — or ask your network for help.
4. When a recommendation leads to a qualifying purchase, rewards are shared among the people who made the connection possible.

WHO IT’S FOR
• Individuals who want to turn trusted word-of-mouth into rewards
• Businesses that want results-based referral marketing instead of paying only for ads or subscriptions

everyCircle is an independent app from everyCircle.com. It is not affiliated with other apps or companies named Circle.
```

## Hi-res icon

Upload `store-listing/hi-res-icon-512.png` (also baked into `assets/icon.png` for the next native build).

The updated icon keeps your maroon sphere mark and adds the **everyCircle** wordmark plus tagline so it is clearly your brand, not a generic Circle logo.

## Child Safety Standards declaration

In Play Console → App content → Child Safety Standards:

- **Published standards URL:** `https://everycircle.com/child-safety`
- **Point of contact email:** `support@everycircle.com`
- Confirm in-app reporting / feedback exists
- Confirm CSAM handling and legal compliance as described in the published policy

**Deploy note:** Ship `public/child-safety.html` and the updated `public/_redirects` to production before resubmitting. After deploy, open the URL in a private browser window and confirm the full CSAE policy text is visible **without** installing the app.
