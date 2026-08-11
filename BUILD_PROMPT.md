# Build “Verify Before You Go” — Local-First Expo Application with Separate Frontend and Backend

You are Codex working inside the user’s local workspace.

Build a complete, functional, local-first version of the “Verify Before You Go” platform for a UNESCO Media and Information Literacy hackathon.

The project must include:

- A universal Expo Router frontend for iOS, Android and responsive web.
- A clearly separated Fastify backend.
- PostgreSQL with Prisma.
- Typed shared API contracts.
- All 19 application screens.
- Recruitment-news functionality.
- An interactive MIL quiz.
- Private recruitment-scam reporting.
- Reviewed community alerts.
- Local development and testing documentation.

All user-facing application content must be written in English.

Progress reports and testing instructions sent to the user should be written in Vietnamese.

---

# 1. Mandatory Working Mode: One Feature at a Time

This is a non-negotiable instruction.

Work on exactly one checkpoint at a time.

A checkpoint is a complete vertical feature slice containing all frontend, backend, database, API, persistence, test and documentation work required by that feature.

After completing and verifying one checkpoint:

1. Report what was completed.
2. Report all automated checks and their results.
3. Give the user exact local testing instructions.
4. State the expected results.
5. State known limitations honestly.
6. Stop working.
7. Wait for the user to inspect the feature.
8. Do not begin the next checkpoint until the user explicitly approves the current checkpoint.

The approval phrase is:

```text
DUYỆT CPxx
```

Silence is not approval.

Do not combine multiple checkpoints in one implementation batch.

If the user requests changes, fix the same checkpoint, verify it again, report again and stop.

Do not ask the user to test while relevant automated checks are failing. Continue fixing the current checkpoint until it passes, unless there is a genuine environmental blocker.

Route placeholders for future checkpoints are allowed only when required for navigation. They must:

- Contain no future business logic.
- Be visibly labelled as unfinished local prototype pages.
- Be replaced by the appropriate checkpoint before final completion.

Subagents may assist only with the currently approved checkpoint. They must not begin future checkpoints.

This checkpoint workflow overrides any earlier instruction saying to continue through the whole project without stopping.

---

# 2. Required Checkpoint Report Format

After every checkpoint, use this exact structure:

```text
CHECKPOINT CPxx — SẴN SÀNG ĐỂ BẠN KIỂM TRA

Đã hoàn thành:
- [Describe working behaviour, not merely files created.]

Frontend:
- [Routes and interactions completed.]

Backend:
- [Endpoints, persistence or contracts completed.]

Kiểm tra tự động:
- [Exact command] — PASS/FAIL
- [Exact command] — PASS/FAIL

Cách bạn kiểm tra:
1. [State whether local services are already running or give the exact command.]
2. [Provide the actual local URL, Expo Go action or application route.]
3. [Give exact taps, inputs and actions.]
4. Kết quả mong đợi: [Describe the specific visible result.]

Giới hạn còn lại của checkpoint này:
- [None, or an honest list.]

Tôi đang dừng tại CPxx và chưa làm CPyy.
Hãy trả lời “DUYỆT CPxx” để tôi tiếp tục, hoặc gửi yêu cầu chỉnh sửa.
```

Always provide:

- Actual local ports and URLs.
- Actual route names.
- Sample input the user can paste.
- Expected output.
- Whether the verification was automated, tested in web, or still requires a physical Expo Go check.

Keep the local development processes running for user review when practical.

---

# 3. Objective

Convert the existing “Verify Before You Go” HTML prototype into a functional application that helps migrant workers and job seekers:

- Analyse recruitment content without automatically declaring it safe or fraudulent.
- Identify warning signals.
- Understand what information remains unknown.
- Independently verify recruiters, licences and job offers.
- Review recruitment news and educational scam-pattern updates.
- Submit anonymous recruitment-scam reports.
- Review privacy-redacted community alerts.
- Practise Media and Information Literacy through scenarios and quizzes.
- Access emergency and support contacts offline.
- Share privacy-safe observations with trusted people.

The application must never generate a definitive scam/not-scam verdict.

---

# 4. Required Source Inspection

Before creating code, inspect all of these sources completely:

## Final HTML prototype

```text
/Users/macbookpro/Documents/Codex/2026-08-02/t/outputs/Verify_Before_You_Go_19_screens.html
```

## User Requirements Document

```text
/Users/macbookpro/Documents/Codex/2026-08-02/t/outputs/Verify_Before_You_Go_URD.pdf
```

