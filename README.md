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
- BullMQ workers: Reap processing, Reap polling fallback, Reap TikTok publish
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

7. Configure storage:

   - Create a private Supabase Storage bucket, for example `clips`.
   - Set `STORAGE_PROVIDER=supabase`.
   - Set `SUPABASE_URL`.
   - Set `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never expose it to the browser.
   - Set `SUPABASE_STORAGE_BUCKET=clips` or your chosen bucket name.

8. Configure Reap:

   - Set `REAP_API_KEY` (get from [reap.video](https://reap.video)).
   - Connect your TikTok account at `https://reap.video/settings/integrations`.
   - Optional: adjust `REAP_DEFAULT_*` settings in `.env`.

9. Start the development server:

   ```bash
   npm run dev
   ```

10. In a second terminal, start the Reap processing worker:

    ```bash
    npm run worker:reap
    ```

11. In a third terminal, start the Reap publish worker for TikTok uploads:

    ```bash
    npm run worker:reap-publish
    ```

12. In a fourth terminal, start the Reap publish status worker:

    ```bash
    npm run worker:reap-publish-status
    ```

13. In a fifth terminal, start the Reap polling worker (fallback when webhooks are not available):

    ```bash
    npm run worker:reap-polling
    ```

14. Open `http://localhost:3000/dashboard`.

15. Check queue and worker health when debugging:

    ```bash
    npm run worker:health
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

2. The webhook handler downloads clips, stores them, and updates the video status to `ready_to_upload`.

## Polling Fallback (Development)

If you don't have a public webhook URL, use the polling worker:

```bash
npm run worker:reap-polling
```

This worker checks Reap project status every 30 seconds (up to 120 attempts ≈ 1 hour) and downloads clips when complete.

You can also trigger manual polling via API:

```bash
curl -X POST http://localhost:3000/api/videos/{videoId}/poll \
  -b "next-auth.session-token=YOUR_SESSION"
```

## Useful Commands

```bash
npm run typecheck
npm run build
npm run prisma:studio
npm run worker:reap
npm run worker:reap-polling
npm run worker:reap-publish
npm run worker:reap-publish-status
npm run worker:health
npm run setup:check
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
- `npm run worker:reap-polling` polls Reap for project status when webhooks are unavailable.
- `/videos/:id` shows clip previews and editable title, caption, and hashtag metadata when clip rows exist.
- `POST /api/clips/:id/generate-caption` uses a safe placeholder caption service. If `OPENAI_API_KEY` is missing, it returns and stores a clear placeholder response instead of calling an external API.
- `POST /api/clips/:id/upload` validates the clip has a Reap clip ID, creates an `UploadTarget`, and queues a TikTok publish job.
- `npm run worker:reap-publish` starts the dedicated Reap TikTok publish worker with default concurrency `1`.
- `npm run worker:reap-publish-status` polls Reap post status after TikTok publishing has started.
- The publish worker retries failed TikTok uploads up to 3 attempts with a 5 minute fixed delay.
- Reap API calls are globally rate-limited through Redis by `REAP_RATE_LIMIT_MAX_REQUESTS` and `REAP_RATE_LIMIT_WINDOW_MS`.
- `npm run worker:health` prints Redis ping status, BullMQ queue counts, and database job counts.
- API JSON request bodies use Zod validation and return field-level validation details.
- Dashboard and video ledger pages show live database-backed error states and retry buttons.
- API handlers do not run long-lived automation work.
- Reap credentials must stay server-side and must not be exposed to the frontend.

## TODO Before Production

- Production deployment: add real auth, secrets management, managed Redis/Postgres, worker process supervision, migrations, backups, and observability dashboards.
- Compliance review: review Reap and TikTok terms, consent, rate limits, content policy, and data retention before external or high-volume use.
- Webhook URL: configure a stable HTTPS webhook endpoint for Reap callbacks.
- TikTok integration monitoring: periodically verify the TikTok connection in Reap dashboard remains active.
