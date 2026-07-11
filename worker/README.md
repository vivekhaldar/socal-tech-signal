# Signup worker

Cloudflare Worker providing Resend-backed double opt-in for SoCal Tech Signal.

Legacy production endpoint:

```text
https://socal-tech-signal-signup.vivekhaldar-02231129.workers.dev
```

The website now posts to the shared publication-scoped service at
`https://vivek-blog-subscriptions.vivekhaldar-02231129.workers.dev/subscribe/socal`.
Keep this legacy Worker deployed until the shared route has passed a real
confirmation test; then retire it explicitly. Confirmed addresses remain in the
dedicated SoCal segment and topic.

## Local mock

```sh
npx wrangler dev --var SIGNUP_MODE:mock
```

## Operations

Secrets are stored in `pass` and uploaded to Cloudflare, never committed:

```sh
pass API_KEYS/RESEND_FULL_ACCESS_API_KEY | npx wrangler secret put RESEND_API_KEY
pass API_KEYS/SOCAL_TECH_SIGNAL_CONFIRMATION_SECRET | npx wrangler secret put CONFIRMATION_SECRET
```

Common checks:

```sh
npm test
npx wrangler secret list
npx wrangler deployments list
RESEND_API_KEY="$(pass API_KEYS/RESEND_FULL_ACCESS_API_KEY | head -n1)" npx resend-cli domains list --json
RESEND_API_KEY="$(pass API_KEYS/RESEND_FULL_ACCESS_API_KEY | head -n1)" npx resend-cli contacts list --json
```

Deploy from this directory with `npx wrangler deploy --strict`. The sender domain
is `updates.socaltech.live`; its SPF and DKIM records are managed through Porkbun.
The KV binding provides per-IP signup rate limiting.