## Existing mascot assets

```text
/Users/macbookpro/Documents/Codex/2026-08-02/t/work/vbyg-web/assets/mascots
```

## User-provided mascot cutouts

```text
/Users/macbookpro/Documents/Codex/2026-08-02/t/work/vbyg-web/assets/mascots/provided
```

Requirements:

- Decode and inspect the actual HTML, CSS, embedded data and image references.
- Inspect the complete PDF, including the Report Scam requirements.
- Inspect the mascot files visually before using them.
- Treat the final 19-screen HTML as the visual source of truth.
- Original HTML screen IDs are visual reference IDs only.
- Original HTML screen IDs must not determine the new application order.
- Do not modify the source HTML.
- Do not modify the source PDF.
- Do not overwrite or edit original mascot files.
- Copy required assets into the new frontend project.

If a source file is genuinely unavailable, report the exact missing path before substituting anything.

---

# 5. Project Location

Create the project at:

```text
/Users/macbookpro/Documents/Codex/2026-08-02/t/verify-before-you-go
```

Do not create the old `verify-before-you-go-mobile` structure.

---

# 6. Local-Only Scope

The complete application must run locally before any deployment work begins.

For this task:

- Do not deploy to Vercel.
- Do not deploy to Railway.
- Do not deploy to GitHub Pages.
- Do not create an EAS Build.
- Do not run `vercel`.
- Do not run `railway up`.
- Do not run `eas build`.
- Do not create a public repository.
- Do not push code to GitHub.
- Do not create external cloud resources.
- Do not purchase or configure a domain.
- Do not publish the application.

The architecture must remain compatible with the later intended deployment:

```text
apps/frontend → Vercel and Expo/EAS
apps/backend  → Railway
PostgreSQL    → managed PostgreSQL
```

However, do not perform or configure provider-specific deployment unless the user requests it in a later task.

Local functionality has priority.

---

# 7. Monorepo Architecture

Use npm workspaces unless an existing inspected project already uses another compatible workspace manager.

Create:

```text
verify-before-you-go/
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── storage/
│   │   │   ├── theme/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   ├── assets/
│   │   │   ├── fonts/
│   │   │   └── mascots/
│   │   ├── app.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── analysis/
│       │   │   ├── alerts/
│       │   │   ├── news/
│       │   │   ├── reports/
│       │   │   ├── uploads/
│       │   │   ├── quiz/
│       │   │   ├── support/
│       │   │   └── auth/
│       │   ├── config/
│       │   ├── database/
│       │   ├── middleware/
│       │   ├── plugins/
│       │   ├── utils/
│       │   ├── app.ts
│       │   └── server.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── analysis.ts
│       │   ├── alerts.ts
│       │   ├── news.ts
│       │   ├── reports.ts
│       │   ├── quiz.ts
│       │   ├── support.ts
│       │   ├── common.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
│   ├── LOCAL_DEVELOPMENT.md
│   ├── API.md
│   └── CHECKPOINTS.md
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .gitignore
├── .env.example
└── README.md
```

The root package must be private.

---

# 8. Strict Frontend and Backend Boundaries

Use this data flow:

```text
Expo screen
  → feature hook
  → typed frontend API client
  → HTTP /api/v1
  → Fastify route
  → service
  → repository
  → PostgreSQL or local private attachment storage
```

Enforce these boundaries:

- Frontend must never import files from `apps/backend`.
- Backend must never import files from `apps/frontend`.
- Frontend must never import Prisma.
- Frontend must never connect directly to PostgreSQL.
- Frontend must never contain database credentials.
- Frontend must never contain privileged storage credentials.
- React components must not call `fetch` directly.
- All frontend network calls must go through `apps/frontend/src/api`.
- Only `packages/contracts` may be imported by both applications.
- Shared contracts may contain Zod schemas, DTOs, enums, pagination types and API error types.
- Shared contracts must not contain UI code, database code or business logic.
- Do not create backend API routes inside the Expo Router `app` directory.
- Do not duplicate backend analysis or redaction business logic in the frontend.

Frontend redaction may show a preview, but the backend must validate and redact again.

---

# 9. Frontend Technical Requirements

Use:

