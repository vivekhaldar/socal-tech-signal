import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadIssue } from '../lib/issue.mjs';
import { renderEmailHtml, renderEmailText } from '../email-template.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RESEND_API = 'https://api.resend.com';
const GITHUB_API = 'https://api.github.com';
const TERMINAL_BROADCAST_STATES = new Set(['queued', 'scheduled', 'sent']);

const required = (name, value) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const cleanTrailingWhitespace = (value) => value.replace(/[ \t]+$/gm, '');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const validatePostalAddress = (value) => {
  const address = String(value || '').trim();
  if (address.length < 12 || /required before launch|placeholder/i.test(address)) {
    throw new Error('POSTAL_ADDRESS must contain the reviewed physical mailing address');
  }
  return address;
};

export const publicationMatches = (html, issue) => html.includes(`"slug":"${issue.slug}"`)
  && html.includes(issue.issueDate);

export const createBroadcastPayload = (issue, options) => ({
  segment_id: options.segmentId,
  topic_id: options.topicId,
  from: options.from,
  reply_to: options.replyTo,
  name: `socal-tech-signal:${issue.slug}`,
  subject: `SoCal Tech Signal — ${issue.issueDate}`,
  preview_text: `${issue.events.length} curated SoCal AI and tech event entries for ${issue.coverage}.`,
  html: options.html,
  text: options.text,
});

const requestJson = async (url, init = {}) => {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const method = init.method || 'GET';
    const message = body.message || body.error || response.statusText;
    throw new Error(`${method} ${new URL(url).pathname} failed (${response.status}): ${message}`);
  }
  return body;
};

const resendRequest = (apiKey, pathname, init = {}) => requestJson(`${RESEND_API}${pathname}`, {
  ...init,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'socal-tech-signal-github/1.0',
    ...(init.headers || {}),
  },
});

const githubRequest = (token, pathname, init = {}) => requestJson(`${GITHUB_API}${pathname}`, {
  ...init,
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'socal-tech-signal-github/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers || {}),
  },
});

