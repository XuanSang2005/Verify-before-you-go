# Local development

## Prerequisites

- Node.js 24 LTS (the repository includes `.nvmrc`)
- npm 11 or a compatible npm release
- Docker Desktop with Docker Compose
- Expo Go for physical iOS or Android testing

## First run

From the canonical repository root `/Users/macbookpro/UNESCO/verify-before-you-go`:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts the backend on port `4000` and Expo on port `8081` with labelled logs. The services can also be started independently with `npm run dev:backend` and `npm run dev:frontend`.

The project PostgreSQL container is mapped to local port `5433` because port `5432` is already occupied on this development computer.

## Web

Keep `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`, run `npm run web`, then open `http://localhost:8081`.

## iOS Simulator

Keep the default frontend API URL. Run `npm run dev:frontend`, then press `i` in the Expo terminal. The iOS Simulator can reach the Mac through `localhost`.

## Android Emulator

Set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api/v1`, run `npm run dev:frontend`, then press `a` in the Expo terminal.

## Physical device with Expo Go

The computer LAN address detected again on 13 August 2026 is `10.102.13.48`. This address can change whenever the Mac changes Wi-Fi networks or hotspots, so confirm the current address with `ipconfig getifaddr en0` (or `ifconfig en0` when needed), then set:

```text
EXPO_PUBLIC_API_BASE_URL=http://10.102.13.48:4000/api/v1
CORS_ORIGINS=http://localhost:8081,http://localhost:8082,http://localhost:19006,http://10.102.13.48:8081,http://10.102.13.48:8082
```

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/frontend/.env` and add the LAN dev and static-preview origins `http://<LAN-IP>:8081` and `http://<LAN-IP>:8082` to the comma-separated `CORS_ORIGINS` value in `apps/backend/.env`. Restart both processes after either value changes. Without the LAN origins, native Expo Go requests can work while Safari opened at a LAN URL is still blocked by CORS.

Connect the phone and computer to the same trusted Wi-Fi network, run `npm run dev:frontend`, and scan the QR code with Expo Go. The backend binds to `0.0.0.0`. If the Mac firewall asks, allow incoming connections for Node.js.

Do not place secrets in variables beginning with `EXPO_PUBLIC_`. No public tunnel is created by this project.

## Database and verification commands

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm test
npx expo-doctor@latest apps/frontend
curl http://localhost:4000/api/v1/health
```

The seed is deterministic and idempotent. It reconciles foundation metadata, newsroom stories, reviewed alerts and support contacts, so it is safe to run repeatedly.

## CP03 offer drafts and privacy

Open `/check` to paste recruitment text, enter a complete `http://` or `https://` link, or select a screenshot. The selected screenshot is previewed locally; CP03 does not run OCR. The complete draft is held only in app memory and is intentionally unavailable after a full browser refresh or app restart.

The “Remember this check in Recent” switch is off by default. When enabled, AsyncStorage keeps only a timestamp and the input types used (`text`, `link`, or `screenshot`). It never stores the posting text, URL, or local image URI. Use “Clear recent” on the Check screen to remove this metadata.

## CP04 local analysis

From `/check/preview`, “Continue to analysis” calls the local backend at `POST /api/v1/checks/analyse`. Posting text and the recruitment link are processed in memory and are not written to PostgreSQL. A selected screenshot stays on the device; the API receives only a boolean indicating that one was selected.

The analysis uses versioned deterministic rules and returns observed patterns, exact marked text offsets, unknown information and suggested independent checks. It never returns a final classification, percentage or risk score. Results remain in app memory, so a full browser refresh or app restart requires running the analysis again.

The CP04 follow-up routes are `/check/checklist` (CP05), `/reports/new` (CP10), and `/share/preview` (CP12). `/check/share` remains only as a redirect alias for older local links.

## CP09 reviewed synthetic community alerts

Run `npm run db:migrate` and `npm run db:seed`, then open `/alerts`. The list and detail screens read public, privacy-masked alert fixtures from PostgreSQL through `GET /api/v1/alerts` and `GET /api/v1/alerts/:id`.