- React Native.
- TypeScript.
- Current stable Expo SDK available at implementation time.
- Expo Router.
- Expo Go for iOS and Android.
- React Native web through Expo.
- React Native `StyleSheet`.
- Centralized design tokens.
- `npx expo install` for Expo package compatibility.
- AsyncStorage for non-sensitive local state.
- Expo SecureStore for native recovery keys and short-lived access tokens.
- Expo-compatible image selection.
- Expo-compatible native sharing.
- Safe-area support.
- Keyboard-aware layouts.

Do not:

- Use a WebView.
- Generate native `ios` or `android` folders.
- Add packages requiring a custom development client.
- use native modules unsupported by Expo Go.
- Render the HTML prototype as a screenshot.
- Fake completed functionality with static buttons.
- Regenerate, recolour or redraw supplied mascots.

For web, do not falsely claim browser storage is equivalent to SecureStore.

On web:

- Do not persist recovery keys automatically.
- Show the recovery key once.
- Provide copy and download/save instructions.
- Allow the user to enter the key again when checking a report.
- If optional browser persistence is offered, clearly warn that it is local browser storage.

---

# 10. Backend Technical Requirements

Create a separate local backend using:

- Current active-LTS Node.js.
- TypeScript.
- Fastify.
- PostgreSQL.
- Prisma ORM.
- Prisma Migrate.
- Runtime input validation.
- Explicit response schemas.
- Structured logging.
- Centralized error handling.
- CORS allowlists.
- Rate limiting on sensitive endpoints.
- Environment validation.
- Deterministic seed data.

The backend must:

- Listen on `process.env.PORT`, falling back to port `4000`.
- Bind to `0.0.0.0`.
- Expose `GET /api/v1/health`.
- Avoid logging report evidence, recovery keys or unnecessary personal information.
- Store only recovery-key hashes.
- Use idempotency keys for report submission.
- Treat submitted offer content as transient unless the user explicitly submits it as report evidence.
- Keep analysis logic deterministic and testable.
- Return observed signals, not a verdict.

Do not implement administrator or moderator UI unless explicitly requested later.

Moderation metadata may exist in seeded prototype data.

---

# 11. Local PostgreSQL and Storage

Use `docker-compose.yml` to run local PostgreSQL.

Pin a stable PostgreSQL version compatible with the selected Prisma version.

The local workflow should support commands equivalent to:

```bash
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

If Docker is unavailable:

- Do not silently switch to another database.
- Do not install system software without permission.
- Report the blocker during CP01.
- Ask whether to use an existing PostgreSQL installation or another local approach.

For local report attachments:

- Implement an `AttachmentStorage` interface.
- Use a private local development adapter under `apps/backend/.local-storage`.
- Add this folder to `.gitignore`.
- Serve evidence only through authorized backend endpoints.
- Do not make the directory a public static folder.
- Validate file type and file size.
- Generate opaque attachment IDs.
- Never expose absolute local filesystem paths to the frontend.

Keep the interface replaceable by private S3-compatible object storage later.

---

# 12. Local Environment Variables

Create committed example files without real secrets.

Backend example:

```text
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/verify_before_you_go
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
RECOVERY_KEY_PEPPER=replace-with-local-development-value
LOCAL_STORAGE_DIR=.local-storage
LOG_LEVEL=debug
```

Frontend example:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_DATA_MODE=api
```

For a physical Expo Go device, `localhost` points to the phone, not the development computer.

At CP01:

- Detect the computer’s reachable LAN address.
- Explain how to use it in `EXPO_PUBLIC_API_BASE_URL`.
- Do not expose secrets.
- Do not create a public tunnel without permission.
- Document simulator, web and physical-device configurations separately.

Never place secrets in variables beginning with `EXPO_PUBLIC_`.

---

# 13. Root Development Commands

Provide root scripts equivalent to:

```text
npm run dev
npm run dev:frontend
npm run dev:backend
npm run web
npm run typecheck
npm run test
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
npm run export:web
```

`npm run dev` should start frontend and backend together with clearly identifiable logs.

Frontend and backend must also run independently.

Do not use shell commands that hide or swallow failures.

---

# 14. Backend API Contract

Use versioned endpoints under:

```text
/api/v1
```

Implement as required by the checkpoints:

```text
GET    /api/v1/health

POST   /api/v1/checks/analyse

GET    /api/v1/news
GET    /api/v1/news/:slug

GET    /api/v1/alerts
GET    /api/v1/alerts/:id

GET    /api/v1/quiz
GET    /api/v1/support-contacts

POST   /api/v1/uploads

POST   /api/v1/reports
POST   /api/v1/reports/:id/access
GET    /api/v1/reports/:id
POST   /api/v1/reports/:id/evidence
```