const waitForPublishedIssue = async (issue, options) => {
  if (options.skip) return;
  const attempts = Number(options.attempts || 30);
  const delay = Number(options.delay || 20_000);
  const urls = [issue.webUrl, issue.archiveUrl];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const results = await Promise.all(urls.map(async (url) => {
      try {
        const separator = url.includes('?') ? '&' : '?';
        const response = await fetch(`${url}${separator}deploy=${encodeURIComponent(options.commit)}-${attempt}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) return false;
        return publicationMatches(await response.text(), issue);
      } catch {
        return false;
      }
    }));

    if (results.every(Boolean)) {
      console.log(`Verified ${issue.slug} at the homepage and permanent archive.`);
      return;
    }
    console.log(`Publication verification ${attempt}/${attempts} is still waiting for GitHub Pages.`);
    if (attempt < attempts) await wait(delay);
  }

  throw new Error(`The merged issue did not appear at ${issue.webUrl} and ${issue.archiveUrl}`);
};

const ledgerBody = (issue, state, details = {}) => [
  `Issue: \`${issue.slug}\``,
  `State: **${state}**`,
  `Commit: \`${details.commit || 'pending'}\``,
  `Broadcast ID: \`${details.broadcastId || 'pending'}\``,
  `HTML SHA-256: \`${details.htmlHash || 'pending'}\``,
  `Text SHA-256: \`${details.textHash || 'pending'}\``,
  `Homepage: ${issue.webUrl}`,
  `Archive: ${issue.archiveUrl}`,
  `Updated: ${new Date().toISOString()}`,
  '',
  'This issue is an automated exactly-once delivery ledger. It contains no subscriber addresses or secrets.',
].join('\n');

const findLedger = async (token, repository, title) => {
  const issues = await githubRequest(token, `/repos/${repository}/issues?state=all&per_page=100&sort=created&direction=desc`);
  return issues.find((issue) => !issue.pull_request && issue.title === title) || null;
};

const createLedger = (token, repository, title, body) => githubRequest(token, `/repos/${repository}/issues`, {
  method: 'POST',
  body: JSON.stringify({ title, body }),
});

const updateLedger = (token, repository, issueNumber, body, state = 'open') => githubRequest(
  token,
  `/repos/${repository}/issues/${issueNumber}`,
  { method: 'PATCH', body: JSON.stringify({ body, state }) },
);

const broadcastIdFromLedger = (ledger) => {
  const value = ledger?.body?.match(/Broadcast ID: `([^`]+)`/)?.[1];
  return value && value !== 'pending' ? value : '';
};

const verifyBroadcast = (broadcast, payload, issue) => {
  const mismatches = [];
  if (broadcast.segment_id !== payload.segment_id) mismatches.push('segment');
  if (broadcast.topic_id !== payload.topic_id) mismatches.push('topic');
  if (broadcast.from !== payload.from) mismatches.push('sender');
  if (broadcast.subject !== payload.subject) mismatches.push('subject');
  if (!broadcast.html?.includes(`socal-tech-signal:${issue.slug}`)) mismatches.push('HTML issue marker');
  if (!broadcast.html?.includes(issue.webUrl)) mismatches.push('homepage URL');
  if (!broadcast.text?.includes(issue.webUrl)) mismatches.push('plain-text homepage URL');
  if (mismatches.length) throw new Error(`Broadcast ${broadcast.id} does not match: ${mismatches.join(', ')}`);
};

const getBroadcast = (apiKey, id) => resendRequest(apiKey, `/broadcasts/${encodeURIComponent(id)}`);

const waitForAcceptedBroadcast = async (apiKey, id) => {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const broadcast = await getBroadcast(apiKey, id);
    if (TERMINAL_BROADCAST_STATES.has(broadcast.status)) return broadcast;
    if (broadcast.status !== 'draft') throw new Error(`Unexpected Broadcast status: ${broadcast.status}`);
    if (attempt < 10) await wait(3_000);
  }
  throw new Error(`Broadcast ${id} remained a draft after the send request`);
};

export const run = async (environment = process.env) => {
  const sourcePath = path.resolve(root, required('SOURCE_PATH', environment.SOURCE_PATH));
  const issue = loadIssue(sourcePath);
  const postalAddress = validatePostalAddress(environment.POSTAL_ADDRESS);
  const html = cleanTrailingWhitespace(renderEmailHtml(issue, { postalAddress }));
  const text = cleanTrailingWhitespace(renderEmailText(issue, { postalAddress }));
  const htmlHash = sha256(html);
  const textHash = sha256(text);

  if (!html.includes(`socal-tech-signal:${issue.slug}`)) throw new Error('Email is missing its issue marker');
  if (!html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')) throw new Error('HTML email is missing the unsubscribe placeholder');
  if (!text.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')) throw new Error('Text email is missing the unsubscribe placeholder');
  if (!html.includes(postalAddress) || !text.includes(postalAddress)) throw new Error('Email is missing the postal address');
  if (Buffer.byteLength(html) >= 90_000) throw new Error(`Email HTML is too large: ${Buffer.byteLength(html)} bytes`);

  const commit = required('GITHUB_SHA', environment.GITHUB_SHA);
  await waitForPublishedIssue(issue, {
    skip: environment.SKIP_SITE_VERIFY === '1',
    commit,
    attempts: environment.SITE_VERIFY_ATTEMPTS,
    delay: environment.SITE_VERIFY_DELAY_MS,
  });

  const payload = createBroadcastPayload(issue, {
    segmentId: required('RESEND_SEGMENT_ID', environment.RESEND_SEGMENT_ID),
    topicId: required('RESEND_TOPIC_ID', environment.RESEND_TOPIC_ID),
    from: required('RESEND_FROM', environment.RESEND_FROM),
    replyTo: required('RESEND_REPLY_TO', environment.RESEND_REPLY_TO),
    html,
    text,
  });

  if (environment.DRY_RUN === '1') {
    console.log(JSON.stringify({
      dryRun: true,
      issue: issue.slug,
      homepage: issue.webUrl,
      archive: issue.archiveUrl,
      htmlBytes: Buffer.byteLength(html),
      htmlHash,
      textHash,
    }, null, 2));
    return;
  }

  const apiKey = required('RESEND_API_KEY', environment.RESEND_API_KEY);
  const githubToken = required('GITHUB_TOKEN', environment.GITHUB_TOKEN);
  const repository = required('GITHUB_REPOSITORY', environment.GITHUB_REPOSITORY);
  const ledgerTitle = `[email-send] ${issue.slug}`;
  let ledger = await findLedger(githubToken, repository, ledgerTitle);
  if (!ledger) {
    ledger = await createLedger(
      githubToken,
      repository,
      ledgerTitle,
      ledgerBody(issue, 'preparing', { commit, htmlHash, textHash }),
    );
  }

  let broadcastId = broadcastIdFromLedger(ledger);
  let broadcast;
  if (broadcastId) {
    broadcast = await getBroadcast(apiKey, broadcastId);
    verifyBroadcast(broadcast, payload, issue);
    if (TERMINAL_BROADCAST_STATES.has(broadcast.status)) {
      await updateLedger(
        githubToken,
        repository,
        ledger.number,
        ledgerBody(issue, broadcast.status, { commit, broadcastId, htmlHash, textHash }),
        'closed',
      );
      console.log(`Broadcast ${broadcastId} was already ${broadcast.status}; no duplicate send was attempted.`);
      return;
    }
    if (broadcast.status !== 'draft') throw new Error(`Broadcast ${broadcastId} has unexpected status ${broadcast.status}`);
  } else {
    const created = await resendRequest(apiKey, '/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    broadcastId = required('Broadcast ID', created.id);
    await updateLedger(
      githubToken,
      repository,
      ledger.number,
      ledgerBody(issue, 'draft', { commit, broadcastId, htmlHash, textHash }),
    );
    broadcast = await getBroadcast(apiKey, broadcastId);
    verifyBroadcast(broadcast, payload, issue);
  }

  try {
    await resendRequest(apiKey, `/broadcasts/${encodeURIComponent(broadcastId)}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (error) {
    const stateAfterError = await getBroadcast(apiKey, broadcastId).catch(() => null);
    if (!stateAfterError || !TERMINAL_BROADCAST_STATES.has(stateAfterError.status)) throw error;
  }

  const accepted = await waitForAcceptedBroadcast(apiKey, broadcastId);
  await updateLedger(
    githubToken,
    repository,
    ledger.number,
    ledgerBody(issue, accepted.status, { commit, broadcastId, htmlHash, textHash }),
    'closed',
  );
  console.log(`Broadcast ${broadcastId} accepted with status ${accepted.status}.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
