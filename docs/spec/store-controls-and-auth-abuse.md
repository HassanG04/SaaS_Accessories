# Store controls, authentication abuse and occasion reminders

Owner request: 2026-10-18. This extends `owner-experience-change.md` and the
roadmap; it does not authorize production changes. Supabase plan: **Free**, as
confirmed by the owner. Keep the owner-confirmed order/approval/payment/shipping,
permissions and stock baseline; test affected regressions without reopening the
whole baseline as unverified. Anti-Gravity's postal work remains separate.

## Current evidence

- `src/features/auth/api.ts` calls Supabase Auth directly. Cloudflare protection
  on the Pages hostname alone does not cover that endpoint.
- `Turnstile.tsx` and the auth forms have local lifecycle repairs in T-2.12a:
  stable callbacks, safe cleanup, fresh single-use challenges, no synthetic
  production token, and no dummy production site key. These are usability and
  client correctness fixes, not proof of server-side enforcement or attack capacity.
- `src/features/admin/settings/types.ts` and `validators.ts` expose Arabic hero
  copy but no hero image, featured-product selection or complete policy editor.
  `admin_update_setting` has a database allow-list: adding form fields alone fails.
- Routed `HomePage.tsx` hard-codes `categories/earrings-cover.webp` and shows
  `bestSellers[0]`; several English settings it reads have no admin write contract.
- `TermsPage.tsx`, `PrivacyPage.tsx`, `ReturnsPage.tsx`, `ShippingPage.tsx` and
  `ContactPage.tsx` contain route-local copy. Footer branding/navigation are also
  coded in the component. Existing `returns_text_ar` is only a limited summary.
- `analytics/src/lolys_analytics/calendar.py` already includes Mother's Day and Valentine's Day;
  `ForecastPage.tsx` has no upcoming-event notification feed. There is no connected
  generative AI service. Statistical models exist; `[global_ml].enabled = false`.
  Production forecasting is explicitly on hold in `analytics/README.md` and
  `docs/analytics/execution-review.md`. Synthetic event uplift constants are test
  data, not learned production effects or recommended discounts.

## Authentication: target behavior and deployment boundary (T-2.12)

1. Use the existing **Managed Turnstile** integration: low-risk visitors usually
   obtain a token without interaction; suspicious visitors may see a checkbox.
   Invalid/expired/replayed/missing tokens must be rejected by **Supabase Auth**.
   This is provider-managed risk assessment, not a locally invented risk score.
2. Owner verifies Managed widget mode, allowed production hostnames, production
   keys, and CAPTCHA enforcement in Supabase's Bot and Abuse Protection settings.
   The private key stays in Supabase. Test-key success is never launch evidence.
3. Keep Supabase endpoint limits and monitor rejected requests, challenge failures
   and legitimate login success. Per-IP limits alone do not stop a distributed
   attack. Avoid permanent account locks triggered solely by unauthenticated
   failures: attackers could lock out real customers. Shared-IP users, mobile
   networks, VPNs, accessibility tools and slow connections belong in the tests.
4. No browser/device claim proves a human. Do not trust user-agent strings, a
   local `isHuman` flag, mouse movements or a client-provided risk score as a
   security boundary. Keep generic auth responses and mandatory admin AAL2.
5. Supabase's built-in leaked-password check requires Pro or higher. On the
   confirmed Free plan it is **unavailable**, not enabled by our strength meter.
   Do not send plaintext passwords or full password hashes to another service.
   An additional breach-screening service or API proxy needs a separate ADR,
   owner decision, origin-bypass analysis and review of its privacy/cost impact.
6. Verify in owner-controlled staging: direct Supabase login without CAPTCHA,
   forged/expired/replayed tokens, recovery/resend abuse, renewed-token retries,
   uniform known/unknown-account responses, rate-limit recovery and admin MFA.
   Any load exercise needs bounded staging traffic and a defined capacity target;
   do not attack production or claim that 10,000 bots were tested.

Sources checked 2026-10-18:
[Managed Turnstile](https://developers.cloudflare.com/turnstile/concepts/widget/),
[token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[password security](https://supabase.com/docs/guides/auth/password-security),
[OWASP credential stuffing](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html).

## Persistent content contract first (T-3.10c)

Extend the existing typed settings/RPC architecture with additive migrations,
not localStorage edits or direct table writes. Preserve public/private key
classification: payment credentials and approval-only QR instructions must never
be exposed through a public content query. Require admin AAL2, explicit grants,
bounded field validation and audit entries. Regenerate types and test pgTAP.

Allow both Arabic and English hero title/subtitle/badge/caption, a safe uploaded
hero image path, an optional active featured-product ID, and ordered active
category shortcut IDs. Add localized store/footer branding, informational-card
copy, policy link labels/order and full Terms/Privacy/Returns/Shipping/Contact
page content. Keep route destinations allow-listed. Contacts/social URLs use
validated fields, not arbitrary HTML, scripts or raw SQL. Use plain text with
paragraph breaks. Preserve existing saved content; never replace it with sample
business promises, phone numbers or invented policy/legal claims.

Save coherent content together and detect conflicting edits; refresh the public
query cache after saving. Avoid partially published bilingual edits. Enforce
length/type/reference checks on the server. Product price/stock remain live
catalogue data. Marketing copy must not claim a discount that does not exist.

## Content editor UI (T-3.10 and T-5.15)

- One shared edit form contract for Admin Settings and the homepage mouse-icon
  control; both persist through the audited RPC. Admin-role visibility alone
  does not authorize a write: the server must require AAL2.
- Show the current image with click-to-upload, safe JPEG/PNG/WebP validation,
  re-encoding and unique storage paths. Only clean up obsolete, unshared assets
  after a successful save. Featured-item selection searches existing products.
- Provide clear English/Arabic fields, a public preview, saved/unsaved/error
  states, and category add/remove/reorder controls. Keep catalogue browsing intact.
- Policies edited in Settings must appear on their full routed page, not just
  the homepage summary. Footer labels/branding/contact content must use the same
  saved contract. Validate on narrow screens, both themes, both languages.
- Cross-session persistence, customer/guest/AAL1 denial, malicious text/URL/image
  inputs, removed products, stale cache and conflicting saves are required tests.

## Motion control (T-3.11b)

Remove the hamburger control; retain the accessible bilingual footer selector.
Full/Reduced/Follow-device choices and their persistence remain unchanged. The
owner's word "hidden" means placed discreetly in the footer, not inaccessible.

## Upcoming occasions (T-9.14)

Reuse the existing calendar as the authoritative event source; do not create a
second set of hard-coded dates in the React component. Add an AAL2-only read API
and a bilingual upcoming-events view in Forecast. Include event date, days until
it, and a link to review affected products/promotions; use Cairo date boundaries.
Connect in-app admin reminders to the notification infrastructure, with a
configurable advance-notice window, deduplication and read/dismiss state. No
email, SMS or push service is assumed by this request.

Known dates can produce reminders before sales history exists. Label preliminary
or uncertain holiday dates honestly, handle year rollover and annually reviewed
Hijri dates. Do not invent a demand uplift or automatically change prices.
Statistical forecasts require readiness/backtest gates; an event reminder does
not lift the production forecasting hold. Test duplicate generation, two admins,
time boundaries, no-history behavior and unauthorized access.

## Implementation boundary

Update 2026-10-18: Docker is available and the owner has paused Anti-Gravity.
The isolated lolys-db-integration stack can run reset/test/type generation.
The persistent content editor and reminders above are **specified, not shipped**.
No hosted CAPTCHA configuration, leaked-password protection, database acceptance,
production forecast activation, main merge or deployment is claimed here.
