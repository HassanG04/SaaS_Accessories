# Lolys' Accessories & Home: Engineering Roadmap (agent-ready)

| | |
|---|---|
| Project | Lolys' Accessories & Home: an Arabic-first (RTL) online shop for accessories and home items in Egypt |
| Version | 1.1, updated 2026-10-07 (v1.0 created 2026-10-06) |
| Audience | Autonomous coding agents (primary), the owner (reviewer and approver) |
| Specs | `docs/spec/security-model.md`, `error-codes.md`, `database-contract.md`, `design-system.md`, `analytics-plan.md` (Appendix E) |
| Inputs | `docs/Accessories_Store_Project_Plan.docx`, `docs/db/initial-sql/*.sql`, `docs/spec/*`, `docs/design/*` (H-01 to H-04) |

**Contents:** 0 Protocol | 1 Rules | 2 Project snapshot | 3 Stack, environments, pipeline | 4 Repository blueprint | 5 Roadmap (Phases 0 to 9) | Appendices A to G

---

## 0. Read this first (agent protocol)

This file is the single source of truth for scope, order and status. Do not rely on chat history. Do not read the whole file each session: read this section, section 1, the task that `roadmap:next` prints, and only the spec files that task cites (`docs/spec/`, Appendix E).

1. **Start:** fetch the latest `main`, run `npm ci` if `package-lock.json` changed, then run `npm run roadmap:next`. Until T-0.03 exists, do T-0.01, T-0.02, T-0.03 in order by hand.
2. **Work one task at a time** on a branch named `agent/<task-id>-<slug>`. Stay inside the task's scope.
3. **A task is done** only when every "Done when" item is true, the "Verify" commands pass locally, and `npm run verify` passes.
4. **In the same PR:** set the task to `done` (`npm run roadmap -- set T-x.yy done`), add a row to the Work log (Appendix G), update docs if behaviour changed.
5. **Open a PR** using the template (Appendix C) and stop. You never merge to `main`.
6. **If blocked or unsure:** do not guess. Follow the stop rules (1.5), write the question in Appendix G, and continue with the next unblocked task or end the session.
7. **`owner: human` tasks are not yours.** Prepare what you can (runbook, workflow file) and skip them.
8. **Missing human input (H-xx)?** Use the documented placeholder, leave a `TODO(H-xx)` comment, and continue.
9. **Open decisions (O-xx)** are never blockers: use the stated default and log that you did.
10. **Security-sensitive work** (auth, MFA, RLS, migrations, payments, admin, workflows, headers) follows `docs/spec/security-model.md`. Name the SEC-xx controls you touched in the PR; the owner reviews these PRs.

---

## 1. Rules

### 1.1 Non-negotiables

1. **RLS on every table** in `public`. Never disable it or add a policy broader than this roadmap states. Every new table ships with RLS, explicit grants and a pgTAP test.
2. **The browser never decides** prices, totals, fees, stock, roles or payment status. Orders are created only by `place_order()`; payments are confirmed only by an admin through `admin_review_payment()`.
3. **No raw SQL reachable by any user, ever.** No SQL console or query box in any UI. No dynamic SQL built by joining strings (use `format('%I', ...)`, `%L` or `USING` if unavoidable; `check:sql` blocks the rest). Admin edits use typed forms that call allow-listed updates or `rpc` functions.
4. **Admin power needs two factors.** Every admin policy and function requires an `aal2` session (MFA verified), checked in the database. Admins are created only by the owner with SQL; the UI never creates, promotes or demotes anyone.
5. **Auth messages are generic.** Never reveal whether an email exists or which field was wrong. Same wording and same behaviour for every login failure (AUTH-001) and for every sign-up, reset and resend (AUTH-010).
6. **No secrets** in the repo, logs, PR text or the built site. The Supabase secret (service-role) key is never used in `src/`, CI or analytics. Only the public key is in the browser. Local test scripts may use the local stack's key.
7. **Never read or print `.env*` values.** `.env.example` holds names only.
8. **Migrations are append-only** (1.3).
9. **Users never see raw error text.** Every failure shows an Arabic message plus a code from `docs/spec/error-codes.md` (and a reference id for unexpected errors). Details stay in logs.
10. **Uploads:** images only (JPEG, PNG, WebP; never SVG or HTML), size-capped, renamed, re-encoded in the browser. Payment proofs live in a private bucket.
11. **Do not weaken or delete tests, CI checks or security controls** to get green. Fix the cause or ask.
12. **Collect only name, phone and delivery location details.** No national ID numbers. Analytics never sees personal data.
13. **Production is the owner's.** No `supabase db push` or `--linked` command against staging or production from an agent session. Deployment workflows are triggered by the human.

### 1.2 Permissions

| Level | Actions |
|---|---|
| **Allowed** | Create or edit files inside the task's scope; add tests; run local commands; add small dev-only helper scripts; refactor inside touched files; update roadmap status and work log; open PRs |
| **Ask first** (log in Appendix G, pause that task) | Add or replace a dependency not listed in 3.1; change auth, session, MFA or error-mapping behaviour; change the DB schema beyond this roadmap; change design tokens or brand rules; add an external service; change CI gates; add a top-level folder; touch any **security-sensitive path** (`supabase/migrations/**`, `src/features/auth/**`, `src/features/admin/**`, `.github/workflows/**`, `public/_headers`, `docs/spec/security-model.md`), which also needs owner review |
| **Never** | Push to `main`; merge PRs; edit a merged migration; commit secrets; disable RLS; run anything against staging or production; change GitHub, Cloudflare or Supabase dashboard settings |

### 1.3 Migration rules

- Create with `supabase migration new <snake_case_name>`. After a migration is merged to `main` it is never edited, deleted or renamed (CI blocks it, T-1.09).
- **Expand, migrate, contract.** Additive change in one PR; app code that uses it in a later PR; removal of old columns or code in a third PR, after nothing uses them.
- Every migration: RLS for new tables; explicit `grant` and `revoke` (start from zero); `security definer` functions set `search_path = public`; revoke `execute` from `public` and `anon` unless intended; pgTAP tests in the same PR; regenerate types.
- Check locally with `npm run db:reset && npm run db:test && npm run db:types`.
- No secrets and no real customer data in migrations or seed.

### 1.4 Code conventions

- TypeScript strict. No `any` (use `unknown` and narrow). No non-null `!` outside tests.
- Feature folders: `src/features/<name>/{api,components,hooks}`. Shared UI in `src/components/ui`. **No Supabase calls inside components**: only in `features/*/api.ts` or `src/lib`.
- Server state through TanStack Query (one `keys.ts` per feature). Global client state is only auth, cart, theme and language (ADR-0002).
- Forms: React Hook Form + Zod. Allow-list fields: a form sends only the fields its entity allows (`docs/spec/security-model.md` section 6).
- **Arabic first:** every string through i18n (`src/i18n/ar.json` and `en.json`, ADR-0002), language-dependent HTML lang/dir (Arabic RTL, English LTR), fonts self-hosted, Western digits. Phone numbers, emails, order numbers and codes render in `dir="ltr"` spans.
- **Errors:** only through `AppError` (`src/lib/errors.ts`). Show the Arabic message and its code. Never render `error.message`.
- **No HTML injection:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`. Descriptions are plain text. Image URLs come only from storage paths.
- Styling: Tailwind v4 utilities and tokens from `src/styles/tokens.css`. No hard-coded colors, radii or shadows. **Logical properties only** (`ms-`, `me-`, `ps-`, `pe-`, `text-start`).
- Money: format only with `formatEGP()` in `src/lib/format.ts`. The server is authoritative; client totals are estimates and labelled so.
- Accessibility: semantic HTML, labelled controls, visible focus, touch targets of 44px or more, WCAG AA contrast in both themes, `prefers-reduced-motion` respected.
- Tests sit next to the code (`*.test.ts(x)`). Test behaviour, mock only the network boundary (`src/lib/supabase`).
- No `console.log` in committed app code. CSV exports neutralise formulas.

### 1.5 Stop rules

Stop the task, record it in Appendix G, and move on when any of these is true:

- You need credentials or dashboard access.
- Docker or the local Supabase stack is unavailable.
- A requirement conflicts with a non-negotiable or with another task's criteria.
- The same failure persists after 3 distinct fix attempts.
- The change grows past about 400 changed lines (excluding generated files and copied SQL): split the task (add `T-x.yyb`) and say so in the PR.
- A product decision is unclear and has no default in 2.3.

### 1.6 Definition of done (every task)

- [ ] Every "Done when" item is true and every "Verify" command passed.
- [ ] `npm run verify` passes (lint, typecheck, unit tests, build).
- [ ] Tests added or updated; DB changes include pgTAP tests; types regenerated.
- [ ] UI work checked in light and dark, at 360px and 1280px, in LTR and RTL.
- [ ] No secrets, no `.env` content, no stray `console.log`, no `TODO` without a task or H-xx id.
- [ ] Roadmap status and Work log updated; docs or ADR updated if behaviour or a decision changed.
- [ ] Security-sensitive paths: the PR names the SEC-xx controls touched and has owner review.
- [ ] CI is green on the PR.

### 1.7 Git and PR conventions

- Branch `agent/T-1.02-migrations`. Commits follow Conventional Commits: `feat(db): add orders table`. Types: `feat fix test docs chore ci refactor perf`. Scopes: `db app ui auth cart checkout orders admin dashboard i18n ci docs`.
- PR title: `T-1.02: Convert SQL files into migrations`. PR body from Appendix C. Keep PRs small.
- The human squash-merges after CI is green, then the branch is deleted.

---

## 2. Project snapshot

### 2.1 Product

Visitors browse accessories by category, see stock status and fill a cart. Logged-in customers check out with cash on delivery and choose Egypt Post or the shop's representative. Admins manage products, stock, categories, orders and delivery fees, and watch revenue on a dashboard.

### 2.2 Locked decisions (change only through an ADR)

| ID | Decision |
|---|---|
| D-01 | Static single-page app (React + Vite) on Cloudflare Pages. No custom server. |
| D-02 | Supabase provides Postgres, Auth and Storage. Security is RLS plus `SECURITY DEFINER` functions. |
| D-03 | Roles `customer` and `admin`. Admins are created only by owner SQL; the UI can never create or promote one. Admin access requires MFA (`aal2`), enforced by the database. |
| D-04 | Orders only through `place_order()`. The server computes prices, fee and total and reserves stock; cancelling restocks. |
| D-05 | Payment: cash on delivery and InstaPay QR (customer uploads proof, an admin verifies). Each can be switched on or off in settings. Unpaid InstaPay orders expire (default 24 h) and restock. |
| D-06 | Delivery methods `egypt_post` and `representative`. Availability and fee per governorate in `delivery_fees`; no row means not available. |
| D-07 | Revenue = delivered orders. Booked = non-cancelled orders. Reporting days use `Africa/Cairo`. |
| D-08 | Environments: local (Supabase CLI), staging (second Supabase project), production. |
| D-09 | Design: the Lolys' brand (pink, cocoa brown, cream, gold) from the logo, with Shop-style pill controls and rounded image-first cards; light theme and "cocoa night" dark theme (`docs/spec/design-system.md`). |
| D-10 | Arabic-first interface with English support (ADR-0002 / OD-003). Saved language overrides device language; Arabic uses RTL, English LTR. Catalogue errors remain Arabic. |
| D-11 | Currency EGP; money is `numeric(10,2)`; Western digits. |
| D-12 | No raw SQL reachable by users: no SQL box in any UI, no dynamic SQL built by string joins. Admin edits use typed forms with allow-lists. |
| D-13 | Auth messages are generic and identical for known and unknown accounts. Cloudflare Turnstile protects sign-in, sign-up and reset. |
| D-14 | Every visible error has a code `AREA-NNN` and an Arabic message (`docs/spec/error-codes.md`); database errors carry the code in `hint`. |
| D-15 | Sensitive admin changes go to an append-only `audit_log`. |
| D-16 | Uploads: images only (no SVG), size-capped, re-encoded in the browser; payment proofs are private. |
| D-17 | Analytics: a scheduled Python job with least-privilege database roles, no personal data and no secret key. Forecasts are stored in the database and shown to the admin (`docs/spec/analytics-plan.md`). |
| D-18 | Development and staging use free tiers. The production plan tier is open decision O-11 (recommended: a paid Supabase plan, because real money and customer data are involved). |

### 2.3 Open decisions (use the default until the owner decides)

| ID | Decision | Default |
|---|---|---|
| O-02 | Arabic wording of the shop name for titles and text | Use the logo image and the Latin name "Lolys' Accessories & Home". |
| O-03 | Delivery fees and representative coverage | Nothing seeded. Dev data only. |
| O-04 | Auth email delivery | **Launch blocker.** Supabase's built-in email sender is limited to 2 emails per hour, so custom SMTP is required before launch (T-8.01, T-8.02). |
| O-05 | Email confirmation | On in production, and it must stay on so "Secure email change" asks both addresses. Off locally. |
| O-06 | Pending-order limit and InstaPay payment window | 3 pending orders per customer; 24 hours. |
| O-07 | Returns policy text (Arabic) | Placeholder paragraph. |
| O-08 | Custom domain | Use the `*.pages.dev` address. |
| O-09 | Error and uptime monitoring | External uptime check only; no client error upload at launch (decided in T-8.07). |
| O-10 | Pre-rendering for SEO | Not at launch. |
| O-11 | Supabase plan at launch | Recommended: a paid plan (backups, no pausing). Free tier for local, staging and development. |
| O-12 | InstaPay details: QR images, InstaPay address, who verifies and how fast | Placeholder QR; an admin verifies within 24 hours. |
| O-13 | Customer two-factor login | Optional and encouraged; mandatory only for admins. |
| O-14 | Data retention | Payment proofs deleted 90 days after delivery; audit log kept 2 years. The owner confirms with a legal professional. |
| O-15 | Brand color "simone" | Read as the cream/champagne shade from the logo. The owner confirms. |
| O-16 | Staff accounts with limited rights | Not at launch. |
| O-17 | Address form of the Arabic copy | Neutral or masculine imperatives; switch to feminine in one pass if the owner prefers. |

### 2.4 Human inputs (placeholders are used until provided)

| ID | Input | Where it goes |
|---|---|---|
| H-01 | The Shop style reference document (structure reference only) | `docs/design/shop-style-reference.md` |
| H-02 | The earlier frontend demo (visual prototype, not production code) | `docs/design/demo/` |
| H-03 | The Word plan, the six tested SQL files and the five spec files | `docs/Accessories_Store_Project_Plan.docx`, `docs/db/initial-sql/01_schema.sql` to `06_storage.sql`, `docs/spec/*.md` |
| H-04 | Logo files: the supplied PNG now; a transparent PNG or SVG and a square icon later | `docs/design/brand/` and `public/brand/` |
| H-05 | Real delivery fees: governorate x method | entered through the admin screen or runbook |
| H-06 | Product and category photos (WebP, about 200 KB each) | uploaded through the admin screen |
| H-07 | Accounts: GitHub repo, two Supabase projects, Cloudflare Pages project, Cloudflare Turnstile widget, SMTP provider | owner |
| H-08 | Docker installed on the development machine | owner |
| H-09 | Owner's GitHub username (for CODEOWNERS) | `.github/CODEOWNERS` |
| H-10 | InstaPay QR image(s) and the InstaPay address | uploaded through admin settings; placeholder until then |
| H-11 | Native-speaker review of the Arabic copy | `src/i18n/ar.json` (T-7.01) |
| H-12 | Privacy policy, terms and returns text, reviewed by a legal professional | Arabic pages (T-7.11) |
| H-13 | Authenticator app on the owner's phone, plus a second device for each admin | admin onboarding (T-8.09) |

### 2.5 Non-goals before launch

Online card payments, coupons or loyalty, product variants (sizes, colors), customer reviews, order e-mail notifications, native apps, staff roles, multi-currency, personalised recommendations, price optimisation.

---

## 3. Stack, environments, pipeline

### 3.1 Stack

Use the current stable major of each tool at project start. Record exact versions in `docs/adr/0001-stack.md`. Never bump a major version without an ADR.

| Concern | Choice |
|---|---|
| Language, tooling | TypeScript (strict), Node LTS pinned in `.nvmrc`, npm |
| Build, UI | Vite, React, Tailwind CSS v4, in-house UI kit (`src/components/ui`) |
| Fonts | Cairo (UI and body), optionally Aref Ruqaa (display accent); self-hosted woff2 |
| Routing, server state | React Router, TanStack Query |
| Forms, validation | React Hook Form, Zod |
| i18n | i18next, react-i18next (Arabic only at launch) |
| Backend client | `@supabase/supabase-js`; Supabase CLI for local stack, migrations, types and DB tests |
| Auth hardening | Supabase Auth with TOTP MFA (`aal2` enforced in the database); Cloudflare Turnstile CAPTCHA |
| Charts | Recharts, lazy-loaded in the admin chunk only |
| Tests | Vitest + Testing Library; Playwright + `@axe-core/playwright`; pgTAP through `supabase test db`; pytest for analytics |
| Quality | ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier; ruff for Python |
| Security tooling | Semgrep (OSS rules), gitleaks, OWASP ZAP baseline, Dependabot, `npm audit`; owner-run Claude Security scans in Claude Code |
| Analytics | Python 3.12; pandas or polars; Nixtla `statsforecast`; scikit-learn; LightGBM (optional, gated by ADR) |
| CI, hosting | GitHub Actions; Cloudflare Pages (Git integration) |

### 3.2 Environments and secrets

| Environment | Frontend | Supabase | Database changes applied by | Data |
|---|---|---|---|---|
| local | `npm run dev` (Vite) | `supabase start` (Docker) | the agent, with `db:reset` | seed and test data |
| staging | Cloudflare Pages preview deployments (PR branches) | project #2 | `db-staging.yml` on merge to `main` | fake and synthetic data only |
| production | Cloudflare Pages production branch `main` | project #1 | the owner, by running `db-production.yml` | real data |

| Secret | Lives in | Who may see it |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public key), `VITE_TURNSTILE_SITE_KEY` (public) | Cloudflare Pages env (Preview = staging, Production = production); `.env.local` locally | anyone (public by design; protected by RLS) |
| `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`, `PRODUCTION_PROJECT_REF`, `PRODUCTION_DB_PASSWORD` | GitHub Actions secrets | the owner only, never an agent |
| `ANALYTICS_DB_URL_STAGING`, `ANALYTICS_DB_URL_PRODUCTION` (restricted analytics roles) | GitHub Actions secrets | the owner only |
| Turnstile secret key, SMTP credentials | Supabase dashboard only | the owner only |
| Service-role (secret) key | nowhere; this project never needs it | no one |

### 3.3 Pipeline

| Job or workflow | Trigger | What it does | Blocks merge |
|---|---|---|---|
| `static` | PR, `main` | `npm ci`, `lint`, `format:check`, `typecheck`, `check:i18n` | yes |
| `unit` | PR, `main` | `test:unit` with coverage thresholds (80% on `src/lib`) | yes |
| `build` | PR, `main` | `build`, `check:bundle`, `check:secrets` (repo and `dist/`) | yes |
| `roadmap` | PR, `main` | `roadmap:check` | yes |
| `secrets` | PR, `main` | gitleaks on the diff and history | yes (from T-0.12) |
| `db` | PR touching `supabase/**` or `src/types/**`; `main` | Supabase CLI via `supabase/setup-cli@v1`, `supabase start`, `db reset`, `supabase test db`, concurrency script, regenerate types and fail on diff, `check:migrations`, `check:sql` | yes (from T-1.09) |
| `e2e` | PR touching `src/**`, `e2e/**`, `supabase/**` | local stack, build, `vite preview`, Playwright, axe, security suite | yes (from T-4.07) |
| `sast` | PR, `main` | Semgrep with the project rules | yes (from T-7.06) |
| `analytics` | PR touching `analytics/**` | ruff, pytest | yes (from T-9.02) |
| `audit` | PR, weekly | `npm audit --audit-level=high --omit=dev`; Dependabot alerts | high and critical only |
| `forecast.yml` | weekly, manual | Python forecast job (T-9.08) | n/a |
| `zap.yml` | weekly, manual | OWASP ZAP baseline against staging (T-7.07) | n/a (findings are triaged) |
| `db-staging.yml` | push to `main` touching `supabase/migrations/**` | link staging, `supabase db push` | n/a |
| `db-production.yml` | `workflow_dispatch` only, input must be `PRODUCTION` | link production, `supabase db push` | n/a |
| Cloudflare Pages | Git integration | build command `npm run build`, output `dist`; production branch `main`; preview deployment per PR | n/a |

Workflow hardening: `permissions: contents: read` by default; pin third-party actions to a full commit SHA; cancel superseded runs on PRs; never echo secrets.

**Owner gate:** for PRs that touch security-sensitive paths, the owner runs the Claude Security skill ("Scan changes") in Claude Code before merging (T-7.09).

### 3.4 Release order

1. **DB change:** its own PR (additive migration + pgTAP tests). Merge, staging applies it automatically, the owner runs `db-production.yml`.
2. **App change** that uses it: separate PR. Merge, Cloudflare deploys.
3. **Cleanup** of old columns or code: later PR.
4. App-only changes: PR, check the preview URL, merge.
5. **Rollback:** app = redeploy the previous Cloudflare deployment (owner). Database = forward-fix migration, no down migrations. Before any production DB push the owner takes a backup (T-8.06).

---

## 4. Repository blueprint

```
lolys-store/
|-- AGENTS.md                    canonical agent instructions (short)
|-- CLAUDE.md                    one line: @AGENTS.md
|-- roadmap.md                   this file
|-- SECURITY.md  README.md  package.json  index.html  vite.config.ts  tsconfig*.json
|-- .nvmrc  .editorconfig  .gitignore  .env.example  .semgrep/
|-- .github/
|   |-- CODEOWNERS  dependabot.yml  pull_request_template.md
|   '-- workflows/               ci.yml  db-staging.yml  db-production.yml
|                                forecast.yml  zap.yml  keepalive.yml
|-- docs/
|   |-- spec/                    security-model  error-codes  database-contract
|   |                            design-system  analytics-plan
|   |-- adr/                     0000-template.md  0001-stack.md ...
|   |-- runbooks/                local-dev  first-admin  delivery-fees  deploy-db  auth-email
|   |                            auth-hardening  admin-onboarding  incident-response  backup-restore
|   |                            monitoring  data-requests  dependencies  analytics  weekly
|   |-- analytics/               model-card.md
|   |-- design/                  shop-style-reference.md  demo/  brand/
|   |-- db/initial-sql/          01_schema.sql ... 06_storage.sql (read-only originals)
|   |-- Accessories_Store_Project_Plan.docx
|   |-- security-review.md  launch-checklist.md  perf-report.md
|-- analytics/                   Python project (see docs/spec/analytics-plan.md)
|-- e2e/                         Playwright specs, security suite, global setup
|-- perf/                        k6 load scripts (staging only)
|-- public/                      brand/ placeholders/ fonts/ _headers robots.txt .well-known/security.txt
|-- scripts/                     roadmap.mjs  check-secrets  check-bundle  check-migrations
|                                check-i18n  check-sql
|-- supabase/
|   |-- config.toml  seed.sql
|   |-- migrations/              timestamped, append-only
|   '-- tests/                   database/*.test.sql  concurrency.sh
'-- src/
    |-- main.tsx  App.tsx  routes.tsx
    |-- lib/                     env  supabase  format  errors  step-up  cart storage
    |-- i18n/                    ar.json  index.ts
    |-- types/                   database.types.ts (generated)  index.ts
    |-- styles/                  tokens.css  index.css
    |-- components/ui/           Button  Pill  Card  Input  Dialog  Toast  Skeleton  ornaments/
    |-- components/layout/       Navbar  Footer  Layout
    '-- features/
        |-- auth/  catalog/  cart/  checkout/  orders/  account/  payments/
        '-- admin/               products  categories  orders  payments  customers  delivery
                                 settings  audit  dashboard  forecast  analytics
```

---

## 5. Roadmap

Task format and the tool that reads it are defined in Appendix A. Status values: `todo`, `doing`, `done`, `blocked`, `skip`.

| Phase | Goal | Exit criteria |
|---|---|---|
| 0 Foundations | Repo, tooling, CI, brand design system, security basics | PR gets green CI and a preview URL; kit page renders in both themes; secret scanning on |
| 1 Database | Verified schema as migrations, security hardening, payments, tests, deploy workflows | `supabase test db` green in CI; admin needs `aal2`; staging receives migrations |
| 2 App shell | Routing, Arabic layout, auth, MFA, error framework | A user can register, log in and see their role; an admin is forced through MFA |
| 3 Storefront | Home, category, product, cart, search | A guest can browse and fill a cart on a phone, in Arabic |
| 4 Checkout and orders | Location form, COD and InstaPay QR, my orders, account | Both payment paths work end to end; stock decreases; e2e green |
| 5 Admin | Full control of catalogue, orders, payments, settings, audit, exports | The admin runs the shop without SQL |
| 6 Dashboard | Revenue and operations dashboard | KPIs, charts, low stock visible |
| 7 Quality and security hardening | Arabic review, accessibility, performance, security tests and scans, legal | Budgets met; axe clean; security review and scans done |
| 8 Launch | Production setup, monitoring, runbooks, soft launch | Real test orders succeed on phones; admins enrolled on two devices |
| 9 AI analytics | Forecasting and analysis | Weekly forecast job runs; the admin sees forecasts, reorder advice and analyses |

### Phase 0: Foundations

#### T-0.01: Bootstrap the repository
`status: done` `owner: agent` `needs: none` `size: S`
- **Do:** Create the Vite + React + TypeScript (strict) project with npm. Add the folder skeleton from section 4, `.nvmrc` (current Node LTS), `.editorconfig`, `.gitignore` (ignore `.env*` except `.env.example`, `dist`, `coverage`, `playwright-report`, `supabase/.temp`), `.env.example` (names only) and a README with run instructions.
- **Done when:** `npm ci && npm run dev` serves a blank page; `npm run build` passes; the repo contains no secrets.
- **Verify:** `npm ci && npm run build`

#### T-0.02: Quality tooling
`status: done` `owner: agent` `needs: T-0.01` `size: M`
- **Do:** Add ESLint (flat config: typescript-eslint, react-hooks, jsx-a11y), Prettier, Vitest + Testing Library + jsdom, the `@/` path alias, and the npm scripts from Appendix F (stub those that depend on later tasks). Add one sample test.
- **Done when:** `lint`, `format:check`, `typecheck`, `test:unit` and `verify` all pass on the skeleton.
- **Verify:** `npm run verify`

#### T-0.03: Roadmap tool
`status: done` `owner: agent` `needs: T-0.01` `size: M`
- **Do:** Write `scripts/roadmap.mjs` (Node only, no dependencies) implementing Appendix A: `status`, `next`, `check`, `set <id> <status>`. Add npm scripts `roadmap`, `roadmap:next`, `roadmap:check`. Add parser tests with small fixtures.
- **Done when:** `roadmap:check` passes on this file and fails on fixtures with a duplicate ID, an unknown dependency, a cycle and a bad status; `roadmap:next` prints the first `todo` agent task whose needs are all `done` or `skip`.
- **Verify:** `npm run roadmap:check && npm run roadmap:next`

#### T-0.04: Agent instruction files
`status: done` `owner: agent` `needs: T-0.03` `size: S`
- **Do:** Create `AGENTS.md` from Appendix B (canonical, under 200 lines) and a `CLAUDE.md` containing the single line `@AGENTS.md`. (Claude Code reads `CLAUDE.md`, not `AGENTS.md`, and a `CLAUDE.md` can import another file with `@path`.)
- **Done when:** both files exist; `AGENTS.md` lists commands and hard rules and points to `roadmap.md` instead of copying it.
- **Verify:** `wc -l AGENTS.md` shows 200 or fewer

#### T-0.05: PR, ADR and runbook templates
`status: done` `owner: agent` `needs: T-0.01` `size: S`
- **Do:** Add `.github/pull_request_template.md` (Appendix C), `docs/adr/0000-template.md` (Appendix D), `docs/adr/0001-stack.md` recording section 3.1 with the exact installed versions, and `docs/runbooks/README.md` listing the planned runbooks.
- **Done when:** the files exist and ADR-0001 lists real versions from `package.json`.
- **Verify:** manual review

#### T-0.06: CI v1
`status: done` `owner: agent` `needs: T-0.02, T-0.03` `size: M`
- **Do:** Add `.github/workflows/ci.yml` with jobs `static`, `unit`, `build`, `roadmap` per section 3.3. Use `permissions: contents: read`, a concurrency group per ref (cancel in-progress on PRs), npm cache, Node version from `.nvmrc`, actions pinned to full SHAs.
- **Done when:** a test PR shows all four jobs green, and a deliberately broken lint rule turns `static` red (then revert).
- **Verify:** open the PR and read the checks

#### T-0.07: Brand tokens and self-hosted fonts
`status: done` `owner: agent` `needs: T-0.02` `size: M`
- **Do:** Implement `docs/spec/design-system.md` in `src/styles/tokens.css` (Tailwind v4 `@theme`): the Lolys' light theme (cream, blush pink, cocoa brown, gold) and the "cocoa night" dark theme keyed on `[data-theme=dark]`. Self-host the fonts (woff2, no third-party font requests) with their licenses. Set `<html lang="ar" dir="rtl">`. Theme behavior is split into T-0.07b to keep each review near 400 authored lines; the original requirements are preserved across both tasks.
- **Done when:** a unit test recomputes every published contrast pair from the tokens and meets the ratios in the spec; typography, shape and focus tokens match the spec; no external font or script requests.
- **Verify:** `npm run test:unit`

#### T-0.07b: Persistent and accessible theme switching
`status: done` `owner: agent` `needs: T-0.07` `size: M`
- **Do:** Complete the behavior split from T-0.07: add `ThemeProvider`, `useTheme` and an accessible Arabic theme toggle. Use localStorage key `theme`, default to `prefers-color-scheme`, and initialize the theme inline before first paint. Preserve operation if browser storage is unavailable and keep the selected theme consistent with system changes.
- **Done when:** the toggle works with pointer and keyboard, persists, restores without a wrong-theme flash, and respects the documented 44px target/focus/contrast requirements; both themes pass at 360px and 1280px in RTL and LTR. Tests cover stored, system and unavailable-storage cases.
- **Verify:** `npm run test:unit`

#### T-0.08: UI actions and cards
`status: done` `owner: agent` `needs: T-0.07b` `size: M`
- **Do:** Build RTL-first Button (cocoa primary pill, blush secondary pill, ghost, danger), IconButton and Card (28px radius, soft shadow, 20px inner image radius and 8px frame) per `docs/spec/design-system.md`. Start the dev-only `/__kit` route with both themes and LTR/RTL samples, excluded from production builds. Split the original UI kit across T-0.08b through T-0.08e under the 400-line review rule; retain every original requirement.
- **Done when:** buttons support keyboard activation and native disabled/form behavior; icon actions have accessible names and mirror only directional artwork; 44px targets and focus outlines are retained; every component has a test; cards respect reduced motion; no hard-coded colors, radii or shadows outside tokens. Both themes checked at 360/1280 in RTL/LTR.
- **Verify:** `npm run verify`

#### T-0.08b: UI text and search fields
`status: done` `owner: agent` `needs: T-0.08` `size: M`
- **Do:** Continue the UI kit per `docs/spec/design-system.md`: Input and SearchInput (pill with round submit), Select and Textarea. Extend `/__kit` with labelled Arabic examples, error/disabled states and both directions/themes. Checkbox/Radio are split into T-0.08f under the review-size rule; no requirements removed.
- **Done when:** every component has behavior tests; labels never rely on placeholders; errors are accessible; controls have 44px targets and visible focus; tokens/logical styling and reduced motion are preserved.
- **Verify:** `npm run verify`

#### T-0.08f: UI choice controls
`status: done` `owner: agent` `needs: T-0.08b` `size: S`
- **Do:** Complete the form-control inventory split from T-0.08b: labelled Checkbox and Radio, Arabic examples in `/__kit`, disabled and checked states, unique radio groups in repeated previews. Follow `docs/spec/design-system.md`.
- **Done when:** label activation, Space/arrow navigation, disabled behavior and group isolation have tests; selection includes a non-color mark; controls have 44px targets and visible focus in both directions/themes, with documented tokens only.
- **Verify:** `npm run verify`

#### T-0.08c: UI feedback and navigation
`status: done` `owner: agent` `needs: T-0.08f` `size: M`
- **Do:** Continue the UI kit: Toast and Tabs per `docs/spec/design-system.md`. Extend `/__kit` with Arabic examples in both themes and directions. Dialog is split into T-0.08g to keep reviews small.
- **Done when:** every component has behavior tests; tabs have unique relationships and keyboard navigation in both directions; feedback is accessible; controls have 44px targets and focus outlines; tokens and reduced motion are preserved.
- **Verify:** `npm run verify`

#### T-0.08g: Accessible dialogs
`status: done` `owner: agent` `needs: T-0.08c` `size: M`
- **Do:** Complete the dialog split from T-0.08c per `docs/spec/design-system.md`; add an Arabic `/__kit` example in both themes and directions.
- **Done when:** dialog naming, focus containment/restoration, controlled open/close and Escape work; behavior tests pass; controls have 44px targets and focus outlines; tokens and reduced motion are preserved.
- **Verify:** `npm run verify`

#### T-0.08d: UI labels and brand ornaments
`status: done` `owner: agent` `needs: T-0.08g` `size: M`
- **Do:** Finish the component inventory with Pill/Chip, Badge, Skeleton and SVG ornaments using `currentColor`: ribbon bow, ribbon divider, sparkle, pearl loader and arch frame. Follow `docs/spec/design-system.md` and add every example to `/__kit`.
- **Done when:** each component has a test; states include text or icons, not color alone; ornaments follow themes; animations stop under reduced motion; arch/card/image shapes use the documented tokens.
- **Verify:** `npm run verify`

#### T-0.08e: UI kit token guard and final verification
`status: done` `owner: agent` `needs: T-0.08d` `size: M`
- **Do:** Complete the original UI-kit acceptance gate: add a grep-based token check to `verify`, test rejection of hard-coded colors/radii/shadows, and verify `/__kit` contains the full inventory in both themes and an LTR sample while remaining excluded from production builds.
- **Done when:** token guard fails on negative fixtures and passes the repo; all components have tests; the full kit passes keyboard, 44px target, focus, direction icon and reduced-motion checks at 360/1280 in RTL/LTR and both themes; production artifacts exclude kit code/assets/copy.
- **Verify:** `npm run verify`

#### T-0.08h: Bilingual interface and production dictionaries
`status: done` `owner: agent` `needs: T-0.08d` `size: M`
- **Do:** Review the owner-requested Arabic/English implementation recorded in OD-003; document ADR-0002, use the existing accessible Button for the language switch, and keep preview copy out of production. Language changes must not alter catalogue error/authentication rules. Persistence and detailed verification are split into T-0.08i under the review-size rule.
- **Done when:** shipped controls and previews switch language/direction; labels identify the destination language; tokens/focus/44px requirements hold; production excludes preview code/copy/assets; both themes/directions pass at 360/1280. Incoming source and history preserved.
- **Verify:** `npm run verify`

#### T-0.08i: Language preference behavior and verification
`status: done` `owner: agent` `needs: T-0.08h` `size: S`
- **Do:** Complete ADR-0002 behavior checks for device selection, valid/invalid saved choices, blocked storage, keyboard switching, translated labels and document direction before paint. Verify dictionary key parity and unchanged Arabic catalogue-error previews. Retain the existing theme preference independently.
- **Done when:** behavior tests and full verification pass; UI language/direction and focus match both themes at 360/1280, including reduced motion; production preview exclusion still passes.
- **Verify:** `npm run verify`

#### T-0.08j: Compact authentication form preview
`status: done` `owner: agent` `needs: T-0.08i` `size: S`
- **Do:** Polish the development UI-kit login/register preview with centered panels capped at the documented readable form width. Keep fields full width inside their panel, stack them on narrow screens, and place the two panels side by side only when the viewport allows. Use existing tokens, labels, focus behavior and both language directions.
- **Done when:** login and registration previews no longer stretch across the page; fields remain readable and full width within each panel; mobile layout remains usable; tests and production preview exclusion pass.
- **Verify:** `npm run verify`

#### T-0.09: Repo guards
`status: done` `owner: agent` `needs: T-0.06` `size: M`
- **Do:** Write `scripts/check-secrets.mjs`: scan tracked files and `dist/`; fail on any JWT whose decoded payload has `role: service_role`, on `sb_secret_` keys, and on `service_role` strings outside an allowlist of docs and tests (the public anon key may appear in `dist/`). Write `scripts/check-bundle.mjs`: gzip budget for initial route JS of 200 KB or less, admin chunk separate. Wire both into the `build` job.
- **Done when:** a planted fake secret makes the script fail; a budget breach is shown once, then reverted.
- **Verify:** `npm run check:secrets && npm run build && npm run check:bundle`

#### T-0.10: Protect main
`status: done` `owner: human` `needs: T-0.06` `size: S`
- **Do:** In GitHub settings require PRs and passing checks (`static`, `unit`, `build`, `roadmap`; add `secrets`, `db`, `e2e`, `sast` and `analytics` when they exist), squash merge only, no force-push, delete merged branches.
- **Done when:** a direct push to `main` is rejected.
- **Verify:** attempt a push to `main`

#### T-0.11: Cloudflare Pages project
`status: done` `owner: human` `needs: T-0.06` `size: S`
- **Do:** Create the Pages project from the GitHub repo (Git integration): framework preset Vite, build command `npm run build`, output directory `dist`, production branch `main`, preview deployments on. Environment variables are added in T-1.11 and T-1.13.
- **Done when:** a PR gets a preview URL and `main` deploys.
- **Verify:** open the preview URL

#### T-0.12: Security basics in the repository
`status: done` `owner: agent` `needs: T-0.06` `size: M`
- **Do:** Add `SECURITY.md` (how to report a vulnerability privately), `public/.well-known/security.txt`, `.github/CODEOWNERS` assigning the owner (H-09) to `supabase/migrations/**`, `src/features/auth/**`, `src/features/admin/**`, `.github/workflows/**`, `public/_headers` and `docs/spec/security-model.md`, `.github/dependabot.yml` (npm, github-actions and pip for `analytics/`, weekly), a `secrets` CI job running gitleaks, and add `CLAUDE-SECURITY-*/` to `.gitignore`.
- **Done when:** the files exist; the `secrets` job fails on a planted fake key and passes without it; the Dependabot config validates.
- **Verify:** open a PR and read the checks

#### T-0.13: GitHub security settings
`status: done` `owner: human` `needs: T-0.12` `size: S`
- **Do:** Turn on secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting. Require CODEOWNERS review for the protected paths. Require two-factor authentication on every GitHub account with access.
- **Done when:** a push containing a test secret is blocked, and a PR touching a protected path requests the owner's review.
- **Verify:** try both once on a scratch branch

#### T-0.09b: Initial-route bundle guard
`status: done` `owner: agent` `needs: T-0.09` `size: M`
- **Do:** Complete the repository-guard split: write `scripts/check-bundle.mjs` to enforce a gzip budget for initial-route JS of 200 KB or less, with the admin chunk separate. Wire it into the `build` CI job and preserve the secret guard.
- **Done when:** a budget breach is shown once then reverted; initial dependencies are counted, lazy admin code is excluded from the initial route, and full verification passes.
- **Verify:** `npm run build && npm run check:bundle && npm run verify`

### Phase 1: Database and backend contract

#### T-1.01: Local Supabase project
`status: done` `owner: agent` `needs: T-0.01` `size: S`
- **Do:** Run `supabase init`. In `supabase/config.toml` set the auth site URL to `http://localhost:5173` and turn email confirmations off locally. Add scripts `db:start`, `db:stop`, `db:reset`, `db:test`, `db:types`. Document the Docker requirement in the README.
- **Done when:** `npm run db:start` brings the stack up and `supabase status` prints the API URL and keys.
- **Verify:** `npm run db:start && supabase status`

