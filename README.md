# SoCal Tech Signal

A weekly, human-curated field guide to worthwhile in-person AI, engineering, security, and founder events across Orange County, Los Angeles, and San Diego.

## Publish a weekly edition

1. Add the verified Markdown briefing under `content/YYYY-MM-DD.md`.
2. Build the self-contained site:

   ```sh
   node build.mjs content/YYYY-MM-DD.md
   ```

3. Open `index.html` locally and verify the regional filters before publishing.

The generated `index.html` has no runtime dependencies beyond the two Google Font families loaded by the page. The template, content, and generated artifact are all versioned so each weekly update is reviewable.

## Review-gated automation

A local Codex automation runs every Wednesday at 8:15 a.m. America/Los_Angeles. It checks the proven organizers in `SOURCES.md`, performs fresh discovery, verifies every shortlisted event, generates the new dated issue and `index.html`, and opens a pull request against `main`.

The automation never merges its own pull request and never pushes directly to `main`. Merging the reviewed pull request is the publishing action for GitHub Pages.