Search accepts public titles, locations and already-masked identifiers. Query values are excluded from backend request logs. The Alerts UI supports search and a location filter, including against a previously saved public list while offline; it does not show a pattern filter. A network failure may show the saved copy with its cache timestamp; HTTP/server and invalid-response failures are labelled separately. A module-scoped per-alert generation coordinator serializes authoritative cache writes and deletions. HTTP 404 blocks the matching detail before attempting storage deletion, so a failed removal or overlapping stale request cannot revive old content.

The seeded alerts are synthetic prototype records, not live allegations or verdicts. Public list and detail responses are validated against strict shared schemas before serialization. Identifier display values must match allowlisted handle, phone, licence or account formats with an internal bounded mask run and short visible prefix/suffix; invalid values fail closed. No raw report evidence, unmasked identifier, private attachment or recovery key is stored in the frontend cache.

## CP10–CP11 private report and receipt

Open `/reports/new`, add one identifier/source and at least one observed behaviour, then continue to `/reports/privacy`. The privacy screen separates the protected original from the editable public derivative. “Submit private report” calls `POST /api/v1/reports`; an interrupted retry reuses the saved idempotency attempt so it cannot silently create a second case.

The confirmed `/reports/receipt` screen shows the real report ID, submission time, initial `Received — not yet reviewed.` state and recovery key. It never creates a local receipt when the API fails. On iOS and Android recovery credentials are retained through one authoritative versioned SecureStore vault write. On web the key is held only in the current app session and must be copied or downloaded; it is not automatically written to browser storage. Matching retries can recover the same random key for ten minutes after submission. After that bounded window the receipt remains available but the raw key is not returned again.

`REPORT_SECURITY_SECRET` must be a unique base64url-encoded secret containing at least 32 random bytes. Generate one for each local environment with `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`; do not copy the `.env.example` value into a deployed environment.

CP11 submits structured facts and permissions. Images selected in CP10 remain in the device-local private draft and are not uploaded yet. No report is reviewed, verified, included in an alert or published automatically.

Recovery-delivery ciphertext is cleared automatically at backend startup and once per minute after its ten-minute delivery window expires. Cleanup failures are logged using a fixed code without report IDs or private data and retry on the next bounded sweep.

Three explicitly authorized local synthetic reports created with the legacy `aes-gcm-v1` format were removed during CP11 hardening. The guarded one-time command requires a loopback `verify_before_you_go` database, the exact allowlisted IDs/timestamps and cipher fingerprints, and a deletion count of exactly three inside one transaction. It fails closed on a fresh database or if any record differs:

```bash
npm run db:cleanup:cp11-local-v1 --workspace @vbyg/backend -- delete-exactly-3-authorized-local-synthetic-v1-reports
```

## CP12 privacy-safe sharing

Open `/share/preview` after a transient analysis to share an allowlisted summary of observed signal categories. The app never adds the recruitment posting, marked evidence, screenshot, screenshot metadata, full identifier, private report, case ID or recovery key to the shared text or recipient URL. A direct refresh without transient analysis shows the clearly labelled Screen 14 demo.

“Share privately” opens the native share sheet in Expo Go and uses Web Share in supporting browsers. Web browsers without Web Share copy the privacy-safe summary and recipient link instead; “Copy summary” is always available as an explicit fallback. The backend issues a seven-day token signed with a domain-separated key derived from `REPORT_SECURITY_SECRET`; recipient findings render only after `/api/v1/share-tokens/verify` accepts that token. If token creation is unavailable, sharing remains text-only and clearly says that the recipient link is unavailable—an unsigned URL is never created. CP12 adds no database persistence. Expo Go development links are LAN-bound and can change when Wi-Fi changes; production sharing needs a deployed universal/app link.

## CP13 My Reports and status recovery

Open `/reports` and enter the exact report ID and recovery key from a private receipt. The app sends them only in the body of `POST /api/v1/reports/status`; neither value is placed in a URL, query string, analytics event or ordinary log. The status response is deliberately minimal and never includes the report identifier/source, description, evidence, attachments, ciphertext or recovery hash.

On iOS and Android, report credentials use the existing versioned single-key SecureStore vault. Vault writes and clears are serialized, corrupt data is never silently overwritten, and an explicit recovery confirmation is required before resetting a damaged vault. On web, entered keys remain only in memory for the running browser session. A full refresh or browser restart requires entering them again; CP13 does not write raw keys to localStorage, sessionStorage, IndexedDB or AsyncStorage.

