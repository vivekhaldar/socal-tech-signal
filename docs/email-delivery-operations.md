# Email delivery operations

This document is the operator reference for the automatic weekly newsletter
delivery path. The system deliberately separates editorial work, publication,
and delivery while making a reviewed pull-request merge the authorization to
publish and send.

## What owns each part

| Responsibility | Repository location |
| --- | --- |
| GitHub Actions trigger, permissions, and environment | `.github/workflows/send-merged-issue.yml` |
| Deployment verification, Resend API calls, and send ledger | `scripts/send-merged-issue.mjs` |
| Issue parsing and homepage/archive URLs | `lib/issue.mjs` |
| HTML and plain-text rendering | `email-template.mjs` |
| Latest issue source | `content/YYYY-MM-DD.md` |
| Reviewable generated email | `email/YYYY-MM-DD.html` and `email/YYYY-MM-DD.txt` |
| Latest website issue | `index.html`, served at `https://socaltech.live/` |
| Permanent website archive | `issues/YYYY-MM-DD/index.html`, served at `https://socaltech.live/issues/YYYY-MM-DD/` |

## Trigger and eligibility

The workflow listens for a pull request targeting `main` to close and runs the
send job only when GitHub reports that the pull request was merged. A direct
push, an unmerged closed pull request, or merely opening the weekly pull request
does not send email.

The merge must add exactly one new file matching
`content/YYYY-MM-DD.md`. Merges that add no dated issue exit successfully
without sending. A merge that adds multiple dated issues or has malformed or
missing matching artifacts fails closed.

For an eligible edition, the merged commit must contain:

- `index.html`
- `issues/YYYY-MM-DD/index.html`
- `email/YYYY-MM-DD.html`
- `email/YYYY-MM-DD.txt`
- `email/YYYY-MM-DD.subject.txt`

The workflow then runs the repository test suite before any delivery work.

## Publication before delivery

The GitHub Actions runner checks out the merge commit and loads its new Markdown
issue. It renders the final HTML and plain-text email from that Markdown using
the shared parser and email template. The final render includes the physical
mailing address supplied at runtime and Resend's unsubscribe placeholder.

The sender validates the issue marker, unsubscribe placeholder, postal address,
and 90 KB HTML size limit. It then polls both of these public URLs with a
cache-busting query parameter:

- `https://socaltech.live/`
- `https://socaltech.live/issues/YYYY-MM-DD/`

Both pages must contain the exact merged issue slug and edition. The runner
tries for up to approximately ten minutes. If GitHub Pages is stale or either
URL is unavailable, the workflow fails without creating a Resend Broadcast.

The homepage is always the current edition and is the primary link in the
email. The dated URL is the permanent archive that remains available after a
later edition replaces the homepage.

## How Resend receives the email

Resend does not fetch the website or read files from GitHub. The GitHub Actions
runner sends the complete rendered content directly to the Resend Broadcast
API.

After publication verification, `scripts/send-merged-issue.mjs` constructs a
Broadcast payload containing:

- The configured subscriber segment and newsletter topic IDs.
- `SoCal Tech Signal <signal@updates.socaltech.live>` as the sender.
- `vh@vivekhaldar.com` as the reply-to address.
- The edition subject and preview text.
- The complete rendered HTML body.
- The complete rendered plain-text body.

The delivery sequence is:

1. Create a GitHub issue titled `[email-send] YYYY-MM-DD` as the durable send
   ledger.
2. `POST /broadcasts` to Resend with the complete payload.
3. Record the returned Broadcast ID in the ledger before attempting delivery.
4. `GET /broadcasts/{id}` and verify its segment, topic, sender, subject, issue
   marker, homepage link, HTML, and plain-text alternative.
5. `POST /broadcasts/{id}/send` for that exact verified draft.
6. Poll the Broadcast until Resend reports `queued`, `scheduled`, or `sent`.
7. Record the terminal status and content hashes, then close the ledger issue.

