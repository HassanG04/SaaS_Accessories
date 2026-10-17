# Owner experience changes — 2026-10-17

This owner request extends the roadmap. Existing database authority, RLS, safe
uploads, audit logs and admin AAL2 requirements remain in force. Arabic and
English must both work. No production change is authorized by this document.

Latest extension (2026-10-18): see `store-controls-and-auth-abuse.md` for
adaptive login protection on the confirmed Supabase Free plan, persistent hero
and footer/policy controls, footer-only motion preferences and admin occasion
reminders. These additions have separate implementation/verification boundaries.

## Review slices

1. **T-5.13 — Admin usability:** full-width workspace; physically right-hand,
   collapsible desktop sidebar and accessible mobile drawer; remove duplicate
   quick actions; clicking a product thumbnail opens image selection using the
   existing validated/re-encoded upload pipeline; clip rounded table corners;
   render missing analytics as unavailable, never undefined/NaN.
   **T-5.13b — Review navigation:** link pending
   order cards to filtered orders; link order payment information to the matching
   payment review. Show outstanding payment review count to admins.
2. **T-3.10 — Storefront control:** replace the arch with an accessory/mug-friendly
   rounded image; an admin-only mouse-icon edit toggle exposes controls for hero
   image, showcased item, bilingual headline and promotional copy. Promotions
   must match actual discounts (no fixed 50% claim). Editable category shortcut
   list with add control; catalogue sections keep their existing behavior.
   Hover/focus enlarges the informational cards without clipping text.
3. **T-4.08 — Postal addresses:** owner correction: postal code is required,
   database `NOT NULL`, with non-empty/format validation, on complete saved
   delivery addresses and new immutable order address snapshots. It is not an
   optional field or limited to Egypt Post. Store as text, preserve leading zeros,
   show it to fulfilment staff, and preserve signup before address entry. Use
   additive expand/backfill/contract migrations; no fabricated codes, empty-string
   defaults, deleted records or rewritten historical facts. Missing legacy data
   must be resolved explicitly before the final constraint is claimed complete.
   Confirm the postal format from an authoritative source.
4. **T-2.10 — Customer updates:** hamburger My Orders link; in-app notification
   bell for a wishlisted product entering a sale, order approval and general
   sales. Wishlist data also informs admin demand. Customers can submit
   suggestions, visible to authorized admins. Notifications and suggestions
   require owner-scoped RLS, limits, tests and documented retention.
5. **T-2.11 — Profile photo:** user-owned storage path, safe image validation,
   re-encoding, size cap, access policies and replacement cleanup.
6. **T-5.14 — InstaPay:** approved recipient is `alaa.ahm9624@instapay`.
   The actual owner asset is `ip/ip.jpeg` (original request called it `ip.png`);
   reconcile its hash with historical decode evidence in `docs/handoff/DATABASE-INTEGRATION.md` and verify asset access before
   deploying it. Payment instructions remain private until order approval and
   come from the database. A screenshot marks an order under review, never paid;
   admin checks the actual transfer plus reference before confirming payment.
7. **T-2.06b — Session continuity:** owner confirmed keeping a verified session
   across reloads, with MFA after logout/fresh login and for sensitive actions.
   No local boolean bypass or trusted-device login is requested. Keep documented
   admin idle timeout; ordinary reloads must not re-enroll an authenticator.

## Motion and reset

### Owner-confirmed transactional baseline (2026-10-17)

The owner confirms testing of the complete order → approval → payment → shipping
flow, permissions, stock handling and database behavior. Treat that existing flow
as owner-confirmed; do not list it wholesale as untested. New changes need their
affected regression tests. This confirmation is not an invented automated-test
run, CI result, SMTP check, recovery rehearsal or blanket completion of all launch
tasks. Local Docker unavailability still limits verification of new schema work.

### Latest owner correction (2026-10-17; takes precedence)

The owner now requires English admin navigation on the left, Arabic on the right,
with matching header toggle and mobile slide direction. This overrides earlier
physical-right-in-both-languages wording below. Add visible storefront Admin
access for the resolved admin role; the separate mouse-icon homepage editor
still needs real persistent functionality. Sale ribbon and wishlist occupy
opposite logical edges. Fully translate policy pages and all other routes,
including body copy, validation, accessible names and errors.

The owner explicitly requests motion even when device animation settings are
off. Implement site modes Full (new default), Reduced and Follow device, with
one persisted policy for CSS/JS. A visitor's explicit Reduced mode must suppress
decorative motion; Follow device honors the OS. This replaces the earlier
OS-always-wins default without removing the visitor's ability to reduce motion.
See `docs/handoff/OWNER-FOLLOWUP-2026-10-17.md` for scope and acceptance tests.

### Explicit missed-feature handoff (2026-10-17)

The owner repeated the complete request and identified missing About Us effects
and admin slide transitions. T-3.10a prioritizes active HomePage visual repairs:
the rounded hero, truthful sale copy, bilingual informational cards, enabled-method
badges and hover/focus enlargement with visible section entry. T-5.13e adds admin
sidebar/drawer entry and exit, inner-page transitions, localized loading skeletons
and persistent-header behavior. These visual slices can proceed without Docker.
The persistent editor, postal code, notifications, suggestions and photos remain
separate unfinished data-backed tasks. See `HANDOVER_TO_ANTI_GRAVITY.md` for the
full ledger and exact acceptance criteria; no requirement is satisfied merely by
an unused component, a CSS class or a mocked test.

### Responsive follow-up (T-5.13c, 2026-10-17)

Keep the dashboard label and adjacent menu control on the physical right in
both languages. Admin content scrolls independently so the header remains
reachable on phones. Product visibility switches have a centered thumb, a
44px target and logical positioning. All users receive TikTok, Instagram and
WhatsApp community links in the hamburger menu; narrow views show named icons,
larger views show icons and text. Use only the owner-supplied destinations in
`SocialMenuLinks.tsx`. Add My Orders for signed-in users.
T-5.13d carries the component/browser regression evidence separately for review size.

The owner confirmed Windows Animation effects makes the existing motion visible.
Keep system reduced-motion support; do not silently override accessibility.
An explicit per-site preference can be considered separately if requested.

Prepare, but do not execute, owner SQL deleting all accounts and orders. It must
state that admins are included, identify storage/stock/analytics implications,
preserve audit history, avoid disabling triggers/RLS, and default to a rollback
preview. This is not a production migration or a storefront feature.

## Verification boundaries

Each slice needs its own evidence and status. A mocked UI test does not prove
hosted Supabase behavior. Database-dependent slices must await the local stack
if Docker remains unavailable; do not label them complete or ship untested
migrations. No owner task is completed by implication.
