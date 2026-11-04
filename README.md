# SoCal Tech Signal

A weekly, human-curated field guide to worthwhile in-person AI, engineering, security, and founder events across Orange County, Los Angeles, and San Diego.

## Publish a weekly edition

1. Add the verified Markdown briefing under `content/YYYY-MM-DD.md`.
2. Build the self-contained site:

   ```sh
   node build.mjs content/YYYY-MM-DD.md
   node build-email.mjs content/YYYY-MM-DD.md
   ```

3. Open `index.html` locally and verify the regional filters before publishing.

The build writes the latest issue to `index.html`, preserves the same issue at
`issues/YYYY-MM-DD/index.html`, and creates the complete HTML and plain-text
newsletter under `email/`. The root URL is always the current issue; dated paths
remain permanent archives after the following issue replaces the homepage.

## Review-gated automation

An Amp schedule runs every Sunday at 8:00 p.m. America/Los_Angeles, beginning November 8, 2026. It covers the immediately following Monday through Sunday, checks the proven organizers in `SOURCES.md`, performs fresh discovery, verifies shortlisted events, generates the website and email editions, and opens a pull request against `main` with a reviewed preview. The November 8 run covers November 9–15. The preparation date remains the edition slug.

The schedule is managed in [the Amp research thread](https://ampcode.com/threads/T-01a1a4d1-fbae-773b-a3b4-3d280ddccbbf), not GitHub Actions. It checks existing editions and PRs to avoid duplicates. The previously documented Monday-night local Codex job is not managed by this schedule; if still enabled, disable it separately to avoid overlapping automation. The November 3 catch-up edition retains its November 4–10 coverage.

The automation never merges its own pull request and never pushes directly to
`main`. Merging the reviewed pull request publishes the homepage and archive.
After GitHub Pages serves that exact edition at both URLs, a GitHub Actions
workflow creates and sends one Resend Broadcast. Closed PRs, direct pushes,
content edits, and merges without exactly one newly added dated issue do not
send email.

The sender is fail-closed: missing secrets, a missing physical postal address,
failed tests, mismatched artifacts, or a stale website prevent Broadcast
creation. A private GitHub secret named `SOCAL_SIGNAL_POSTAL_ADDRESS` must hold
the reviewed mailing address used in every newsletter footer.

## Amp orb environment

`.agents/setup` installs the Node version in `.node-version` (Node 22, matching
CI's major version) from the official checksum-verified distribution. It reuses
the installed version on warm snapshots without downloading or reinstalling it.
A checkout-scoped login-shell hook puts that Node and its bundled npm on `PATH`
for Amp and supervised services. Run setup again after changing the version pin,
then start a new login shell.

There are no npm dependencies, lockfiles, databases, or required development
secrets: `npm test` and `npm run build` work without `npm install`.
`.agents/resume` activates and checks the toolchain; it never installs, authenticates,
builds, publishes, or sends email. Wrangler is optional deployment tooling and
is not installed by setup. No long-lived service is needed for builds or tests.

These lifecycle files take effect for new project orbs after reaching the
default branch. Amp can reuse the prepared toolchain through project snapshots.

## Design documents

- [Email newsletter design and implementation](docs/email-newsletter-design.md)
- [Email delivery operations](docs/email-delivery-operations.md)
