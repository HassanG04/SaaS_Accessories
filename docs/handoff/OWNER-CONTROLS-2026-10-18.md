# Anti-Gravity continuation: owner controls and login protection

Read `docs/spec/store-controls-and-auth-abuse.md`, shared progress, roadmap and
the actual diff/status before starting. Preserve your active postal-code work.

Codex worked in `C:/Users/Hassan-PC/.codex/worktrees/owner-controls/الاء`, based on
`35106ec`, without copying/resetting your uncommitted files. Review these commits:

- `0be6033`: removes the hamburger motion selector; footer control remains.
- `6056783`: fixes Turnstile callback/cleanup/token-renewal bugs in login,
  registration, reset and resend. Synthetic tokens live in test fixtures only;
  production dummy keys are refused. Includes regression evidence and corrections
  to the footer test count.

Latest local verification: 786 app + 203 tooling tests, all 12 verify gates pass;
bundle 199,717/200,000 gzip bytes. No live provider/remote CI/production claims.

Review and integrate only the two implementation commits after your current
postal checkpoint; reconcile roadmap/progress additions, preserving both agents'
statuses. The new specification/task registrations are a separate documentation
commit on `agent/T-2.12a-challenge-lifecycle`. No main merge or deployment.

Next implementation sequence:

1. Finish and verify the current postal-code slice. Owner already confirmed the
   existing transaction/permissions/stock flow; validate changes to it specifically.
2. T-3.10c: database content contract first. Local Docker engine is currently
   unavailable; obey roadmap 1.5 rather than claiming untested schema completion.
3. T-3.10: persistent mouse editor and Settings hero/image/featured-item/category
   controls, using that contract. Current hard-coded image/bestSellers[0] are not
   an editor. Cover English fields the admin currently cannot save.
4. T-5.15: complete footer and all policy routes editable in both languages.
   Do not substitute new sample policies, shipping promises or contact numbers.
5. T-2.10 then T-9.14: shared notifications/suggestions and admin calendar reminders.
   Reuse the calendar; known occasions need no LLM. Optional ML stays disabled and
   the forecast release hold remains until its separate evidence/owner gate passes.

Owner prerequisite T-2.12: verify Supabase enforces CAPTCHA at its direct Auth
endpoint, Managed Turnstile/production keys/hostnames, and safe rate limits.
Supabase is **Free**: native leaked-password screening is unavailable. Do not
silently upgrade, add a proxy/breach service or invent a browser risk score.
Preserve generic errors, server authority and admin AAL2. No account-wide permanent
lockouts based solely on unauthenticated failures.

Next exact read-only command in the primary checkout:

```powershell
git diff --stat
```

Then run the documented postal checks when Docker is available. Never delete,
reset or commit another agent's unfinished changes to make the workspace clean.
