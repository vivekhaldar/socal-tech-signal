# Email newsletter design and implementation

Status: signup, rendering, and merge-triggered sending implemented
Last updated: July 11, 2026

## Summary

SoCal Tech Signal will offer a weekly email edition containing the complete event list while linking to the corresponding issue on `socaltech.live`. The email should feel like the website—acid-lime, near-black, cobalt, vermilion, direct, and technical—but use a simplified email-safe layout.

The proposed delivery platform is **Resend**. It is preferred because it supports custom HTML, contacts, segments, topics, Broadcast drafts, scheduling, an official CLI, and an official MCP server. The system should be operable by agents and CI without requiring routine work in Resend's browser dashboard.

The pull-request review gate is the authorization boundary:

1. The Monday-night aggregator opens a pull request containing the website and complete email edition.
2. Vivek reviews the content and rendered email in GitHub.
3. Merging publishes the website.
4. A merge that adds exactly one new dated issue authorizes one email send.
5. The sender waits until the merged issue is live at the homepage and permanent archive before creating the Broadcast.

The website signup, permanent issue archive, HTML and plain-text email renderer,
privacy page, confirmation page, and Cloudflare Worker double-opt-in flow are now
implemented. The shared publication-scoped Worker is deployed at
`https://vivek-blog-subscriptions.vivekhaldar-02231129.workers.dev`; SoCal signup
uses `/subscribe/socal`. Confirmed subscribers are stored only in the dedicated
SoCal Resend segment and explicitly opted into the weekly topic. Sender
authentication for `updates.socaltech.live` is verified. The shared service
protects unrelated topic preferences during global-unsubscribe re-consent.

A valid physical postal address must replace the email template's launch
placeholder before the first newsletter Broadcast is sent.

## Current provisioning state

- Vivek has created the Resend account.
- A send-only Resend API key is stored at `API_KEYS/RESEND_API_KEY`.
- A full-access automation key is stored at `API_KEYS/RESEND_FULL_ACCESS_API_KEY`.
- The key value must never be printed, copied into the repository, included in PR text, written to automation memory, or placed in client-side code.

Agents and scripts should load it only for the process that needs it:

```sh
RESEND_API_KEY="$(pass API_KEYS/RESEND_API_KEY)" resend whoami
```

Provisioning the account and key does not authorize sending a Broadcast. Merging
a reviewed PR that adds exactly one dated issue is the explicit approval gate.

## Goals

- Collect only an email address through one low-friction field on the website.
- Require double opt-in before adding a subscriber to the active list.
- Send the complete weekly event list, not a teaser or partial digest.
- Preserve the site's visual identity within email-client constraints.
- Generate the website and email from the same verified Markdown issue.
- Operate subscriber management, drafts, tests, and sends through CLI, MCP, or API.
- Make the reviewed PR merge the single publishing-and-sending authorization.
- Handle unsubscribe, bounces, complaints, and preferences through the email provider.
- Keep provider credentials and subscriber data out of the public repository.

## Non-goals

- No pop-ups, modals, name fields, region selectors, or preference questionnaires in the initial signup form.
- No browser-dashboard dependency for normal weekly operation.
- No email send merely because the aggregator completed or opened a PR.
- No direct email sending from GitHub Pages or client-side JavaScript.
- No separate editorial source for the email.
- No complex lifecycle campaigns, paid subscriptions, referrals, or sponsorship tooling in the initial release.

## Subscriber experience

### Placement and copy

Place a full-width subscription band after “The signal” and before “Three to circle.” It should remain visually subordinate to the issue content but distinct from the event directory.

Recommended copy:

> **Want next week's signal in your inbox?**
> One useful email a week. The best SoCal AI + tech events, before the week fills up.

The form contains:

- One required `email` input with placeholder `you@example.com`.
- One submit button labeled `Send me the signal`.
- Supporting text: `No spam. Unsubscribe anytime.`

Desktop layout places the nudge and form side by side. Mobile stacks the input and button while keeping both at least 44 pixels tall. Do not repeat the full form elsewhere; the footer may link back to the signup band.

### Form states

- **Idle:** email input and submit button.
- **Submitting:** disable the button and change its label to `Sending…` without changing the layout.
- **Confirmation required:** replace the form inline with `Check your inbox to confirm.`
- **Already subscribed:** show `You're already on the list.` without revealing any account details.
- **Invalid address:** show a specific inline error attached to the input.
- **Service failure:** preserve the entered address locally and show `Couldn't start your signup. Try again in a moment.`