Use a consistent error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted information is incomplete.",
    "requestId": "request-id"
  }
}
```

Do not return:

- Stack traces.
- Database details.
- Local file paths.
- Recovery-key hashes.
- Internal moderation notes.
- Private evidence in public responses.

---

# 15. Canonical Information Architecture

## Critical Homepage Rule

The Homepage must be the first and default application screen.

- The app must launch at `/`.
- `/` must render the Homepage.
- The Home tab must be selected at launch.
- Do not open onboarding first.
- Do not redirect first-time users to onboarding.
- Do not create an `onboardingComplete` redirect.
- “How it works” is an optional informational screen.
- First-time guidance may be a dismissible Homepage card.
- Every major workflow must be reachable from the Homepage.

## Bottom-tab order

Use exactly:

1. Home
2. Check
3. News
4. Quiz
5. Help

Nested check, alert, report, share and detail screens must open through a stack above the tabs.

---

# 16. Complete Screen Requirements

## App Screen 01 — Homepage

Route:

```text
/
```

Visual reference:

```text
Original HTML Screen 17
```

Include:

- “Check a job offer” primary action.
- Recruitment news.
- MIL quiz.
- Reviewed community alerts.
- Report an offer.
- My reports.
- Help and emergency contacts.
- Latest recruitment briefing.
- Quick practice card.
- Optional “How it works” link.
- Evidence-not-verdict trust statement.

Every important workflow must be reachable from here.

## App Screen 02 — Offer Checker

Route:

```text
/(tabs)/check
```

Visual reference:

```text
Original HTML Screen 02
```

Support:

- Paste recruitment text.
- Select a screenshot.
- Enter a recruitment link.
- Recent checks.
- Example job postings.
- Scenario-practice link.
- Reviewed-alerts link.

Do not pretend that screenshot OCR succeeded if OCR is not implemented.

If local OCR is not reliable, allow screenshot selection, preview and optional accompanying transcription while clearly explaining the limitation.

## App Screen 03 — Posting Preview

Route:

```text
/check/preview
```

Visual reference:

```text
Original HTML Screen 03
```

Display submitted text, link and screenshot preview.

Allow users to edit or continue.

## App Screen 04 — Analysis Overview

Route:

```text
/check/result
```

Visual reference:

```text
Original HTML Screen 04
```

Show:

- Observed-signal count.
- Marked passages.
- Evidence-based warning signals.
- Missing or unverified information.
- Clear “Not a verdict” disclaimer.
- Finding-detail link.
- Checklist link.
- Reporting link.
- Sharing link.

## App Screen 05 — Finding Detail

Route:

```text
/check/finding/[id]
```

Visual reference:

```text
Original HTML Screen 05
```

Explain:

- What was observed.
- Why it may matter.
- What remains unknown.
- How to verify independently.

## App Screen 06 — Verification Checklist

Route:

```text
/check/checklist
```

Visual reference:

```text
Original HTML Screen 06
```

Implement five interactive verification items.

Persist progress locally.

Support reset and offline use.

## App Screen 07 — MIL Scenario Practice

Route:

```text
/learn/scenario
```

Visual reference:

```text
Original HTML Screen 07
```

Present two recruitment posts and ask which one the user would investigate or trust first.

Show educational feedback after selection.

Allow retry.

## App Screen 08 — Recruitment Newsroom

Route:

```text
/(tabs)/news
```

Visual reference:

```text
Original HTML Screen 18
```

Create:

- Hiring updates.
- Scam Watch.
- Guides.
- MIL explainers.
- Filter chips.
- Featured story.
- Source-status metadata.
- Publication date.
- Review date.
- Alerts and verification-guide links.
- Loading, empty, offline and error states.

Add a subordinate detail route when needed:

```text
/news/[slug]
```

Do not count this subordinate route as an additional numbered prototype screen.

All local stories must be visibly labelled as synthetic prototype content.

## App Screen 09 — Interactive MIL Quiz

Route:

```text
/(tabs)/quiz
```

Visual reference:

```text
Original HTML Screen 19
```

Implement exactly five learning topics:

1. Passport requests combined with urgency.
2. Independent verification of licences and certificates.
3. Viral accusations are leads rather than proof.
4. No watchlist match does not prove safety.
5. Share redacted observations rather than accusations.

Include:

- Question progress.
- Selectable answers.
- Immediate educational feedback.
- Local score.
- Completion state.
- Retry.
- Link to the Offer Checker.
- Supplied learning and lightbulb mascots.

The mascot should be visibly large.

Its feet may overlap the quiz progress bar.

It must never overlap:

- Page title.
- Question heading.
- Supporting text.
- Answer options.
- Buttons.

## App Screen 10 — Community Alerts

Route:

```text
/alerts
```

Visual reference:

```text
Original HTML Screen 12
```

Include:

- Search.
- Location filters.
- Category filters.
- Reviewed synthetic alerts.
- Moderation status.
- Review date.
- Masked identifiers.

Display exactly:

```text
No match does not mean an offer is safe.
```

## App Screen 11 — Alert Detail

Route:

```text
/alerts/[id]
```

Visual reference:

```text
Original HTML Screen 13
```

Show:

- Observed evidence.
- Number of compatible reports.
- What remains unconfirmed.
- Review date.
- Independent verification steps.
- “Not a verdict” disclaimer.

## App Screen 12 — Report Details

Route:

```text
/reports/new
```

Visual reference:

```text
Original HTML Screen 09
```

Allow users to:

- Select observed behaviours.
- Add relevant evidence.
- Remove evidence.
- Write a factual description.
- Review what will be submitted.

Reports must be anonymous by default.

## App Screen 13 — Privacy Review

Route:

```text
/reports/privacy
```

Visual reference:

```text
Original HTML Screen 10
```

Show:

- Private evidence.
- Redacted public version.
- Privacy controls.
- Sharing permissions.
- Warning against passports, home addresses and unrelated conversations.

Client-side redaction is a preview. The backend must redact again.

## App Screen 14 — Report Receipt

Route:

```text
/reports/receipt
```

Visual reference:

```text
Original HTML Screen 11
```

After a successful backend submission, display:

- Report ID.
- One-time recovery key.
- Submission time.
- Initial status.

Explain that receipt does not mean the report has been reviewed, verified or published.

Do not generate a fake receipt when the API submission fails.

## App Screen 15 — Share to Protect

Route:

```text
/share/preview
```

Visual reference:

```text
Original HTML Screen 14
```

Create a redacted sharing preview.

Hide:

- Names.
- Full handles.
- Passport details.
- Screenshot metadata.
- Unrelated conversations.
- Private report evidence.

Use:

- Expo Go-compatible native sharing on mobile.
- Web Share API when available.
- Copy-link or copy-text fallback on web.

## App Screen 16 — Recipient View

Route:

```text
/share/recipient
```

Visual reference:

```text
Original HTML Screen 15
```

Show what a trusted friend receives.

Never expose private evidence or hidden identifiers.

## App Screen 17 — My Reports

Route:

```text
/reports
```

Visual reference:

```text
Original HTML Screen 16
```

Include:

- Under-review reports.
- More-evidence-needed status.
- Add recovery key.
- Retrieve status.
- Clear locally stored access records with confirmation.

Native recovery keys must use SecureStore.

On web, ask for the recovery key again unless the user explicitly opts into local browser storage with a warning.

## App Screen 18 — Help and Emergency Contacts

Route:

```text
/(tabs)/help
```

Visual reference:

```text
Original HTML Screen 08
```

Provide offline prototype contacts for Cambodia and Vietnam.

Include:

- Country filters.
- Emergency contacts.
- Embassies.
- Support organisations.
- Offline availability indicators.
- Link to “How it works”.

Clearly distinguish:

- Emergency data.
- Synthetic prototype data.
- Information requiring internet access.

## App Screen 19 — How It Works

Route:

```text
/how-it-works
```

Visual reference:

```text
Original HTML Screen 01
```

This is not an onboarding gate.

Explain:

- How offer analysis works.
- Why there is no scam score.
- Privacy-first reporting.
- What remains on the device.
- What is sent to the backend.
- Independent verification.

Include:

- Back to Homepage.
- Check an offer.
- Get help.

---

# 17. Design System

Closely reproduce the final HTML visual language.

Use:

- Primary navy: `#00224A`.
- Supporting blue: `#005CA8`.
- Bright blue: `#0077D4`.
- Ice background: `#EDF5FD`.
- Amber: `#FFC24D`.
- White and light-grey surfaces.
- Rounded cards.
- Pill-shaped buttons.
- Strong editorial hierarchy.
- Archivo headings.
- IBM Plex Mono metadata.

