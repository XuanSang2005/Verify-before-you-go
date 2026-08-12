# Verify Before You Go

Local-first Expo and Fastify monorepo for an evidence-first recruitment verification platform.

## Implemented scope: CP01–CP14

The approved CP01–CP13 foundation and CP14 ready-for-local-review implementation currently provide:

- Expo Router shell for iOS, Android, and responsive web
- Fastify API with `GET /api/v1/health`
- PostgreSQL 18 through Docker Compose
- Prisma schema, initial migration, and deterministic seed command
- Shared Zod API contracts
- Root development, verification, and database scripts
- Centralized visual tokens and the supplied Archivo, Be Vietnam Pro, and IBM Plex Mono fonts
- The accepted Homepage mascot and responsive Homepage at `/`
- Five tabs in the canonical order: Home, Check, News, Quiz, Help
- Homepage entry points for every major workflow
- Offer intake at `/check` for pasted text, recruitment links, and a locally selected screenshot
- Synthetic example postings and opt-in recent-check metadata that never stores posting content
- An edit-before-analysis posting preview at `/check/preview`
- Deterministic transient analysis through `POST /api/v1/checks/analyse`
- Marked passages, observed patterns, unknown information, and independent verification guidance
- Analysis overview at `/check/result` and finding details at `/check/finding/[id]`
- Offline five-item verification checklist at `/check/checklist`
- Offline MIL scenario practice at `/learn/scenario`
- PostgreSQL-backed synthetic newsroom at `/news` and `/news/[slug]`
- Offline five-topic MIL quiz at `/quiz`
- PostgreSQL-backed reviewed synthetic community alerts at `/alerts` and `/alerts/[id]`
- Search, location/category filters, masked identifiers, moderation metadata, review dates and independent verification guidance
- Anonymous local report drafting and privacy review at `/reports/new` and `/reports/privacy`
- Idempotent private report submission to PostgreSQL and a real receipt at `/reports/receipt`
- Unicode-safe fail-closed backend redaction, AAD-bound encrypted private fields, bounded recovery-key delivery, an atomic native SecureStore vault and one-session web key handling
- Privacy-safe sharing at `/share/preview` with backend-signed recipient tokens, native/Web share, copy fallback and a tamper-checked no-account recipient view at `/share/recipient`
- Private report status recovery at `/reports` with a minimal protected lookup API, native SecureStore keys and session-only web keys
- A Cambodia/Viet Nam help directory at `/help` with dated source metadata, explicit connectivity requirements and a versioned offline public cache
- Explicit inert placeholders only for workflows assigned to CP15 and later

The implemented screens use evidence-based language rather than a conclusion. Screenshot text is not extracted, offer content and analysis results remain transient, and public alert fixtures are synthetic, reviewed and privacy-masked. CP11 submits structured report facts; private evidence images remain local until a later secure upload flow. CP12 shares only allowlisted signal categories and fixed safety copy, never the posting, marked evidence, screenshot, identifiers, report data or recovery key. CP13 returns only a minimal workflow status after recovery-key verification. CP14 separates reviewed references from synthetic summaries and never auto-contacts a service or shares location. Placeholder routes contain no future business logic.

## Quick start

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for web, simulator, and physical Expo Go instructions.

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- Frontend web: `http://localhost:8081`
- Backend health: `http://localhost:4000/api/v1/health`