The form must work with keyboard navigation, visible focus, screen readers, and reduced motion.

## Double-opt-in architecture

GitHub Pages cannot safely hold a Resend API key, so the form submits to a small server-side endpoint deployed independently from the static site.

```text
socaltech.live signup form
          |
          v
POST /subscribe
          |
          +-- validate and normalize address
          +-- honeypot and rate-limit checks
          +-- generate signed, expiring confirmation token
          +-- send confirmation email through Resend
          |
          v
Reader opens /confirm?token=...
          |
          +-- verify signature and expiry
          +-- create or update Resend contact
          +-- add contact to the newsletter segment
          +-- explicitly subscribe contact to the weekly topic
          |
          v
Redirect to socaltech.live/subscribed/
```

Preferred implementation characteristics:

- A small Cloudflare Worker or Vercel Function deployed by CLI.
- `POST /subscribe` for requests and `GET /confirm` for confirmation.
- A signed token containing the normalized email, issuance time, and expiry.
- A 24-hour confirmation expiry.
- Idempotent confirmation so replaying a valid link does not duplicate contacts.
- Contact creation only after confirmation; Resend remains the subscriber system of record.
- No raw email addresses in application logs or analytics.
- Honeypot, per-IP throttling, and provider-level suppression handling.
- A plain-text confirmation email as well as HTML.

The exact serverless host is intentionally undecided. Choose the smallest service that provides CLI deployment, secret storage, logs, rate limiting, and a stable HTTPS endpoint.

## Resend organization

Create these resources through the Resend CLI or MCP server:

- Segment: `SoCal Tech Signal subscribers`
- Public topic: `Weekly SoCal Tech Signal`
- Sending identity: `SoCal Tech Signal`
- Proposed sender: `signal@updates.socaltech.live`
- Reply-to: Vivek's normal correspondence address

Using `updates.socaltech.live` isolates sending reputation from the apex website. Resend will provide SPF/DKIM and related DNS records; configure them through the Porkbun API and verify them through the Resend CLI. Add DMARC deliberately after SPF and DKIM pass.

The sender address is an open decision. `signal@socaltech.live` is cleaner, while `signal@updates.socaltech.live` provides clearer infrastructure separation.

## Email content

Every edition is complete and useful without opening a browser. It contains:

1. Publication name, edition date, and explicit coverage window.
2. A prominent `View this issue on the web` link.
3. The short editorial synthesis.
4. All three editor's picks with their rationales.
5. The full Orange County list.
6. The full Los Angeles list.
7. The full San Diego list.
8. The full `Later on the radar` section.
9. Canonical links for every event.
10. A second link to the full web issue.
11. Unsubscribe, preferences, sender identity, and valid postal-address footer.

Editor’s picks may appear again in their regional sections, matching the website's behavior. The email should make that repetition explicit with a star rather than silently deduplicating it.

### Permanent web links

Email links must remain useful after the next issue replaces the homepage. Before launching email, add stable issue archives such as:

```text
https://socaltech.live/issues/2026-07-22/
```

The homepage remains the latest issue, while each email links to its permanent issue URL. Regional headings in the email may link to anchors in that archived page.

## Email visual system

Email clients cannot reproduce the website exactly. Preserve the identity, not every implementation detail.

### Keep

- Acid-lime masthead.
- Near-black primary text.
- Cobalt, vermilion, and green regional signals.
- Large, dense, left-aligned heading.
- Hard rules and rectangular blocks.
- Clear editor's-pick hierarchy.
- Compact metadata followed by readable descriptions.

### Simplify or remove

- Use a single 600–640 pixel column.
- Use tables and inline CSS for structural compatibility.
- Use robust email-safe sans-serif fallbacks; do not depend on Google Fonts.
- Remove JavaScript, filters, sticky elements, SVG routing artwork, CSS Grid, container queries, OKLCH colors, and animation.
- Avoid background images and any information conveyed only by color.
- Keep the generated HTML comfortably below common clipping thresholds; target less than 90 KB before provider modifications.

### Responsive behavior

- Full-width body on narrow screens with 16–20 pixel side padding.
- Minimum 16-pixel body copy.
- Links and calls to action large enough for touch.
- Long titles and URLs must wrap without horizontal scrolling.
- Event blocks remain one column at every width.