Requirements:

- Centralize colours, spacing, typography, radii and shadows.
- Use reusable components.
- Respect safe areas.
- Handle the keyboard.
- Use at least 44×44-point touch targets.
- Add accessibility labels.
- Support screen readers.
- Support reduced-motion preferences where relevant.
- Provide visible web focus states.
- Provide hover, pressed, loading and disabled states.
- Avoid low-contrast text.
- No essential information may depend only on colour.

Create reusable components such as:

- `AppHeader`
- `ScreenContainer`
- `PrimaryButton`
- `SecondaryButton`
- `InfoCard`
- `StatusBadge`
- `SignalCard`
- `ProgressBar`
- `FilterChips`
- `MascotIllustration`
- `EmptyState`
- `OfflineNotice`
- `ErrorState`
- `LoadingState`

---

# 18. Mascot Requirements

Use only the supplied mascot artwork.

Do not:

- Regenerate mascots.
- Redraw mascots.
- Recolour mascots.
- Restyle mascots.
- Replace accepted mascots with new generated characters.
- Use the same top-right-corner placement on every page.

Preserve mascot choices and placements from original HTML Screens 01–08 because those placements were already accepted.

For original HTML Screens 09–19, follow the final corrected HTML.

Maintain inclusive representation while balancing the supplied human mascots with the colourful abstract mascots.

