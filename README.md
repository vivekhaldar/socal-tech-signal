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

A local Codex automation runs every Monday at 8:00 p.m. America/Los_Angeles. It prepares the upcoming Wednesday-through-Tuesday issue, checks the proven organizers in `SOURCES.md`, performs fresh discovery, verifies every shortlisted event, generates the new dated issue and `index.html`, and opens a pull request against `main`.

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

## Design documents

- [Email newsletter design and implementation](docs/email-newsletter-design.md)
- [Email delivery operations](docs/email-delivery-operations.md)
