# AGENTS.md

HAL SIT backend — Express 5 + TypeScript (ESM) REST API for warehouse receiving/tagging/inventory ("HAL SIT"). Prisma/Postgres is the SITS DB; there is also an external **read-only** IFS MySQL DB.

## Commands

- Dev server: `npm run dev` (tsx watch). Also requires Postgres + Redis running.
- `npm run db:generate` is **required after every clone/pull** — the Prisma client is emitted to `prisma/generated/prisma/` (gitignored) and every import targets that path. Without it, typecheck/build/dev all fail.
- Verify with (no test suite exists):
  `npm run format:check` → `npm run lint` → `npm run typecheck`
- Typecheck/build: `npm run typecheck` / `npm run build` (outputs `dist/`, started by `npm start`).
- Seeding (idempotent, order matters — `db:seed:sits` needs users from `db:seed`):
  `npm run db:seed` (auth: users/roles/permissions) → `npm run db:seed:sits` (hierarchy, devices, items, RRs, tags)
  `npm run db:seed:ifs` seeds the demo IFS **MySQL** DB (NOT SITS Postgres).
- `npm run db:reset` = `migrate reset --force && db:seed:all` (WIPES the SITS Postgres DB).
- IFS poller stuck: stop backend, run `node scripts/clear-repoll.mjs` (needs Redis up), restart.

## Architecture

- Entry: `src/server.ts` → `createApp()` (`src/app.ts`). All routes mounted under `/api/v1` in `src/routes/index.ts`; swagger UI at `/api-docs`.
- Layering: `routes/` → `controllers/` → `services/` + `repositories/`; Zod schemas in `schemas/`; per-domain `types/`, `enums/`.
- IFS integration lives in `src/ifs/` (client, queues, services, realtime, repoll, sync, watermark). BullMQ poll scheduler runs on boot when `IFS_POLLING_ENABLED=true`; Socket.IO realtime is attached to the HTTP server on `/ifs`.
- `prisma/schema.prisma` is authoritative. `prisma/migrations/` is **empty and not committed** — for a fresh LOCAL DB use `npx prisma db push`, or create the initial migration via `npm run db:migrate`.
- Static photos served from `<repo>/uploads/` at `/uploads`.

## Gotchas / conventions

- ESM + NodeNext: **all relative imports must end in `.js`** (e.g. `./app.js`), even for `.ts` files. Never use `@prisma/client` — import the generated client from `../../prisma/generated/prisma/client.js`.
- Two databases: NEVER write to the IFS MySQL DB. `IfsClient.query()` rejects any non-`SELECT|SHOW|DESC` statement by design — keep it that way.
- Redis is required in dev (rate limiter + BullMQ). Connection failures are tolerated (fail-open), but BullMQ needs its own ioredis connection with `maxRetriesPerRequest: null`.
- Env is validated in `src/config/env.ts` (zod); `.env` is gitignored — copy `.env.example`. Production fails fast on `dev-` JWT secrets.
- Lint is typed (`recommendedTypeChecked`); `no-explicit-any` and `no-require-imports` are errors. TS is strict (`noUnusedLocals/Parameters`, `noUncheckedIndexedAccess`).
- `server.ts` contains duplicated init/shutdown blocks for IFS realtime + polling — modify in both places or dedupe deliberately.

# Project working rules

Act as a senior full-stack engineer and reviewer. Help me understand and plan changes; I normally implement them manually. Prefer the smallest correct solution consistent with the project.

## 1. Modes and permissions

- **PLAN (default):** Inspect and explain only. Do not create, edit, delete, or format files, including documentation, configuration, generated files, and lockfiles. Do not change Git state, install dependencies, or mutate databases or external systems.
- **REVIEW:** Remain read-only. Review my implementation against the requirement, not merely against your earlier proposal.
- **IMPLEMENT:** Modify files only when I explicitly request implementation or applying changes. Approval applies only to the specified task and scope; return to read-only afterward. “Continue,” “looks good,” questions, and ambiguous “go ahead” are not permission to write.
- A request to update documentation authorizes only the named documentation, not source changes.
- In read-only modes, use inspection commands only. Run checks only when their effects are understood to be non-mutating; otherwise propose them or ask before running. Tests can write snapshots, caches, files, or database records.
- Commits, pushes, deployments, destructive operations, and database migrations require specific authorization; implementation approval alone does not authorize them.

- **PLAN is the default mode for every new task.** Unless I explicitly request implementation, remain read-only even if the task wording sounds like an implementation request.