## Repository design

The website and email must use one parser and one issue data model. Refactor rather than independently parsing the same Markdown twice.

Proposed structure:

```text
content/YYYY-MM-DD.md
lib/issue.mjs
build.mjs
build-email.mjs
template.html
email-template.html
index.html
issues/YYYY-MM-DD/index.html
email/YYYY-MM-DD.html
email/YYYY-MM-DD.txt
email/YYYY-MM-DD.png
```

Responsibilities:

- `lib/issue.mjs`: parse, normalize, validate, count, and serialize an issue.
- `build.mjs`: render the latest homepage plus the permanent archived web issue.
- `build-email.mjs`: render full HTML email and full plain-text alternative.
- `email-template.html`: email-safe visual system with inlineable styles.
- `email/YYYY-MM-DD.png`: full-height review rendering generated in a deterministic browser.

The generated email should contain an issue identifier in a comment or metadata field so agents can match a Broadcast to the originating issue and commit.

## Weekly automation and approval gate

The Monday-night Codex automation:

1. Research and verify the Wednesday-through-Tuesday issue.
2. Generate the Markdown, website, archive, HTML email, text email, and email screenshot.
3. Validate all artifacts.
4. Open the weekly GitHub pull request without contacting Resend.

The PR includes:

- Full event and source diffs.
- Stable archived issue URL.
- Rendered web and email screenshots.
- Email HTML byte count.
- Counts for OC, LA, SD, and Later.
- The three editor's picks.
- Broken-link and HTML-validation results.
- Test-send result.
- The explicit note: `Merging publishes the website and sends this email after live verification.`

### Merge-triggered sending

`.github/workflows/send-merged-issue.yml` runs only when a PR to `main` closes as
merged. It compares the merge commit with its first parent and proceeds only when
the merge adds exactly one `content/YYYY-MM-DD.md` file. It then:

1. Requires the matching homepage, permanent archive, HTML email, text email,
   and subject artifact in the merged commit.
2. Runs the complete test suite.
3. Renders the final email with the postal address supplied by GitHub Actions.
4. Polls `https://socaltech.live/` and the dated archive until both serve the
   expected slug and edition.
5. Creates a GitHub issue named `[email-send] YYYY-MM-DD` as the durable delivery
   ledger.
6. Creates a Resend Broadcast draft and records its ID before sending.
7. Retrieves and verifies the draft's segment, topic, sender, subject, issue
   marker, homepage link, and text alternative.
8. Sends that exact Broadcast ID and closes the ledger after Resend reports
   `queued`, `scheduled`, or `sent`.

On rerun, the workflow reads the saved Broadcast ID first. A Broadcast already
accepted by Resend is never sent again. If a send request fails ambiguously, the
workflow retrieves the Broadcast state before deciding whether it may retry.

## Agent interfaces

Use the Resend CLI for deterministic automation and CI. Use the Resend MCP server for interactive inspection and agent-driven operations.

Expected CLI capabilities include:

- Authenticate through macOS Keychain or `RESEND_API_KEY`.
- Create, inspect, update, and send Broadcasts.
- Create and update contacts.
- Manage segment memberships and topic subscriptions.
- Create and verify domains.
- Inspect logs and delivery state.
- Emit structured JSON for scripts and agents.

Store the production key in `pass` and/or macOS Keychain. If GitHub Actions is later used, store a narrowly scoped key in GitHub Actions secrets. Never place the key in HTML, JavaScript, Markdown, git history, PR text, logs, or automation memory.

## Test and validation requirements

### Signup

- Valid signup sends exactly one confirmation email.
- Invalid, empty, and malformed addresses fail clearly.
- Confirmation creates one contact and one correct topic subscription.
- Expired and altered tokens fail safely.
- Replayed confirmation links are idempotent.
- Existing unsubscribed contacts are not silently resubscribed.
- Honeypot and rate-limit paths do not disclose subscriber state.
- API keys and full email addresses do not appear in logs.

### Email rendering

- HTML and plain text contain the same complete event set.
- Exactly three editor's picks appear before the regional sections.
- Regional counts match the web issue.
- Every event has a canonical URL.
- The archived issue URL and all region anchors work.
- HTML stays within the size budget.
- No horizontal overflow at phone width.
- Review in Gmail web/mobile, Apple Mail, and Outlook before launch.
- Dark-mode behavior remains legible even if colors are transformed.