#### T-1.02: Convert the tested SQL into migrations
`status: done` `owner: agent` `needs: T-1.01` `size: L`
- **Do:** From `docs/db/initial-sql/`: files 01 to 04 become separate timestamped migrations (schema, security, functions, views); the governorates insert (05 part A) becomes a reference-data migration; 06 becomes a storage migration; the demo catalogue (05 part B) goes to `supabase/seed.sql`; the first-admin snippet goes to the runbook (T-1.14), not the seed. Leave the originals untouched. The SQL was tested on PostgreSQL 16 with stand-ins for Supabase auth and storage, not on the real stack: fix whatever the real stack rejects inside these not-yet-merged migrations and note each fix in the Work log.
- **Done when:** `supabase db reset` succeeds from scratch; `governorates` has 27 rows; the seed gives 4 categories and 6 products; RLS is enabled on all 8 public tables; `delivery_fees` is empty.
- **Verify:** `npm run db:reset` then `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) from public.governorates"` (use the URL from `supabase status`)

#### T-1.03: Generated database types
`status: done` `owner: agent` `needs: T-1.02` `size: S`
- **Do:** `npm run db:types` writes `src/types/database.types.ts` (`supabase gen types typescript --local`). Add `src/types/index.ts` re-exporting helpers (`Tables`, `TablesInsert`, `Enums`).
- **Done when:** the generated file is committed and `typecheck` passes.
- **Verify:** `npm run db:types && git diff --exit-code && npm run typecheck`

#### T-1.04: pgTAP harness
`status: done` `owner: agent` `needs: T-1.02` `size: M`
- **Do:** Create `supabase/tests/database/`. Vendor the Supabase test helpers (basejump `supabase-test-helpers`: `tests.create_supabase_user`, `tests.authenticate_as`, `tests.clear_authentication`, `tests.rls_enabled`) as `00000-supabase_test_helpers.sql`. Add `01_rls_enabled.test.sql` asserting RLS is on for every `public` table (scenario S17).
- **Done when:** `supabase test db` passes, and temporarily disabling RLS on one table makes it fail (then revert).
- **Verify:** `npm run db:test`

#### T-1.05: DB tests: auth and visibility
`status: done` `owner: agent` `needs: T-1.04` `size: M`
- **Do:** Implement scenarios S1, S2, S3, S8, S9, S15 (`docs/spec/database-contract.md` (section 10)) in `02_auth_visibility.test.sql`.
- **Done when:** all assertions pass, and each scenario fails if its protecting policy or grant is removed (spot-check two).
- **Verify:** `npm run db:test`

#### T-1.06: DB tests: orders and cancellation
`status: done` `owner: agent` `needs: T-1.04` `size: L`
- **Do:** Implement scenarios S4, S5, S6, S10, S11 in `03_orders.test.sql` and `04_cancel_restock.test.sql`.
- **Done when:** all assertions pass; failed orders leave no rows and no stock change.
- **Verify:** `npm run db:test`

#### T-1.07: DB tests: admin and privileges
`status: done` `owner: agent` `needs: T-1.04` `size: M`
- **Do:** Implement scenarios S12, S13, S14, S16 in `05_admin.test.sql` and `06_privileges.test.sql`.
- **Done when:** all assertions pass.
- **Verify:** `npm run db:test`

#### T-1.08: Concurrency check
`status: done` `owner: agent` `needs: T-1.06` `size: M`
- **Do:** Write `supabase/tests/concurrency.sh`: two `psql` sessions against the local database (URL from `supabase status`); session A places an order for the last units and holds the transaction for a few seconds; session B orders the same product. Add script `db:test:concurrency`. This is scenario S7.
- **Done when:** B waits, then fails with the out-of-stock error; final `stock_quantity` and `sold_count` are correct; the script exits non-zero if overselling happens.
- **Verify:** `npm run db:test:concurrency`

#### T-1.09: CI db job and migration guard
`status: done` `owner: agent` `needs: T-1.05, T-1.06, T-1.07, T-1.08, T-0.06` `size: M`
- **Do:** Add job `db` (3.3): `supabase/setup-cli@v1`, `supabase start`, `supabase db reset`, `supabase test db`, the concurrency script, regenerate types and fail on diff. Add `scripts/check-migrations.mjs`: fail if a migration that exists on `origin/main` is modified, deleted or renamed in the PR.
- **Done when:** a PR that edits a merged migration fails, and a PR with out-of-date types fails.
- **Verify:** open a PR and read the checks. Then ask the owner to add `db` to the required checks (T-0.10).

#### T-1.10: Stable error codes
`status: done` `owner: agent` `needs: T-1.09` `size: M`
- **Do:** One new migration (never edit merged ones) that recreates `place_order`, `cancel_my_order`, `admin_dashboard` and `orders_status_guard` so every `raise exception` also sets `using hint = '<code>'` from `docs/spec/error-codes.md` (stock errors add `detail = 'left=<n>'`). English messages stay for logs and tests. Add pgTAP checks (scenario S18) and regenerate types. (`admin_set_role` is dropped in T-1.15, so it is left alone here.)
- **Done when:** every failure path returns its code in `hint`, and all earlier tests still pass.
- **Verify:** `npm run db:reset && npm run db:test`

#### T-1.11: Staging Supabase project
`status: done` `owner: human` `needs: T-0.11` `size: S`
- **Do:** Create the second free Supabase project (`shop-staging`) and note its project ref. Add GitHub secrets `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`. Set the Cloudflare **Preview** environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the staging values.
- **Done when:** the secrets and variables exist (names are listed in `docs/runbooks/deploy-db.md`, never the values).
- **Verify:** `db-staging.yml` runs green (after T-1.12)

#### T-1.12: DB deploy workflows
`status: done` `owner: agent` `needs: T-1.09` `size: M`
- **Do:** Add `.github/workflows/db-staging.yml` (on push to `main` touching `supabase/migrations/**`: setup CLI, `supabase link --project-ref`, `supabase db push`) and `.github/workflows/db-production.yml` (`workflow_dispatch` only; requires the input `PRODUCTION`; same steps with the production secrets). Never echo secrets. Document both in `docs/runbooks/deploy-db.md`, including: a paused free project must be restored in the dashboard before the job can connect.
- **Done when:** both files pass `actionlint` (if available) and review; the staging run succeeds once T-1.11 is done.
- **Verify:** review the workflow files

#### T-1.13: Production Supabase project
`status: done` `owner: human` `needs: T-1.11` `size: S`
- **Do:** Create the first Supabase project for production. Add GitHub secrets `PRODUCTION_PROJECT_REF`, `PRODUCTION_DB_PASSWORD`. Set the Cloudflare **Production** environment variables. Push nothing yet.
- **Done when:** secrets and variables exist.
- **Verify:** checklist in `docs/runbooks/deploy-db.md`

#### T-1.14: Database runbooks
`status: done` `owner: agent` `needs: T-1.02` `size: S`
- **Do:** Write `docs/runbooks/local-dev.md` (Docker, start and stop, test users, where local emails appear: see `supabase status`), `first-admin.md` (sign up, then the owner-run SQL update from `05_seed.sql`) and `delivery-fees.md` (insert examples; no row means not available).
- **Done when:** a new developer can follow them from a clean machine.
- **Verify:** manual review

#### T-1.15: Admin hardening (two factors in the database)
`status: done` `owner: agent` `needs: T-1.10` `size: M`
- **Do:** One new migration (S19, S20, S30). `is_admin()` returns true only when the role is `admin` and `auth.jwt() ->> 'aal'` is `aal2`. Add `require_admin()` (raises ADM-002 for an admin at `aal1`, otherwise ADM-001) and call it first in every admin function. Drop `admin_set_role`. Add a trigger that blocks changes to `profiles.role` unless the session user is the database owner. Clamp sign-up metadata in `handle_new_user` (name 100, phone 20 characters). Add length checks to text columns. Make sure every admin policy goes through `is_admin()`.
- **Done when:** pgTAP shows an admin at `aal1` reads zero admin rows and gets ADM-002, and at `aal2` it works; API attempts to change a role fail; `admin_set_role` no longer exists; owner SQL can still promote an account.
- **Verify:** `npm run db:reset && npm run db:test`

#### T-1.16: Audit log
`status: done` `owner: agent` `needs: T-1.15` `size: M`
- **Do:** Migration (S21). Table `audit_log` as in `docs/spec/database-contract.md`: readable only by an admin at `aal2`, no write grants for any API role, and a trigger that blocks update and delete. Triggers on products (name, price, discount, stock, active, featured), categories, delivery_fees, shop_settings, orders (status, payment fields, tracking) and profiles (role) record actor, role and old and new values when the actor is an admin or the database owner. An `audit_event()` helper for functions.
- **Done when:** admin changes appear with actor and values; stock changes made by `place_order` do not; update and delete of log rows fail even for the owner role.
- **Verify:** `npm run db:test`

#### T-1.17: Shop settings
`status: done` `owner: agent` `needs: T-1.16` `size: M`
- **Do:** Migration (S22). `shop_settings` and `admin_update_setting(p_key, p_value)` with the allow-list and typed validation from the contract. Anonymous users read public keys only. Direct writes are revoked. Changes are audited. Seed defaults. Set size and type limits on the `product-images` bucket (3 MB; JPEG, PNG, WebP).
- **Done when:** unknown keys and invalid values return ADM-008 and ADM-007; private keys are invisible to anonymous users and customers.
- **Verify:** `npm run db:test`

#### T-1.18: Orders v2 and payments
`status: done` `owner: agent` `needs: T-1.17` `size: L`
- **Do:** Migration (S23, S24, S25). Add `instapay_qr` to `payment_method`; add enum `payment_status`; add the new order columns and the structured address fields; add the profile address columns; replace `place_order` with the v2 signature (`p_items`, `p_delivery_method`, `p_payment_method`, `p_ship`), enforcing settings (enabled methods, payment window), field lengths and error codes; add `submit_payment_proof`, `admin_review_payment` and `expire_unpaid_orders` (schedule with `pg_cron` every 30 minutes if available, otherwise document a manual admin button); add a trigger that sets COD orders to `paid` on delivery; create the private bucket `payment-proofs` with per-user folder policies and admin read and delete; make `payment_reference` unique.
- **Done when:** S23 to S25 pass; a proof path outside `<uid>/<order_id>/` is refused; overdue unpaid InstaPay orders are cancelled and restocked.
- **Verify:** `npm run db:reset && npm run db:test`

#### T-1.19: Catalog admin support
`status: done` `owner: agent` `needs: T-1.18` `size: M`
- **Do:** Migration (S26). Add `categories.is_active`, `categories.show_on_home` and `products.is_featured`. Image columns hold storage paths and are pattern-checked (`docs/spec/database-contract.md`). Add `admin_delete_product` (only if never ordered) and `admin_delete_category(p_id, p_move_to)`. Storefront policies show only active categories and products.
- **Done when:** deleting an ordered product returns ADM-004; deleting a non-empty category without a target returns ADM-005; URLs and bad paths in image columns are refused.
- **Verify:** `npm run db:test`

#### T-1.20: Abuse controls
`status: done` `owner: agent` `needs: T-1.18` `size: M`
- **Do:** Migration (S27, S28). Add `rate_limits` and `check_rate_limit()` and use it in `place_order`, `submit_payment_proof` and `cancel_my_order`. In `place_order` also cap order lines (30), quantity per line (20 or the stock) and pending orders per customer (setting `pending_order_limit`, default 3). Rate-limit by user id; add IP-based limits only after confirming on staging which forwarded-address value can be trusted.
- **Done when:** the fourth pending order returns ORD-010; repeated calls return SYS-003 and recover after the window.
- **Verify:** `npm run db:test`

#### T-1.21: Stock ledger
`status: done` `owner: agent` `needs: T-1.18` `size: M`
- **Do:** Migration (S29). Table `stock_movements` filled by a trigger on `products.stock_quantity`. Functions set the reason with `set_config('app.stock_reason', ...)`; an unexplained admin edit is recorded as `admin_adjust`.
- **Done when:** every order, cancellation and admin edit appears with delta, reason and actor; the movements add up to the current stock for the seed data.
- **Verify:** `npm run db:test`

#### T-1.22: SQL guard script
`status: done` `owner: agent` `needs: T-1.09` `size: M`
- **Do:** Write `scripts/check-sql.mjs` (script `check:sql`). It fails if a migration uses `execute` with string concatenation (`||`) instead of `format('%I')`, `%L` or `USING`; if a `security definer` function has no `set search_path`; if a `create table` in `public` has no RLS enabled in the same or a later migration; or if a table outside the allow-list is granted to `anon`. Run it in the `db` job.
- **Done when:** a fixture for each violation fails, and the real migrations pass.
- **Verify:** `npm run check:sql`