Resend replaces `{{{RESEND_UNSUBSCRIBE_URL}}}` for each recipient and delivers
the Broadcast to confirmed contacts in the configured segment who are
subscribed to the weekly topic.

## Credentials and secrets

No Resend credential or mailing address is committed to this public
repository. They are encrypted GitHub Actions repository secrets:

- `SOCAL_SIGNAL_RESEND_API_KEY`
- `SOCAL_SIGNAL_POSTAL_ADDRESS`

The workflow maps them only into the send step:

```yaml
POSTAL_ADDRESS: ${{ secrets.SOCAL_SIGNAL_POSTAL_ADDRESS }}
RESEND_API_KEY: ${{ secrets.SOCAL_SIGNAL_RESEND_API_KEY }}
```

The Node process reads them from `process.env.POSTAL_ADDRESS` and
`process.env.RESEND_API_KEY`. It authenticates Resend API requests using the
API key as an HTTP bearer token. GitHub masks registered secrets in workflow
logs, and the sender avoids logging message bodies or credentials.

The dedicated GitHub Actions Resend key is also stored locally in Vivek's
password store at:

```text
pass API_KEYS/SOCAL_SIGNAL_GITHUB_ACTIONS_RESEND_KEY
```

The password-store entry is the recoverable local source. GitHub Actions uses
its own encrypted repository-secret copy. Rotating the local key alone does not
update GitHub; after rotation, update `SOCAL_SIGNAL_RESEND_API_KEY` with
`gh secret set` without printing the value.

The postal address is intentionally not duplicated in this public repository.
Its current reviewed value is stored only in
`SOCAL_SIGNAL_POSTAL_ADDRESS`. Updating that secret does not trigger a workflow
or send an email; it only affects a future eligible merged edition.

## Duplicate-send protection

The GitHub ledger makes retries idempotent. Before creating a Broadcast, the
sender looks for the exact `[email-send] YYYY-MM-DD` issue. If the ledger already
contains a Broadcast ID, the workflow retrieves that Broadcast instead of
creating another one.

If Resend reports `queued`, `scheduled`, or `sent`, the workflow records the
state and exits without another send request. If the send API call has an
ambiguous network failure, the workflow retrieves the Broadcast state before
deciding whether the request failed. Concurrency is also restricted to one
newsletter delivery workflow at a time.

## Normal weekly operation

1. The Monday automation researches an edition and opens a review pull request
   containing the Markdown, homepage, archive, and email artifacts. It never
   calls Resend.
2. Review the event list and generated site/email changes in the pull request.
3. Merge the pull request to authorize publication and one delivery.
4. Check the `Send merged weekly issue` GitHub Actions run.
5. If needed, inspect the corresponding `[email-send] YYYY-MM-DD` GitHub issue
   for the commit, Broadcast ID, content hashes, and final state.

Useful commands:

```sh
gh run list --repo vivekhaldar/socal-tech-signal \
  --workflow send-merged-issue.yml --limit 10

gh run view RUN_ID --repo vivekhaldar/socal-tech-signal

gh run view RUN_ID --repo vivekhaldar/socal-tech-signal --log-failed

gh secret list --repo vivekhaldar/socal-tech-signal

gh issue list --repo vivekhaldar/socal-tech-signal \
  --search 'in:title [email-send]'
```

`gh secret list` shows secret names and update times, never their values.

## Failure behavior

The process stops without sending when any of these checks fail:

- The pull request was not merged.
- The merge did not add exactly one correctly named dated issue.
- Required website or email artifacts are absent.
- Tests fail.
- A required GitHub secret is missing.
- The postal address is empty or still a placeholder.
- The rendered email is invalid or too large.
- The homepage or archive does not show the exact merged edition in time.
- The created Resend draft does not match the intended payload.
- The ledger contains an unexpected Broadcast state.

Do not manually rerun or send a replacement Broadcast until the workflow log,
ledger issue, and current Resend Broadcast state have all been checked. The
ledger is specifically designed to distinguish a safe retry from a duplicate
delivery risk.
