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

The computer LAN address detected again on 11 August 2026 is `192.168.1.17`. This address can change whenever the Mac changes Wi-Fi networks or hotspots, so confirm the current address with `ipconfig getifaddr en0` (or `ifconfig en0` when needed), then set:

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.17:4000/api/v1
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://192.168.1.17:8081
```

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/frontend/.env` and add the LAN web origin `http://<LAN-IP>:8081` to the comma-separated `CORS_ORIGINS` value in `apps/backend/.env`. Restart both processes after either value changes. Without the LAN origin, native Expo Go requests can work while Safari opened at the LAN URL is still blocked by CORS.

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

The seed command upserts one deterministic foundation record, so it is safe to run repeatedly.

## CP03 offer drafts and privacy

Open `/check` to paste recruitment text, enter a complete `http://` or `https://` link, or select a screenshot. The selected screenshot is previewed locally; CP03 does not run OCR. The complete draft is held only in app memory and is intentionally unavailable after a full browser refresh or app restart.

The “Remember this check in Recent” switch is off by default. When enabled, AsyncStorage keeps only a timestamp and the input types used (`text`, `link`, or `screenshot`). It never stores the posting text, URL, or local image URI. Use “Clear recent” on the Check screen to remove this metadata.

## CP04 local analysis

From `/check/preview`, “Continue to analysis” calls the local backend at `POST /api/v1/checks/analyse`. Posting text and the recruitment link are processed in memory and are not written to PostgreSQL. A selected screenshot stays on the device; the API receives only a boolean indicating that one was selected.

The analysis uses versioned deterministic rules and returns observed patterns, exact marked text offsets, unknown information and suggested independent checks. It never returns a final classification, percentage or risk score. Results remain in app memory, so a full browser refresh or app restart requires running the analysis again.

The CP04 follow-up routes are `/check/checklist` (CP05), `/reports/new` (CP10), and `/share/preview` (CP12). `/check/share` remains only as a redirect alias for older local links.

## CP09 reviewed synthetic community alerts

Run `npm run db:migrate` and `npm run db:seed`, then open `/alerts`. The list and detail screens read public, privacy-masked alert fixtures from PostgreSQL through `GET /api/v1/alerts` and `GET /api/v1/alerts/:id`.

Search accepts public titles, locations, categories and already-masked identifiers. Query values are excluded from backend request logs. Location and pattern filters also work against a previously saved public list while offline. A network failure may show the saved copy with its cache timestamp; HTTP/server and invalid-response failures are labelled separately. A module-scoped per-alert generation coordinator serializes authoritative cache writes and deletions. HTTP 404 blocks the matching detail before attempting storage deletion, so a failed removal or overlapping stale request cannot revive old content.

The seeded alerts are synthetic prototype records, not live allegations or verdicts. Public list and detail responses are validated against strict shared schemas before serialization. Identifier display values must match allowlisted handle, phone, licence or account formats with an internal bounded mask run and short visible prefix/suffix; invalid values fail closed. No raw report evidence, unmasked identifier, private attachment or recovery key is stored in the frontend cache.

## CP10–CP11 private report and receipt

Open `/reports/new`, add one identifier/source and at least one observed behaviour, then continue to `/reports/privacy`. The privacy screen separates the protected original from the editable public derivative. “Submit private report” calls `POST /api/v1/reports`; an interrupted retry reuses the saved idempotency attempt so it cannot silently create a second case.

The confirmed `/reports/receipt` screen shows the real report ID, submission time, initial `Received — not yet reviewed.` state and recovery key. It never creates a local receipt when the API fails. On iOS and Android recovery credentials are retained through one authoritative versioned SecureStore vault write. On web the key is held only in the current app session and must be copied or downloaded; it is not automatically written to browser storage. Matching retries can recover the same random key for ten minutes after submission. After that bounded window the receipt remains available but the raw key is not returned again.

`REPORT_SECURITY_SECRET` must be a unique base64url-encoded secret containing at least 32 random bytes. Generate one for each local environment with `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`; do not copy the `.env.example` value into a deployed environment.

CP11 submits structured facts and permissions. Images selected in CP10 remain in the device-local private draft and are not uploaded yet. No report is reviewed, verified, included in an alert or published automatically.

## CP12 privacy-safe sharing

Open `/share/preview` after a transient analysis to share an allowlisted summary of observed signal categories. The app never adds the recruitment posting, marked evidence, screenshot, screenshot metadata, full identifier, private report, case ID or recovery key to the shared text or recipient URL. A direct refresh without transient analysis shows the clearly labelled Screen 14 demo.

“Share privately” opens the native share sheet in Expo Go and uses Web Share in supporting browsers. Web browsers without Web Share copy the privacy-safe summary and recipient link instead; “Copy summary” is always available as an explicit fallback. Recipient links open `/share/recipient` and contain only schema version, allowlisted signal IDs, demo state and an expiry timestamp. CP12 creates no backend endpoint and no local persistence. Expo Go development links are LAN-bound and can change when Wi-Fi changes; production sharing needs a deployed universal/app link.
