# Staging Deployment

This project runs as one Next.js web process plus four BullMQ worker processes. Staging should use dedicated staging services for PostgreSQL, Redis, Supabase Storage, Reap credentials, and OAuth callback URLs.

## Recommended Staging Topology

- Web app: Docker on a VPS or a platform that can run the included container image.
- Workers: same image as the web app, running `worker:reap`, `worker:reap-polling`, `worker:reap-publish`, and `worker:reap-publish-status`.
- Database: managed PostgreSQL staging database.
- Queue: managed Redis staging instance.
- Storage: Supabase Storage staging bucket, for example `clips-staging`.
- Webhook: `https://staging.your-domain.com/api/reap/webhook`.

Do not point staging workers at production database, Redis, or storage buckets.

## 1. Create Staging Env

Copy the template and fill real staging values:

```bash
cp .env.staging.example .env.staging
```

Important values:

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
NEXTAUTH_URL=https://staging.your-domain.com
NEXTAUTH_SECRET=<32+ char secret>
ALLOW_DEV_AUTH=false
DATABASE_URL=<staging postgres url>
REDIS_URL=<staging redis url>
SUPABASE_URL=<staging supabase url>
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
SUPABASE_STORAGE_BUCKET=clips-staging
REAP_API_KEY=<staging or low-risk Reap API key>
REAP_WEBHOOK_SECRET=<32+ char webhook secret>
```

If Google OAuth is enabled, add this callback URL in Google Cloud:

```text
https://staging.your-domain.com/api/auth/callback/google
```

If GitHub OAuth is enabled, add:

```text
https://staging.your-domain.com/api/auth/callback/github
```

## 2. Preflight

Run checks before starting containers:

```bash
npm run typecheck
npm run test
```

Then validate staging env with the production preflight rules:

```bash
docker compose -f docker-compose.staging.yml run --rm production-check
```

Warnings are acceptable when understood. Errors should be fixed before continuing.

## 3. Build and Migrate

```bash
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml run --rm migrate
```

## 4. Start Web and Workers

```bash
docker compose -f docker-compose.staging.yml up -d app worker-reap worker-reap-polling worker-reap-publish worker-reap-publish-status
```

Check process status:

```bash
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs -f app
```

## 5. Configure Reap Webhook

Set the Reap webhook URL to:

```text
https://staging.your-domain.com/api/reap/webhook?reap_webhook_secret=<REAP_WEBHOOK_SECRET>
```

Use the query parameter mode only when Reap cannot send custom signature headers.

## 6. Smoke Test

From your local machine:

```bash
STAGING_BASE_URL=https://staging.your-domain.com npm run staging:smoke
```

If staging is protected by Vercel Deployment Protection, also set:

```bash
VERCEL_PROTECTION_BYPASS=<bypass token>
```

## 7. Real Workflow Test

After smoke checks pass:

1. Sign up or sign in on staging.
2. Open `/videos/new`.
3. Submit a short, low-risk source video URL.
4. Configure clipping and click `Get Clips`.
5. Watch worker logs:

   ```bash
   docker compose -f docker-compose.staging.yml logs -f worker-reap worker-reap-polling
   ```

6. Confirm the video reaches `ready_to_upload`.
7. Test one TikTok publish only after the Reap TikTok integration is connected to the intended staging account.

## Rollback

For container rollback, deploy the previous image tag and restart services:

```bash
docker compose -f docker-compose.staging.yml up -d --no-build app worker-reap worker-reap-polling worker-reap-publish worker-reap-publish-status
```

Database migrations should be treated as forward-only unless a migration-specific rollback is written and tested.
