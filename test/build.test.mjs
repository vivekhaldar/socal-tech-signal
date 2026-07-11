import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderEmailHtml, renderEmailText } from '../email-template.mjs';
import { findLatestIssuePath, loadIssue } from '../lib/issue.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const issue = loadIssue(findLatestIssuePath(root));

test('latest issue contains the complete curated edition', () => {
  assert.equal(issue.featured.length, 3);
  assert.equal(issue.events.length, 37);
  assert.deepEqual(issue.counts, { OC: 10, LA: 12, SD: 11, Later: 4 });
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
  assert.ok(Buffer.byteLength(html) < 90_000, 'email HTML must stay below clipping-prone size');
});

test('generated production site exposes the complete event list and live signup', () => {
  const web = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(web, /"events":\[/);
  assert.match(web, /"mode":"live"/);
  assert.match(web, /socal-tech-signal-signup\.vivekhaldar-02231129\.workers\.dev\/subscribe/);
  assert.match(web, /Want next week’s signal in your inbox\?/);
});
