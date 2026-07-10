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