### Delivery

- SPF and DKIM pass.
- DMARC reporting is enabled before broad promotion.
- Test sends reach at least Gmail and one non-Gmail mailbox.
- Bounce, complaint, unsubscribe, and suppression events are visible to agents.
- Unsubscribe works without requiring login.
- A duplicate send attempt is detected before delivery.

## Compliance and privacy

- State the expected frequency beside the signup form.
- Use double opt-in and retain confirmation evidence through the provider.
- Include accurate sender information, a clear unsubscribe mechanism, and a valid physical postal address in every issue.
- Use a registered PO box or qualifying commercial mailbox rather than a home address if desired.
- Publish a short privacy notice describing what is collected, why, the processor, and how deletion requests are handled.
- Collect only email address and operational consent metadata initially.
- Export and back up the subscriber list periodically without committing it to git.
- Reconfirm applicable legal requirements before implementation or expansion beyond the United States.

## Service decision

### Proposed: Resend

Reasons:

- Official CLI designed for people, agents, and CI/CD.
- Official MCP server with Contacts, Segments, Topics, Domains, Broadcasts, and sending operations.
- Full custom HTML and plain-text support.
- Draft-first Broadcast workflow.
- API-accessible unsubscribe and preference management.
- Structured output suitable for deterministic automation.

### Alternatives considered

- **Buttondown:** excellent static embed and Markdown workflow, but no official MCP server or official SDK. Keep as the low-engineering fallback.
- **Beehiiv:** strong free tier and growth tooling, but agent write/send capabilities are more plan-dependent and the hosted publication overlaps with the existing site.
- **MailerLite:** capable forms and marketing automations, but less aligned with a CLI/MCP-first operating model.

Pricing, limits, API behavior, and MCP support are time-sensitive. Reverify them immediately before implementation.

## Implementation phases

### Phase 1: email renderer

- Extract the shared issue parser.
- Create HTML and plain-text email templates.
- Add permanent archived web issues.
- Generate screenshots and validation reports.
- Do not connect to an email provider yet.

### Phase 2: Resend foundation

- Account created.
- Programmatic API key created and stored at `pass API_KEYS/RESEND_API_KEY`.
- Install and authenticate the official CLI.
- Install and authorize the official MCP server.
- Configure segment, topic, sending domain, SPF, DKIM, DMARC, and test recipients.
- Test draft creation and test sends.

### Phase 3: subscription endpoint

- Deploy the serverless signup and confirmation endpoints.
- Add the website signup band and confirmation pages.
- Complete abuse, privacy, accessibility, and failure-path testing.

### Phase 4: weekly merge automation

- Extend the aggregator PR to include all email artifacts.
- Include the homepage, permanent archive, and email artifacts in the PR.
- Treat merge as authorization to create, verify, and send exactly one Broadcast.
- Store the Broadcast ID and terminal state in a durable GitHub issue ledger.

### Phase 5: operational hardening

- Add webhook monitoring for delivery, bounce, complaint, and unsubscribe events.
- Add subscriber export/backup procedure.
- Measure signup conversion and delivery health without unnecessary tracking.
- Monitor the exactly-once ledger and delivery results for the first several issues.

## Open decisions

1. Confirm Resend as the provider after a fresh pricing and capability check.
2. Choose Cloudflare Worker, Vercel Function, or another CLI-managed host for double opt-in.
3. Choose `signal@socaltech.live` versus `signal@updates.socaltech.live`.
4. Choose the reply-to address.
5. Choose and register the postal address shown in the footer.
6. Decide whether open and click tracking should remain disabled.
7. Decide which mailbox receives automated test sends.
8. The homepage serves the current issue and `issues/YYYY-MM-DD/` preserves each permanent archive.
9. A reviewed PR merge is authorization to send automatically after live-site verification.

## Reference links

- [Resend CLI](https://resend.com/docs/cli)
- [Resend MCP server](https://resend.com/docs/mcp-server)
- [Resend Contacts and Broadcasts](https://resend.com/docs/dashboard/audiences/introduction)
- [Resend double-opt-in examples](https://resend.com/docs/examples)
- [Resend marketing pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing)
- [Buttondown API](https://buttondown.com/features/api)
- [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
