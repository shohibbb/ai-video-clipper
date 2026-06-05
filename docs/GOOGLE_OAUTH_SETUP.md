# Google OAuth Setup

AI Video Clipper uses NextAuth with the Prisma adapter. Google OAuth is both login and signup: if a Google account signs in for the first time, NextAuth creates the user, account, and session records automatically.

## 1. Create OAuth Credentials

1. Open Google Cloud Console.
2. Select or create a project.
3. Go to APIs & Services > OAuth consent screen.
4. Configure the app name, support email, developer contact email, and requested scopes.
5. Go to APIs & Services > Credentials.
6. Create OAuth client ID.
7. Choose Web application.

## 2. Add Redirect URIs

For production, add:

```text
https://ai-video-clipper-fawn.vercel.app/api/auth/callback/google
```

For local development, add:

```text
http://localhost:3000/api/auth/callback/google
```

If you later move to a custom domain, add another callback URI using that domain:

```text
https://your-domain.com/api/auth/callback/google
```

## 3. Configure Environment Variables

Set these in Vercel production environment variables:

```env
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret
NEXTAUTH_URL=https://ai-video-clipper-fawn.vercel.app
NEXT_PUBLIC_APP_URL=https://ai-video-clipper-fawn.vercel.app
NEXTAUTH_SECRET=your_random_secret
ALLOW_DEV_AUTH=false
```

Set the same Google OAuth values in the VPS `.env.production` if worker-side scripts need the full production environment file. The workers do not perform OAuth sign-in, but keeping one consistent env file reduces configuration drift.

## 4. Verify

After redeploying Vercel, open:

```text
https://ai-video-clipper-fawn.vercel.app/login
```

Click Continue with Google. A successful first sign-in should create records in:

- `users`
- `accounts`
- `sessions`

Run the production check after the envs are set:

```bash
NODE_ENV=production npm run production:check
```

## Notes

- Signup does not use a separate password form. The first successful Google OAuth sign-in creates the user.
- Keep `ALLOW_DEV_AUTH=false` in production.
- Never expose `AUTH_GOOGLE_SECRET` or `NEXTAUTH_SECRET` to the browser.
