# AI Automation Video Clipper

MVP web application for submitting source videos, tracking OpusClip processing tasks, reviewing generated clips, and preparing TikTok uploads through Composio.

This repository is currently through **Phase 6**:

- Next.js App Router scaffold
- TypeScript configuration
- Tailwind CSS styling
- Prisma schema for core MVP records
- Database-backed API route skeletons
- Basic dashboard, video, and integration pages
- Placeholder service boundaries for queue, storage, OpusClip automation, and Composio upload
- BullMQ workers for OpusClip processing and TikTok upload
- Supabase-backed storage abstraction for source videos and clips
- Composio TikTok upload service boundary

Real OpusClip selectors still need to be filled in manually. TikTok upload is wired through Composio, but requires valid Composio/TikTok configuration before it can run successfully.

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

3. Update `DATABASE_URL` in `.env` to point at your local PostgreSQL database.

4. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

5. Run the first migration:

   ```bash
   npm run prisma:migrate
   ```

6. Start Redis locally and verify `REDIS_URL` points to it.

7. Configure storage:

   - Create a private Supabase Storage bucket, for example `clips`.
   - Set `STORAGE_PROVIDER=supabase`.
   - Set `SUPABASE_URL`.
   - Set `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never expose it to the browser.
   - Set `SUPABASE_STORAGE_BUCKET=clips` or your chosen bucket name.

8. Start the development server:

   ```bash
   npm run dev
   ```

9. In a second terminal, start the OpusClip worker:

   ```bash
   npm run worker:opusclip
   ```

10. In another terminal, start the TikTok upload worker when testing uploads:

   ```bash
   npm run worker:upload
   ```

11. Open `http://localhost:3000/dashboard`.

## OpusClip Session Setup

Phase 4 adds the Playwright skeleton only. It does not contain production-ready selectors and does not bypass CAPTCHA, rate limits, or any OpusClip security controls.

1. Install the Chromium browser used by Playwright:

   ```bash
   npm run playwright:install
   ```

2. Configure these values in `.env`:

   ```bash
   OPUSCLIP_LOGIN_URL=https://www.opus.pro/clip
   OPUSCLIP_APP_URL=https://www.opus.pro/clip
   OPUSCLIP_STORAGE_STATE_PATH=./playwright/.auth/opusclip.json
   ```

3. Run the manual login helper:

   ```bash
   npm run opusclip:login
   ```

4. Complete the normal user-owned login flow in the browser, then press Enter in the terminal to save `storageState`.

5. Start the worker:

   ```bash
   npm run worker:opusclip
   ```

Failure artifacts are written under `OPUSCLIP_ARTIFACTS_DIR` and include a screenshot when a page is available plus a JSON error file with the current URL.

## Composio TikTok Setup

Phase 6 adds the TikTok-only Composio upload path. It does not add YouTube or Instagram upload.

1. Create or configure a Composio TikTok connection in your Composio account.

2. Set server-side environment variables:

   ```bash
   COMPOSIO_API_KEY=
   COMPOSIO_TIKTOK_CONNECTED_ACCOUNT_ID=
   COMPOSIO_TIKTOK_UPLOAD_ACTION=TIKTOK_UPLOAD_VIDEO
   COMPOSIO_TOOLKIT_VERSION_TIKTOK=
   COMPOSIO_TIKTOK_PUBLISH=false
   COMPOSIO_TIKTOK_PRIVACY_LEVEL=SELF_ONLY
   ```

3. Keep `COMPOSIO_TIKTOK_PUBLISH=false` while testing if you only want to verify upload staging. Set it to `true` only when you are ready for Composio/TikTok to attempt publishing.

4. Run the upload worker:

   ```bash
   npm run worker:upload
   ```

The worker creates a signed URL for the private clip file, stages it with `composio.files.upload`, then executes `TIKTOK_UPLOAD_VIDEO` with caption metadata. If `COMPOSIO_API_KEY` is missing, the upload job fails cleanly and stores the error in `upload_targets` and `logs`.

## Useful Commands

```bash
npm run typecheck
npm run build
npm run prisma:studio
npm run worker:opusclip
npm run worker:upload
npm run opusclip:login
npm run playwright:install
```

## Phase Notes

- `POST /api/videos` accepts URL submissions or `multipart/form-data` file uploads.
- File uploads currently support `.mp4`, `.mov`, and `.webm`.
- Uploaded source videos are stored at `users/{userId}/videos/{videoId}/source.{ext}` and saved to `videos.source_storage_path`.
- Video processing jobs are enqueued in BullMQ using `REDIS_URL`.
- `npm run worker:opusclip` starts the worker and calls the Phase 4 OpusClip Playwright skeleton.
- Real OpusClip selectors are TODO in `src/lib/opusclip/selectors.ts`; keep the `OPUSCLIP_ENABLE_REAL_*` flags disabled until those selectors are implemented and tested manually.
- `/videos/:id` now shows clip previews and editable title, caption, and hashtag metadata when clip rows exist.
- `POST /api/clips/:id/generate-caption` uses a safe placeholder caption service. If `OPENAI_API_KEY` is missing, it returns and stores a clear placeholder response instead of calling an external API.
- `POST /api/clips/:id/upload` validates the clip storage path, creates an `UploadTarget`, and queues a TikTok upload job.
- `npm run worker:upload` starts the dedicated Composio TikTok upload worker with default concurrency `1`.
- The upload worker retries failed TikTok uploads up to 3 attempts with a 5 minute fixed delay.
- API handlers do not run long-lived automation work.
- Playwright automation belongs in worker/service modules and is not production-ready yet.
- Composio credentials must stay server-side and must not be exposed to the frontend.
