# Persistent storefront content contract

Task T-3.10c extends the existing settings architecture. The new public row is
`shop_settings.key = storefront_content`. It begins as `{}`, preserving the
existing storefront's fallback text and business policies. Payment instructions
remain separate/private. No hosted database has been changed.

The allowed fields are defined in `src/features/settings/content.ts` and enforced
by `20261018100000_storefront_content.sql`. Localized fields require both Arabic
and English, or neither. Policy bodies are plain text (12,000 characters maximum);
other copy is bounded to 500 characters. Image references must name an existing
JPEG/PNG/WebP object under a uniquely named `settings/hero-...` storage path.
Product/category choices must reference active records. Footer order must retain
all five allow-listed policy routes. Public contact links use approved social
hostnames, never user-supplied schemes or destinations.

`admin_update_storefront_content(content, expected_updated_at)` requires admin
AAL2 and saves the complete document in one transaction through the existing
audit trigger. Its return value is the new revision; NULL means another save has
already changed the document. Keep the local draft on conflict and offer an
explicit reload/reconciliation action. Never retry blindly using a newer token.

The admin API reads content with its revision, maps errors to AppError and reuses
the existing signature-check/re-encode/size-capped upload pipeline. It deliberately
does not delete an old image that another published record might reference.

Next slices: T-3.10 shared mouse-icon/Settings editor and live hero/category
rendering; T-5.15 full footer and policy rendering. Invalidate both public settings
and editor/audit queries after successful publication. A write must never depend
on an admin badge or browser-supplied role. Keep catalogue prices/stock live.
Use existing route-level lazy loading so the editor and its language copy do not
increase the already tight initial bundle budget. No notification or forecast
behavior is added by this contract.

Database validation: isolated reset and 560 pgTAP assertions passed, including
permission denial, bilingual coherence, bounded content, URL/image/reference
validation, conflict preservation, audit evidence and private-payment isolation.
The application verification result belongs in the shared progress log after the
full gate run completes.