Use varied contextual placement:

- Inside cards.
- Beside search controls.
- In success states.
- At the bottom of share previews.
- Inside newsroom artwork.
- On the quiz progress bar.
- Beside empty states.

Mascots must never cover essential copy or controls.

At each relevant checkpoint, visually inspect the implemented screen at the 390×844 reference size.

---

# 19. Responsive Web Requirements

The frontend must also run as a responsive local website.

It must not simply display a mobile phone frame in the middle of the browser.

Support at minimum:

- 360 px mobile.
- 390×844 reference.
- 768 px tablet.
- 1024 px laptop.
- 1440 px desktop.

On larger screens:

- Expand grids intelligently.
- Use readable maximum content widths.
- Adapt news-card layouts.
- Adapt filter layouts.
- Adapt quiz layouts.
- Preserve the mobile visual identity.
- Keep navigation understandable.

Configure Expo web static output:

```json
{
  "expo": {
    "web": {
      "output": "static",
      "bundler": "metro"
    }
  }
}
```

The final local release checkpoint must pass:

```bash
npx expo export -p web
```

The generated output must be locally previewable from `dist`.

All implemented routes must work through internal navigation and direct browser refresh.

For dynamic routes, generate known static paths when required.

Do not deploy the web output in this task.

---

# 20. Offer Analysis Rules

Offer analysis belongs to the backend.

Use deterministic, transparent prototype rules.

Possible observed patterns include:

- Urgency.
- Requests for passport documents.
- Upfront payment requests.
- Moving conversations off-platform.
- Missing employer information.
- Unverifiable licence claims.
- Suspicious shortened links.
- Salary claims without supporting detail.
- Pressure not to contact official organisations.

Return:

- Matched passage.
- Observed pattern.
- Explanation.
- Unknown information.
- Suggested verification step.
- Analysis-rule version.

Never return:

- “Scam”.
- “Not a scam”.
- “Safe”.
- A fraudulent-person label.
- A safety percentage.
- A deceptive risk score.

The UI may count observed signals, but must explain that the count is not a verdict.

---

# 21. Reports, Recovery Keys and Privacy

Reports are anonymous by default.

When a report is submitted:

1. Validate the request.
2. Enforce idempotency.
3. Redact public fields on the backend.
4. Create a public-safe report ID.
5. Generate a strong recovery key.
6. Return the recovery key exactly once.
7. Store only a strong hash of the key.
8. Never place the key in a URL.
9. Never log the key.
10. Store native keys through SecureStore.
11. Exchange a valid key for a short-lived access token when retrieving report status.

Do not expose:

- Raw private evidence in alerts.
- Full handles.
- Passport details.
- Home addresses.
- Private attachment paths.
- Hidden moderation notes.

Queued local drafts are not submitted reports.

The UI must distinguish:

- Draft.
- Waiting to submit.
- Received.
- Under review.
- More evidence needed.
- Reviewed.

---

# 22. Local and Server State

PostgreSQL is the source of truth for:

- News.
- Reviewed alerts.
- Reports.
- Report status history.
- Attachment records.
- Analysis-rule versions.
- Quiz content versions.
- Support-contact versions.
- Moderation metadata.