The list supports loading, empty, offline, invalid-credential and temporarily unavailable states. Clearing local access requires confirmation and removes only keys on this device or in this open browser session—it does not delete the server-side report. `Received`, `Under review` and `More evidence needed` are workflow states, not verification, publication or a scam verdict.

## CP14 help directory

Run `npm run db:migrate` and `npm run db:seed`, then open `/help`. `GET /api/v1/support-contacts` returns both Cambodia and Viet Nam packs; changing the country chip filters that public response locally and does not send location or geolocation data.

The production frontend includes a versioned, strict-contract support pack, so a first launch in airplane mode still shows the reviewed Cambodia and Viet Nam emergency, consular/embassy and organization references. The screen discloses the bundled review date and asks the user to verify availability again. A newer API response or newer valid cache replaces the bundle.

Successful API loads and explicit “Save offline” actions share one module-level, serialized cache coordinator. Superseded requests cannot publish state or cross the cache mutation boundary; network fallback re-reads the latest authoritative cache immediately before display. A response-body transport interruption uses the saved copy or bundle, while parsed data that fails the strict schema still fails closed. The cache contains no report, recruitment posting, evidence, screenshot, identifier, recovery key, account or device location.

Emergency, embassy/consular and organization cards show dated reviewed-reference metadata but do not guarantee availability. On web, calls and online actions are real `tel:`/`https:` anchors; on native they open only after the user activates the disclosed cellular/internet action. The app never monitors emergencies, automatically calls a service, or shares location.

## CP15 How It Works

Open `/how-it-works` for the optional evidence-first guide. It is never an onboarding gate and does not change the launch route: `/` remains the Homepage with Home selected. The guide explains transient checker analysis, why there is no scam score, what report data is deliberately sent to the backend, what remains on the device, recovery-key handling on native and web, and independent verification.

## CP16 local release check

Use the Node version in `.nvmrc` (Node 24). Choose one API address before building:

- Same-Mac review: `http://localhost:4000/api/v1`
- Phone/LAN review: `http://<LAN-IP>:4000/api/v1`

From the repository root, export that choice explicitly. Replace `<API-BASE-URL>` with exactly one of the addresses above:

```bash
export EXPO_PUBLIC_API_BASE_URL=<API-BASE-URL>
```

Update `apps/backend/.env` before starting the backend. For localhost-only review, include `http://localhost:8082`. For phone/LAN review, also include `http://<LAN-IP>:8082`:

```text
CORS_ORIGINS=http://localhost:8081,http://localhost:8082,http://localhost:19006,http://<LAN-IP>:8081,http://<LAN-IP>:8082
```

Restart or start the backend in its own terminal so it reads the updated CORS allowlist:

```bash
cd /Users/macbookpro/UNESCO/verify-before-you-go
npm run dev:backend
```

In a second terminal, create a clean export. `npm run export:web` clears Metro's cache so an older `EXPO_PUBLIC_*` value cannot remain in the bundle:

```bash
cd /Users/macbookpro/UNESCO/verify-before-you-go
EXPO_PUBLIC_API_BASE_URL=<API-BASE-URL> npm run export:web
cd apps/frontend
npx expo serve --port 8082
```

With the static server still running, run the reproducible release regressions from a third terminal. `CP16_LAN_ORIGIN` must be an origin allowed by the backend; use the current LAN address when testing from a phone:

```bash
cd /Users/macbookpro/UNESCO/verify-before-you-go
EXPO_PUBLIC_API_BASE_URL=<API-BASE-URL> \
CP16_STATIC_ORIGIN=http://localhost:8082 \
CP16_API_ORIGIN=http://localhost:4000 \
CP16_LAN_ORIGIN=http://<LAN-IP>:8082 \
npm run test:release-runtime --workspace @vbyg/frontend
```

The runtime command checks clean static routes, CORS for both preview origins, the exact exported API origin, and a rendered API-backed Newsroom reaching its ready state with real backend stories.

Always export again after changing any `EXPO_PUBLIC_*` value or after the LAN IP changes. Restart the backend whenever `CORS_ORIGINS` changes. Internal navigation and direct refresh are supported for all canonical routes. Known static parameters are generated for newsroom stories, reviewed alert IDs and analysis finding IDs. Transient checker results, private report drafts and one-time receipt state intentionally require their originating session and show an honest recovery state after a direct refresh.
