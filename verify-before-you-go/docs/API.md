# Local API

Base URL: `http://localhost:4000/api/v1`

## `GET /health`

Returns HTTP 200 when the service and PostgreSQL connection are ready.

```json
{
  "status": "ok",
  "service": "verify-before-you-go-backend",
  "database": "connected",
  "timestamp": "2026-08-09T05:00:00.000Z"
}
```

If the database check fails, the endpoint returns HTTP 503 with the same response shape and `status: "degraded"`, `database: "unavailable"`.

## `POST /checks/analyse`

Runs nine deterministic prototype rules without storing the request or result. The screenshot binary and local URI are never sent; `screenshotProvided` only records that the user selected one.

```json
{
  "postingText": "URGENT: Contact us on Telegram and send a passport photo.",
  "recruitmentLink": "https://jobs.example.org/posting",
  "screenshotProvided": false
}
```

At least one of `postingText`, `recruitmentLink`, or `screenshotProvided: true` is required. Text is limited to 12,000 characters, links to 2,048 characters, and links must use HTTP or HTTPS.

The HTTP 200 response contains:

- A deterministic `analysisId` and `ruleVersion`.
- `observedSignalCount` and `checkedRuleCount`—never a rating or conclusion.
- `findings`, each with the observed pattern, passage or absence evidence, explanation, unknown information, and independent verification steps.
- Exact `markedPassages` offsets into the raw submitted `postingText`, including any leading or trailing whitespace.
- Global missing or unverified information and a mandatory “not a verdict” safety statement.
- `screenshotNote` when a screenshot was selected but not uploaded or read.

Invalid requests return HTTP 400 using the shared API error contract:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted recruitment information is incomplete or invalid.",
    "requestId": "request-id"
  }
}
```

## `GET /news`

Returns PostgreSQL-backed synthetic newsroom summaries ordered with the featured story first and then by publication date. Optional `category` values are:

- `hiring-update`
- `scam-watch`
- `guide`
- `mil-explainer`

Every summary includes its explicit `Synthetic prototype` label, source-status label, publication date, review date and reading time. The response also includes `fetchedAt` so the frontend can label cached offline content accurately.

## `GET /news/:slug`

Returns one complete synthetic story with educational body sections, independent verification steps and source notes. Unknown slugs return HTTP 404 with `NEWS_STORY_NOT_FOUND`; no database or storage details are exposed.

## `GET /alerts`

Returns PostgreSQL-backed, reviewed synthetic alert summaries ordered by review date. Optional filters are:

- `search`: up to 120 characters; matches public titles, locations, summaries and masked identifiers.
- `location`: `cambodia`, `vietnam`, or `regional`.
- `category`: `identity-document`, `off-platform-contact`, `licence-claim`, or `upfront-payment`.

Every result includes its moderation status, compatible-report count, review date and masked public identifiers. List responses do not include the detail-only evidence arrays. All fixtures are labelled `Synthetic demo data`; they are not live allegations or verdicts.

## `GET /alerts/:id`

Returns one reviewed synthetic alert such as `A-018`, including observed evidence, unknown information, independent verification steps, review metadata and the required not-a-verdict statement. Only privacy-masked public identifiers are returned. Unknown valid IDs return HTTP 404 with `COMMUNITY_ALERT_NOT_FOUND`.

## `POST /reports`

Creates one anonymous private report and returns its receipt. The request must include an `Idempotency-Key` header containing 20–128 URL-safe characters. A retry with the same key and identical structured report returns the same report ID; the recovery credential is re-delivered only inside its bounded delivery window. Reusing the key with different details returns HTTP 409.

```json
{
  "subjectType": "recruiter",
  "identifierType": "handle",
  "identifier": "@example_recruiter",
  "behaviourIds": ["identity-document-request", "pressure"],
  "description": "The sender requested a passport image before sharing a written contract.",
  "redactedPreview": "Messaging handle hidden. Identity-document number hidden.",
  "permissions": {
    "useForPrivateMatching": true,
    "allowRedactedPublicAlert": false,
    "shareWithNamedPartner": false,
    "namedPartner": ""
  }
}
```

HTTP 201 returns a non-enumerable report ID, the exact submission time, initial `received` status and the mandatory not-reviewed notice. The first successful response includes a cryptographically random 128-bit recovery key. Matching idempotent retries can re-deliver that key only during a ten-minute delivery window; later retries return the same receipt metadata with `recoveryKey: null` and `recoveryKeyStatus: "unavailable"`. Every response from this endpoint uses `Cache-Control: no-store` and `Pragma: no-cache`.

The backend normalizes Unicode and zero-width bypasses, redacts the public derivative again, and persists no public derivative when public-alert permission is disabled. Private fields use AES-256-GCM with schema/report/field AAD. Domain-separated keys are derived from `REPORT_SECURITY_SECRET`; matching and idempotency values are HMAC-protected, while the durable recovery credential remains a scrypt hash. Only the short-lived delivery copy is encrypted until the retry window expires. Request bodies, idempotency values and recovery keys are excluded from ordinary logs.

The CP11 request contains reviewed structured facts and permissions only. Images attached to the local CP10 draft are not uploaded by this endpoint and remain private on the device.

## `POST /reports/status`

Retrieves the minimal current status of one private report using a strict JSON body containing only `reportId` and `recoveryKey`. Credentials are never accepted in a URL or query string. The recovery key is verified against its scrypt hash; an unknown report and an incorrect key return the same generic response.

A successful response contains only `reportId`, `submittedAt`, `status`, `updatedAt` and a privacy-safe `nextStep`. CP13 exposes only `received`, `under-review` and `more-evidence-needed`. It does not return identifiers, descriptions, evidence, attachment paths, ciphertext, matching data or recovery hashes.

Every response is `no-store`/`no-cache`. The endpoint uses an early bounded per-IP rate limit before request validation, rejects extra body or query fields, and excludes request credentials and report IDs from logs. A received or under-review status does not mean the report is verified, published or a scam verdict.

## `POST /share-tokens`

Accepts only `schemaVersion`, unique allowlisted `findingIds` and the `demo` flag. The backend sets issuance and expiry timestamps, caps lifetime at seven days, and returns one canonical signed token. Signing uses a domain-separated HKDF key derived from `REPORT_SECURITY_SECRET`. Responses are `no-store`; recruitment text, evidence, screenshots, identifiers, report IDs and recovery keys are neither accepted nor logged.

## `POST /share-tokens/verify`

Accepts only `{ "token": "…" }`. A valid, unexpired token returns its allowlisted finding IDs, demo state, server-issued timestamps and the fixed checked-rule count. Modified, malformed, expired or over-lifetime tokens fail closed, and recipient findings remain hidden unless verification succeeds.

Token verification confirms that the shared summary has not been modified and has not expired. It does not verify the sender, the original posting, or the accuracy of the observations.