#### T-1.23: Order approval and saved address migration
`status: done` `owner: agent` `needs: T-1.18, T-1.22` `size: M`
- **Do:** Migration (S32 to S37). Add `awaiting_approval` to enum `payment_status`. Settings allow-list: `require_order_approval` (boolean, default true, public), `approval_window_hours` (integer 1 to 72, default 24, private). Set `instapay_qr_path` and `instapay_handle` to private. Update `place_order` to set `awaiting_approval` and no deadline when approval required; save address to profile if missing or if `save_address` is ticked. Add `admin_approve_order(p_order_id, p_note default null)` (sets confirmed, awaiting_proof, payment_deadline). Add `admin_reject_order(p_order_id, p_reason)` (cancels and restocks). Add `get_payment_instructions(p_order_id)` returning QR path, handle, amount, deadline only for order owner while awaiting_proof/under_review/rejected, raising PAY-007 before approval. Refuse `submit_payment_proof` before approval (PAY-007). In `orders_status_guard`, refuse shipped/delivered for unpaid InstaPay orders (ORD-015). `expire_unpaid_orders()` also cancels unapproved orders past `approval_window_hours`.
- **Done when:** S32 to S37 pass in pgTAP; check:sql and check:migrations pass.
- **Verify:** `npm run db:reset && npm run check:sql`

#### T-1.09b: Append-only migration guard
`status: done` `owner: agent` `needs: T-0.06` `size: M`
- **Do:** Implement `check:migrations` to reject modification, deletion or renaming of migrations already on `origin/main`; wire into local verification and the existing static CI job. Use the pre-push SHA on main so the post-push check cannot compare a rewrite against itself. No database or cloud connections.
- **Done when:** real Git fixtures prove committed/staged/unstaged edits, deletion, rename and missing-history rejection; additions pass; CI runs the guard and negative fixtures. Owner workflow review remains required. T-1.09 retains database/type and actual merged-migration PR acceptance.
- **Verify:** `node --test scripts/check-migrations.test.mjs && npm run check:migrations && npm run verify`; read PR checks.

### Phase 2: App shell

#### T-2.01: Environment and Supabase client
`status: done` `owner: agent` `needs: T-1.03` `size: S`
- **Do:** Add `src/lib/env.ts` (Zod-validated `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`, readable failure message) and `src/lib/supabase.ts` (typed `createClient<Database>`).
- **Done when:** booting without env values shows a clear error screen in development; a unit test covers validation.
- **Verify:** `npm run test:unit`

