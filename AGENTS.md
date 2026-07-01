# AGENTS.md

## Project

- Project name: Gacha Pop
- Project type: Production web application for a gacha store
- Technology: Next.js App Router, TypeScript, Tailwind CSS, Supabase, Vercel, Discord Webhook

## Main Systems

- Gacha random draw system
- Wallet / balance system
- Purchase system
- Admin dashboard
- Product / stock management
- User account system
- Discord notification webhook

## 1. Codex Working Rules

- Read only files required for the current task.
- Modify the minimum number of files possible.
- Never scan, rewrite, or refactor the entire project unless explicitly requested.
- Never modify unrelated files.
- For small tasks, modify at most 3 files.
- If more than 3 files are required, explain why before changing them.
- Do not run build, lint, tests, or install packages unless explicitly requested.
- Do not format unrelated code.

## 2. UI Protection

- Never redesign the UI unless explicitly requested.
- Never change colors, layout, spacing, fonts, animations, or responsive behavior unless required for the task.
- Keep the current Gacha Pop design exactly the same.
- Never modify Thai text unless explicitly requested.
- Never translate existing Thai labels.
- Never rewrite UI labels.
- Preserve UTF-8 encoding.
- Do not change fonts or font imports unless explicitly requested.

## 3. Security Rules

- Never trust client input.
- Validate all request bodies.
- Validate query parameters.
- Validate route parameters.
- Never expose secrets.
- Never modify `.env` files.
- Never print environment variables.
- Never expose internal error details to users.
- Use safe and consistent error messages.

## 4. Admin Rules

- Every admin page must be protected.
- Every admin API must verify admin permission server-side.
- Never rely only on frontend checks.
- Log important admin actions when appropriate.
- Never expose admin functionality publicly.

## 5. Wallet Rules

- Wallet balance must never become negative.
- All wallet updates must be atomic.
- Never update wallet balance without validation.
- Never trust price or balance values from the client.
- Log wallet transactions when appropriate.

## 6. Purchase / Gacha Rules

- Validate that the user exists.
- Validate that the product exists.
- Validate that the product is available.
- Validate sufficient balance before purchase.
- Prevent duplicate purchase requests.
- Prevent race conditions.
- Prevent stock from becoming negative.
- Purchase, wallet update, and stock update must be atomic when possible.
- Do not change gacha probability logic unless explicitly requested.

## 7. Database / Supabase Rules

- Never modify database schema unless explicitly requested.
- Never change Supabase RLS policies unless explicitly requested.
- Keep migrations backward compatible.
- Avoid unnecessary queries.
- Use transactions or RPC functions for critical wallet and purchase operations when appropriate.

## 8. API Rules

- Preserve existing API response formats unless required.
- Use proper HTTP status codes.
- Validate every input.
- Rate limit sensitive APIs when requested.
- Do not cache user-sensitive data.
- Do not leak stack traces.

## 9. Performance Rules

- Do not optimize unrelated code.
- Cache only public data.
- Never cache wallet, user profile, purchase history, or admin data.
- Avoid unnecessary React re-renders.
- Use `next/image` where appropriate, but do not change unrelated images.

## 10. Dependencies

- Do not use `latest` versions.
- Use fixed package versions.
- Do not upgrade packages automatically.
- Do not install new dependencies without explaining why first.
- Prefer small and well-maintained packages.

## 11. Testing / Build

- Do not run build, lint, or tests unless explicitly requested.
- When asked to verify, run checks only once after all changes are complete.
- Fix TypeScript errors caused by the current task.

## 12. Completion Report

After every task, always summarize:

- Files changed
- What changed
- Why it changed
- Security impact
- Performance impact
- Risks
- Next recommended step

## 13. Safe Deployment Policy

For normal safe code fixes, after the fix is complete:

1. Check that the worktree is clean or use a clean worktree.
2. Run `pnpm build`.
3. If build fails, stop immediately.
4. If build passes, commit only files related to the task.
5. Push to `deploy-safe-setup-gacha-pop`.
6. Deploy Preview first.
7. If Preview deployment succeeds, deploy Production to `www.gachapop-th.xyz`.

Production command:

```bash
pnpm dlx vercel deploy --prod --yes
```

Never deploy Production automatically if the task involves:

- Deleting data
- Clearing inventory
- Database schema changes
- Wallet or coin balance logic
- Purchase or gacha logic
- Admin permission/security logic
- Environment variables or secrets
- Failed build
- Dirty worktree
- Unresolved git conflict

Do not expose secrets.
Do not print environment variable values.
Do not force push.
