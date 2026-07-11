import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLatestIssuePath, loadIssue } from './lib/issue.mjs';
import { renderEmailHtml, renderEmailText } from './email-template.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, process.argv[2] || findLatestIssuePath(here));
const issue = loadIssue(sourcePath);
const postalAddress = process.env.POSTAL_ADDRESS || 'Postal address required before launch';
const strict = process.env.EMAIL_STRICT === '1';

if (strict && postalAddress === 'Postal address required before launch') {
  throw new Error('POSTAL_ADDRESS is required when EMAIL_STRICT=1');
}

const cleanTrailingWhitespace = (value) => value.replace(/[ \t]+$/gm, '');
const html = cleanTrailingWhitespace(renderEmailHtml(issue, { postalAddress }));
const text = cleanTrailingWhitespace(renderEmailText(issue, { postalAddress }));
const outputDirectory = path.join(here, 'email');
fs.mkdirSync(outputDirectory, { recursive: true });

const htmlPath = path.join(outputDirectory, `${issue.slug}.html`);
const textPath = path.join(outputDirectory, `${issue.slug}.txt`);
const subjectPath = path.join(outputDirectory, `${issue.slug}.subject.txt`);
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(textPath, text);
fs.writeFileSync(subjectPath, `SoCal Tech Signal — ${issue.issueDate}\n`);

console.log(`Built ${htmlPath} (${Buffer.byteLength(html)} bytes)`);
console.log(`Built ${textPath} (${Buffer.byteLength(text)} bytes)`);