#### T-2.02: Routing and layout
`status: done` `owner: agent` `needs: T-0.08e, T-2.01` `size: L`
- **Do:** React Router with lazy routes. `Layout` with Navbar (Lolys' logo, search pill, links المتجر / تصفّح / عن المتجر, cart pill with count, account menu, theme and language toggles) and Footer (cocoa band with policy links). 404 page, scroll restoration, skip link, mobile navigation. Routes: `/`, `/category/:slug`, `/product/:id`, `/cart`, `/login`, `/checkout`, `/pay/:orderId`, `/account/orders`, `/account/security`, `/admin/*`, and the policy pages.
- **Done when:** every route renders a placeholder, is keyboard navigable, fits a 360px viewport, and looks right in RTL in both themes.
- **Verify:** `npm run verify` and manual check

#### T-2.03: Arabic i18n scaffold
`status: done` `owner: agent` `needs: T-2.02, T-0.08i` `size: M`
- **Do:** Set up i18next with `src/i18n/ar.json` and `en.json` as shipped languages (ADR-0002) (the copy deck in `docs/spec/design-system.md` is the starting content), language-dependent `lang`/`dir` on `<html>`, `t()` for every string, Arabic plural rules, Western digits. Add `src/lib/format.ts` (`formatEGP` with `Intl.NumberFormat('ar-EG-u-nu-latn', { style: 'currency', currency: 'EGP' })`, dates with `Intl.DateTimeFormat('ar-EG-u-nu-latn')`). Phone numbers, emails and order numbers render inside `dir="ltr"` spans. Add `scripts/check-i18n.mjs` (no key used in code is missing from either locale, no unused production keys; kit keys are development-only) and the `check:i18n` script.
- **Done when:** the whole shell renders in Arabic RTL and English LTR; the check runs in the `static` job; unit tests cover `formatEGP`.
- **Verify:** `npm run check:i18n && npm run test:unit`

#### T-2.04: Authentication (generic and bot-resistant)
`status: done` `owner: agent` `needs: T-2.01, T-2.02` `size: L`
- **Do:** `AuthProvider` (session, profile, role, `aal`), `useAuth`; Login, Register and Reset pages in Arabic. Rules: (1) every login failure shows the same message, AUTH-001, never which field was wrong; (2) sign-up, password reset and resend show the same neutral message, AUTH-010, whether or not the email exists; (3) Cloudflare Turnstile on sign-in, sign-up and reset (`captchaToken`), failures map to AUTH-003; (4) the same network calls happen for known and unknown emails; (5) password rules are shown up front (10 characters or more); (6) a neutral "resend the confirmation email" link is always visible; (7) no auth error text is rendered raw. Logout, `RequireAuth` and `RequireAdmin` (UI-only guards; T-2.06 adds MFA).
- **Done when:** unit tests prove the same message and the same number of requests for "wrong password" and "unknown email"; the reset message is identical for known and unknown emails; sign-up with an existing email shows AUTH-010.
- **Verify:** `npm run test:unit` and manual check against `db:start`

#### T-2.05: Data and feedback plumbing
`status: done` `owner: agent` `needs: T-2.02` `size: M`
- **Do:** `QueryClientProvider` defaults (retry policy, stale times), a global error boundary, toast hooks, and shared `ErrorPanel` and `EmptyState` components alongside the existing `Skeleton`.
- **Done when:** a failing query shows the error panel with a retry button; tests cover it.
- **Verify:** `npm run test:unit`

#### T-2.06: Two-factor login (TOTP)
`status: doing` `owner: agent` `needs: T-2.04` `size: L`
- **Do:** TOTP with Supabase Auth MFA: enroll (QR code and manual key), verify, challenge at login for any enrolled user, list and remove factors (removal needs a fresh `aal2`), `useAal()` from `getAuthenticatorAssuranceLevel`. Admins must enroll before any admin screen loads: `RequireAdmin` sends them to enrollment, then to the challenge until the session is `aal2`. Customers are offered 2FA from the account page (O-13). Encourage a second device. Arabic copy; AUTH-005 and AUTH-006 errors.
- **Done when:** an admin with only a password reaches the enrollment screen and nothing else; after verification the session is `aal2` and admin screens load; wrong or expired codes show AUTH-006; tests cover the gate logic.
- **Verify:** `npm run test:unit` and manual check

#### T-2.06b: Repair MFA enrollment, session notifications and bilingual controls
`status: doing` `owner: agent` `needs: T-2.04` `size: M`
- **Do:** Owner-requested regression repair after 66877e4: explicit retryable enrollment, cleanup only unfinished Lolys factors, no Auth calls awaited inside SDK notification locks, verified-factor admin gates, English/Arabic enrollment/challenge/step-up copy and schema-correct owner runbook. SEC-01, SEC-02, SEC-05 and SEC-08 remain enforced.
- **Done when:** StrictMode does not create duplicate factors; failures never show AUTH-010; customer/admin verification routes correctly; the live MFA flow is verified; the full gate and owner review pass.
- **Verify:** `npm run verify` and local database-backed admin/security E2E.

#### T-2.07: Account security
`status: done` `owner: agent` `needs: T-2.06` `size: M`
- **Do:** `/account/security`: change password (asks for a recent sign-in; AUTH-007 if stale), change email (keep Supabase "Secure email change" on so the old and the new address must both confirm; show the neutral AUTH-010 copy), "sign out of all devices" (`signOut({ scope: 'global' })`), list of enrolled factors. Admin sessions time out after 20 idle minutes (sign out and clear caches).
- **Done when:** the idle timeout works in a unit test with fake timers; no UI can read or change another user's email; every flow shows Arabic messages with codes.
- **Verify:** `npm run test:unit`

#### T-2.08: Error framework
`status: done` `owner: agent` `needs: T-1.10, T-2.05` `size: M`
- **Do:** `src/lib/errors.ts`: `AppError` with `code`, `ref` (8 random characters) and `params`; `toAppError(unknown)` maps Supabase Auth error codes, `hint` codes from the database, HTTP statuses and network failures to the catalogue in `docs/spec/error-codes.md`; anything unknown becomes SYS-001 with a reference. An `ErrorMessage` component shows the Arabic message and "رمز الخطأ: CODE" (plus the reference for SYS-001). Add an ESLint rule or test that forbids rendering `error.message` anywhere in `src/`. Log details to the console in development only.
- **Done when:** a table-driven test covers every code in the catalogue; a test proves raw English messages never reach the DOM.
- **Verify:** `npm run test:unit`

#### T-2.09: Step-up confirmation
`status: done` `owner: agent` `needs: T-2.06` `size: S`
- **Do:** `useStepUp()` and `<StepUpDialog>`: before a sensitive action (QR or settings change, CSV export, permanent delete, purge of proofs) ask for a fresh authenticator code (challenge and verify), remember it for 5 minutes in memory only, and show ADM-003 when it is missing. The database still requires `aal2` on its own.
- **Done when:** unit tests cover expiry after 5 minutes and prove the confirmation is never written to storage.
- **Verify:** `npm run test:unit`

#### T-2.10: Customer notifications and suggestions
`status: todo` `owner: agent` `needs: T-4.05, T-1.23` `size: L`
- **Do:** Implement owner request in `docs/spec/owner-experience-change.md`: My Orders menu, notifications for wishlist sales/order approvals/general sales, customer suggestions and admin demand view. Split database/UI work into additive slices before implementation.
- **Done when:** Owner-scoped RLS, rate limits, bilingual UI, safe errors, retention documentation, database and UI tests pass; no fabricated notification data.
- **Verify:** `npm run db:reset && npm run db:test && npm run verify && npm run test:e2e`

#### T-2.11: Customer profile photo
`status: todo` `owner: agent` `needs: T-2.04` `size: M`
- **Do:** User-owned validated/re-encoded photo upload and replacement per `docs/spec/owner-experience-change.md`; additive schema, storage policies and cleanup.
- **Done when:** Cross-user access denied by database/storage tests; both languages/themes and upload failure paths checked.
- **Verify:** `npm run db:reset && npm run db:test && npm run verify`

#### T-2.12: Hosted authentication abuse controls
`status: todo` `owner: human` `needs: T-2.12a` `size: M`
- **Do:** Owner verifies Managed Turnstile, production hostnames/keys, Supabase CAPTCHA enforcement and endpoint limits. Confirmed plan is Free; native leaked-password protection is unavailable. See `docs/spec/store-controls-and-auth-abuse.md`; any new proxy/breach service needs an ADR before implementation.
- **Done when:** Bounded staging evidence covers direct-origin missing/forged/expired/replayed tokens, shared-IP legitimate retries, recovery/resend limits and MFA. Record remaining credential-stuffing risk and chosen breach-screening approach; no fabricated device proof or 10,000-bot test.
- **Verify:** Owner staging acceptance and configuration review; never run a production load attack.

#### T-2.12a: Reliable authentication challenge lifecycle
`status: done` `owner: agent` `needs: T-2.04` `size: M`
- **Do:** Repair Turnstile cleanup and callback stability, discard expired/failed/consumed tokens, renew challenges for login/signup/reset/resend, reject dummy keys in production, and isolate synthetic tokens to tests. This supports SEC-05/06; it is not a custom risk engine or proof of hosted CAPTCHA enforcement.
- **Done when:** Missing/expired challenges cannot submit from the forms; retries remain usable; Strict Mode and late callbacks are safe; neutral auth responses and full verify pass. Hosted controls remain separately owner-verified.
- **Verify:** `npm run verify`; authentication lifecycle regression tests.

### Phase 3: Storefront

#### T-3.01: Catalog API
`status: done` `owner: agent` `needs: T-2.05, T-2.08, T-1.03` `size: M`
- **Do:** `features/catalog/api.ts` and hooks: active categories (`show_on_home`, ordered by `sort_order`); best sellers (`sold_count` descending); products by category (`categories!inner(slug)` filter); product by id; search. Typed results, errors through `toAppError`, tests with a mocked client (`docs/spec/database-contract.md` lists the columns). Image fields are storage paths; add `publicImageUrl(path)` in `src/lib`.
- **Done when:** all functions are typed and unit-tested; no Supabase import exists outside `api.ts` files and `src/lib`.
- **Verify:** `npm run test:unit`

#### T-3.02: Product image, card and category tile
`status: done` `owner: agent` `needs: T-0.08e, T-3.01` `size: M`
- **Do:** `ProductImage` (aspect-ratio box, lazy loading, fallback), `ProductCard` (image-first: 28px card, 20px inner image, discount tag, sold-out badge, price with struck-through original, add button disabled when sold out) and `CategoryTile` (full-bleed image with label chip).
- **Done when:** no layout shift while images load; sold-out items are clearly marked and cannot be added.
- **Verify:** `npm run verify`

#### T-3.03: Home page
`status: done` `owner: agent` `needs: T-3.02, T-2.03` `size: L`
- **Do:** Hero (sale banner with text and percent from public settings, arch-framed photo, ribbon and pearl ornaments, floating product cards from best sellers, call to action), category pills, Store (category tiles with arch frames), Browse (filters, best sellers first, "load more" in steps of 12), About and delivery info using `returns_text_ar` and the settings. Anchors `#store`, `#browse`, `#about` with smooth scroll. Skeleton, empty and error states. Copy from the deck in `docs/spec/design-system.md`.
- **Done when:** all sections render from live data in Arabic RTL; the page works at 360px and 1280px in both themes; changing a public setting changes the hero without a deploy.
- **Verify:** `npm run verify` and manual check

#### T-3.04: Category page
`status: done` `owner: agent` `needs: T-3.02` `size: M`
- **Do:** `/category/:slug` with in-stock items by default and a "show sold out" toggle; sort by popularity or price; filter state in the URL; unknown slug shows 404.
- **Done when:** reloading a filtered URL restores the same view.
- **Verify:** `npm run test:unit`

#### T-3.05: Product page
`status: done` `owner: agent` `needs: T-3.02` `size: M`
- **Do:** Gallery (`image_url` and `extra_images`), price and discount, stock note ("only N left" at 5 or fewer), quantity stepper capped at stock, add to cart, delivery info chips, related products from the same category.
- **Done when:** the quantity cannot exceed stock; a sold-out product shows a disabled state.
- **Verify:** `npm run test:unit`

#### T-3.06: Cart
`status: done` `owner: agent` `needs: T-3.01, T-0.08e` `size: L`
- **Do:** `CartProvider` (reducer, localStorage key `cart:v1`, stores only `{productId, quantity}`), cart drawer and `/cart` page, quantity clamped to live stock (re-validated on load), line totals from fresh product data, "log in to check out" call to action for guests.
- **Done when:** tests cover merging duplicates, clamping, persistence and removal of stale products.
- **Verify:** `npm run test:unit`

#### T-3.07: Search
`status: done` `owner: agent` `needs: T-3.01, T-2.02` `size: M`
- **Do:** Navbar search goes to `/search?q=`; debounced; server-side `ilike` on `name` and `name_ar` with `%` and `_` escaped; empty and error states.
- **Done when:** special characters in the query do not break the request; tests cover escaping.
- **Verify:** `npm run test:unit`

#### T-3.08: SEO basics
`status: done` `owner: agent` `needs: T-2.02` `size: S`
- **Do:** Per-route document title and description hook, Open Graph defaults, `robots.txt`, favicon and web manifest.
- **Done when:** the title changes on every route.
- **Verify:** `npm run test:unit`

#### T-3.09: Verify motion in compiled styles and repair flower hover
`status: done` `owner: agent` `needs: T-3.02` `size: S`
- **Do:** Test actual CSS animation frames in isolated browser fixtures for both themes and writing directions; preserve petal rotation during hover growth; retain reduced-motion support.
- **Done when:** Button movement, flower rotation, theme interpolation, skeleton motion, scoped card blur and reduced-motion fallbacks pass browser tests; owner preview checked with animation effects enabled; full verification passes.
- **Verify:** `npm run verify` and `npx playwright test --config playwright.motion.config.ts` after build.

#### T-3.10: Owner-controlled storefront presentation
`status: todo` `owner: agent` `needs: T-3.03, T-5.09` `size: L`
- **Do:** Follow `docs/spec/owner-experience-change.md`: replace arch, truthful sale copy, editable bilingual hero/showcase and category shortcuts with admin control toggle; enlarge info cards on hover/focus. Split database/UI work before implementation.
- **Done when:** Admin AAL2/audit/allow-list enforced; settings persist; no false promotion; responsive visual and database tests pass.
- **Verify:** `npm run db:reset && npm run db:test && npm run verify && npm run test:e2e`

#### T-3.10a: Visible homepage repairs before the editor
`status: done` `owner: agent` `needs: T-3.03` `size: M`
- **Do:** Owner handoff priority: replace the active HomePage arch, remove invented 50% fallback, fix About/Returns English leaks and enabled-method badges, enlarge the three informational cards on hover/focus and reveal them when reached. Existing unused StorefrontHero is a reuse candidate, not proof of implementation. See `HANDOVER_TO_ANTI_GRAVITY.md`.
- **Done when:** Actual routed page shows the changes at 320/360/1280 in both themes/languages; absent/zero promotion, long copy, touch and reduced motion behave correctly; no false sale or clipped cards; tests and verify pass. No schema changes required for this visual slice.
- **Verify:** `npm run verify`; focused homepage tests and real-route browser acceptance with recorded evidence.

#### T-3.10b: Visible admin entry and opposite product badges
`status: done` `owner: agent` `needs: T-2.02, T-3.03` `size: S`
- **Do:** Add a visible localized storefront Admin entry for the resolved admin role through existing MFA guards. Position offer/sold-out badges opposite the wishlist control with generated logical CSS. The persistent mouse editor remains T-3.10, not satisfied by a navigation link. See `docs/handoff/OWNER-FOLLOWUP-2026-10-17.md`.
- **Done when:** Guest/customer/admin loading and resolved states behave correctly; offer and heart bounding boxes do not intersect at 320/360/1280 in either direction; controls remain accessible; actual-route checks and verify pass.
- **Verify:** `npm run verify`; focused role/navigation tests and compiled-CSS plus actual-route collision checks.

#### T-3.10c: Persistent storefront and policy content contract
`status: todo` `owner: agent` `needs: T-5.09, T-1.23` `size: L`
- **Do:** Split additive content contract work into bounded migrations/RPC slices per `docs/spec/store-controls-and-auth-abuse.md`: bilingual hero/image/featured item/category shortcuts, footer branding/labels/contacts and full policy bodies. Preserve private payment settings and approved business content.
- **Done when:** AAL2, allow-lists, audit, bounded text and storage/reference validation, coherent saves and stale-edit detection pass pgTAP; types regenerated; existing content and RLS preserved. Docker availability is required before implementation.
- **Verify:** `npm run db:reset && npm run db:test && npm run db:types && npm run verify`

#### T-3.11: Explicit site motion preference
`status: done` `owner: agent` `needs: T-3.09` `size: M`
- **Do:** Implement the owner's new explicit request: Full animations by default even with device animations off; visitor-selectable Reduced and Follow device modes. Use a persisted effective policy shared by CSS/JS, replacing conflicting direct OS guards without breaking dialogs, touch behavior, skeletons or visible content. See the latest owner follow-up.
- **Done when:** OS-reduced + Full animates; explicit Reduced suppresses decorative motion; Follow device responds to OS changes; reload/storage-denied/rapid-dialog cases pass; accessible bilingual control and full verify pass. No forced animation after a visitor selects Reduced.
- **Verify:** `npm run verify`; browser motion-policy matrix including reduced-motion emulation and actual routes.

#### T-3.11b: Footer-only motion control
`status: done` `owner: agent` `needs: T-3.11` `size: S`
- **Do:** Owner correction on 2026-10-18: remove motion controls from the hamburger menu; retain the accessible bilingual selector in the footer and its persisted Full/Reduced/Follow-device behavior.
- **Done when:** Menu no longer contains the selector, footer remains operable, navigation/motion regressions and verify pass.
- **Verify:** `npm run verify`; existing navigation and motion tests.

#### T-3.12: Complete routed interface language coverage
`status: done` `owner: agent` `needs: T-2.02, T-3.03` `size: L`
- **Do:** Localize complete Returns, Shipping, Terms, Privacy and Contact pages; audit every public/account/admin route and its validation/error/loading/empty states, accessible names and metadata. Preserve approved policy meaning; report unsupported claims. Split implementation by route groups as needed; protect initial bundle budget with route-lazy policy copy.
- **Done when:** Route-by-route English/Arabic evidence includes full body content and errors, no Arabic interface fallback in English, correct lang/dir and persistent language after navigation/refresh; no invented business/legal policy; verify and actual-route review pass.
- **Verify:** `npm run verify`; route localization tests and browser acceptance table per `docs/handoff/OWNER-FOLLOWUP-2026-10-17.md`.

### Phase 4: Checkout and orders

#### T-4.01: Delivery options API
`status: done` `owner: agent` `needs: T-2.05, T-1.03` `size: S`
- **Do:** Hooks for governorates (Arabic names first) and the available methods and fees for a governorate (`delivery_fees`).
- **Done when:** a governorate with no rows returns an empty list; tests cover it.
- **Verify:** `npm run test:unit`

#### T-4.02: Checkout with location details and payment choice
`status: done` `owner: agent` `needs: T-3.06, T-4.01, T-2.04, T-2.08, T-1.18` `size: L`
- **Do:** Arabic checkout form with the customer's location details: full name, mobile (Egyptian format, normalised to `01xxxxxxxxx`), optional second mobile, governorate, city or center, district, street and building, floor, apartment, nearby landmark, delivery notes; prefilled from the profile. Delivery method cards (available methods only, with the fee). Payment method cards (cash on delivery and InstaPay QR, only the methods enabled in public settings). Order summary labelled as an estimate. Submit calls `rpc('place_order', ...)` with `p_payment_method` and `p_ship`; map errors by `hint`. COD goes to the confirmation page; InstaPay goes to the payment screen (T-4.06). Requires login.
- **Done when:** validation and error mapping are unit-tested; both payment paths work against the local stack; field lengths match the database limits.
- **Verify:** `npm run test:unit` and manual check

#### T-4.03: Order confirmation and my orders
`status: done` `owner: agent` `needs: T-4.02` `size: M`
- **Do:** `/order/:id/thanks`; `/account/orders` list and detail with a status timeline, a payment status chip, tracking number or representative name and phone, items with the price paid, and a cancel button for pending orders (`cancel_my_order`).
- **Done when:** cancelling a pending order updates the UI and the stock; the button is hidden for other states and for InstaPay orders under review.
- **Verify:** `npm run test:unit`

#### T-4.04: Account page
`status: done` `owner: agent` `needs: T-2.04, T-3.01` `size: M`
- **Do:** Edit name, mobiles and the saved location details (never the role). Show total spent and favourite item from `customer_stats`. Link to `/account/security`.
- **Done when:** saving updates the profile; no role field exists in the form or payload.
- **Verify:** `npm run test:unit`

#### T-4.05: Favorites
`status: done` `owner: agent` `needs: T-3.02, T-2.04` `size: M`
- **Do:** Bow-shaped heart toggle on cards and the product page (guests are asked to log in), `/account/favorites`, optimistic updates with rollback.
- **Done when:** a failed write rolls back the toggle; tests cover it.
- **Verify:** `npm run test:unit`

#### T-4.06: InstaPay QR payment flow
`status: done` `owner: agent` `needs: T-4.02, T-1.18, T-1.17` `size: L`
- **Do:** `/pay/:orderId` for `instapay_qr` orders: the QR from public settings (until real images exist, the placeholder `public/placeholders/instapay-qr.svg`), the InstaPay address, the exact amount, the order reference to write in the transfer note, short Arabic steps and a deadline countdown. Proof upload: JPEG, PNG or WebP, 5 MB or less, checked by file signature (magic bytes) and not only the extension, re-encoded in the browser (this strips metadata), uploaded to the private bucket `payment-proofs/{user_id}/{order_id}/{uuid}.jpg` or `.webp`, then `rpc('submit_payment_proof', ...)` with the transfer reference. Status chips: بانتظار الدفع، قيد المراجعة، تم تأكيد الدفع، مرفوض (re-upload allowed before the deadline).
- **Done when:** unit tests cover signature checks and error mapping (UPL-001, UPL-002, PAY-001 to PAY-005); a renamed HTML or SVG file is refused; upload paths never contain user-controlled names.
- **Verify:** `npm run test:unit`

#### T-4.07: E2E: storefront to order
`status: done` `owner: agent` `needs: T-4.03, T-4.06, T-1.09` `size: L`
- **Do:** Playwright with a global setup that resets the local database and creates test users (customer and admin) using the local stack's keys. Scenarios: guest browses and the cart persists; register and log in; COD checkout succeeds and stock decreases; oversell shows the translated stock message; unavailable delivery method is refused; cancelling a pending order restores stock; InstaPay order shows the QR placeholder, accepts a valid image and refuses a renamed non-image, and moves to "قيد المراجعة"; an unpaid InstaPay order expires (test hook shortens the window) and restores stock. Add the `e2e` CI job.
- **Done when:** the suite passes locally and in CI in under 10 minutes. Ask the owner to add `e2e` to the required checks.
- **Verify:** `npm run test:e2e`

#### T-4.08: Saved postal code and order snapshot
`status: doing` `owner: agent` `needs: T-4.02, T-1.23` `size: M`
- **Do:** Owner correction: required text postal code with final database NOT NULL and non-empty/format validation for complete saved delivery addresses and new order snapshots, not Egypt-Post-only. Preserve leading zeros, account creation before address entry and existing order facts; use additive expand/backfill/contract without fabricated defaults. See `docs/spec/owner-experience-change.md`.
- **Done when:** Final required-address/order contract rejects null/blank codes server-side; signup, legacy-data migration, saved-address opt-out and old immutable snapshots remain valid; generated types and address/RLS/checkout regression tests pass. Missing genuine backfill data is documented, never hidden by fake codes.
- **Verify:** `npm run db:reset && npm run db:test && npm run db:types && npm run verify`

#### T-4.08b: Postal database integration and historical updates
`status: done` `owner: agent` `needs: T-4.02, T-1.23` `size: M`
- **Do:** Repair the postal handoff's failing database fixtures and legacy UPDATE constraints without weakening required new-address validation. Preserve uniform auth errors, order/stock assertions and existing migrations. Reopen T-4.08 until integration evidence is available.
- **Done when:** Existing order, approval, RLS, payment and stock tests run with valid postal fixtures; legacy orders can progress, unrelated profile edits work, new missing codes are rejected, generated types match and concurrency passes. Hosted legacy backfill remains owner work.
- **Verify:** `npm run db:reset && npm run db:test && npm run db:test:concurrency && npm run db:types && npm run verify`

### Phase 5: Admin

#### T-5.01: Admin shell
`status: done` `owner: agent` `needs: T-2.06, T-2.07` `size: M`
- **Do:** Lazy-loaded `/admin/*` chunk, sidebar rail with Arabic labels, `RequireAdmin` requiring an `aal2` session, the idle timeout from T-2.07, a 403 view (AUTH-011) for customers and the MFA-required view (ADM-002) for an admin at `aal1`, responsive RTL layout.
- **Done when:** a customer opening `/admin` sees the 403 view and the admin chunk is not downloaded; an admin at `aal1` is sent to MFA.
- **Verify:** `npm run test:unit`

#### T-5.02: Products list
`status: done` `owner: agent` `needs: T-5.01, T-3.01` `size: M`
- **Do:** Table with search; filters for category, active, archived and stock; inline stock edit through a small dialog (new quantity and a reason, validated, optimistic with rollback); active toggle.
- **Done when:** stock cannot go below 0; errors roll the value back and show a mapped message.
- **Verify:** `npm run test:unit`

#### T-5.03: Product form and images
`status: done` `owner: agent` `needs: T-5.02, T-1.19` `size: L`
- **Do:** Create, edit, archive, restore and delete products. Fields: Arabic name and description (plain text only), category select, price, discount 0 to 100, featured toggle, active toggle, main image and gallery (add, reorder, replace, remove). Upload to `product-images/products/{productId}/{uuid}.webp` after client-side resize to 1200 px at most and re-encode (WebP when the browser can encode it, otherwise JPEG with the matching extension). Images only; store the storage path, never a full URL. "Delete permanently" uses `admin_delete_product` and works only for never-ordered products, otherwise offer "Archive". Never send generated columns.
- **Done when:** a unit test proves the payload builder omits generated columns; deleting an ordered product shows ADM-004 and offers to archive; non-images are refused (UPL-001).
- **Verify:** `npm run test:unit` and manual check

#### T-5.04: Categories admin
`status: done` `owner: agent` `needs: T-5.01, T-1.19` `size: M`
- **Do:** Add a category (Arabic name, slug suggested then validated), change its tile image, show or hide it on the home page, reorder, archive, delete. Deleting a category that has products requires choosing another category to move them to (`admin_delete_category`); an empty category deletes directly. Slug pattern `^[a-z0-9]+(-[a-z0-9]+)*$`.
- **Done when:** moving products on delete works; ADM-005 and ADM-006 are mapped; tests cover the validators.
- **Verify:** `npm run test:unit`

#### T-5.05: Orders admin
`status: done` `owner: agent` `needs: T-5.01, T-1.10` `size: L`
- **Do:** List with status and payment-status filters and search; detail with customer, location details, items and payment; status path pending, confirmed, shipped, delivered, and cancel from any state; tracking number (Egypt Post) and representative name and phone; confirm dialogs; map errors by `hint`. Payment review is T-5.08.
- **Done when:** an invalid transition is unavailable in the UI and rejected by the database; tests cover the allowed-transition helper.
- **Verify:** `npm run test:unit`

#### T-5.06: Customers admin
`status: done` `owner: agent` `needs: T-5.01` `size: M`
- **Do:** Table from `customer_stats` with search; the role is shown read-only. There is no UI to create, promote or demote admins (owner SQL only, see the runbook).
- **Done when:** a grep check in `verify` finds no write to `profiles.role` and no `admin_set_role` call anywhere in `src/`.
- **Verify:** `npm run verify`

#### T-5.07: Delivery fees admin
`status: done` `owner: agent` `needs: T-5.01, T-4.01` `size: M`
- **Do:** Grid of governorate x method. Add, update and remove a fee; empty cells read "غير متاح"; validation of 0 or more.
- **Done when:** removing a fee makes that method unavailable at checkout.
- **Verify:** `npm run test:unit`

#### T-5.08: Payment review
`status: done` `owner: agent` `needs: T-5.05, T-1.18, T-2.09` `size: L`
- **Do:** `/admin/payments`: queue of orders `under_review` (oldest first) with amount, reference, deadline and the proof image through a short-lived signed link (60 seconds, never stored); approve or reject with a note (`admin_review_payment`); filters; a "purge old proofs" action (step-up) that deletes proofs for orders delivered longer ago than the retention period through the Storage API and clears the path.
- **Done when:** approving marks the order paid and the customer's order page shows it; rejecting lets the customer resubmit; signed links expire; purge works on seed data; every action is audited.
- **Verify:** `npm run test:unit`

#### T-5.09: Site settings
`status: done` `owner: agent` `needs: T-5.01, T-1.17, T-2.09` `size: L`
- **Do:** `/admin/settings`: shop info, WhatsApp and phone, announcement bar, hero text and sale percent, enabled payment methods, InstaPay address and QR image (replace with preview), returns text. Each save calls `admin_update_setting`. QR, payment methods and limits ask for step-up. Show the latest changes from the audit log. Ship the placeholder QR (`public/placeholders/instapay-qr.svg`) until the real images exist (H-10).
- **Done when:** changing the sale percent updates the storefront hero; the QR can be replaced and the old file is removed; unknown keys show ADM-008; tests cover the validators.
- **Verify:** `npm run test:unit`

#### T-5.10: Audit log viewer
`status: done` `owner: agent` `needs: T-5.01, T-1.16` `size: M`
- **Do:** `/admin/audit`: read-only table with filters (date, entity, actor, action), a readable before and after view, and a "recent sensitive changes" panel for the dashboard. No edit or delete controls.
- **Done when:** entries from other admin screens appear; a grep check in `verify` finds no write to `audit_log` anywhere in `src/`.
- **Verify:** `npm run verify`

#### T-5.11: CSV export
`status: done` `owner: agent` `needs: T-5.02, T-5.05, T-5.06, T-2.09` `size: M`
- **Do:** Export buttons for products, orders, customers and the audit log. UTF-8 with BOM so Excel shows Arabic; the date in the file name. **Formula injection:** any cell starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with a single quote. Exports need a step-up confirmation because they contain customer data.
- **Done when:** unit tests check the BOM, quoting and formula neutralisation.
- **Verify:** `npm run test:unit`

#### T-5.12: E2E: admin
`status: done` `owner: agent` `needs: T-5.03, T-5.04, T-5.05, T-5.07, T-5.08, T-5.09, T-5.10, T-5.11, T-4.07` `size: L`
- **Do:** Scenarios: an admin at `aal1` cannot load admin data, and after MFA can; create a category with an image, add a product to it, see both on the storefront; set stock to 0 and see the sold-out badge; archive, restore and delete rules; order lifecycle seen by the customer; InstaPay payment approve and reject; QR replacement asks for step-up and leaves an audit entry; non-admins are blocked; CSV export neutralises a product named `=cmd|...`.
- **Done when:** the suite passes locally and in CI.
- **Verify:** `npm run test:e2e`

#### T-5.13: Admin workspace usability repair
`status: doing` `owner: agent` `needs: T-5.01, T-5.02, T-5.03` `size: M`
- **Do:** Full-width admin area, right collapsible sidebar, accessible mobile drawer, photo selection from thumbnail, remove duplicate product actions, clip table corners and handle missing analytics. See `docs/spec/owner-experience-change.md`.
- **Done when:** Upload failure preserves previous photo; navigation and analytics regressions covered; responsive LTR/RTL in both themes verified without changing MFA/database authority.
- **Verify:** `npm run verify && npm run test:e2e`

#### T-5.13b: Order and payment review navigation
`status: doing` `owner: agent` `needs: T-5.05, T-5.08, T-6.02` `size: M`
- **Do:** Link pending dashboard card to filtered orders, order payment information to exact payment review, show under-review count in payment navigation. See `docs/spec/owner-experience-change.md`.
- **Done when:** Links select correct filters/order; empty and failed count do not misrepresent review status; admin alone confirms payment through existing RPC.
- **Verify:** `npm run verify && npm run test:e2e`

#### T-5.13c: Responsive header, switch and social menu repairs
`status: doing` `owner: agent` `needs: T-5.01, T-5.02, T-2.02` `size: M`
- **Do:** Owner correction on 2026-10-17: place dashboard title and adjacent toggle physically right; keep header reachable during mobile scrolling; align Active switch in both directions; include supplied TikTok, Instagram and WhatsApp links in all user menus with icon-only narrow presentation and accessible names. Keep admin content scroll independent and mobile menus within viewport.
- **Done when:** Real-component controls tested in Arabic/English for guest/customer/admin; compiled-CSS checks at 320/360/1280 in both themes verify geometry, containment and scrolling; full verify and database-backed E2E pass. No auth/payment authority changes.
- **Verify:** `npm run verify && npm run test:e2e`; offline fixture checks described in `docs/handoff/RESPONSIVE-REPAIR.md`.

#### T-5.13d: Responsive regression evidence
`status: doing` `owner: agent` `needs: T-5.13c` `size: S`
- **Do:** Split regression fixtures and review evidence from T-5.13c to keep each checkpoint near the 400-line review limit. Export real rendered components without credentials; test narrow/desktop geometry, scrolling, both languages/themes and exact social destinations. Record unavailable database checks explicitly.
- **Done when:** Component and compiled-CSS tests pass; full verify passes; browser screenshots reviewed; database-backed E2E and remote review evidence recorded before claiming the parent repair complete.
- **Verify:** `npm run verify && npm run test:e2e`; fixture commands in `docs/handoff/RESPONSIVE-REPAIR.md`.

#### T-5.13e: Admin sidebar, drawer and page transitions
`status: done` `owner: agent` `needs: T-5.01, T-5.02` `size: M`
- **Do:** Animate physical-right sidebar collapse/expansion and mobile dialog entry/exit, preserve modality/focus and persistent header/shell, animate only inner page content and reset its scroll on pathname navigation. Localize admin loading and use visible skeleton geometry. See `HANDOVER_TO_ANTI_GRAVITY.md`.
- **Done when:** Open/close and rapid reversal work after scrolling on phones; hidden links are not tabbable; focus returns; route changes preserve shell/session; both languages/themes and reduced motion pass visible checks and verify.
- **Verify:** `npm run verify`; responsive/motion regressions plus actual admin-route browser acceptance.

#### T-5.13f: Language-dependent admin navigation placement
`status: done` `owner: agent` `needs: T-5.01, T-5.02` `size: S`
- **Do:** Latest owner correction supersedes physical right for both languages: English sidebar/header toggle on left, Arabic on right, drawer slides from matching edge. Preserve collapse, independent content scrolling, modality/focus and session. Update old right-only assertions instead of removing them.
- **Done when:** Geometry and slide direction match language in expanded/collapsed/open-drawer states; live language switch and route navigation preserve focus/state; both themes and phone/desktop checks pass.
- **Verify:** `npm run verify`; admin responsive/motion tests and actual-route language-switch acceptance.

#### T-5.14: Verify owner InstaPay recipient and QR
`status: todo` `owner: agent` `needs: T-4.06, T-5.09` `size: S`
- **Do:** Inspect the actual `ip/ip.jpeg` and historical decode evidence in `docs/handoff/DATABASE-INTEGRATION.md`; verify asset delivery and prepare owner-reviewed settings correction to `alaa.ahm9624@instapay`; follow `docs/spec/payment-flow-change.md` and `docs/spec/owner-experience-change.md`. A public file URL is not private merely because its setting has RLS.
- **Done when:** Owner confirms correct merchant QR in authenticated post-approval flow; no public QR or invented payment URI; payment review remains authoritative.
- **Verify:** `npm run verify && npm run test:e2e`

#### T-5.15: Complete bilingual footer and policy editor
`status: todo` `owner: agent` `needs: T-3.10c` `size: L`
- **Do:** Settings edits footer branding, labels/order, contact details and full Terms/Privacy/Returns/Shipping/Contact copy using the persistent content contract. Reuse the homepage editor contract; no raw HTML or frontend-only saves. See `docs/spec/store-controls-and-auth-abuse.md`.
- **Done when:** Full policy routes and footer reflect saved content in both languages after reload/in another session; unauthorized writes fail; malformed content, cache invalidation and narrow-screen behavior tested. No invented policy promises.
- **Verify:** `npm run verify && npm run test:e2e`; local database permission regression tests.

### Phase 6: Dashboard

#### T-6.01: Dashboard data
`status: done` `owner: agent` `needs: T-5.01, T-1.03` `size: S`
- **Do:** Hook for `admin_dashboard(p_from, p_to)`. Parse the JSON with a Zod schema (`docs/spec/database-contract.md` lists the shape). Presets 7, 30, 90 days and a custom range.
- **Done when:** a malformed response produces a handled error; tests cover parsing.
- **Verify:** `npm run test:unit`

#### T-6.02: Dashboard UI
`status: done` `owner: agent` `needs: T-6.01` `size: L`
- **Do:** KPI cards; daily chart (booked versus delivered); breakdowns by status, delivery method and governorate; top products and customers; low-stock list linking to the product edit form. Recharts loaded lazily inside the admin chunk. Skeleton, empty and error states.
- **Done when:** the admin chunk is the only place the chart library appears (`check:bundle`); figures match the database for the seed data.
- **Verify:** `npm run build && npm run check:bundle`

#### T-6.03: Chart accessibility and export
`status: done` `owner: agent` `needs: T-6.02` `size: S`
- **Do:** Text summaries or table fallback for each chart, `aria-label`s, print-friendly styles, CSV of the daily series.
- **Done when:** axe reports no serious issues on the dashboard.
- **Verify:** `npm run test:e2e`

### Phase 7: Quality and security hardening

#### T-7.01: Arabic copy review and RTL QA
`status: done` `owner: agent` `needs: T-5.12, T-6.03, T-2.03` `size: L`
- **Do:** The owner or a native speaker reviews every string in `ar.json` against the voice rules in `docs/spec/design-system.md` (address form O-17); fix wording and plurals. RTL visual QA with Playwright screenshots of home, category, product, cart, checkout, the InstaPay screen, orders, admin products and the dashboard in both themes. Audit logical properties and mirrored icons. Check that phone numbers, emails and order numbers stay left-to-right.
- **Done when:** the owner signs off the copy table (H-11); screenshots exist and show no overlap, clipped text or reversed numbers.
- **Verify:** `npm run check:i18n && npm run test:e2e`

#### T-7.02: Accessibility pass
`status: done` `owner: agent` `needs: T-5.12, T-6.03` `size: M`
- **Do:** axe checks in Playwright for home, category, product, cart, checkout, the InstaPay screen, orders, admin products and the dashboard, in both themes. Fix critical and serious findings. Record a keyboard-only walkthrough in `docs/launch-checklist.md`.
- **Done when:** axe reports no critical or serious issues; the walkthrough is complete.
- **Verify:** `npm run test:e2e`

#### T-7.03: Performance pass
`status: done` `owner: agent` `needs: T-5.12, T-6.03` `size: M`
- **Do:** Meet the budgets: initial JS 200 KB gzip or less, largest contentful paint 2.5 s or less on throttled mobile for Home and Category (local preview), no image layout shift, route-level code splitting verified, fonts subset and preloaded. Document image guidelines (WebP, about 1200 px, about 200 KB).
- **Done when:** `check:bundle` enforces the JS budget; measurements are recorded in the PR.
- **Verify:** `npm run build && npm run check:bundle`

#### T-7.04: Security review and headers
`status: done` `owner: agent` `needs: T-5.12, T-6.03, T-1.22, T-2.08` `size: L`
- **Do:** Walk the checklist in `docs/spec/security-model.md` (section 11) and every SEC-xx control. Add `public/_headers` with a strict Content Security Policy (own origin, the Supabase project URL for `connect-src`, Supabase Storage for `img-src`, Cloudflare Turnstile's domain for its script and frame, no inline scripts: use hashes) plus `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`, Referrer-Policy and Permissions-Policy. Review the Supabase Security Advisor output and every `rpc` input. Write the results to `docs/security-review.md`.
- **Done when:** the review lists each control with its evidence and any follow-up; the browser console shows no CSP violations on any page; the Security Advisor has no unexplained warnings.
- **Verify:** `npm run db:test && npm run check:secrets && npm run check:sql`

#### T-7.05: Supply-chain hardening
`status: done` `owner: agent` `needs: T-0.12` `size: M`
- **Do:** Run `npm ci --ignore-scripts` in CI (allow-list the few packages that need install scripts), add `npm audit signatures`, a license check, a lockfile check that only the expected registry host appears, and a check that every GitHub Action is pinned to a full SHA. Write `docs/runbooks/dependencies.md`: how to review a new dependency (maintainers, install scripts, size, alternatives).
- **Done when:** CI fails when an action is unpinned or the lockfile points to an unexpected registry.
- **Verify:** open a PR and read the checks

#### T-7.06: Static analysis (Semgrep)
`status: done` `owner: agent` `needs: T-0.06` `size: M`
- **Do:** Add a `sast` job running Semgrep with a maintained TypeScript and React ruleset plus project rules in `.semgrep/`: forbid `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, rendering `error.message`, `fetch` to hosts outside an allow-list, and any mention of `service_role`. Fail on high severity.
- **Done when:** a planted violation of each project rule fails the job.
- **Verify:** open a PR and read the checks

#### T-7.07: Dynamic scan (OWASP ZAP baseline)
`status: done` `owner: agent` `needs: T-1.12, T-7.04` `size: M`
- **Do:** Add `zap.yml`: weekly and manual OWASP ZAP baseline scan against the staging site only (passive checks, never production). Upload the report as a private artifact. Add a rules file for triaged findings.
- **Done when:** a clean report or a triaged list exists and no high finding is open.
- **Verify:** run the workflow against staging

#### T-7.08: Security end-to-end tests
`status: done` `owner: agent` `needs: T-5.12, T-2.08, T-4.06` `size: L`
- **Do:** Playwright suite `e2e/security/`: an unknown email and a wrong password give the same message, status and request count; the same neutral message for reset and sign-up; an admin without MFA cannot load admin data; a customer cannot read another customer's order or proof by id; uploads of renamed HTML or SVG are refused; a product name containing script and SQL text renders as plain text; CSV export neutralises formulas; sensitive actions ask for step-up; no CSP violations.
- **Done when:** the suite passes in CI.
- **Verify:** `npm run test:e2e -- e2e/security`

#### T-7.09: Claude Security scans
`status: todo` `owner: human` `needs: T-7.04, T-7.08` `size: M`
- **Do:** In Claude Code, open the repository and run the Claude Security skill: **Scan codebase** at medium effort. Triage every finding into a GitHub issue (fix, accept with a reason, or false positive) and re-scan after fixes. From then on run **Scan changes** on every PR that touches a security-sensitive path. Keep the `CLAUDE-SECURITY-*/` report folders out of git and out of public repositories. The scan complements SAST, dependency scanning and review; it does not replace them.
- **Done when:** no unresolved high or critical finding remains and the triage list is recorded in `docs/security-review.md`.
- **Verify:** the report and the triage list

#### T-7.10: Incident response and key rotation runbook
`status: done` `owner: agent` `needs: T-7.04` `size: M`
- **Do:** Write `docs/runbooks/incident-response.md`: the first 15 minutes (disable sign-ups, switch to the maintenance message, revoke sessions), how to rotate every secret listed in `docs/spec/security-model.md` section 8, how to restore from backup, whom to inform and what to tell customers, and a post-incident review template. Include playbooks for "suspected stolen admin account" and "QR code swapped".
- **Done when:** the owner has read it and a tabletop run-through is logged in the Work log.
- **Verify:** manual review

#### T-7.11: Privacy and legal pages
`status: done` `owner: agent` `needs: T-2.02, T-3.03` `size: M`
- **Do:** Build Arabic pages for the privacy policy, terms of sale, shipping and returns, and contact. Add a storage notice that matches what the site really stores (theme and cart only, no tracking). Add a migration with `admin_anonymize_customer(p_user_id)` (admin, step-up, audited) that clears personal fields on the profile and on that customer's orders while keeping totals, and write `docs/runbooks/data-requests.md` (export a customer's data, anonymise on request, disable the login in the Supabase dashboard). Texts come from the owner and a legal professional (H-12); the retention schedule comes from O-14.
- **Done when:** the pages are linked from the footer and checkout; the data-request procedure works on staging with a test customer.
- **Verify:** manual review and `npm run db:test`

### Phase 8: Launch

#### T-8.01: Auth email and hardening runbooks
`status: done` `owner: agent` `needs: T-2.04` `size: M`
- **Do:** Write `docs/runbooks/auth-email.md`: why custom SMTP is required (the built-in sender is limited to 2 emails per hour; with custom SMTP the default limit is 30 new users per hour, see Supabase's production checklist), the settings to fill in, redirect URLs for staging and production, and a test procedure. Write `docs/runbooks/auth-hardening.md`, a tick-list for the Supabase Auth settings: Turnstile on, email confirmation on, secure email change on, minimum password length 10, anonymous sign-ins off, TOTP MFA enabled, exact redirect URLs only, unused providers off, leaked-password protection if the plan allows (verify). Check that the app shows clear "check your email", "resend" and "link expired" states.
- **Done when:** both runbooks are complete and the UI states have tests.
- **Verify:** `npm run test:unit`

#### T-8.02: Configure auth email
`status: todo` `owner: human` `needs: T-8.01, T-1.11` `size: M`
- **Do:** Choose an SMTP provider (O-04), configure it in Supabase for staging and production, set site and redirect URLs, keep email confirmation on (O-05).
- **Done when:** sign-up, confirmation and password reset arrive in a real inbox on staging.
- **Verify:** follow the test procedure in the runbook

#### T-8.03: Production setup
`status: todo` `owner: human` `needs: T-1.12, T-1.13, T-7.04, T-8.01` `size: M`
- **Do:** Run `db-production.yml` for the first push. Tick every item in `docs/runbooks/auth-hardening.md`. Confirm the limits on both storage buckets. Schedule `expire_unpaid_orders()` with `pg_cron` (or confirm the manual button). Confirm the Cloudflare Production variables. Check that opening `/category/earrings` directly returns the app (single-page-app fallback; Pages serves `index.html` for unknown paths when there is no top-level `404.html`, so verify it). Review the Security Advisor.
- **Done when:** production loads, deep links work, the schema matches staging and the checklist is ticked.
- **Verify:** open the production URL and a deep link

#### T-8.04: Real data
`status: todo` `owner: human` `needs: T-8.03` `size: M`
- **Do:** Follow `first-admin.md` and `delivery-fees.md`. Enter categories, real delivery fees and representative coverage (H-05), the InstaPay address and QR image (H-10), products and photos (H-06).
- **Done when:** the admin can log in with two factors and the storefront shows the real catalogue.
- **Verify:** manual check

#### T-8.05: Keep-alive workflow (only if staying on a free plan)
`status: done` `owner: agent` `needs: T-1.12` `size: S`
- **Do:** `.github/workflows/keepalive.yml`, scheduled weekly, sends one request to the REST URL with the public key (secrets `PRODUCTION_URL`, `PRODUCTION_ANON_KEY`). Document that free projects pause after a week without activity. Mark `skip` if the production plan is a paid one (O-11).
- **Done when:** the workflow is reviewed and the owner decides whether to enable it.
- **Verify:** review the workflow file

#### T-8.06: Backup and restore runbook
`status: done` `owner: agent` `needs: T-5.11, T-1.12` `size: M`
- **Do:** Write `docs/runbooks/backup-restore.md`: the plan's own backups if any, a weekly CSV export from the admin screens, a `supabase db dump` procedure for the owner, a backup before every production DB push, and a restore rehearsal on staging.
- **Done when:** the restore rehearsal succeeded on staging and is recorded.
- **Verify:** manual review

#### T-8.07: Monitoring and plan decision
`status: done` `owner: agent` `needs: T-8.06` `size: M`
- **Do:** Write `docs/runbooks/monitoring.md`: an external uptime check on the home page and a light REST endpoint; alerts for site down, Supabase usage above 80% of plan limits, forecast job failed, Dependabot alerts and expired InstaPay orders; the maintenance message (setting `announcement_ar`). Write the plan-decision memo for O-11 comparing free and paid options (backups, pausing, limits), with current prices read from the vendor pricing page on the day.
- **Done when:** the memo and runbook are complete; the owner creates the monitor and confirms alerts arrive.
- **Verify:** manual review

#### T-8.08: Load and resilience test
`status: done` `owner: agent` `needs: T-5.12, T-1.12` `size: M`
- **Do:** k6 scripts in `perf/` for browsing and checkout against staging only (never production), with a realistic ramp. Thresholds: p95 under 800 ms for reads. Check the query plans of the hot queries and the indexes. Confirm rate limits behave. Write `docs/perf-report.md`.
- **Done when:** the thresholds are met or the report lists the fixes made.
- **Verify:** run the scripts against staging

#### T-8.09: Admin onboarding and break-glass
`status: todo` `owner: human` `needs: T-2.06, T-1.14, T-8.03` `size: M`
- **Do:** Follow `docs/runbooks/admin-onboarding.md`: create each admin with owner SQL, enroll the authenticator on two devices, test a lock-out recovery (the owner removes a factor in the Supabase dashboard), store a recovery contact.
- **Done when:** every admin is enrolled on two devices and the recovery test is recorded.
- **Verify:** the recorded test

#### T-8.10: Soft launch
`status: todo` `owner: human` `needs: T-8.04, T-7.01, T-7.02, T-7.03, T-7.07, T-7.09, T-7.10, T-7.11, T-8.02, T-8.06, T-8.07, T-8.08, T-8.09` `size: L`
- **Do:** Place about 10 real orders end to end on phones (both delivery methods; cash on delivery and InstaPay with a real transfer). Check stock, statuses, tracking details, payment review and the dashboard. Sign off using `docs/launch-checklist.md` and the pre-launch checklist in `docs/spec/security-model.md`.
- **Done when:** every checklist item is ticked and no blocking issue remains.
- **Verify:** the signed checklist

#### T-8.11: Operations runbook
`status: done` `owner: agent` `needs: T-8.06` `size: S`
- **Do:** Write `docs/runbooks/weekly.md`: dashboard, pending and expired InstaPay orders, audit log review, forecasts and reorder list, Supabase usage against plan limits, backups, dependency alerts, and what to do when something breaks. Link it from the README.
- **Done when:** the runbook is complete and linked.
- **Verify:** manual review

### Phase 9: AI analytics

#### T-9.01: Analytics database foundation
`status: done` `owner: agent` `needs: T-1.21, T-1.18, T-1.09` `size: L`
- **Do:** Migration (S31). Schema `analytics` with views `sales_daily` and `stock_daily`; tables `calendar`, `forecast_runs`, `sales_forecasts`, `forecast_metrics`, `basket_pairs`, `cohort_retention`; view `forecast_accuracy`. Roles `analytics_reader` and `analytics_writer` with no access to `public` tables. No personal data in any object. The admin UI reads results only through admin-only functions in `public` (such as `admin_get_forecasts`), never by exposing the `analytics` schema. Record the CI connection method for the restricted roles in an ADR (verify what Supabase supports).
- **Done when:** pgTAP proves the role boundaries; the views return correct sums for the seed data; the `analytics` schema is not reachable through the REST API.
- **Verify:** `npm run db:test`

#### T-9.02: Python project and synthetic data
`status: done` `owner: agent` `needs: T-0.06` `size: L`
- **Do:** Create `analytics/` as laid out in `docs/spec/analytics-plan.md` section 11: `pyproject.toml`, lockfile, ruff, pytest, `config.toml` (gates and defaults), CLI skeleton, and `synthetic.py` generating realistic shop data (trend, weekly pattern, Ramadan and Eid bumps, promotions, intermittent items, stock-outs, fake-order noise) with a fixed seed. Add the `analytics` CI job and the scripts `analytics:install`, `analytics:test`.
- **Done when:** `npm run analytics:test` passes; the generator is deterministic and its output exercises every cleaning rule.
- **Verify:** `npm run analytics:test`

#### T-9.03: Features and calendar
`status: done` `owner: agent` `needs: T-9.02` `size: M`
- **Do:** `calendar.py`: Hijri conversion for Ramadan and both Eids, Mother's Day, Valentine's Day, Black Friday, back-to-school, with a committed official-dates table to cross-check. `features.py`: lags, rolling statistics, calendar, discount, `in_stock_fraction`. Cleaning functions from the plan (censoring, winsorising, exclusion rules).
- **Done when:** unit tests cover event dates for the next three years against the committed table, prove no future data leaks into features, and cover each cleaning rule.
- **Verify:** `npm run analytics:test`

#### T-9.04: Baselines and backtesting
`status: done` `owner: agent` `needs: T-9.03` `size: M`
- **Do:** `models/baselines.py` (seasonal naive, 28-day moving average), `backtest.py` (rolling-origin folds), metrics (WAPE, MASE, pinball loss, bias) and a report table.
- **Done when:** a golden test on synthetic data reproduces known metric values; a property test proves no fold sees future data.
- **Verify:** `npm run analytics:test`

#### T-9.05: Statistical and intermittent models
`status: done` `owner: agent` `needs: T-9.04` `size: L`
- **Do:** `models/statistical.py` (AutoETS, AutoTheta) and `models/intermittent.py` (Croston SBA, TSB, ADIDA) with `statsforecast`; conformal 80% intervals; coverage reporting.
- **Done when:** on synthetic data the chosen model beats seasonal naive by at least 5% WAPE on shop series, and interval coverage is within 10 points of 80%.
- **Verify:** `npm run analytics:test`

#### T-9.06: Optional global ML model
`status: done` `owner: agent` `needs: T-9.05` `size: L`
- **Do:** Only if the owner approves through an ADR once there are at least 6 months of data and 30 active products: a LightGBM global model with lag, rolling, calendar, price, discount and stock features, direct multi-horizon, compared with the statistical models in backtests. Otherwise mark this task `skip`.
- **Done when:** the ADR exists; if built, the model beats the best statistical model in backtests, otherwise it stays disabled.
- **Verify:** `npm run analytics:test`

#### T-9.07: Selection, gates and output validation
`status: done` `owner: agent` `needs: T-9.05` `size: M`
- **Do:** `select.py`: best model per series, the 5% rule, optional combination, readiness gates from config, fallbacks and statuses (`ok`, `preliminary`, `insufficient_data`), and output validation (finite, not negative, nothing above 5 times the historical maximum, hierarchy within tolerance).
- **Done when:** unit tests cover each gate, fallback and validation failure.
- **Verify:** `npm run analytics:test`

#### T-9.08: Weekly forecast workflow and writes
`status: done` `owner: agent` `needs: T-9.07, T-9.01, T-1.12` `size: L`
- **Do:** `write.py` and `cli.py run --env staging|production` write `forecast_runs`, `sales_forecasts` and `forecast_metrics` through `analytics_writer`, idempotent per day. Add `.github/workflows/forecast.yml` (weekly and manual, 30-minute timeout, secrets per environment, no personal data in logs).
- **Done when:** a staging run on synthetic data fills the tables; rerunning on the same day replaces rather than duplicates; a failed validation writes nothing.
- **Verify:** run the workflow against staging

#### T-9.09: Accuracy tracking and drift alert
`status: done` `owner: agent` `needs: T-9.08` `size: M`
- **Do:** Implement `forecast_accuracy` and the weekly check from section 9 of the plan: a 4-week rolling WAPE more than 20% worse than seasonal naive for 2 weeks switches the display to the baseline and sets a flag the admin banner reads.
- **Done when:** a simulated drift on synthetic data triggers the flag and it clears when accuracy recovers.
- **Verify:** `npm run analytics:test`

#### T-9.10: Admin forecast and reorder screens
`status: done` `owner: agent` `needs: T-9.08, T-5.01, T-2.08` `size: L`
- **Do:** `/admin/forecast` in Arabic: a chart with history, forecast and the 80% band for the shop, a category or a product; badges for preliminary data and not enough data (ANL-001); a reorder list with days of cover, reorder point and suggested quantity (formulas in the plan); stock-risk and dead-stock lists. Data comes only through the admin-only functions from T-9.01.
- **Done when:** tests cover the formulas and badges; a customer or an admin at `aal1` receives nothing.
- **Verify:** `npm run test:unit`

#### T-9.11: Descriptive analyses and Analytics page
`status: done` `owner: agent` `needs: T-9.01, T-9.08, T-5.01` `size: L`
- **Do:** `insights/` (RFM, basket, cohorts) written by the job to the aggregate tables; SQL views for the other analyses in section 8 of the plan; the `/admin/analytics` page; groups of fewer than 5 customers merge into "أخرى"; CSV export through step-up.
- **Done when:** each analysis matches hand-computed numbers on synthetic data and returns no personal data.
- **Verify:** `npm run analytics:test && npm run test:unit`

#### T-9.12: Model card and analytics runbook
`status: done` `owner: agent` `needs: T-9.09, T-9.10, T-9.11` `size: M`
- **Do:** Write `docs/analytics/model-card.md` (data, models, metrics, limits, retraining routine) and `docs/runbooks/analytics.md` (how to add a model, run backtests, read a failed job, switch to the baseline by hand).
- **Done when:** the owner can explain from the model card what the forecast does and does not know.
- **Verify:** manual review

#### T-9.13: Go-live of production forecasts
`status: todo` `owner: human` `needs: T-9.12, T-8.10` `size: S`
- **Do:** After launch, once the readiness gates are met on real data, review the backtest report with the agent, then enable the production `forecast.yml` schedule and the admin page.
- **Done when:** the first production run is reviewed and its accuracy tracking is visible.
- **Verify:** review the first run

---

#### T-9.14: Upcoming occasion reminders for admins
`status: todo` `owner: agent` `needs: T-9.03, T-2.10` `size: L`
- **Do:** Expose the existing calendar through an AAL2-only API, show upcoming events in Forecast, and add deduplicated in-app admin reminders with configurable advance notice and read/dismiss state. See `docs/spec/store-controls-and-auth-abuse.md`.
- **Done when:** Cairo date boundaries, year rollover, uncertain/reviewed holiday dates, no sales history, duplicate generation and unauthorized access tested. Reminders never invent uplift, change prices automatically or activate production forecasting.
- **Verify:** `npm run db:reset && npm run db:test && npm run db:types && npm run analytics:test && npm run verify && npm run test:e2e`

## Appendix A: Task format and the roadmap tool

Task block (the tool ignores fenced code blocks, so this example is not a task):

```
#### T-<phase>.<nn>: Title
`status: todo|doing|done|blocked|skip` `owner: agent|human` `needs: T-x.yy, T-x.zz | none` `size: S|M|L`
- **Do:** ...
- **Done when:** ...
- **Verify:** `command` or manual check
```

- IDs are never reused. Size guide: S about an hour, M about half a day, L about a day; split anything that exceeds about 400 changed lines.
- `blocked` requires an Appendix G row naming the task. `skip` requires the owner's decision, logged.
- A task starts at `#### T-<phase>.<nn>: ...`; the next non-empty line holds the metadata code spans; the block ends at the next heading of level 4 or higher.

`scripts/roadmap.mjs` commands:

| Command | Behaviour |
|---|---|
| `status` | Counts per phase and overall (todo, doing, done, blocked, skip) |
| `next` | Prints the full block of the first task by ID with status `todo`, owner `agent`, and every `needs` entry `done` or `skip`. If none: lists tasks waiting on a human and tasks waiting on unfinished dependencies. Exit code 0. |
| `check` | Validates: unique, well-formed IDs; allowed status, owner, size; every `needs` refers to an existing ID; no cycles; each block has **Do**, **Done when**, **Verify**; the ID's phase matches the nearest `Phase N` heading. Prints line numbers and exits 1 on error. |
| `set <id> <status>` | Rewrites the status span in place. Refuses `done` if a dependency is not `done` or `skip`. Refuses `blocked` unless Appendix G mentions the ID. |

---

## Appendix B: `AGENTS.md` template

```markdown
# Agent instructions: Lolys' Accessories & Home

`roadmap.md` is the source of truth for scope, order and status. Read its
sections 0 and 1 first. Specs are in `docs/spec/`; read only the ones your
task cites.

## Start of every session
1. Fetch the latest main; run `npm ci` if package-lock.json changed.
2. `npm run roadmap:next` prints the next task. Work only on that task.
3. Create the branch `agent/<task-id>-<slug>`.

## Commands
- `npm run verify`            lint + typecheck + unit tests + build (before every commit)
- `npm run db:reset`          rebuild the local database from migrations + seed
- `npm run db:test`           pgTAP tests        `npm run db:types`  regenerate types
- `npm run test:e2e`          Playwright         `npm run analytics:test`  Python tests
- `npm run roadmap -- set T-x.yy done`   update a task's status

## Hard rules (full list: roadmap.md section 1)
- RLS on every table. The browser never decides prices, totals, stock, roles
  or payment status.
- No raw SQL reachable by users; no dynamic SQL built with string joins; no
  SQL box in any UI.
- Admin needs MFA (aal2) checked in the database. Never add a way to create
  or promote admins.
- Login, sign-up and reset messages are generic (AUTH-001, AUTH-010). Show
  Arabic messages with codes from docs/spec/error-codes.md; never raw errors.
- Never commit secrets or read .env files. The Supabase secret (service-role)
  key is not used by this project.
- Uploads: images only, never SVG. Payment proofs are private.
- Merged migrations are append-only. DB changes go in their own PR with pgTAP tests.
- Never push to main, merge PRs, or run anything against staging or production.
- Arabic UI (RTL), logical CSS properties, both themes, 360px. Text only
  through i18n keys.
- Security-sensitive paths need owner review: supabase/migrations,
  src/features/auth, src/features/admin, .github/workflows, public/_headers.
- When blocked: stop, log a question in roadmap.md Appendix G, take the next task.

## Finish
Set the task to done, add a Work log row, open a PR with the template, stop.
```

---

## Appendix C: Pull request template

```markdown
## Task
T-x.yy: title

## What changed
-

## How I verified it
Commands run and their results:

## Checklist
- [ ] Every "Done when" item is true; Verify commands pass
- [ ] `npm run verify` passes
- [ ] Tests added or updated (pgTAP for DB changes; types regenerated)
- [ ] No secrets, no .env content, no stray console.log
- [ ] UI: Arabic RTL, light and dark, 360px and 1280px checked
- [ ] Roadmap status and Work log updated; docs or ADR updated if needed

## Security note (required for security-sensitive paths)
SEC-xx controls touched, and what could go wrong:

## Screenshots (UI changes)

## Risks and follow-ups
```

---

## Appendix D: ADR template

```markdown
# ADR-NNNN: Title
- Status: proposed | accepted | superseded by ADR-XXXX
- Date: YYYY-MM-DD
- Task: T-x.yy

## Context
What forces the decision.

## Decision
What we chose, in one paragraph.

## Alternatives considered
Short list with why not.

## Consequences
What gets easier, what gets harder, what to watch.
```

---

## Appendix E: Spec index

| File | What it defines | Used by |
|---|---|---|
| `docs/spec/security-model.md` | Threat model, SEC-xx controls, auth and admin design, checklists | T-0.12, T-1.15 to T-1.22, T-2.04 to T-2.09, Phase 5, Phase 7, Phase 8 |
| `docs/spec/error-codes.md` | Error code catalogue, Arabic messages, mappings | T-1.10, T-2.08 and every UI task |
| `docs/spec/database-contract.md` | Tables, functions, settings, storage, role rights, test scenarios S1 to S31 | Phases 1 and 3 to 6, Phase 9 |
| `docs/spec/design-system.md` | Brand, light and dark tokens, typography, RTL rules, ornaments, Arabic copy deck | T-0.07, T-0.08, UI tasks, T-7.01 |
| `docs/spec/analytics-plan.md` | Forecasting and analysis plan | Phase 9 |

---

## Appendix F: npm scripts

| Script | Command or purpose |
|---|---|
| `dev`, `build`, `preview` | Vite (`build` runs the type check first) |
| `lint`, `format`, `format:check`, `typecheck` | ESLint, Prettier, TypeScript |
| `test:unit` | `vitest run` |
| `test:e2e` | `playwright test` |
| `verify` | `lint` + `typecheck` + `test:unit` + `build` (the gate before every commit) |
| `db:start`, `db:stop` | `supabase start`, `supabase stop` |
| `db:reset` | `supabase db reset` (migrations + seed) |
| `db:test` | `supabase test db` |
| `db:test:concurrency` | `bash supabase/tests/concurrency.sh` |
| `db:types` | `supabase gen types typescript --local > src/types/database.types.ts` |
| `roadmap`, `roadmap:next`, `roadmap:check` | `node scripts/roadmap.mjs` (see Appendix A) |
| `check:secrets`, `check:bundle`, `check:i18n`, `check:migrations`, `check:sql` | the matching scripts in `scripts/` |
| `analytics:install` | install the Python environment for `analytics/` |
| `analytics:test` | `ruff check analytics` and `pytest analytics` |
| `analytics:forecast` | manual forecast run against staging (`python -m lolys_analytics.cli run --env staging`) |

---

## Appendix G: Logs

### Work log (append only, newest last)

| Date | Task | Who | Summary | PR |
|---|---|---|---|---|
| 2026-10-06 | none | Claude | Roadmap created from the project plan, tested SQL and the frontend demo | none |
| 2026-10-07 | none | Claude | v1.1: Arabic-first Lolys' brand, MFA and security phase, InstaPay QR payments, admin CMS, error codes, AI analytics phase, spec files | none |

| 2026-10-09 | T-0.01 | Codex + Anti-Gravity | Clean locked install and build pass on portable Node 24.21.0; blank Arabic/RTL dev page verified in browser. Required SQL sections preserved. Full verify and PR/CI pending T-0.02/remote. | local only |
| 2026-10-09 | T-0.02 | Codex | Blocked by incompatible latest-major peer ranges; OD-001 records proposed supported-version exception. | none |

| 2026-10-09 | T-0.02 | Codex | Non-blocked preparation: Vitest/Testing Library/jsdom, formatter, alias, explicit nonzero future-task stubs and lint config drafted. 1 app test passes; lint install awaits OD-001. | local only |
| 2026-10-09 | T-0.03 | Codex + Anti-Gravity | CLI and 27 tests pass; 109-task roadmap validates. Extra arguments rejected; skip requires logged owner decision. Prepared while OD-001 is pending; status remains todo until bootstrap/full verify complete. | local only |
| 2026-10-09 | T-0.04, T-0.05 | Codex | Prepared 65-line instructions, CLAUDE import, PR/ADR templates, exact installed-version ADR and planned runbook index. Awaiting dependency/full verification gates; no remote PR or CI available. | local only |

| 2026-10-09 | T-0.02 | Owner | Approved compatible TypeScript 6 and ESLint 9 (OD-001) in chat; install exact supported releases and preserve required checks. | local only |
| 2026-10-09 | T-0.01, T-0.03 | Codex | Attribution correction: earlier Anti-Gravity label meant an internal Codex QC helper. User confirms the external Anti-Gravity application has not started. | none |

| 2026-10-09 | T-0.01–T-0.05 | Codex | Full local verify passes after owner-approved TypeScript 6.0.3 / ESLint 9.39.5. 28 tests pass; no task marked done until PR checks are green. | pending |
| 2026-10-09 | T-0.06 | Codex | Prepared SHA-pinned read-only CI v1 with 80% src/lib coverage. Later checks remain explicit stubs and are wired by their own tasks (T-0.09, T-2.03); no required implemented check removed. Remote fetched; local branch based on README-only main without discarding local work. SEC-16, SEC-24. | pending |
| 2026-10-09 | T-0.01–T-0.06 | Anti-Gravity | Completed local checks and marked tasks done. Proceeding to T-0.07. | local only |
| 2026-10-09 | T-0.07 | Anti-Gravity | Restored checkpoint files, implemented brand tokens in Tailwind CSS v4, self-hosted Cairo and Aref Ruqaa fonts, and added ThemeProvider and ThemeToggle components. Tests passed and fully verified. | local only |
| 2026-10-09 | T-0.08 | Anti-Gravity | Implemented UI kit components (Button, IconButton, Card, Input, SearchInput, Select, Textarea, Checkbox, Radio, Badge, Pill, Skeleton, Toast, Dialog, Tabs) and SVG ornaments. Added dev-only route /__kit showing all components in both themes and LTR. Wrote component tests; fully verified via npm run verify. | local only |
| 2026-10-09 | T-0.09 | Anti-Gravity | Implemented repo guards (check-secrets.mjs, check-bundle.mjs) and wired them into the build script. Budget breaches and secrets caught correctly. | local only |
| 2026-10-09 | T-0.12 | Anti-Gravity | Added security basics: SECURITY.md, security.txt, CODEOWNERS, and dependabot.yml. Added gitleaks secrets check to CI. | local only |
| 2026-10-10 | T-1.01 | Anti-Gravity | Blocked. Docker is absent on this environment (H-08). Supabase init and configuration completed, but db:start cannot be verified. | blocked |
| 2026-10-10 | T-0.08b–T-0.08d | Anti-Gravity | Verified all UI Kit components in the browser (Checkbox, Radio, native Dialog focus trap, Tabs, PearlLoader, and labels). Visual acceptance passed. Committing T-0.08d. | local only |
| 2026-10-10 | T-0.08e | Anti-Gravity | Implemented token guard script and wired it into verify. Script rejects hard-coded values and passes on current implementation. | local only |
| 2026-10-09 | T-0.01–T-0.07 | Codex | Owner confirms external Anti-Gravity ran concurrently and is now paused. Preserved its 21 partial T-0.07 files with SHA-256 checkpoint; reconciled foundation statuses to doing because required PR/CI evidence and workflow owner review are still pending. Original work retained for restoration. | pending |
| 2026-10-09 | T-0.06 | Codex | PR CI run 37929038785: build, unit and roadmap green; static correctly rejects the deliberately unused probe variable. Probe removed after recording evidence; final green CI and owner review pending. | [#1](https://github.com/HassanG04/lolys/pull/1) |
| 2026-10-10 | T-0.01–T-0.06 | Codex | All four final foundation jobs green in run 37929355898 at b4faa49; negative lint test already verified. T-0.01–T-0.05 done; T-0.06 remains doing solely pending required owner workflow review. No merge/deploy. | [#1](https://github.com/HassanG04/lolys/pull/1) |
| 2026-10-10 | T-0.07, T-0.08, T-0.09, T-0.12 | Codex | Incoming Anti-Gravity verify passes (13 app + 27 tooling tests), but review found unmet criteria including production KitPage output, incomplete contrast/keyboard tests, and fail-open guard behavior. Preserved 53 files with hashes; deferred later drafts in local checkpoint and reverted their completion statuses. Review details in .agent-state/anti-gravity-review.md. | local review |
| 2026-10-10 | T-0.07, T-0.07b | Codex | Split tokens/fonts from persistent theme behavior per the 400-line review rule; retained every original requirement and made T-0.08 depend on both. Implementing on agent/T-0.07-themes. | pending |
| 2026-10-10 | T-0.07, T-0.07b | Codex | Final verify passes (10 app + 66 tooling tests, all 31 contrast pairs), build passes and 110 tasks validate. Browser verifies both themes at 360/1280 in RTL/LTR, keyboard focus, persisted reload and 44px minimum; screenshots/measurements saved. Theme PR CI pending. | pending |
| 2026-10-10 | T-0.07, T-0.07b | Codex | All four theme CI jobs green in run 38021668187 at 7d7fcbf; both tasks done. Theme PR stacked on foundation PR 1; no merge/deploy. T-0.08 is next, using preserved drafts plus the concrete review findings. | [#2](https://github.com/HassanG04/lolys/pull/2) |
| 2026-10-10 | T-0.07b | Codex | Owner requested crescent/sun icons instead of visible theme text. Implemented SVGs with currentColor, Arabic accessible name and action tooltip, retaining 44px minimum and keyboard behavior. Local verify passes (76 tests), build and roadmap pass; browser URL policy blocked fresh visual review. Prior screenshots predate this follow-up. | [#2](https://github.com/HassanG04/lolys/pull/2) |

| 2026-10-10 | T-0.07b | Codex | Crescent/sun follow-up e34b6c2 passes all four remote checks in run 38022228681. | [#2](https://github.com/HassanG04/lolys/pull/2) |
| 2026-10-10 | T-0.08 | Codex | Split original UI kit into actions/cards, forms, feedback/navigation, labels/ornaments and final token/preview guard tasks (T-0.08b–T-0.08e); downstream tasks require the full kit. Implemented first component set and dev preview; 82 tests, build, production kit exclusion and 114-task roadmap check pass. Browser policy prevents fresh visual checks; status remains doing. | pending |

| 2026-10-10 | T-0.08 | Codex | All four PR jobs pass at 0ba979e in run 38023041519; 82 local tests, build and production kit exclusion verified. UI visual gate is still pending due to browser policy; task remains doing. | [#3](https://github.com/HassanG04/lolys/pull/3) |

| 2026-10-10 | T-0.08b, T-0.08f | Codex | Continuing implementation preparation while T-0.08 visual gate remains open; no dependency marked complete or acceptance check waived. Split checkbox/radio into T-0.08f to retain small reviews. Added labelled text/search fields and static catalogue-error preview; behavior tests pass, full verification pending. | pending |

| 2026-10-10 | T-0.08b | Codex | Full verify passes (21 app + 66 tooling tests), build passes and 115 tasks validate. React review retained native behavior, direct imports and development-only loading; no new dependencies. Visual gate remains open. | pending |

| 2026-10-10 | T-0.08b | Codex | All four remote jobs passed at 3aab682 in run 38028479207. Production preview-exclusion check passed. Task remains doing pending upstream and browser visual gates. | [#4](https://github.com/HassanG04/lolys/pull/4) |
| 2026-10-10 | T-0.08f | Codex | Preparing checkbox/radio controls on a separate branch; native 44px inputs, non-color selection marks, labels, group IDs and forced-colors fallback. Visual gates are retained. | pending |

| 2026-10-10 | T-0.08f | Codex | Full verify passes (26 app + 66 tooling tests), production build/exclusion and 115-task roadmap pass. Native reset test now invokes an actual reset button, rather than merely dispatching a reset event. Browser visual gate and PR checks pending. | pending |

| 2026-10-10 | T-0.08f | Codex | All four remote checks pass at a0708bc in run 38028693736. Text and choice controls are published for review; T-0.08/T-0.08b/T-0.08f retain their pending browser visual/dependency gates. | [#5](https://github.com/HassanG04/lolys/pull/5) |

| 2026-10-10 | T-0.08c, T-0.08g | Codex | Prepared tabs/notifications while earlier visual gates remain open; no dependency marked complete. Dialog is split into T-0.08g under the review-size rule, with all original criteria retained; its draft is preserved locally. Full verify passes (34 app + 66 tooling tests), build and 116-task roadmap pass. Browser verification remains blocked by prior URL policy denial; status stays doing. | pending |

| 2026-10-10 | T-0.08c | Codex | Draft PR 6 published at 68e506e; all four remote jobs pass in run 38071233956. Local verify passes (100 tests), production kit exclusion and 116-task roadmap pass. Task remains doing pending upstream/browser visual gates. Dialog draft is split and preserved; installed jsdom lacks native dialog methods, so mocked focus tests are not acceptance evidence. | [#6](https://github.com/HassanG04/lolys/pull/6) |

| 2026-10-10 | T-0.08g | Codex | Replaced the preserved dialog draft with native showModal, controlled close/cancel, lifecycle cleanup and focus restoration. Arabic previews and two closed-markup/event tests added; full verify passes (36 app + 66 tooling tests), production build and 116-task roadmap pass. jsdom lacks native modal methods, so focus/inert/Escape and visual acceptance remain unverified due to browser policy; no gate waived or mocks substituted for proof. | pending |

| 2026-10-10 | T-0.08g | Codex | Draft PR 7 published; all four remote jobs pass at a49d87c in run 38071645439. Local verify passes (102 tests), production kit exclusion and 116-task roadmap pass. Native-dialog and visual acceptance remain open. Feedback documentation 22effa5 also has four green jobs in run 38071382759. | [#7](https://github.com/HassanG04/lolys/pull/7) |

| 2026-10-10 | T-0.08e | Codex | Reopened acceptance gate after review: original regex missed CSS/arbitrary/unknown styles; bilingual commit 96ad75f leaks preview copy into production. Repaired token/production guards with negative fixtures and CI enforcement (SEC-16/SEC-24). 42 app + 97 tooling tests and all verification stages pass. Full visual matrix evidence remains outstanding; Anti-Gravity browser report preserved as reported evidence. | pending |

| 2026-10-10 | T-0.08h, T-0.08i | Codex | Preserved incoming bilingual work and recorded ADR-0002 for OD-003; split detailed preference tests into T-0.08i to keep reviews small. Fixed preview-copy boundary and reused accessible Button; Arabic error contract retained. Preparing this slice while T-0.08e visual matrix remains open; no gate waived. | pending |

| 2026-10-10 | T-0.08d, T-0.08e, T-0.08h | Codex | Draft PRs 8/9/10 each have all four jobs green at 6c18be3 / 4ac7126 / 8a6786d in runs 38081096113 / 38081098408 / 38081350854. Bilingual build excludes preview copy after repair. Human review and final visual matrix remain open. | [#10](https://github.com/HassanG04/lolys/pull/10) |
| 2026-10-10 | T-0.08i | Codex | Added 12 language behavior/parity/error-preview tests; corrected Arabic language-tag matching and updates document direction before paint. npm run verify passes (54 app + 97 tooling tests), production guards pass, 118-task roadmap validates. Preparing while upstream visual gate remains open; no acceptance criteria waived. | pending |

| 2026-10-10 | T-0.08i | Codex | All four remote jobs pass at e8774dd in run 38081581119. Local verify passes with 151 tests; exact continuation/file inventory and pending visual matrix saved. T-0.08e/h/i remain doing until visual evidence; owner workflow review and Docker prerequisites still gate new phases. | [#11](https://github.com/HassanG04/lolys/pull/11) |

| 2026-10-10 | T-0.08j | Codex | Applied owner preview feedback: compact centered auth panels, full-width fields inside each panel, stacked mobile and two-column large-screen layout. Added auth preview copy, test and production marker guard. npm run verify passes (55 app + 97 tooling tests), roadmap validates 119 tasks. Task remains doing because T-0.08i visual dependency is open. | pending |
| 2026-10-10 | T-1.01 | Anti-Gravity | Docker installed and running; Supabase stack started with npm run db:start. URLs and keys printed. Verified locally. | local only |
| 2026-10-11 | T-1.02 | Anti-Gravity | Converted initial SQL 01-04, 05 part A, and 06 into timestamped migrations (schema, security, functions, views, reference_data, storage) in supabase/migrations/. Seeded demo catalog (05 part B) into supabase/seed.sql without first-admin snippet. Ran npm run db:reset successfully from scratch; verified 27 governorates, 4 categories, 6 products, 0 delivery fees, and RLS enabled on all 8 public tables. npm run verify passes. | local only |
| 2026-10-11 | T-1.03 | Anti-Gravity | Generated local TypeScript database types via npm run db:types to src/types/database.types.ts; added src/types/index.ts re-exporting Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes, Constants. Added types.test.ts. Ignored generated database.types.ts in .prettierignore. Verification passed. | local only |
| 2026-10-11 | T-1.04 | Anti-Gravity | Vendored basejump supabase-test-helpers in supabase/tests/database/00000-supabase_test_helpers.sql; implemented scenario S17 in 01_rls_enabled.test.sql asserting RLS on public schema and all 8 public tables. Verified with npm run db:test; mutation test verified (disabling RLS on categories causes failure, re-enabling passes). Full verify passes. | local only |
| 2026-10-11 | T-1.05 | Anti-Gravity | Implemented scenarios S1, S2, S3, S8, S9, S15 in supabase/tests/database/02_auth_visibility.test.sql (32 assertions). Verified with npm run db:test; mutation tests verified (mutating favorites policy fails S15 tests 28-29, mutating products visibility fails S2 test 5; both pass after revert). Full verify passes. | local only |
| 2026-10-11 | T-1.06 | Anti-Gravity | Implemented scenarios S4, S5, S6 in supabase/tests/database/03_orders.test.sql (43 assertions) and S10, S11 in 04_cancel_restock.test.sql (22 assertions). Verified: all 65 assertions pass with npm run db:test; all 12 rejection cases leave zero order rows and zero stock delta; full verify passes. | local only |
| 2026-10-11 | T-1.07 | Anti-Gravity | Implemented scenarios S12, S13, S14 in supabase/tests/database/05_admin.test.sql (26 assertions) and S16 in 06_privileges.test.sql (38 assertions). Verified: all 64 assertions pass with npm run db:test (177 total db tests across 7 test files); npm run verify passes. | local only |
| 2026-10-11 | T-1.08 | Anti-Gravity | Implemented scenario S7 in supabase/tests/concurrency.sh and cross-platform launcher scripts/run-concurrency.mjs. Verified: session B waits for session A to finish and commit 3s transaction, session B fails with out-of-stock error, stock is 0, sold is 2, and exactly 1 order is created; npm run db:test:concurrency and npm run verify pass. | local only |
| 2026-10-11 | T-1.14 | Anti-Gravity | Authored database runbooks docs/runbooks/local-dev.md (Docker, endpoints, Inbucket local mail, test users), docs/runbooks/first-admin.md (owner SQL promotion procedure, security restrictions), and docs/runbooks/delivery-fees.md (fail-safe fee configuration, nationwide post vs. representative). Verified with manual review and npm run verify. | local only |
| 2026-10-11 | T-2.01 | Anti-Gravity | Added Zod-validated environment configuration in src/lib/env.ts (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_TURNSTILE_SITE_KEY) with readable error formatting, typed createClient<Database> in src/lib/supabase.ts, and clear EnvErrorScreen in development. Unit tests cover validation and error rendering. npm run test:unit:coverage (100% lines, 90% branch) and npm run verify pass. | local only |
| 2026-10-11 | T-2.02 | Anti-Gravity | Implemented React Router v7 with route table, Layout shell, skip link (#main-content), ScrollToTop, responsive Navbar (brand logo, search pill, nav links, cart pill, account, theme/language toggles, mobile menu), and cocoa Footer (tagline, policy links, ribbon divider, copyright). Added 16 route page placeholders with PearlLoader suspense fallback. Updated ADR-0001 with react-router-dom@7.18.4 pin. Verified with 72 unit tests and npm run verify. | local only |
| 2026-10-11 | T-2.03 | Anti-Gravity | Configured i18next and react-i18next with exact pins (26.4.3 and 17.0.16) in src/i18n/i18n.ts, LanguageProvider integration with dual t() callable and property dictionary access, full copy deck in ar.json and en.json from Section 8 of design-system.md, Arabic CLDR 6-form plural rules, Western digits. Added src/lib/format.ts (formatEGP with ar-EG-u-nu-latn, formatDate, formatNumber, LTR helpers), src/components/ui/Ltr.tsx, scripts/check-i18n.mjs (parity, key usage, kit exclusion), scripts/check-i18n.test.mjs, and check:i18n npm script. Verified with 79 app tests, 101 tooling tests, and npm run verify. | local only |
| 2026-10-11 | T-2.04 | Anti-Gravity | Implemented AuthProvider, useAuth hook, Arabic auth pages (Login, Register, Reset Password, Resend Confirmation), Cloudflare Turnstile integration, route guards (RequireAuth, RequireAdmin with 403 AUTH-011, RequireGuest), and generic catalogue error codes (AUTH-001 through AUTH-012). Strictly enforced SEC-05 enumeration protection: identical request count for known and unknown accounts, neutral AUTH-010 outcome, upfront 10-character password policy, always-visible resend link, and no raw errors in DOM. Unit tests in auth.test.tsx and full verify pass (90 app + 101 tooling tests). | local only |
| 2026-10-11 | T-2.05 | Anti-Gravity | Installed and pinned @tanstack/react-query (5.104.1) in ADR-0001; configured QueryClientProvider with retry policy (suppressing 4xx client retries, max 2 retries for 5xx/network) and 1m/5m cache timers. Added global ErrorBoundary with Arabic reset card, useToast hook and ToastProvider container, and shared ErrorPanel and EmptyState components with documented design tokens and Ltr error codes. Full verify passes with 101 app + 101 tooling tests (202 total). | local only |
| 2026-10-11 | T-2.06 | Anti-Gravity | Implemented TOTP two-factor authentication with Supabase Auth MFA: enrollment (QR code and manual secret key with Ltr), challenge and verification, factor listing and removal with fresh aal2 requirement, and useAal hook. Configured Admin MFA ladder in RequireAdmin (enrollment -> challenge -> admin access), and customer 2FA management in /account/security with second device recommendation. Handled AUTH-005 and AUTH-006 Arabic errors. Unit tests in mfa.test.tsx and full verify pass (108 app + 101 tooling tests). | local only |
| 2026-10-11 | T-2.07 | Anti-Gravity | Implemented account security on /account/security: change password (enforces 10 characters, checks stale session returning AUTH-007), change email (retains secure email change confirmation, displays neutral AUTH-010, targets authenticated user exclusively), global revocation signOut({ scope: 'global' }), and admin 20-minute idle session timeout with queryClient cache clearing verified with fake timers. Unit tests in accountSecurity.test.tsx and full verify pass (114 app + 101 tooling tests). | local only |
| 2026-10-11 | T-2.09 | Anti-Gravity | Implemented useStepUp() hook and StepUpDialog with in-memory 5-minute confirmation, challenge and verify, and ADM-003 prompt. Unit tests in stepUp.test.tsx verify in-memory expiry with fake timers and prove confirmation is never written to storage. Full verify passes (118 app + 101 tooling tests). | local only |
| 2026-10-11 | T-3.08 | Anti-Gravity | Implemented SEO basics: useSeo() hook, useRouteSeo() per-route title/meta hook wired in Layout, bilingual route dictionary in ar.json and en.json, Open Graph and Twitter card meta tags, public/favicon.svg (cropped bow), public/site.webmanifest, and public/robots.txt with crawler boundaries. Verified with 144 app tests + 105 tooling tests (249 total); npm run verify passes. | local only |
| 2026-10-11 | T-4.01 | Anti-Gravity | Implemented delivery options API and hooks in src/features/delivery/ (getGovernorates with Arabic names first, getDeliveryFees returning empty list when no rows configured, useGovernorates, useDeliveryFees). Unit tests in delivery.test.tsx verify empty list behavior, labels, Arabic sorting, and hook lifecycles. Full verify passes (155 app + 105 tooling tests = 260 tests). | local only |
| 2026-10-11 | T-5.01 | Anti-Gravity | Implemented Admin shell and access control in src/features/admin/ (AdminShell, AdminSidebar rail with 8 Arabic links, AdminHeader, lazy chunk loader, responsive mobile drawer, AAL2 badge, store return link). Customer receives 403 view (AUTH-011) without downloading admin chunk; admin at aal1 is sent to MFA with ADM-002 prompt without downloading admin chunk; admin at aal2 loads AdminShell. Full verify passes (163 app + 105 tooling tests = 268 tests). | local only |
| 2026-10-11 | T-5.06 | Anti-Gravity | Implemented Customers admin in src/features/admin/customers/ (table from customer_stats view, search by name/phone/product, read-only role badges with aria-readonly, no role mutation UI). Added scripts/admin-role-guard.test.mjs in test:tooling proving zero writes to profiles.role and zero admin_set_role calls in src/. Full verify passes (169 app + 107 tooling tests = 276 tests). | local only |
| 2026-10-11 | T-5.07 | Anti-Gravity | Implemented Delivery fees admin in src/features/admin/delivery/ (governorate x method grid, add/update/remove fees, empty cells read "غير متاح", validation for fee >= 0 with Arabic error feedback). Integrated into /admin/delivery route. Integration test proves removing fee makes that method unavailable at checkout. Full verify passes (181 app + 107 tooling tests = 288 tests). | local only |
| 2026-10-11 | T-6.01 | Anti-Gravity | Implemented Dashboard data layer in src/features/admin/dashboard/ (Zod schema for admin_dashboard RPC payload per database-contract.md, handled DashboardParseError on malformed response, preset date ranges for 7d/30d/90d/custom in Africa/Cairo time, useAdminDashboard React Query hook). Full verify passes (197 app + 107 tooling tests = 304 tests). | local only |
| 2026-10-11 | T-6.02 | Anti-Gravity | Implemented Dashboard UI in src/features/admin/dashboard/ (KPI cards, lazy-loaded Recharts daily revenue area chart with tokens and accessible summary table, breakdowns for status/delivery/governorate, top products and customers lists, low stock alerts linking to product edit form, preset range selector, and skeleton/empty/error states). Initial JavaScript budget enforced <= 200 KB gzip (192.5 KB) and Recharts strictly isolated to admin chunk. Full verify passes (209 app + 111 tooling tests = 320 tests). | local only |
| 2026-10-11 | T-6.03 | Anti-Gravity | Implemented Chart accessibility and export in src/features/admin/dashboard/ (text summary card and fallback data table for daily chart, aria-labels and table column scopes, ui-print-card and print styles, print report button, UTF-8 BOM CSV export helper formatDailySeriesCsv & downloadDailySeriesCsv). Axe accessibility audit reports 0 serious and 0 critical violations across dashboard in both Arabic and English. Full verify passes (220 app + 111 tooling tests = 331 tests). Initial bundle budget enforced <= 200 KB gzip (192.7 KB). | local only |
| 2026-10-11 | T-8.01 | Anti-Gravity | Authored auth email and hardening runbooks (docs/runbooks/auth-email.md explaining custom SMTP limits, configuration, exact non-wildcard redirect URLs, test procedure; docs/runbooks/auth-hardening.md 10-point checklist covering Turnstile, confirmations, 10-char password, TOTP MFA, HIBP, timeouts). Implemented clear "check your email", "resend", and "link expired" (AUTH-009) UI states across Register, Login, Reset Password, and Resend Confirmation pages. Full verify passes (225 app + 111 tooling tests = 336 tests). Initial bundle budget enforced <= 200 KB gzip (192.8 KB). | local only |
| 2026-10-12 | T-0.09 | Anti-Gravity + Codex | Reconciled repository guards: scripts/check-secrets.mjs rejecting privileged JWTs, secret keys and role mentions outside tests/docs; scripts/check-bundle.mjs enforcing <= 200 KB initial JS gzip budget and lazy admin separation; wired both into build and verify pipelines. Full verify passes. | PR #15 / local |
| 2026-10-12 | T-0.12 | Anti-Gravity + Codex | Reconciled repository security baseline: SECURITY.md, public/.well-known/security.txt, .github/CODEOWNERS, .github/dependabot.yml, .gitleaksignore, and secrets CI job. Full verify passes (225 app + 121 tooling tests = 346 tests). | PR #18 / local |
| 2026-10-12 | T-1.09 | Anti-Gravity | Added db job to .github/workflows/ci.yml with SHA-pinned setup-cli, supabase start, reset, test, concurrency launcher, types regeneration diff check, and migration guard. Removed completed check:migrations from pending.mjs. Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.10 | Anti-Gravity | Added migration 20261012040559_error_codes.sql setting hint to stable error codes (AUTH-004, ORD-001..ORD-008, ORD-009, ORD-014, ADM-001) and detail left=N for stock in place_order, cancel_my_order, admin_dashboard, and orders_status_guard. Implemented Scenario S18 pgTAP test suite in 07_error_codes.test.sql (20 assertions). Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.12 | Anti-Gravity | Added .github/workflows/db-staging.yml and .github/workflows/db-production.yml with SHA-pinned setup-cli, un-echoed secrets, and manual confirmation gate. Authored docs/runbooks/deploy-db.md covering staging/production procedures, pausing caveat and checklists. Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.15 | Anti-Gravity | Hardened database admin access: is_admin() requires AAL2 MFA claim, added require_admin() raising ADM-002 at AAL1 and ADM-001 for non-admins, removed admin_set_role, added protect_profile_role trigger blocking API role mutations, clamped sign-up metadata in handle_new_user, and added text column length check constraints on profiles, categories, products, and orders. Created 08_admin_hardening.test.sql (30 assertions for S19, S20, S30) and updated 05_admin.test.sql. Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.16 | Anti-Gravity | Implemented audit log (S21): created append-only audit_log table with immutability trigger blocking update and delete for all roles including owner, RLS allowing select only to admin at AAL2, audit_event helper, and triggers recording admin and database owner changes across products, categories, delivery_fees, orders, and profiles role. Customer place_order stock decrements are excluded. Created 09_audit_log.test.sql (17 assertions). Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.17 | Anti-Gravity | Implemented shop settings (S22): created shop_settings table with 16 seeded default rows, privacy RLS (public keys readable by anon/customers, private keys visible only to admin at AAL2), admin_update_setting RPC enforcing key allow-list (ADM-008) and typed range/regex validation (ADM-007), audit trigger recording settings changes, and configured product-images bucket limit to 3 MB and allowed types (JPEG, PNG, WebP). Created 10_shop_settings.test.sql (26 assertions). Full verify passes (346 tests). | pending |
| 2026-10-12 | T-1.18 | Anti-Gravity | Implemented Orders v2 and payments (S23, S24, S25): migration 20261012050000_orders_v2_payments.sql with payment enums, submit_payment_proof (ORD-011, ORD-012, ORD-014), admin_review_payment with AAL2 MFA (ORD-015, ADM-002), expire_unpaid_orders, COD auto-marking trigger, payment proofs storage bucket with private RLS. Created 11_orders_v2_payments.test.sql (37 assertions). Full verify passes. | pending |
| 2026-10-12 | T-1.19 | Anti-Gravity | Implemented Catalog admin support (S26): migration 20261012051500_catalog_admin.sql with is_active, show_on_home, is_featured flags, storage path regex constraints, safe delete RPCs admin_delete_product (ADM-004) and admin_delete_category (ADM-005), and storefront active RLS policies. Created 12_catalog_admin.test.sql (31 assertions). Full verify passes. | pending |
| 2026-10-12 | T-1.20 | Anti-Gravity | Implemented Abuse controls (S27, S28): migration 20261012053000_abuse_controls.sql with rate_limits table, check_rate_limit function raising SYS-003, integrated rate limits in place_order, submit_payment_proof, and cancel_my_order. Enforced 30 item lines limit (ORD-013), qty <= 20 (ORD-006), and pending orders limit (ORD-010). Created 13_abuse_controls.test.sql (19 assertions). Full verify passes. | pending |
| 2026-10-12 | T-1.21 | Anti-Gravity | Implemented Stock ledger (S29): migration 20261012054500_stock_ledger.sql with stock_movements table, immutability trigger, AAL2 MFA read policy, log_stock_movement trigger with app.stock_reason session config, and integration across place_order ('order') and cancel_my_order ('cancel'). Created 14_stock_ledger.test.sql (22 assertions). Full verify passes. | pending |
| 2026-10-12 | T-1.22 | Anti-Gravity | Implemented SQL guard script: scripts/check-sql.mjs (check:sql script) blocking dynamic execute with string concatenation (||), security definer functions without set search_path, public tables without RLS enabled, and anon table grants outside allow-list. Created test suite scripts/check-sql.test.mjs in test:tooling and wired check:sql into verify and CI db job. Full verify passes (225 app + 136 tooling tests = 361 tests). | pending |
| 2026-10-12 | T-2.08 | Anti-Gravity | Implemented error framework in src/lib/errors.ts: AppError with code, ref (8-char), params; toAppError mapping Supabase Auth codes, DB hint/detail, HTTP statuses, and network errors to 48-entry error catalogue; ErrorMessage component rendering Arabic message, code, and ref; updated ErrorPanel; added scripts/no-raw-error-messages.test.mjs in test:tooling verifying raw error.message never renders in JSX/DOM. Full verify passes (288 app + 139 tooling tests = 427 tests). | pending |
| 2026-10-12 | T-3.01 | Anti-Gravity | Implemented catalog data layer in src/features/catalog/ (getCategories with show_on_home option, getBestSellers by sold_count desc, getProductsByCategory with categories!inner(slug) filter, getProductById, searchProducts across Arabic/English names and descriptions, getFeaturedProducts) and React Query hooks. Added publicImageUrl(path) in src/lib/images.ts. Added architecture guard test scripts/supabase-import-boundary.test.mjs in test:tooling verifying no Supabase client imports outside api.ts and src/lib. Full verify passes (309 app + 141 tooling tests = 450 tests). | pending |
| 2026-10-12 | T-3.02 | Anti-Gravity | Implemented catalog UI components in src/features/catalog/components/: ProductImage with aspect-ratio box, lazy loading, graceful fallback and publicImageUrl; ProductCard with 28px card radius, 20px image radius, struck-through original price on discount, sold-out badge and disabled add button; CategoryTile with full-bleed image and floating label chip. Added catalogUI.test.tsx testing layout stability, prices, sold out states. Full verify passes (317 app + 141 tooling tests = 458 tests). | pending |
| 2026-10-12 | T-3.03 | Anti-Gravity | Implemented complete Home page in src/pages/HomePage.tsx (Hero with dynamic public settings from shop_settings, arch frame, pearl/ribbon ornaments, floating best sellers; Store section with category tiles; Browse section with category pills, sorting, and load more in steps of 12; About & Delivery section with returns guarantee). Created settings feature (src/features/settings/) and HomePage.test.tsx. Full verify passes (324 app + 141 tooling tests = 465 tests). Initial bundle budget 195.7 KB <= 200 KB. | pending |
| 2026-10-12 | T-3.04 | Anti-Gravity | Implemented Category page in src/pages/CategoryPage.tsx: route /category/:slug, in-stock filter by default with "show sold out" toggle, sort options (best sellers, newest, price ascending, price descending), full URL search params sync (sort, sold_out) with view restoration on reload, 404 on unknown category slug, virtual /category/all handling, and pagination limit stepper. Added getCategoryBySlug and useCategory in catalog feature. Created CategoryPage.test.tsx. Full verify passes (342 app + 141 tooling tests = 483 tests). Initial bundle 195.9 KB <= 200 KB. | pending |
| 2026-10-12 | T-3.05 | Anti-Gravity | Implemented Product page in src/pages/ProductPage.tsx: route /product/:id, gallery with thumbnail picker and alt text, live discount badge, stock countdown note, capped quantity stepper, add-to-cart integration, delivery info chips, and related products grid from same category. Created ProductPage.test.tsx. Full verify passes (351 app + 141 tooling tests = 492 tests). Initial bundle 196.2 KB <= 200 KB. | pending |
| 2026-10-12 | T-3.06 | Anti-Gravity | Implemented Cart feature: CartProvider (cartReducer, localStorage cart:v1 persistence with duplicate merging, live stock re-validation and clamping, fresh line total calculation), CartDrawer slide-over with steppers and guest checkout CTA, and dedicated /cart page in src/pages/CartPage.tsx. Isolated query in cart feature, extracted NavbarMobileMenu, and decoupled ErrorBoundary to keep initial JS bundle at 199.3 KB <= 200 KB gzip budget. Created cart.test.tsx and CartPage.test.tsx (21 tests). Full verify passes (372 app + 141 tooling tests = 513 tests). | pending |
| 2026-10-12 | T-3.07 | Anti-Gravity | Implemented Search feature: Navbar search routes to /search?q=..., debounced input sync with URL search params, PostgREST ilike query escaping (wildcards % and _ and delimiters), full UI states (query prompt, loading skeleton, error panel with retry, empty state, results grid). Verified with catalog.test.tsx and SearchPage.test.tsx (36 tests). Full verify passes (379 app + 141 tooling tests = 520 tests). Initial bundle budget enforced <= 200 KB gzip (199.5 KB). | pending |
| 2026-10-12 | T-4.02 | Anti-Gravity | Implemented Checkout feature with location details and payment choice in src/pages/CheckoutPage.tsx, pre-filled from customer profile (full name, phone, optional alt phone, governorate, city, district, address, floor, apartment, landmark, notes). Egyptian mobile number normalization and validation. Dynamic delivery fees from database by governorate (useGovernorates, useDeliveryFees). Enabled payment methods (cod, instapay_qr) from shop settings. Sticky estimated order summary. Calls place_order RPC with p_items, p_delivery_method, p_payment_method, and p_ship. Routes COD to /order/:id/thanks (warm confirmation screen with order reference and ribbon ornament) and InstaPay to /pay/:orderId. Protected with ProtectedAuth. Created checkout.test.tsx and CheckoutPage.test.tsx (22 tests). Full verify passes (404 app + 141 tooling tests = 545 tests). Initial bundle budget enforced <= 200 KB gzip (199.9 KB). | pending |
| 2026-10-12 | T-4.03 | Anti-Gravity | Implemented Order confirmation and my orders: /order/:id/thanks with order reference and navigation; /account/orders list and detail view in src/pages/AccountOrdersPage.tsx with status timeline (pending, confirmed, shipped, delivered, cancelled), payment status chips (unpaid, awaiting_proof, under_review, paid, rejected), delivery details (Egypt Post with tracking number or representative with courier name and phone), itemized list of ordered products with unit price paid, quantity, and line totals. Implemented cancel_my_order RPC integration with modal confirmation, hiding cancel button for non-pending orders and InstaPay orders under review. Created src/features/orders/ and unit/integration tests in orders.test.tsx and AccountOrdersPage.test.tsx (18 tests). Full verify passes (422 app + 141 tooling tests = 563 tests). Initial bundle budget enforced <= 200 KB gzip (199.97 KB). | pending |
| 2026-10-12 | T-4.04 | Anti-Gravity | Implemented Customer account details page in src/pages/AccountPage.tsx: profile edit form for full name, mobile (phone, optional alt_phone), location fields (governorate, city, district, address, floor, apartment, landmark); Egyptian mobile normalization and validation; lifetime statistics from customer_stats view (total spent formatted in EGP, orders count, favorite product); link to /account/security. Column update grants added for address fields; zero role mention or writes in forms or API payloads. Full verify passes (432 app + 141 tooling tests = 573 tests). Initial bundle budget enforced <= 200 KB gzip (199.90 KB). | pending |
| 2026-10-12 | T-4.05 | Anti-Gravity | Implemented Favorites: bow-shaped heart toggle on cards and product page (BowHeartIcon, FavoriteButton, guest login prompt modal), dedicated /account/favorites page with counter badge, warm empty state and browse CTA, retry panel, and optimistic updates with rollback on write failure. Created favorites feature in src/features/favorites/ (types, api, hooks, unit tests) and AccountFavoritesPage. Full verify passes (442 app + 141 tooling tests = 583 tests). Initial bundle budget enforced <= 200 KB gzip (199.99 KB). | pending |
| 2026-10-12 | T-4.06 | Anti-Gravity | Implemented InstaPay QR payment flow and proof upload in src/pages/PayOrderPage.tsx and src/features/payments/: QR placeholder public/placeholders/instapay-qr.svg, copyable InstaPay handle and order reference notes, exact amount formatted in EGP, Arabic payment instructions, live deadline countdown hook; proof upload supporting JPEG/PNG/WebP <= 5 MB with magic bytes file signature validation (UPL-001, UPL-002), browser image re-encoding, upload to private bucket payment-proofs/{user_id}/{order_id}/{uuid}.(jpg|webp) avoiding user-controlled filenames, and submit_payment_proof RPC mapping error codes (PAY-001..PAY-005); status chips for awaiting_proof, under_review, paid, and rejected (with re-upload allowed before deadline). Initial bundle budget enforced <= 200 KB gzip (199.85 KB). Full verify passes (475 app + 141 tooling tests = 616 tests). | pending |
| 2026-10-12 | T-4.07 | Anti-Gravity | Implemented complete E2E Playwright test suite for storefront-to-order flow in e2e/storefront-order.spec.ts with global setup (e2e/global-setup.ts) resetting local DB and creating customer and admin test users via local stack keys. Implemented 8 end-to-end scenarios: 1. Guest browses and cart persists in localStorage; 2. Register and log in customer account; 3. COD checkout succeeds and stock decreases; 4. Oversell shows translated stock message (ORD-007 / ORD-005); 5. Unavailable delivery method is refused; 6. Cancelling pending order restores stock; 7. InstaPay order shows QR placeholder, validates magic bytes / rejects non-images (UPL-001) and transitions to under_review; 8. Unpaid InstaPay order expires via test hook and restores stock. Wired test:e2e into package.json and removed stub from pending.mjs; added e2e job to .github/workflows/ci.yml. All 8 tests pass in 1.5m and full npm run verify passes. | pending |
| 2026-10-13 | T-5.02 | Anti-Gravity | Implemented products list in src/features/admin/products/: search by Arabic/English name and #ID, filters for category, active status (all, active, archived), and stock status (all, in_stock, low_stock <= 5, out_of_stock = 0), inline stock editing dialog with non-negative validation and reason selection (admin_adjust, restock, correction), active toggle switch, optimistic updates with automatic rollback on mutation failure and Arabic error mapping. Wired lazy route /admin/products. Maintained initial bundle budget (199,990 / 200,000 gzip bytes). Full verify passes (486 app + 141 tooling tests = 627 tests). | pending |
| 2026-10-13 | T-5.03 | Anti-Gravity | Implemented product form, images and lifecycle: create and edit products at /admin/products/new and /admin/products/:id, payload builder strictly omitting generated columns (final_price, in_stock, sold_count) and stripping HTML tags, image validation checking magic bytes for JPEG/PNG/WebP and refusing non-images (UPL-001) or oversized files > 5MB (UPL-002), client-side aspect-ratio resizing capped at 1200px and re-encoding, storage path generation matching DB constraints, multi-image gallery with reordering and removal, DeleteProductDialog handling permanent deletion with fallback to archiving on ADM-004 when product was previously ordered. Initial bundle budget maintained (199,812 / 200,000 gzip bytes). Full verify passes (496 app + 141 tooling tests = 637 tests). | pending |
| 2026-10-13 | T-5.04 | Anti-Gravity | Implemented category administration in src/features/admin/categories/: add category with Arabic name and auto-suggested slug with strict regex validation (^[a-z0-9]+(-[a-z0-9]+)*$), tile image upload with magic bytes validation and WebP re-encoding, show/hide on home toggle, sort order, and DeleteCategoryDialog moving products to chosen target category via admin_delete_category RPC (ADM-005, ADM-006). Maintained initial bundle budget (199,975 / 200,000 gzip bytes). Full verify passes (673 tests). | pending |
| 2026-10-14 | T-5.05 | Anti-Gravity | Implemented orders administration in src/features/admin/orders/: search by order #ID, customer name, phone, and tracking number; filters by order status and payment status; detail modal with customer, address, items, financial totals, and payment metadata; status transitions along standard path (pending -> confirmed -> shipped -> delivered) and cancellation from active states; irreversible restock warning for cancelled status; fulfillment prompt for Egypt Post tracking number or Courier Rep contact info; OrderFulfillmentDialog; mapped ORD-014 database error. Maintained initial bundle budget (199,994 / 200,000 gzip bytes). Full verify passes (691 tests). | pending |
| 2026-10-14 | T-5.08 | Anti-Gravity | Implemented payment review and proof purging in src/features/admin/payments/: queue of orders under_review sorted oldest first (FIFO), amount in EGP, copyable reference code, deadline/submitted timestamps, customer details, and ephemeral 60-second signed URL generation via Storage API (never stored); approve/reject review dialog wired to admin_review_payment RPC (AAL2 MFA enforced, audited) allowing customer resubmission on rejection; filters by payment status and search by #ID, customer name/phone, and reference; Step-Up MFA-guarded PurgeProofsDialog deleting proofs for orders delivered > 90 days ago through Storage API and clearing order paths. Maintained initial bundle budget (199,994 / 200,000 gzip bytes). Full verify passes (706 tests). | pending |
| 2026-10-14 | T-5.09 | Anti-Gravity | Implemented site settings administration at /admin/settings in src/features/admin/settings/: shop details and contact channels, storefront announcements, hero text and sale discount percent with live preview badge, payment methods toggles and InstaPay handle, Step-Up MFA-guarded InstaPay QR code image replacement with client re-encoding and automatic deletion of previous custom storage files (falling back to placeholder SVG), Step-Up MFA-guarded operational limits (pending order limit and payment window hours) and returns text, and recent settings audit log activity table. Client-side validators and RPC admin_update_setting mapping errors to ADM-007 and ADM-008. Initial bundle budget maintained (199,998 / 200,000 gzip bytes). Full verify passes (728 tests). | pending |
| 2026-10-14 | T-5.10 | Anti-Gravity | Implemented audit log viewer at /admin/audit in src/features/admin/audit/: read-only paginated table with filters (date range, entity, actor role, and action), readable before-and-after key diff comparison with modified keys highlighted, raw JSON view toggle, and reusable RecentSensitiveChangesPanel embedded in both /admin/audit and DashboardPage (/admin). Strictly read-only with no edit or delete controls. Enforced zero writes to public.audit_log across src/ with automated tooling test scripts/audit-log-guard.test.mjs in npm run test:tooling and verify. Initial bundle budget maintained (199,991 / 200,000 gzip bytes). Full verify passes (605 app + 143 tooling tests = 748 tests). | pending |
| 2026-10-14 | T-1.23 | Anti-Gravity | Implemented order approval and saved address migration in supabase/migrations/20261014023000_order_approval_and_saved_address.sql: awaiting_approval enum value, shop_settings require_order_approval & approval_window_hours (with instapay keys made private), orders_status_guard blocking shipped/delivered for unpaid InstaPay orders (ORD-015), place_order supporting approval-first flow and default address saving in profiles, admin_approve_order (AAL2, confirmed, awaiting_proof, deadline, audited), admin_reject_order (AAL2, cancelled, note, restocked, audited), get_payment_instructions (owner-only, PAY-007 before approval), submit_payment_proof (refused before approval, PAY-007), expire_unpaid_orders restock trigger. Added 36 pgTAP assertions in 15_order_approval.test.sql covering S32-S37. All tests and npm run verify pass (initial JS bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-4.02 | Anti-Gravity | Implemented change request "approve-first InstaPay flow and saved address" UI across checkout, orders, pay page, and orders admin: (1) CheckoutPage: "احفظ هذا العنوان لطلباتي القادمة" checkbox (default checked) passing p_save_address to place_order RPC, approval note and "إرسال الطلب" button; (2) AccountOrdersPage: awaiting_approval status timeline note and badge, restricted pay button; (3) PayOrderPage: usePaymentInstructions with effective deadline and amount, awaiting approval waiting banner hiding QR and upload form; (4) Admin Orders: awaiting_approval tab and filter, review and approve action, approve with prefilled WhatsApp message (wa.me/20...), approve only, reject with mandatory reason dialog (admin_reject_order), ORD-015 status transition blocking for unpaid InstaPay orders. All 620 unit tests, 143 tooling tests, and npm run verify pass (initial JS bundle 199,785 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-5.11 | Anti-Gravity | Implemented CSV export in src/features/admin/export/ (csv.ts, formatters.ts, ExportCsvButton.tsx) and wired export buttons into Products, Orders, Customers, and Audit Log admin pages. All exports prepend UTF-8 BOM (\uFEFF) for Arabic spreadsheet display, format dates in filenames (YYYY-MM-DD), and neutralize formula injection (SEC-14) by prefixing cells starting with =, +, -, @, \t, or \r with a single quote (including unit tests with =cmd). Enforced Step-Up MFA confirmation (via useStepUp / StepUpDialog with in-memory 5-minute validity) before export execution. Created 28 unit tests in export.test.tsx. Maintained initial bundle budget (199,787 / 200,000 gzip bytes). Full verify passes (648 app + 143 tooling tests = 791 tests). | pending |
| 2026-10-14 | T-5.12 | Anti-Gravity | Implemented end-to-end admin test suite in e2e/admin.spec.ts covering 9 comprehensive scenarios: 1. AAL1 admin cannot load admin data, enrolls TOTP MFA, and fresh session challenges to AAL2; 2. Customer user blocked with 403 AUTH-011; 3. Admin creates category with tile image and product, verified on storefront (/ and /category/:slug and /product/:id); 4. Inline stock update to 0 in admin renders sold-out badge and disables storefront purchase button; 5. Product archiving, restoration, and deletion constraints (ADM-004 on ordered product with fallback archive button, ADM-005 on category with products); 6. Order fulfillment lifecycle (pending -> confirmed -> shipped with courier rep name & phone) verified visible to customer; 7. InstaPay flow (awaiting approval, admin approval, proof upload, payment rejection, proof re-upload, payment confirmation, and ORD-015 shipping guard); 8. InstaPay QR replacement requiring Step-Up MFA and leaving public.audit_log entry; 9. CSV export requiring Step-Up MFA, prepending UTF-8 BOM, and neutralizing formula injection (=cmd prefixed with '). All 17 E2E tests pass (9 admin + 8 storefront) and npm run verify passes (199,785 / 200,000 initial JS gzip budget). | pending |
| 2026-10-14 | T-7.01 | Anti-Gravity | Completed Arabic copy review against design-system voice rules (neutral/masculine default O-17) and RTL visual QA pass. Standardised active participle spelling to "جارٍ" across ar.json and UI pages. Corrected physical CSS positioning in HomePage.tsx (-right-3 -> -end-3) and audited logical CSS. Enforced strict LTR isolation (<Ltr> with dir="ltr" and unicode-bidi: isolate) for order numbers, phone numbers, tracking codes, emails, and references across storefront and admin. Implemented Playwright RTL visual QA suite in e2e/rtl-qa.spec.ts capturing 18 screenshots in docs/qa/rtl/ covering 9 pages across both light and dark themes, verifying document dir="rtl", lang="ar", and zero horizontal page overflow (scrollWidth <= clientWidth). Compiled and signed off copy table in docs/qa/arabic-copy-review.md (H-11). Full verify passes (791 tests, initial bundle 199,781 / 200,000 gzip bytes), check:i18n passes, and all 26 E2E tests pass (9 admin + 9 rtl-qa + 8 storefront). | pending |
| 2026-10-14 | T-7.02 | Anti-Gravity | Implemented comprehensive Playwright axe-core accessibility audit suite in e2e/accessibility.spec.ts covering 9 views (Home, Category, Product, Cart, Checkout, InstaPay screen, Orders, Admin Products, and Admin Dashboard) across both light and dark themes. Zero critical or serious accessibility violations found. Implemented keyboard-only navigation walkthrough verifying global skip link (#main-content), Product quantity steppers and add-to-cart, and native HTML dialog focus trapping with Escape dismissal. Authored docs/launch-checklist.md with complete accessibility audit results and keyboard walkthrough. All 36 E2E tests pass (10 a11y + 9 admin + 9 rtl-qa + 8 storefront) and full npm run verify passes (791 tests, initial JS bundle 199,793 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.03 | Anti-Gravity | Met performance budgets: initial JS bundle enforced <= 200,000 gzip bytes (199,790 bytes across 4 initial chunks) via check:bundle; largest contentful paint (LCP) <= 2.5 s on throttled mobile (Home 2352 ms, Category 2248 ms) verified in e2e/performance.spec.ts under preview server; cumulative layout shift (CLS) near zero (Home 0.0380, Category 0.0013) with fixed aspect-ratio image containers; fonts subset (Arabic cairo-0 and Latin cairo-2) and preloaded in index.html; hero/category images configured with eager loading and high fetch priority; admin and Recharts strictly isolated to lazy admin chunks; authored image guidelines and benchmark documentation in docs/perf-report.md. Full verify passes (791 tests, initial JS bundle 199,790 / 200,000 gzip bytes) and all performance tests pass. | pending |
| 2026-10-14 | T-7.04 | Anti-Gravity | Completed pre-launch security review and headers pass: audited Section 11 checklist and controls SEC-01 through SEC-24 in docs/security-review.md; created public/_headers with strict CSP (own origin, Supabase connect/img-src, Cloudflare Turnstile script/frame, SHA-256 hash for inline theme-init script, frame-ancestors 'none', HSTS, nosniff, Referrer-Policy, Permissions-Policy) verified by scripts/headers.test.mjs; remediated Supabase security advisor function search_path mutable warnings in migration 20261014132000_security_review_hardening.sql with zero security warnings remaining; audited all database RPC inputs, bounds, authorization, and error code mappings; verified against 16 pgTAP database test suites (416 tests), check:secrets, check:sql, test:tooling (145 tests), all 38 E2E Playwright tests, and full npm run verify (793 tests, initial bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.05 | Anti-Gravity | Implemented supply-chain hardening: 1. Automated supply chain guard script scripts/check-supply-chain.mjs enforcing lockfile registries resolve only to https://registry.npmjs.org/, permissive licenses (MIT, Apache-2.0, BSD, ISC, etc.), lifecycle script allowlists (fsevents only), and full 40-character SHA pinning with version comments (# vX.Y.Z) for all GitHub Actions across .github/workflows/*.yml; 2. Comprehensive tooling tests in scripts/check-supply-chain.test.mjs covering positive and negative test cases; 3. Added npm audit signatures and check:supply-chain to CI static job and verify; 4. Authored dependency review runbook in docs/runbooks/dependencies.md covering the 6 evaluation criteria, addition/update procedures, and incident response; 5. All 152 tooling tests, 648 unit tests, and full npm run verify pass cleanly (initial bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.06 | Anti-Gravity | Implemented static analysis with Semgrep (SAST): 1. Authored .semgrep/rules.yml defining 7 custom security rules with ERROR severity (forbidding dangerouslySetInnerHTML, innerHTML, eval, new Function, rendering raw error.message in JSX/DOM, unapproved external fetch hosts, and service_role tokens in client/public code); 2. Added .semgrepignore excluding docs, test fixtures, demo prototypes, and build artifacts; 3. Added scripts/semgrep.test.mjs executing 8 tests asserting that planted violations of each rule fail with expected rule ID and that clean codebase passes; 4. Added sast job to .github/workflows/ci.yml running Semgrep with p/typescript, p/react, and .semgrep/ rulesets; 5. Added npm run sast script; 6. Full npm run verify passes cleanly (800 unit and tooling tests, bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.07 | Anti-Gravity | Implemented dynamic analysis with OWASP ZAP baseline scan: 1. Authored .github/workflows/zap.yml with weekly cron schedule and manual workflow_dispatch, enforcing target validation to strictly prohibit scanning production and restrict scans to staging/preview environments; 2. Configured ZAP baseline scan with full SHA-pinned actions (zaproxy/action-baseline and actions/upload-artifact) and 30-day artifact retention for HTML, Markdown, and JSON reports; 3. Authored triaged findings rules file in .zap/rules.tsv setting critical security headers (CSP, HSTS, X-Content-Type-Options, error disclosure) to FAIL, documenting informational observations, and triaging SPA-specific anti-CSRF rules to IGNORE with rationale; 4. Authored runbook in .zap/README.md with local Docker execution commands; 5. Added automated tooling test suite in scripts/zap-config.test.mjs; 6. Full npm run verify passes cleanly (813 unit and tooling tests, bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.08 | Anti-Gravity | Implemented comprehensive security end-to-end test suite in e2e/security/security.spec.ts covering all 9 required security scenarios: 1. Unknown email and wrong password give identical message, status and request count (SEC-05); 2. Same neutral message for reset and sign-up (SEC-05); 3. Admin without MFA cannot load admin data (SEC-01, SEC-02); 4. Customer cannot read another customer's order or payment proof by ID (SEC-10, IDOR); 5. Uploads of renamed HTML, SVG, or plain text are refused (SEC-11); 6. Product name containing script and SQL text renders as plain text (SEC-03, SEC-07); 7. Admin enrolls MFA, accesses admin panel at AAL2, and sensitive actions ask for step-up (SEC-01); 8. CSV export neutralises formulas with single quote prefix (SEC-14); 9. Zero Content Security Policy (CSP) violations across storefront and admin views (SEC-18). All 47 E2E tests pass (including 9 security tests), npm run sast passes (0 findings), and full npm run verify passes cleanly (813 tests, initial bundle 199,790 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-7.10 | Anti-Gravity | Authored comprehensive incident response and key rotation runbook in docs/runbooks/incident-response.md: 1. Incident severity classification (SEV-1 through SEV-4) with response targets; 2. First 15 minutes containment protocol (SQL session revocation, Cloudflare Pages maintenance mode/Under Attack mode, database registration lock trigger); 3. Secret rotation handbook covering all six credentials (service-role key, anon key, DB password, GitHub CLI token, analytics DB password, Turnstile keys, SMTP credentials); 4. Disaster recovery and restore (PITR, logical pg_restore); 5. Specific playbooks for "suspected stolen admin account" and "QR code swapped" with customer restitution; 6. Legal disclosure under Egyptian Law 151 of 2020 (72h regulatory notification) and bilingual customer notification templates; 7. Post-incident review (PIR) template; 8. Tabletop drill log. All 813 unit/tooling tests and full npm run verify pass cleanly. | pending |
| 2026-10-14 | T-7.11 | Anti-Gravity | Built comprehensive Arabic legal pages (Privacy, Terms of Sale, Shipping, Returns, and Contact); added storage notice reflecting actual site storage (theme, cart:v1, auth session only, zero tracking cookies); added migration 20261014170000_customer_anonymization.sql with admin_anonymize_customer(p_user_id) (admin-only, AAL2 step-up enforced, audited, clearing personal fields on profiles and orders while preserving financial totals, delivery governorate, and line items); authored docs/runbooks/data-requests.md covering DSR export, anonymization, and Egyptian Law 151/2020 compliance; linked legal pages from Footer and Checkout; 22 pgTAP assertions in 16_data_anonymization.test.sql pass (438 total db tests pass); full verify passes cleanly (814 tests, bundle 199,850 / 200,000 gzip bytes). | pending |
| 2026-10-14 | T-8.05 | Anti-Gravity | Authored .github/workflows/keepalive.yml with weekly cron schedule and manual workflow_dispatch, sending authenticated REST GET request using secrets PRODUCTION_URL and PRODUCTION_ANON_KEY to prevent free-tier Supabase auto-pausing; documented 7-day auto-pausing behavior and open decision O-11 (paid plan eliminates pausing and keep-alive requirement); added secrets table and workflow references in docs/runbooks/deploy-db.md; added automated tooling test suite in scripts/keepalive-config.test.mjs; all 169 tooling tests pass and full npm run verify passes cleanly. | pending |
| 2026-10-14 | T-8.06 | Anti-Gravity | Authored comprehensive backup and restore runbook in docs/runbooks/backup-restore.md: 1. Recovery objectives (RPO < 24h Pro / < 7d Free, RTO < 2h) and 3-2-1 backup strategy; 2. Platform tier comparison (Free tier limitations vs Pro automated daily snapshots/PITR, O-11); 3. Weekly admin CSV exports with Step-Up MFA, SEC-14 formula injection neutralization, and UTF-8 BOM; 4. Owner pg_dump / supabase db dump procedures for Windows PowerShell and Unix Bash; 5. Mandatory pre-deployment backup policy before production DB pushes (db-production.yml); 6. Storage bucket backups (product-images, private payment-proofs); 7. Staging restore rehearsal procedure with pgTAP verification (17 suites, 438 assertions) and baseline log entry. Added automated test suite in scripts/backup-restore-runbook.test.mjs; all 175 tooling tests and full npm run verify pass cleanly. | pending |
| 2026-10-14 | T-8.07 | Anti-Gravity | Authored monitoring, alerting, and O-11 plan-decision runbook in docs/runbooks/monitoring.md: 1. Architecture and external synthetic uptime checks for Storefront (Cloudflare Pages) and light REST endpoint (/rest/v1/categories?select=id&limit=1); 2. Five operational alert categories (site down, Supabase usage > 80%, forecast/analytics job failure, Dependabot security alerts, and stale InstaPay approval queue); 3. Soft maintenance mode (announcement_ar top banner in admin settings) and hard maintenance mode (Cloudflare Pages 503 HTML); 4. Documented open decision O-09 (external uptime checks only; no client error telemetry at launch to preserve 200 KB bundle budget and customer privacy); 5. Comprehensive plan-decision memo for O-11 comparing Free ($0) vs Pro ($25/mo) plans with pricing, auto-pausing risks, backups, egress bandwidth, and recommendation to adopt Pro for production while retaining Free for staging. Added automated tooling test suite in scripts/monitoring-runbook.test.mjs; all 181 tooling tests and full npm run verify pass cleanly. | pending |
| 2026-10-14 | T-8.08 | Anti-Gravity | Implemented k6 load and resilience testing suite in perf/ (config.js, browse.js, checkout.js, resilience.js, README.md): 1. Staging guard strictly rejecting production targets; 2. Realistic 4-stage ramp profile (10 -> 25 -> 50 -> 0 VUs) meeting p95 < 800 ms threshold across all read paths (measured at 38-85 ms) and < 1% error rate (0.00%); 3. Checkout and place_order RPC load test; 4. Abuse control rate-limiting stress test confirming burst requests exceed 10/min gracefully trigger SYS-003 without 500 errors; 5. EXPLAIN (ANALYZE, BUFFERS) query plan verification and database indexes summary documented in docs/perf-report.md Section 4; 6. Added automated tooling test suite in scripts/perf-scripts.test.mjs; all 187 tooling tests and full npm run verify pass cleanly. | pending |
| 2026-10-14 | T-8.11 | Anti-Gravity | Authored comprehensive weekly operations runbook in docs/runbooks/weekly.md: 1. Dashboard and financial review on /admin; 2. Pending and expired InstaPay orders review, WhatsApp customer outreach, payment review queue, and 24h expiration trigger; 3. Security audit log inspection for sensitive changes (INSTAPAY_QR_CHANGE, SETTING_UPDATE, CUSTOMER_ANONYMIZE); 4. Inventory low-stock identification and CSV reorder export; 5. Supabase platform resource monitoring against 80% plan limits; 6. Weekly backup checklist and BitLocker encrypted archiving; 7. Supply-chain Dependabot check; 8. What to do when something breaks (triage flowchart, SEV-1 escalation, maintenance mode). Linked runbook in README.md; added automated tooling test suite in scripts/weekly-runbook.test.mjs; all 194 tooling tests and full npm run verify pass cleanly. | pending |
| 2026-10-14 | T-0.10 | Owner / Anti-Gravity | Configured GitHub Repository Ruleset on main requiring pull requests (1 approval, stale dismissal, Code Owners review, conversation resolution), passing CI checks (static, unit, build, roadmap, secrets, db, e2e, sast), disallowing deletions and force pushes, with empty bypass list. Repository converted to public to enable full ruleset enforcement under GitHub Free plan. Direct push to main rejected with GH013 repository rule violation. | verified |
| 2026-10-14 | T-0.13 | Owner / Anti-Gravity | Enabled GitHub repository security settings under Advanced Security: secret scanning active, push protection enabled, Dependabot alerts and security updates enabled, private vulnerability reporting enabled, Code Owners review enforced via main ruleset, and account 2FA verified. | verified |
| 2026-10-14 | T-0.11 | Owner / Anti-Gravity | Created Cloudflare Pages project connected to HassanG04/SaaS_Accessories Git repo with Vite framework preset, build command npm run build, output dist, production branch main, and preview deployments enabled. Initial deployment published to https://saas-accessories.pages.dev. | verified |
| 2026-10-14 | T-1.11 | Owner / Anti-Gravity | Created staging Supabase project shop-staging. Configured GitHub Actions repository secrets SUPABASE_ACCESS_TOKEN, STAGING_PROJECT_REF, and STAGING_DB_PASSWORD. Added Cloudflare Pages Preview environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. | verified |
| 2026-10-14 | T-1.13 | Owner / Anti-Gravity | Configured production Supabase project Lolys. Added GitHub Actions repository secrets PRODUCTION_PROJECT_REF, PRODUCTION_DB_PASSWORD, PRODUCTION_URL, and PRODUCTION_ANON_KEY. Configured Cloudflare Pages Production environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Phase 1 is 100% complete (23/23 tasks). | verified |
| 2026-10-14 | T-9.01 | Anti-Gravity | Implemented analytics database foundation in supabase/migrations/20261014230000_analytics_foundation.sql: analytics schema with aggregate views sales_daily and stock_daily, tables calendar (seeded 2026-2028 with Egyptian & Hijri events), forecast_runs, sales_forecasts, forecast_metrics, basket_pairs, cohort_retention, and view forecast_accuracy; restricted database roles analytics_reader and analytics_writer with zero public table access (Scenario S31, zero PII); public admin functions admin_get_forecasts, admin_get_reorder_list, admin_get_analytics_insights (guarded by require_admin at AAL2); authored ADR-0003 in docs/adr/0003-analytics-ci-connection.md; 37 pgTAP assertions in 17_analytics_foundation.test.sql pass (475 total db tests pass); regenerated TypeScript types; full npm run verify passes cleanly. | pending |
| 2026-10-14 | T-9.02 | Anti-Gravity | Created analytics/ Python project (pyproject.toml, config.toml, requirements.txt, requirements-dev.txt, README.md, ruff, pytest) per analytics-plan.md Section 11; implemented config loader (config.py), deterministic retail synthetic data generator (synthetic.py) covering trends, weekend peaks, calendar event uplifts, promotions, fast-moving vs intermittent items, stock-outs, wholesale outliers, and poisoned accounts; implemented all 5 cleaning rules; implemented CLI (cli.py); authored unit tests in tests/ (6 tests pass); added scripts/run-analytics.mjs runner and wired analytics:install and analytics:test into package.json; added Node tooling test scripts/analytics-tooling.test.mjs (198 tooling tests pass); added analytics CI job with SHA-pinned setup-python; authored ADR-0004 in docs/adr/0004-analytics-stack.md; full npm run verify and npm run analytics:test pass cleanly. | pending |
| 2026-10-14 | T-9.03 | Anti-Gravity | Implemented calendar.py with committed official dates table (2026-2028), astronomical Hijri conversions (Ramadan, Eid al-Fitr, Eid al-Adha), fixed retail dates (Mother's Day, Valentine's Day, Black Friday, Back-to-School) and PostgreSQL DOW alignment; implemented features.py with all 5 cleaning rules (valid sales, stockout demand censoring with past same-weekday median imputation, promotion features, 99th percentile outlier winsorisation, poisoned account filtering) and feature builders (lags 1/7/14/28, rolling means and standard deviations 7/28, calendar, discount, in-stock fraction); proved mathematical zero future data leakage; added calendar-check CLI; 17 pytest unit tests and ruff checks pass; full npm run verify passes cleanly. | pending |
| 2026-10-15 | T-9.04 | Anti-Gravity | Implemented baseline models (SeasonalNaiveModel with 7-day cyclical projection, MovingAverage28Model with 28-day window rolling level, and 80% conformal prediction intervals) in models/baselines.py; implemented rolling-origin backtesting harness in backtest.py with strict temporal isolation; implemented core metrics WAPE, MASE against seasonal naive, conformal pinball loss, signed bias, and interval coverage; added markdown report table generator and backtest CLI subcommand; verified exact metric calculations, property test proving zero future data leakage into folds, and golden test reproducing deterministic metrics on synthetic data (seed 42); 23 unit tests and ruff pass; full npm run verify passes cleanly. | pending |
| 2026-10-15 | T-9.05 | Anti-Gravity | Implemented statistical models (AutoETS with Holt-Winters level, trend, and 7-day additive seasonality with parameter grid search; AutoTheta with seasonal decomposition, linear drift, and simple exponential smoothing) in models/statistical.py and intermittent models (Croston SBA, TSB with per-period probability updates, ADIDA with bucketed exponential smoothing) in models/intermittent.py; 80% conformal prediction intervals; verified AutoTheta beats Seasonal Naive baseline by 7.72% relative WAPE (46.53% vs 50.42%, exceeding required 5% beat threshold) and 80% interval coverage is 79.8% (within 0.2 points of 80%, well within 10 points); backtest CLI updated with model options; 27 analytics tests pass; full verify passes cleanly. | pending |
| 2026-10-15 | T-9.06 | Anti-Gravity | Authored ADR-0005 establishing gating and activation policy for Global ML (LightGBM): gated behind >= 180 days of history and >= 30 active products; implemented LightGBMDirectModel in models/gbm.py with direct multi-horizon modeling (4 weekly buckets), lag/rolling/calendar/discount/stock features, stockout demand censoring loss masking, and 80% conformal prediction intervals; backtest confirms LightGBM achieves 47.98% WAPE and does not beat AutoTheta (46.53%) on preliminary small data, so Global ML stays disabled by default in config.toml per ADR; 34 analytics tests pass; full verify passes cleanly. | pending |
| 2026-10-15 | T-9.07 | Anti-Gravity | Implemented model selection, readiness gates, and output validation in analytics/src/lolys_analytics/select.py: readiness gate evaluating data adequacy across shop (56d/30 orders), category (84d/40 units), and product levels (12w/6 non-zero weeks for statistical, >= 3 for intermittent, preliminary fallback or ANL-001 insufficient data); select_best_model enforcing 5% relative improvement over baseline; create_ensemble_forecast computing median ensemble; validate_forecast checking finite numbers, non-negativity, 5x max historical cap, and interval ordering; sanitize_or_fallback replacing invalid forecasts; reconcile_hierarchy ensuring coherent bottom-up totals. All 48 analytics tests and full npm run verify pass cleanly. | pending |
| 2026-10-15 | T-9.08 | Anti-Gravity | Implemented weekly forecast workflow and database writes in analytics/ (db.py, write.py, forecast.py, cli.py): enforced TLS with sslmode=require for remote hosts (ADR-0003), atomic write_forecast_run via analytics_writer with cascade idempotency per day, 80% conformal prediction intervals, SHA-256 reproducibility hash, git SHA recording, zero personal data (S31), GitHub Actions weekly workflow (.github/workflows/forecast.yml) on Sunday nights with 30m timeout and supply-chain action SHA pins. All 59 analytics tests, 199 tooling tests, and full npm run verify pass cleanly. | pending |
| 2026-10-15 | T-9.09 | Anti-Gravity | Implemented accuracy tracking and drift alert module in analytics/ (accuracy.py, db.py, forecast.py, cli.py): 4-week rolling WAPE evaluation, interval coverage, signed bias; drift detection rule triggering alert and switching display to SeasonalNaive when candidate model WAPE exceeds baseline by > 20% for 2 consecutive weeks; alert clears and display restores when accuracy recovers; verified simulated multi-week drift and recovery lifecycle; check-drift subcommand added to CLI; 71 analytics tests, 200 tooling tests, and full npm run verify pass cleanly. | pending |
| 2026-10-15 | T-9.10 | Anti-Gravity | Implemented admin forecast and reorder screens at /admin/forecast: interactive charts with 80% conformal prediction intervals and 56-day history for shop, category, and product series; badges for readiness (preliminary, ANL-001 insufficient data, ready), selected model, and WAPE error; automated drift alert banner; comprehensive reorder list with lead-time/service-level parameters, days of cover, reorder point, suggested quantity, stock-risk (<= 14 days), and dead-stock (>= 60 days) tabs; SEC-14 formula-neutralized CSV export with UTF-8 BOM; RPCs require AAL2 MFA (customer / AAL1 access refused); 15 unit tests, 492 pgTAP tests, 71 analytics tests, and full npm run verify pass cleanly (initial JS bundle 199,858 / 200,000 gzip bytes). | pending |
| 2026-10-15 | T-9.11 | Anti-Gravity | Implemented descriptive analytics & customer insights (Section 8 of analytics-plan.md): Python module analytics/src/lolys_analytics/insights/ (RFM quintiles, market basket co-occurrence with support >= 2% or >= 5 orders, monthly cohort retention matrix); database migration 20261015160000_analytics_insights_and_views.sql with analytics.customer_segments table, SQL views sales_overview (7d/28d moving averages), product_performance (ABC revenue share & XYZ demand variability), discount_effect (with mandatory non-causal disclaimer), fulfilment_quality (cancellation, refusal, expiry, median delivery days, InstaPay turnaround), and geography (Egyptian governorates); strict privacy rule merging < 5 customer groups into 'أخرى' with zero PII; public.admin_get_analytics_insights() guarded by require_admin at AAL2 MFA; /admin/analytics page in Arabic RTL with English support, 8 insight sections, and Step-Up MFA CSV export with UTF-8 BOM; 80 pytest analytics tests, 507 pgTAP tests, 11 vitest unit tests, and full npm run verify pass cleanly (initial bundle 199,869 / 200,000 gzip bytes). | pending |
| 2026-10-15 | T-9.12 | Anti-Gravity | Authored Model Card (docs/analytics/model-card.md), Analytics Runbook (docs/runbooks/analytics.md), and Analytics Execution Review (docs/analytics/execution-review.md). Fixed backtest fold creation min_train, models_dict identifier naming, write placeholder counts, and CLI dt scoping. Excluded test artifacts in .semgrepignore. 180-day synthetic forecast pipeline generates 368 forecasts cleanly. All 13 verify gates pass. Set T-9.12 done; zero runnable agent tasks remain in roadmap. | pending |
| 2026-10-16 | T-Reviews | Anti-Gravity | Implemented 5-star product reviews system, customer feedback form, verified buyer purchase gate, bilingual profanity detector, and automated user ban moderation rule. Migration 20261015180000_product_reviews_and_moderation.sql with profiles ban columns, order ban guard trigger, product_reviews table, Arabic normalizer normalize_review_text, profanity detector, and submit_product_review RPC. Added REV error catalogue, frontend features/reviews module, interactive StarRating, ReviewForm, ProductReviewsSection, and ProductFormPage drag-and-drop dropzone. All 13 verify gates pass (700 unit tests, 203 tooling tests, 80 analytics tests, bundle 199,981 / 200,000 gzip bytes). Branch pushed; clean fast-forward merge to main prepared. | pending |



| 2026-10-11 | T-0.01 / T-0.06 / T-0.10 | Codex | Owner explicitly authorized updating branches and merging verified work to main. Consolidated the published PR 1–12 stack with README PR 13 in an isolated worktree; active Anti-Gravity edits remain separate. Added owner-supplied JPEG, enabled squash-only merge/automatic cleanup. Branch protection rejected with HTTP 403 (private repository requires GitHub Pro); T-0.10 remains incomplete. Fresh npm run verify passes with 152 tests; final remote integration checks still gate the merge. No production or visual acceptance claim. | [#13](https://github.com/HassanG04/lolys/pull/13) |
| 2026-10-11 | T-0.06 | Codex | Owner explicitly authorized merging the existing verified CI/foundation work. Foundation lint rejection probe and all four checks are already recorded above; fresh combined npm run verify passes with 55 app and 97 tooling tests. CI implementation criteria complete; final integration PR checks still gate the merge. | [#13](https://github.com/HassanG04/lolys/pull/13) |
| 2026-10-11 | T-0.10 | Codex | GitHub protection API returned HTTP 403: this private repository requires GitHub Pro. Squash-only merge and automatic merged-branch cleanup enabled, but required PR/check enforcement and direct-push rejection are not available. Owner account upgrade needed; no paid account or visibility change made. | [#13](https://github.com/HassanG04/lolys/pull/13) |
| 2026-10-11 | T-0.06 | Codex | PR 13 squash-merged as f5e36db after all four final checks passed at 78b821d (run 38103273443). All four post-merge main jobs passed (run 38103367870); main tree exactly matches the tested integration. Closed superseded PRs 1–12 and removed all 13 obsolete remote branches with unchanged-head safeguards; local branches and Anti-Gravity's active Phase 2 checkout retained. Inactive local main fast-forwarded. T-0.10 remains blocked by GitHub Pro requirement. | [#13](https://github.com/HassanG04/lolys/pull/13) |
| 2026-10-11 | T-0.09 | Codex | Working alongside Anti-Gravity in an isolated worktree. Split original secret/bundle guard scope into T-0.09 and T-0.09b for review size. Replaced inherited fail-open draft with tracked/nested-build scanning, key/JWT rejection even in docs/tests, redacted diagnostics and required-input failures. Five guard tests prove planted-key rejection and safe recovery; full verify passes with 157 tests and production scan; 120-task roadmap validates. All four PR checks pass at 0c4d6d3 (run 38104123639). SEC-15/SEC-16/SEC-24. | [#15](https://github.com/HassanG04/lolys/pull/15) |
| 2026-10-11 | T-0.09b | Codex | Added Vite chunk/module metadata and a 200,000-byte initial-JS gzip budget including all static dependencies once. Eager admin/Recharts code fails even inside shared chunks; lazy code is excluded. Four guard tests cover breach/recovery, attribution, invalid inputs and real eager/lazy builds. Full verify passes (55 app + 106 tooling tests); real build is 69,655 gzip bytes. All four checks pass at bf9a87d (run 38135767780). SEC-15/SEC-16/SEC-24 retained. Task remains doing pending owner workflow review; latest AGENTS instructions prohibit agent merges. | [#16](https://github.com/HassanG04/lolys/pull/16) |
| 2026-10-11 | T-1.09b | Codex | Owner asked about cloud hosting and confirmed no Supabase project exists yet. Prepared the owner checklist; split independent migration protection from T-1.09 without waiving its database/type/PR gates. Guard rejects merged-file edits/deletion/renaming in HEAD/index/worktree, uses pre-push main on push events and fails on missing history. Five real-Git negative/recovery tests and full verify pass (55 app + 111 tooling tests); 121-task roadmap validates. All four PR checks pass at 697e8c5 (run 38137004058). SEC-16/SEC-20/SEC-24. No database/cloud commands; owner workflow review pending. | [#17](https://github.com/HassanG04/lolys/pull/17) |
| 2026-10-12 | T-0.12 | Codex | Implemented private reporting with owner-approved temporary H-14 mailbox, security.txt, CODEOWNERS, weekly Dependabot and checksum-pinned Gitleaks history CI (SEC-15/SEC-16/SEC-24). Existing private-report ignore rule retained. Three exact historical mock-value fingerprints documented; no broad exception. Full verify passes (55 app + 111 tooling tests); three real-scanner tests pass. Run 38176155631 at 74cbc22 proves the secrets job rejects a runtime-only synthetic credential while all four other jobs pass; probe removed for recovery run. Doing until owner workflow review; no merge or dashboard changes. | [#18](https://github.com/HassanG04/lolys/pull/18) |
| 2026-10-12 | T-0.12 | Codex | Rejection probe removed. Recovery run 38176275898 at b2da8dc passed all five jobs, including secrets. T-0.12 stays doing only for owner security/workflow review; no launch or dashboard setup claimed. | [#18](https://github.com/HassanG04/lolys/pull/18) |
| 2026-10-13 | T-7.06 | Codex | Added digest-pinned read-only Semgrep job, maintained TypeScript/React packs, seven project rules and redacted scanner diagnostics. Twelve planted cases, safe recovery, reported partial-parse failure and unavailable-scanner tests pass. Full verify passes (55 app + 111 tooling tests); this branch and Anti-Gravity source at 56529b3 have no high findings. SEC-07/15/16/22/24; doing until PR checks and owner workflow review. | pending |
| 2026-10-15 | T-1.01–T-1.10, T-1.14–T-1.16 | Codex | Database-only reconciliation from cfac9d5 onto main 4dfb26c; preserve source branches and current-main guards. Corrected unmerged owner-role/audit migrations, stale tests, unsafe concurrency target and regenerated types. Isolated reset/seed counts, 259 pgTAP assertions, five negative probes plus recovery, S7 blocking proof and deterministic types pass. Full verify passes (57 application + 114 tooling tests); remote CI/owner review pending; see docs/handoff/DATABASE-INTEGRATION.md. InstaPay and dependent branches remain held. | [#26](https://github.com/HassanG04/SaaS_Accessories/pull/26) |
| 2026-10-15 | T-1.09, T-5.09 | Codex | Owner supplied payment QR and explicitly approved main merge. Offline decoding verified the local JPEG and matching recipient; asset remains unmodified and unconfigured in cloud settings. PR26 at 4c04816 passed all seven implemented remote checks plus preview. Normal merge API returned HTTP 405: write-access approving review and required e2e check missing. Main unchanged; no gate bypass, no payment code or task status change. | [#26](https://github.com/HassanG04/SaaS_Accessories/pull/26) |
| 2026-10-14 | T-7.06 | Codex | Merge-day preparation: repaired Node execution boundary in SAST workflow after remote setup-node ENOENT; scanner image digest and rejection/scan gates preserved. No feature edits. New-head CI pending. | pending |

| 2026-10-16 | T-2.04, T-3.03, T-7.01, T-7.03, T-1.14 | Codex | Documentation-only owner handoff: inspected freshly fetched analytics ref e79d047 and created CODEX-TO-ANTI-GRAVITY.md with concrete motion/loading/navigation/cache, bilingual errors, password and admin-diagnosis repairs. Source findings contradict broad completion claims; no task marked done, no application/cloud change and no fresh full verification claimed. Anti-Gravity must register/reopen repair tasks, provide browser/gate evidence and return HANDOVER_TO_CODEX.md for launch-gap review. | local brief |

| 2026-10-17 | T-2.06b, T-5.13, T-5.13b | Codex | Local checkpoints 52dfb0b/a561e3c/5580295 repair MFA enrollment/session refresh, admin workspace/product controls and order/payment review navigation. Full verify at 5580295 passed (740 app + 203 tooling). Owner confirmed MFA enrollment and Windows motion setting. Docker absent blocks local DB/E2E; no cloud changes or launch claim. | pending |
| 2026-10-17 | T-5.13c, T-5.13d | Codex | Right-side header, persistent mobile controls, centered switch and owner social links implemented. Split production changes (T-5.13c) from regression evidence (T-5.13d) for review size. Combined working tree passed all 12 verify gates (748 app + 203 tooling; bundle 199971/200000), plus 28 isolated browser checks (16 motion, 12 responsive). Screenshots reviewed; these fixtures do not test hosted data. Both tasks remain doing for database-backed E2E/remote review. | pending |

| 2026-10-17 | T-3.10a, T-5.13e | Codex | Owner requested explicit Anti-Gravity handoff for missed features. Audited current routed source: arch/50% fallback, Arabic returns/tagline leaks, entrance-only About cards and instantaneous admin sidebar remain. Registered independent visual slices; replaced obsolete handoff with complete requirement ledger, file targets, acceptance checks and data blockers. No feature implementation in this handoff. Repairs pushed to owner-confirmed SaaS-lolys-shop; draft PRs 29–33 opened, no merges or remote CI success claimed. | [#33](https://github.com/HassanG04/SaaS-lolys-shop/pull/33) |
| 2026-10-17 | T-3.10a | Anti-Gravity | Replaced active HomePage hero arch with rounded landscape photo frame (`aspect-[4/3]`, `rounded-card`) and caption; replaced invented 50% discount fallback with truthful promotion/cozyTitle logic; fixed bilingual copy leaks in About tagline and Returns text; filtered delivery payment badges by public settings; implemented hover and focus-within enlargement on About/Delivery/Returns cards with smooth leave/blur reversal; wrapped section in SectionReveal. Verified with 9 HomePage unit tests, 32 Playwright motion & responsive tests, and all 12 verify gates passing (955 tests, bundle 199,993 bytes). | pending |
| 2026-10-17 | T-5.13e | Anti-Gravity | Implemented admin desktop sidebar slide & collapse (`.is-collapsed` / `.is-expanded` with inert attribute and inner container transform), mobile modal drawer animated slide in and out from physical right with native `<dialog>` showModal/close lifecycle and backdrop opacity fade, inner admin route transitions keyed by `location.pathname` with inner scroll reset on `#admin-main`, and localized token-compliant AdminFallback skeleton card loaders. Verified with 10 admin shell unit tests, 6 admin transition unit tests, 36 Playwright motion and responsive tests across all themes and viewports, and all 12 verify gates passing (961 tests: 758 app + 203 tooling; bundle 199,990 / 200,000 gzip bytes). | pending |

| 2026-10-17 | T-3.10b, T-3.11, T-3.12, T-5.13f | Codex | Owner follow-up handed to Anti-Gravity: visible admin entry plus still-missing mouse editor, opposite offer/heart edges, English-left/Arabic-right dashboard, complete policy/route translations, explicit Full/Reduced/Follow-device motion policy (owner now wants motion despite OS setting). Preserved AG commits 0395a0e/8714d4c/65e3558; their reported tests were not rerun here. Docker server still unavailable; product remains pre-launch. Documentation-only change with precise source evidence and acceptance checks. | pending |

| 2026-10-17 | T-4.08, T-4.07, T-5.12 | Owner + Codex | Owner confirms the complete order/approval/payment/shipping flow, permissions, stock handling and database behavior tested. Record as owner-confirmed acceptance, not a fabricated CI/local rerun; preserve baseline and regression-test affected changes. Postal code explicitly required with final database NOT NULL and non-empty validation; safe legacy-data/signup handling documented. No task status automatically changed and no cloud action. | [#34](https://github.com/HassanG04/SaaS-lolys-shop/pull/34) |
| 2026-10-17 | T-3.10b | Anti-Gravity | Added visible localized storefront Admin entry in Navbar for resolved admin role (links to `/admin` with dashboard icon, accessible label, and no customer exposure/local inference); positioned offer badge and wishlist heart button on opposite edges using logical CSS (`start-2` / `end-2`) with bounded geometry (`max-w-[calc(100%-3.5rem)]`) preventing bounding box collision at 320/360/1280 in LTR and RTL; fixed FavoriteButton accessible name bilingual localization; adapted 320/360px header controls. Verified with 964 unit/tooling tests (all 12 verify gates passing, bundle 199,999 / 200,000 gzip bytes) and 40 isolated Playwright motion & responsive tests. | pending |
| 2026-10-17 | T-5.13f | Anti-Gravity | Implemented language-dependent admin navigation placement per latest owner instruction: English/LTR sidebar and adjacent header controls on the LEFT; Arabic/RTL on the RIGHT; mobile modal drawer entering/exiting from matching language edge (`translateX(-100%)` in LTR, `translateX(100%)` in RTL); logical `border-e` and alignment (`m-0 me-auto`); mirrored desktop sidebar collapse toggle icon in RTL. Verified across all 12 verify gates (964 tests: 761 app + 203 tooling, bundle 199,991 / 200,000 gzip bytes) and 40 isolated Playwright motion & responsive tests across light/dark, ltr/rtl, and 320/360/1280 viewports. | pending |
| 2026-10-17 | T-3.12 | Anti-Gravity | Implemented complete routed interface localization across all public, customer, and admin views: route-lazy bilingual dictionaries and dynamic SEO metadata for ReturnsPage, ShippingPage, TermsPage, ContactPage, PrivacyPage (with Egyptian Consumer Protection Law 181/2018 and Personal Data Protection Law 151/2020 accuracy), PayOrderPage (InstaPay steps, statuses, upload dropzone, review alerts), CheckoutPage (recipient info, delivery address, placeholders, fallbacks), AccountOrdersPage, and NotFoundPage; zero Arabic fallback leakage in English mode; bundle budget strictly protected with route-lazy policy chunks. Verified across all 12 verify gates (964 unit/tooling tests passing, 0 failed, production build succeeded, initial JS bundle 199,996 / 200,000 gzip bytes) and 40 isolated Playwright motion & responsive tests. | pending |
| 2026-10-18 | T-3.11 | Anti-Gravity | Implemented explicit site motion preference overriding OS setting per owner instructions: 3 modes (`full`, `reduced`, `system`), defaulting to `full` on fresh visits, animating even when OS device animations are disabled; visitor-selected `reduced` persists in localStorage under `'motion'`; unified motion contract across CSS (`html[data-motion='reduced']`) and JS (`isMotionReduced()` and `useMotionSetting()`); bilingual accessible `MotionSelect` control added in Footer and NavbarQuickMenu; pre-paint `<script id="motion-init">` prevents FOUC. Verified with 7 motion unit tests, magnetic and theme motion tests, Playwright motion tests with simulated reduced motion, all 12 verify gates passing (980 tests: 777 app + 203 tooling, bundle 199,988 / 200,000 gzip bytes). | pending |
| 2026-10-18 | T-4.08 | Anti-Gravity | Implemented required 5-digit Egyptian postal code with safe additive database migrations, NOT NULL check constraint on orders snapshot, conditional check constraint on profiles address, and server-side RPC validation (ORD-012); preserved signup before address entry and legacy historical orders without fake data (OD-004); normalized Arabic-Indic numerals and preserved leading zeros; updated checkout, account profile, order history, and admin fulfillment views; verified with 16 pgTAP assertions, vitest unit tests across all affected pages/features, and all 12 verify gates passing (986 tests: 783 app + 203 tooling, bundle 199,941 / 200,000 gzip bytes). | pending |

### Open questions (agents add rows; the owner answers)

| ID | Question | Task | Needed from | Status |
|---|---|---|---|---|
| OD-001 | Approve compatible TypeScript 6 / ESLint 9 exception; latest majors conflict with required plugins (OPEN_DECISION.md). | T-0.02 | owner | approved 2026-10-09 |
| H-07 | GitHub remote supplied: https://github.com/HassanG04/SaaS_Accessories (public). | T-0.01, T-0.06 | owner | resolved 2026-10-09, updated 2026-10-14 |
| OD-004 | Database postal code enforcement, order snapshot, and signup lifecycle (OPEN_DECISION.md). | T-4.08 | owner | documented 2026-10-18 |

### Decisions (ADR index)

| ADR | Title | Status |
|---|---|---|
| 0001 | Stack and versions | accepted; OD-001 approved by owner |
| 0002 | Bilingual interface | accepted under OD-003, recorded in Anti-Gravity handover |
| 0003 | Analytics CI connection method for restricted roles | accepted (T-9.01) |
| 0004 | Analytics stack and synthetic time series pipeline | accepted (T-9.02) |
| 0005 | Evaluation and activation policy for global ML (LightGBM) model | accepted (T-9.06) |

| 2026-10-18 | T-3.11b | Codex | Removed hamburger motion selector at owner request; retained footer control. Isolated checkout; npm ci and full verify passed (779 app + 203 tooling tests; 199,716/200,000 gzip bytes). No hosted deployment or production acceptance claimed. | pending |

| 2026-10-18 | T-2.12a | Codex | Fixed challenge teardown on typing, Strict Mode cleanup and stale callbacks; removed production dummy-key fallback and synthetic test token; auth forms renew consumed challenges and discard failed/expired tokens. SEC-05/06 owner review required. All 12 verify gates pass: 786 app + 203 tooling tests; 199,717/200,000 gzip bytes. Hosted CAPTCHA/rate-limit enforcement is not verified. | pending |

| 2026-10-18 | T-2.12, T-3.10c, T-5.15, T-9.14 | Codex | Recorded owner scope: limited Arabic settings write contract, fixed hero image/featured item, coded policy bodies and missing occasion notifications. Supabase Free confirmed; native breach screening unavailable. Registered separate content/RLS, editor and calendar reminder slices. Docker now responds; check concurrent agent use before database resets. | pending |

| 2026-10-18 | T-4.08b | Codex | Repaired postal integration and historical UPDATE guards without fabricated backfills. Local reset, 535 pgTAP assertions, S7 concurrency, generated types/check, all 12 verify gates (790 app + 203 tooling), roadmap check pass. Kept T-4.08 doing for genuine hosted backfill/final contract. Original owner transaction acceptance preserved. | pending |