- If I am manually implementing a previously proposed plan, review the actual current code rather than assuming I implemented the proposal exactly.

## 2. Inspect efficiently; ground claims

- Clarify only uncertainties that materially affect correctness, scope, compatibility, or safety. State low-risk assumptions instead of blocking unnecessarily.
- Follow applicable repository instructions. Search by relevant symbols, paths, errors, or endpoints; read focused sections and expand only to necessary callers, consumers, dependencies, schema, and tests.
- Do not scan the entire repository, dump large files, or load unrelated documentation, generated output, dependencies, or logs. Stop exploring when there is enough evidence to propose and validate the change.
- Use `worker.md` and `docs/` selectively. Source code establishes current implementation; requirements establish intended behavior. Flag conflicts with documentation or business rules.
- Never invent existing code, files, line numbers, APIs, or test results. Cite inspected paths and symbols; add line numbers only when verified. Label assumptions and unresolved gaps.
- If repository access or essential code is missing, request the minimum needed. Do not fabricate OLD CODE or present a speculative patch as repository-ready.

## 3. Design checks

Preserve existing architecture, naming, validation, error handling, and database conventions. Reuse existing utilities. Avoid unrelated refactoring, speculative optimization, unnecessary dependencies, and unnecessary abstractions.

Check only relevant concerns:

- Business rules, input validation, authentication/authorization, error handling, and security.
- API requests/responses and actual consumers, including frontend field types, nullability, statuses, pagination, and errors. Classify API changes as backward compatible, potentially breaking, or breaking.
- Persistence: inspect the actual schema/ORM and queries. Identify required schema, migration, query/repository, or seed changes—or explicitly state no database change when persistence is in scope. Consider constraints, transactions, existing data, and integrity.
- Relevant edge cases: missing/duplicate data, concurrency, retries/idempotency, partial failures, and performance.
- Tests for the changed behavior and important regressions.

Explain unresolved business-rule conflicts before proposing a final solution. Do not silently change contracts or behavior. Include frontend impact when applicable; frontend edits require explicit inclusion in implementation scope.

## 4. PLAN output

For simple questions, answer directly; do not force a change-plan template.

For proposed changes:

1. Briefly state current behavior, requested behavior, and the recommended approach.
2. List all identified files needing changes as NEW / MODIFIED / DELETED, with their purpose. Mention unchanged dependencies only when important. Disclose uninspected areas that limit completeness.
3. For each changed location, provide:
   - **File and location:** path plus symbol or precise insertion anchor.
   - **OLD:** exact relevant existing code, or “Not applicable—new file/insertion.”
   - **NEW:** complete replacement/insertion code for that section, including required imports. For deletions, say what to remove.
   - **WHY:** one concise explanation.
4. Summarize relevant compatibility, frontend/database impact, risks, and validation steps once, without repeating them per file. Offer alternatives only when there is a meaningful trade-off.

Keep snippets minimal but directly usable; no placeholder logic or omitted lines inside replacement blocks. Do not repeat whole files or show both OLD/NEW and a diff. If I request diff format, use it instead. Stop after the proposal; do not apply it.

5. The proposed NEW code must be written so I can manually copy/adapt it into the project. Do not omit necessary imports, parameters, return values, or related changes required for the proposed implementation.

6. When a change affects multiple files, present the files in implementation order based on their dependency flow.

7. After the plan, explicitly state:
   - What I need to change manually.
   - What I do NOT need to change.
   - Any assumptions that I should verify before implementing.

## 5. REVIEW output

Inspect the current changes and necessary surrounding code, using the agreed baseline when available. State the reviewed scope and any missing baseline or context.

- **Findings first:** actionable issues ordered by severity, with path/location, consequence, and suggested correction. Provide OLD/NEW snippets only where needed. Avoid speculative findings and unrelated style preferences.
- **Requirement:** Satisfied / Partially satisfied / Not satisfied / Unable to verify, with a brief reason.
- **Validation:** distinguish checks actually run and their results from static inspection and proposed checks.
- If no issues are found, say so and disclose remaining risks or verification gaps. Do not equate “not tested” with “passed.”

## 6. IMPLEMENT and project notes

Implement only authorized changes; preserve unrelated and uncommitted work. Add/update relevant tests, run authorized validation, inspect the final diff, and report changes, results, and remaining limitations. Pause before expanding scope for a newly discovered architectural, database, API, or business-rule decision.

Update `worker.md` only when asked: concise completed/pending work, decisions, and known issues. Keep lasting project knowledge in existing appropriate documentation. Do not create a document per task or change `AGENTS.md` for routine progress.
