import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderEmailHtml, renderEmailText } from '../email-template.mjs';
import { findLatestIssuePath, loadIssue } from '../lib/issue.mjs';
import {
  createBroadcastPayload,
  publicationMatches,
  validatePostalAddress,
} from '../scripts/send-merged-issue.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const issue = loadIssue(findLatestIssuePath(root));

test('latest issue contains the complete curated edition', () => {
  assert.equal(issue.featured.length, 3);
  assert.equal(issue.events.length, 37);
  assert.deepEqual(issue.counts, { OC: 10, LA: 12, SD: 11, Later: 4 });
  assert.equal(issue.webUrl, 'https://socaltech.live/');
  assert.equal(issue.archiveUrl, `https://socaltech.live/issues/${issue.slug}/`);
});

test('HTML and text email editions include every event and required footer controls', () => {
  const html = renderEmailHtml(issue, { postalAddress: 'Test address' });
  const text = renderEmailText(issue, { postalAddress: 'Test address' });

  for (const event of [...issue.featured, ...issue.events]) {
    assert.match(html, new RegExp(event.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, new RegExp(event.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(html, /\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/);
  assert.match(text, /\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/);
  assert.match(html, new RegExp(`socal-tech-signal:${issue.slug}`));
  assert.ok(Buffer.byteLength(html) < 90_000, 'email HTML must stay below clipping-prone size');
});

test('generated production site exposes the complete event list and live signup', () => {
  const web = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(web, /"events":\[/);
  assert.match(web, /"mode":"live"/);
  assert.match(web, /socal-tech-signal-signup\.vivekhaldar-02231129\.workers\.dev\/subscribe/);
  assert.match(web, /Want next week’s signal in your inbox\?/);
});

test('automatic sender targets the current homepage and permanent archive', () => {
  assert.equal(publicationMatches(`prefix \"slug\":\"${issue.slug}\" ${issue.issueDate} suffix`, issue), true);
  assert.equal(publicationMatches(`\"slug\":\"old-issue\" ${issue.issueDate}`, issue), false);
  assert.equal(validatePostalAddress('123 Example Street, Irvine, CA 92612'), '123 Example Street, Irvine, CA 92612');
  assert.throws(() => validatePostalAddress('Postal address required before launch'));

  const payload = createBroadcastPayload(issue, {
    segmentId: 'segment-id',
    topicId: 'topic-id',
    from: 'SoCal Tech Signal <signal@updates.socaltech.live>',
    replyTo: 'vh@vivekhaldar.com',
    html: '<html></html>',
    text: 'text',
  });
  assert.equal(payload.segment_id, 'segment-id');
  assert.equal(payload.topic_id, 'topic-id');
  assert.equal(payload.name, `socal-tech-signal:${issue.slug}`);
  assert.equal(payload.subject, `SoCal Tech Signal — ${issue.issueDate}`);
});
