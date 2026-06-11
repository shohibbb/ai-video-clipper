# AI Automation Video Clipper

MVP web application for submitting source videos, processing them into short clips via the Reap API, reviewing generated clips, and publishing directly to TikTok through Reap's built-in integrations.

This repository is through **Phase 8** (all Reap migration complete):

- Next.js App Router scaffold
- TypeScript configuration
- Tailwind CSS styling
- Prisma schema for core MVP records
- Database-backed API routes
- Dashboard, video ledger, and integration pages
- Reap API client for clip creation and TikTok publishing
- BullMQ workers: Reap processing, delayed polling fallback, clip download, and TikTok publish
- Supabase-backed storage abstraction for source videos and clips
- Webhook receiver for Reap project completion callbacks
- Structured logging, retry controls, worker health check, and troubleshooting notes

## Requirements

- Node.js 20+ (Node 24 is fine)
- npm
- PostgreSQL
- Redis

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Start local PostgreSQL and Redis with Docker:

   ```bash
   docker compose up -d
   ```

   The included compose file starts:

   - PostgreSQL at `localhost:5432`
   - Redis at `localhost:6379`

4. Update `DATABASE_URL` in `.env` if you are not using the Docker defaults. For the included Docker setup, use:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_video_clipper
   REDIS_URL=redis://localhost:6379
   ```

5. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

6. Run database migrations:

   ```bash
   npm run prisma:migrate
   ```

7. Configure auth:

   - Local development can use `ALLOW_DEV_AUTH=true` with `DEV_USER_ID` and `DEV_USER_EMAIL`.
   - Production should set `ALLOW_DEV_AUTH=false` or omit it.
   - Production must configure at least one OAuth provider:
     - Google: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
     - GitHub: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
   - Keep `NEXTAUTH_SECRET` private and set `NEXTAUTH_URL` to your deployed app URL.

8. Configure storage:

   - Create a private Supabase Storage bucket, for example `clips`.
   - Set `STORAGE_PROVIDER=supabase`.
   - Set `SUPABASE_URL`.
   - Set `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never expose it to the browser.
   - Set `SUPABASE_STORAGE_BUCKET=clips` or your chosen bucket name.