Use AsyncStorage only for:

- Report drafts.
- Checklist progress.
- Quiz progress.
- Dismissed Homepage guidance.
- Cached public news.
- Cached alerts.
- Cached support contacts.
- User-consented recent-check history.

Use SecureStore on native for:

- Recovery keys.
- Short-lived report-access tokens.
- Anonymous installation credentials if later introduced.

Do not silently fall back to synthetic local data if the API fails.

Synthetic content must be explicit and visible.

---

# 23. Offline Behaviour

Available offline:

- Verification checklist.
- Previously loaded quiz content.
- Quiz progress.
- Report drafts.
- Cached support contacts.
- Cached news summaries.
- Cached alert summaries.
- “How it works”.

When offline:

- Show last-updated time for cached remote content.
- Do not claim queued reports were received.
- Do not automatically submit reports without explicit action.
- Preserve drafts.
- Show a retry action.
- Keep emergency-contact distinctions clear.

---

# 24. Safety Language

Use language such as:

- “Warning signal”
- “Observed pattern”
- “Needs independent verification”
- “Not a verdict”
- “No match does not mean safe”
- “Synthetic demo content”

Never accuse an identified person, recruiter or company based only on automated signals or unreviewed submissions.

All synthetic content must be clearly marked as synthetic.

---

# 25. Checkpoint Sequence

## CP01 — Local Foundation

Implement only:

- Source inspection.
- npm workspace.
- `apps/frontend`.
- `apps/backend`.
- `packages/contracts`.
- Local PostgreSQL through Docker Compose.
- Prisma initialization.
- Initial migration.
- Seed mechanism.
- Root scripts.
- Environment examples.
- Backend health endpoint.
- Minimal Expo Router shell sufficient to prove startup.
- Local web startup.
- Expo Go-compatible startup.
- LAN-IP documentation.

Stop and wait for:

```text
DUYỆT CP01
```

## CP02 — App Shell and Homepage

Implement:

- Design tokens.
- Fonts.
- Shared components needed by Homepage.
- Supplied mascot integration.
- Five-tab navigation.
- Exact tab order.
- `/` Homepage.
- No onboarding redirect.
- Homepage cards and entry points.
- Inert placeholders for unfinished routes only where necessary.

Stop and wait for:

```text
DUYỆT CP02
```

## CP03 — Offer Intake and Preview

Implement App Screens 02–03:

- Text input.
- Link input.
- Screenshot selection.
- Examples.
- Recent local checks.
- Input validation.
- Posting preview.
- Edit-before-analysis flow.

Stop and wait for:

```text
DUYỆT CP03
```

## CP04 — Analysis and Finding Detail

Implement App Screens 04–05:

- Shared contracts.
- Backend deterministic analysis service.
- `POST /api/v1/checks/analyse`.
- Marked passages.
- Observed signals.
- Unknown information.
- Verification guidance.
- Finding detail.
- Safety language.
- Backend and frontend tests.

Stop and wait for:

```text
DUYỆT CP04
```

## CP05 — Verification Checklist

Implement App Screen 06:

- Five interactive verification items.
- AsyncStorage persistence.
- Reset.
- Offline behaviour.
- Accessibility.

Stop and wait for:

```text
DUYỆT CP05
```

## CP06 — MIL Scenario Practice

Implement App Screen 07:

- Two recruitment scenarios.
- Selection.
- Educational feedback.
- Retry.
- Navigation to checker.

Stop and wait for:

```text
DUYỆT CP06
```

## CP07 — Recruitment Newsroom

Implement App Screen 08:

- Backend news module.
- Prisma news model.
- Synthetic seed stories.
- News list and detail endpoints.
- Featured story.
- Filters.
- Source status.
- Publication and review dates.
- Loading, empty, error and offline states.

Stop and wait for:

```text
DUYỆT CP07
```

## CP08 — Interactive MIL Quiz

Implement App Screen 09:

- All five required topics.
- Backend or bundled versioned question content.
- Immediate feedback.
- Progress.
- Score.
- Completion.
- Retry.
- Local persistence.
- Correct large mascot placement.

Stop and wait for:

```text
DUYỆT CP08
```

## CP09 — Community Alerts

Implement App Screens 10–11:

- Alert database models.
- Synthetic reviewed alert seeds.
- List and detail API.
- Search.
- Location and category filters.
- Masked identifiers.
- Moderation metadata.
- Review date.
- Verification guidance.
- Required disclaimers.

Stop and wait for:

```text
DUYỆT CP09
```

## CP10 — Anonymous Report Draft and Privacy Review

Implement App Screens 12–13 without final submission:

- Observed-behaviour selection.
- Description.
- Evidence add/remove.
- Draft persistence.
- Local private attachment adapter.
- Redacted preview.
- Privacy controls.
- Sharing permissions.
- Privacy warnings.

Stop and wait for:

```text
DUYỆT CP10
```

## CP11 — Report Submission and Receipt

Implement App Screen 14:

- Report database models.
- Idempotent backend submission.
- Server-side redaction.
- Report ID.
- One-time recovery key.
- Server-side recovery-key hash only.
- SecureStore on native.
- Web recovery-key handling.
- Submission time.
- Honest initial status.
- Receipt UI.
- Failure and retry states.

Stop and wait for:

```text
DUYỆT CP11
```

## CP12 — Privacy-Safe Sharing

Implement App Screens 15–16:

- Redacted share preview.
- Native share sheet.
- Web Share support.
- Copy fallback.
- Recipient view.
- Verification that private evidence and identifiers are absent.

Stop and wait for:

```text
DUYỆT CP12
```

## CP13 — My Reports

Implement App Screen 17:

- Local report access records.
- Recovery-key entry.
- Access-token exchange.
- Backend report status retrieval.
- Under-review state.
- More-evidence-needed state.
- Clear local access records with confirmation.

Stop and wait for:

```text
DUYỆT CP13
```

## CP14 — Help and Emergency Contacts

Implement App Screen 18:

- Cambodia/Vietnam filters.
- Emergency contacts.
- Embassies.
- Support organisations.
- Offline cache.
- Data-status distinctions.
- Link to How it works.

Stop and wait for:

```text
DUYỆT CP14
```

## CP15 — How It Works

Implement App Screen 19:

- Optional informational screen.
- No onboarding gate.
- Analysis explanation.
- No-scam-score explanation.
- Privacy explanation.
- Device-versus-server explanation.
- Independent verification guidance.
- Home, Check and Help links.

Stop and wait for:

```text
DUYỆT CP15
```

## CP16 — Final Local Release Candidate

Complete final integration only after CP01–CP15 are approved.

Verify:

- All 19 application screens.
- All subordinate routes.
- All internal links.
- Exact tab order.
- Homepage launch.
- No onboarding redirect.
- Backend integration.
- Prisma migrations.
- Seed data.
- Report privacy.
- Recovery keys.
- Offline states.
- Loading states.
- Empty states.
- Error states.
- Accessibility.
- Keyboard navigation on web.
- Responsive layouts.
- Mascot placement.
- Expo Go compatibility.
- Local web production export.
- README.
- Local runbook.
- API documentation.
- No remaining placeholders.

Stop and wait for:

```text
DUYỆT CP16
```

---

# 26. Verification Requirements

At the relevant checkpoints, run:

- TypeScript checks.
- Backend tests.
- Frontend tests.
- Contract tests.
- Prisma validation.
- Prisma migrations.
- Expo Doctor.
- Expo development startup.
- Local backend health request.
- Local responsive web testing.
- Production web export at CP16.

Do not claim physical Expo Go testing was completed unless it was actually performed by the user or through an available physical-device workflow.

Use visual inspection for mascot placement and responsive layouts.

---

# 27. Definition of Done

The project is complete only when:

- Frontend and backend run independently.
- They also run together from the repository root.
- Local PostgreSQL starts reliably.
- Migrations apply successfully.
- Seed data loads.
- `/api/v1/health` returns HTTP 200.
- `/` always renders Homepage.
- Home is the selected launch tab.
- No onboarding redirect exists.
- All 19 screens work.
- All visible primary actions work.
- News loads from the local backend.
- Alerts load from the local backend.
- Offer analysis loads from the local backend.
- Anonymous reports persist in PostgreSQL.
- Recovery keys are stored only as hashes on the backend.
- Native recovery keys use SecureStore.
- Private attachments are not public.
- Synthetic content is labelled.
- The application never gives a scam verdict.
- Responsive web export succeeds.
- Expo Go compatibility is preserved.
- All 16 checkpoints have been approved by the user.

Start with CP01 only.

Do not begin CP02 in the same turn.

When CP01 is complete, report using the mandatory checkpoint format and wait for the user.