9. Configure Reap:

   - Set `REAP_API_KEY` (get from [reap.video](https://reap.video)).
   - Connect your TikTok account at `https://reap.video/settings/integrations`.
   - Optional: adjust `REAP_DEFAULT_*` settings in `.env`.

10. Start the development server:

   ```bash
   npm run dev
   ```

11. In a second terminal, start the Reap processing worker:

    ```bash
    npm run worker:reap
    ```

12. In a third terminal, start the Reap publish worker for TikTok uploads:

    ```bash
    npm run worker:reap-publish
    ```

13. In a fourth terminal, start the Reap publish status worker:

    ```bash
    npm run worker:reap-publish-status
    ```

14. In a fifth terminal, start the delayed Reap polling fallback worker:

    ```bash
    npm run worker:reap-polling
    ```

15. In a sixth terminal, start the webhook/polling clip download worker:

    ```bash
    npm run worker:reap-download
    ```

16. Open `http://localhost:3000/dashboard`.

17. Check queue and worker health when debugging:

    ```bash
    npm run worker:health
    ```

18. Before deploying to staging or production, run the static production preflight:

    ```bash
    npm run production:check
    ```

## Reap Setup

1. Sign up at [reap.video](https://reap.video) and get your API key.
2. Connect your TikTok account at `https://reap.video/settings/integrations`.
3. Set server-side environment variables:

   ```bash
   REAP_API_KEY=your_reap_api_key
   REAP_BASE_URL=https://public.reap.video/api/v1/automation
   ```

4. Optional Reap configuration:

   ```bash
   REAP_DEFAULT_GENRE=talking          # talking | screenshare | gaming
   REAP_DEFAULT_ORIENTATION=portrait   # landscape | portrait | square
   REAP_DEFAULT_RESOLUTION=1080
   REAP_DEFAULT_REFRAME=true
   REAP_DEFAULT_CAPTIONS_PRESET=system_beasty
   REAP_DEFAULT_ENABLE_EMOJIS=true
   REAP_DEFAULT_ENABLE_HIGHLIGHTS=true
   REAP_DEFAULT_LANGUAGE=en
   ```

## Webhook Setup (Recommended)

Reap sends webhooks when projects complete. For production:

1. Set a public HTTPS webhook URL in your Reap dashboard:
   ```
   https://your-domain.com/api/reap/webhook
   ```

2. Set `REAP_WEBHOOK_SECRET` in your app environment.

3. Prefer HMAC verification if Reap can send a signature header. The handler accepts these signature headers:
   - `x-reap-signature`
   - `reap-signature`
   - `x-webhook-signature`
   - `x-signature`

   Accepted signature values are raw SHA-256 hex, `sha256=<hex>`, or `v1=<hex>` over the raw request body. If a timestamp header is present, the handler also accepts signatures over `<timestamp>.<rawBody>`.

4. If Reap cannot send custom headers, configure the webhook URL with a shared secret query parameter:
   ```
   https://your-domain.com/api/reap/webhook?reap_webhook_secret=your_long_random_secret
   ```

5. Set `REAP_WEBHOOK_REQUIRE_TIMESTAMP=true` only when Reap sends timestamped webhook signatures. Keep it `false` otherwise so valid Reap callbacks are not rejected.

6. The webhook handler queues idempotent clip download work. A quota-conscious polling fallback starts only if the webhook has not handled the project within fifteen minutes.

## Automatic Polling Fallback

Run both the polling watcher and clip download worker:

```bash
npm run worker:reap-polling
npm run worker:reap-download
```

Webhook delivery is the primary path. The fallback waits 15 minutes, then checks Reap every 5 minutes for up to 2 hours. When either path detects completion, it enqueues the same deterministic clip download job.

You can also perform a one-time diagnostic status check via API:

```bash
curl -X POST http://localhost:3000/api/videos/{videoId}/poll \
  -b "next-auth.session-token=YOUR_SESSION"
```

## Useful Commands

```bash
npm run typecheck
npm run build
npm run prisma:deploy
npm run prisma:studio
npm run worker:reap
npm run worker:reap-polling
npm run worker:reap-download
npm run worker:reap-publish
npm run worker:reap-publish-status
npm run worker:health
npm run setup:check
npm run production:check
npm run staging:smoke
```

## Troubleshooting

- `Failed to enqueue ... Check REDIS_URL and Redis availability`: start Redis, verify `REDIS_URL`, then run `npm run worker:health`.
- `REAP_API_KEY is required`: add `REAP_API_KEY` to `.env` and restart workers.
- `Clip must have a storage path`: the clip has not been stored yet. Confirm the Reap worker or webhook processed the project successfully.
- `Clip must have a Reap clip ID`: the clip was created before the Reap migration. Re-process the video to get Reap clip IDs.
- `No active TikTok integration found`: connect your TikTok account at `https://reap.video/settings/integrations`.
- `SUPABASE_SERVICE_ROLE_KEY is required for storage operations`: set Supabase server-side storage env vars and never expose the service role key to frontend code.
- `Reap project failed`: check the video's `errorMessage` field and Reap dashboard for processing status.
- `EPERM` while running `next build` on Windows: stop any running Next dev/build process and rerun the build so `.next` files can be cleaned.
- Upload keeps failing after retries: inspect `upload_targets.error_message`, `logs`, and the Reap dashboard connection state.

## Architecture

```text
Client
  ↓
Web UI (Next.js App Router)
  ↓
Backend API (Next.js Route Handlers)
  ↓
Database (PostgreSQL) + Queue (Redis/BullMQ)
  ↓
Reap Processing Worker → Reap API → Clip creation
  ↓
Webhook Handler or Polling Worker → Download clips
  ↓
Storage (Supabase/Cloudflare R2)
  ↓
Reap Publish Worker → Reap API → TikTok
```

## Phase Notes

- `POST /api/videos` accepts URL submissions or `multipart/form-data` file uploads.
- File uploads currently support `.mp4`, `.mov`, and `.webm`.
- Uploaded source videos are stored at `users/{userId}/videos/{videoId}/source.{ext}` and saved to `videos.source_storage_path`.
- Video processing jobs are enqueued in BullMQ using `REDIS_URL`.
- `npm run worker:reap` starts the worker that uploads source videos to Reap and creates clip projects.
- `POST /api/reap/webhook` receives Reap project completion callbacks and queues clip download work.
- `npm run worker:reap-polling` starts after a fifteen-minute delay and checks every five minutes to recover missed Reap webhooks.
- `npm run worker:reap-download` downloads and stores completed project clips for both webhook and polling paths.
- `/videos/:id` shows clip previews and editable title, caption, and hashtag metadata when clip rows exist.
- `POST /api/clips/:id/generate-caption` uses a safe placeholder caption service. If `OPENAI_API_KEY` is missing, it returns and stores a clear placeholder response instead of calling an external API.
- `POST /api/clips/:id/upload` validates the clip has a Reap clip ID, creates an `UploadTarget`, and queues a TikTok publish job.
- `npm run worker:reap-publish` starts the dedicated Reap TikTok publish worker with default concurrency `1`.
- `npm run worker:reap-publish-status` polls Reap post status after TikTok publishing has started.
- The publish worker retries failed TikTok uploads up to 3 attempts with a 5 minute fixed delay.
- Reap API calls are globally rate-limited through Redis by `REAP_RATE_LIMIT_MAX_REQUESTS` and `REAP_RATE_LIMIT_WINDOW_MS`.
- `npm run worker:health` prints Redis ping status, BullMQ queue counts, and database job counts.
- `npm run redis:budget` prints the modeled 30-day BullMQ maintenance floor and remaining command quota.
- `GET /api/health` checks database and Redis reachability for app/container health checks.
- API JSON request bodies use Zod validation and return field-level validation details.
- Dashboard and video ledger pages show live database-backed error states and retry buttons.
- API handlers do not run long-lived automation work.
- Reap credentials must stay server-side and must not be exposed to the frontend.

### Upstash 500k command profile

Five always-on BullMQ workers consume Redis commands even when queues are empty. The default production profile therefore uses:

```env
REDIS_MONTHLY_COMMAND_QUOTA=500000
REDIS_PLANNED_VIDEOS_PER_MONTH=100
REDIS_PLANNED_PUBLISHES_PER_MONTH=100
BULLMQ_DRAIN_DELAY_SECONDS=300
BULLMQ_STALLED_INTERVAL_MS=300000
REAP_POLLING_INITIAL_DELAY_MS=900000
REAP_POLL_INTERVAL_MS=300000
REAP_POLL_TIMEOUT_MS=7200000
REAP_PUBLISH_STATUS_INTERVAL_MS=120000
REAP_PUBLISH_STATUS_TIMEOUT_MS=7200000
```

With five workers, idle maintenance is modeled at about `86,400` command cycles per 30 days. BullMQ also wakes periodically while delayed jobs exist; at the planning inputs above, the modeled known usage is about `239,400` commands, leaving roughly `260,600` commands for job lifecycle operations, failures, rate limiting, health checks, and monitoring.

This is not a billing guarantee. Adjust the two planning inputs, run `npm run redis:budget`, monitor the Upstash usage dashboard, and avoid probing `/api/health` more often than every five minutes. If the estimate consumes more than half the quota or real usage trends above it, move Redis to the VPS or use an Upstash fixed/paid plan.

## Container Deployment Overview

The included Docker setup builds two runtime targets from the same Dockerfile:

- `runner`: lean Next.js web runtime for `app`.
- `worker-runner`: worker/tooling runtime for BullMQ workers, Prisma migration, health/debug scripts, and `production-check`.

Do not run worker scripts or `production:check` through the `app` service. The web image is intentionally lean and may not contain tooling needed by TypeScript worker scripts. Use the dedicated `production-check`, `migrate`, and worker services shown below.

Use managed Postgres and Redis for real production. The root `docker-compose.yml` remains local-development infrastructure only.

### Supabase and Prisma connection budgets

Do not reuse the same Supabase pooler mode blindly across Vercel and the VPS workers:

```bash
# Vercel web app: transaction mode for serverless/auto-scaling requests
DATABASE_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"

# Prisma migration commands: direct or session-mode connection
DIRECT_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:5432/postgres?connection_limit=1&pool_timeout=20"
```

For the VPS worker `.env.production`, use the session pooler with a strict per-process budget:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:5432/postgres?connection_limit=1&pool_timeout=20"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.pooler.supabase.com:5432/postgres?connection_limit=1&pool_timeout=20"
```

The production compose starts five worker processes. With `connection_limit=1`, their maximum Prisma allocation is five database connections. Increase this only after checking Supabase connection metrics and accounting for every running app, worker, migration, and deployment instance.

## Staging Container Deployment

For full notes, see `docs/STAGING_DEPLOYMENT.md`. The staging compose file uses `.env.staging`, builds `ai-video-clipper:staging` for the web app, builds `ai-video-clipper:staging-worker` for workers/tooling, and maps the web container to host port `3001`.

1. Create a staging env file from the template:

   ```bash
   cp .env.staging.example .env.staging
   ```

2. Fill `.env.staging` with dedicated staging services. Do not reuse production database, Redis, or storage buckets.

3. Build both staging images:

   ```bash
   docker compose -f docker-compose.staging.yml build --no-cache
   ```

4. Run preflight using the worker/tooling image:

   ```bash
   docker compose -f docker-compose.staging.yml run --rm production-check
   ```

5. Apply database migrations:

   ```bash
   docker compose -f docker-compose.staging.yml run --rm migrate
   ```

6. Start the web app and workers:

   ```bash
   docker compose -f docker-compose.staging.yml up -d app worker-reap worker-reap-polling worker-reap-download worker-reap-publish worker-reap-publish-status
   ```

7. Check service status and logs:

   ```bash
   docker compose -f docker-compose.staging.yml ps
   docker compose -f docker-compose.staging.yml logs --tail=100 worker-reap
   ```

8. Run smoke tests against the deployed staging URL:

   ```bash
   STAGING_BASE_URL=https://your-staging-domain.com npm run staging:smoke
   ```

## Production Container Deployment

The production compose file uses `.env.production`, builds `ai-video-clipper:production` for the web app, and builds `ai-video-clipper:production-worker` for workers/tooling.

1. Create a production env file from `.env.example`:

   ```bash
   cp .env.example .env.production
   ```

2. Fill `.env.production` with managed production services. Set both `DATABASE_URL` and `DIRECT_URL`, including `connection_limit=1` and `pool_timeout=20`. `production-check` should report `0 errors` before deployment. A Supabase session-mode warning is expected on a worker-only VPS.

3. Build both production images:

   ```bash
   docker compose -f docker-compose.production.example.yml build --no-cache
   ```

4. Run the production preflight inside the worker/tooling image:

   ```bash
   docker compose -f docker-compose.production.example.yml run --rm production-check
   ```

5. Apply database migrations:

   ```bash
   docker compose -f docker-compose.production.example.yml run --rm migrate
   ```

6. Start the app and workers:

   ```bash
   docker compose -f docker-compose.production.example.yml up -d app worker-reap worker-reap-polling worker-reap-download worker-reap-publish worker-reap-publish-status
   ```

7. Check service status and worker logs:

   ```bash
   docker compose -f docker-compose.production.example.yml ps
   docker compose -f docker-compose.production.example.yml logs --tail=100 worker-reap
   ```

8. Run smoke tests against the deployed URL:

   ```bash
   STAGING_BASE_URL=https://ai-video-clipper-fawn.vercel.app npm run staging:smoke
   ```

## Staging Smoke Tests

`npm run staging:smoke` verifies the minimum deployment surface before running a real Reap/TikTok flow:

- `GET /api/health` returns `ok: true` with database and Redis checks passing.
- `/`, `/terms`, and `/privacy` return `200`.
- `/dashboard` redirects unauthenticated visitors to `/api/auth/signin`.

Required env:

```bash
STAGING_BASE_URL=https://your-staging-domain.com
```

Optional env:

```bash
SMOKE_TIMEOUT_MS=10000
SMOKE_EXPECT_AUTHENTICATED=false
SMOKE_ALLOW_LOCAL=false
VERCEL_PROTECTION_BYPASS=your_vercel_automation_bypass_token
```

Use `SMOKE_ALLOW_LOCAL=true` only when testing a local server.
Set `VERCEL_PROTECTION_BYPASS` when Vercel Deployment Protection is enabled.

## TODO Before Production

- Production deployment: add secrets management, managed Redis/Postgres, worker process supervision, backups, and observability dashboards.
- Run `npm run production:check` in staging/production deploy pipelines before `next build`.
- Auth hardening: configure OAuth providers, rotate `NEXTAUTH_SECRET`, and keep `ALLOW_DEV_AUTH` disabled outside local/internal development.
- Webhook hardening: set `REAP_WEBHOOK_SECRET`; enable timestamp verification only when Reap sends timestamped signatures.
- Compliance review: review Reap and TikTok terms, consent, rate limits, content policy, and data retention before external or high-volume use.
- Webhook URL: configure a stable HTTPS webhook endpoint for Reap callbacks.
- Staging validation: run `npm run staging:smoke`, then one real URL submission through Reap before production traffic.
- TikTok integration monitoring: periodically verify the TikTok connection in Reap dashboard remains active.
