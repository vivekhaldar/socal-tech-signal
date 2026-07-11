import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLatestIssuePath, loadIssue, serializeForScript } from './lib/issue.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, process.argv[2] || findLatestIssuePath(here));
const templatePath = path.join(here, 'template.html');
const outputPath = path.join(here, 'index.html');
const template = fs.readFileSync(templatePath, 'utf8');
const issue = loadIssue(sourcePath);

const signupMode = process.env.SIGNUP_MODE || 'live';
const signupEndpoint = process.env.SIGNUP_ENDPOINT
  || 'https://socal-tech-signal-signup.vivekhaldar-02231129.workers.dev/subscribe';
const data = { ...issue, signup: { mode: signupMode, endpoint: signupEndpoint } };
const render = (canonicalUrl) => template
  .replace('__CANONICAL_URL__', canonicalUrl)
  .replace('__ISSUE_DATA__', serializeForScript(data));

fs.writeFileSync(outputPath, render('https://socaltech.live/'));
const archivePath = path.join(here, 'issues', issue.slug, 'index.html');
fs.mkdirSync(path.dirname(archivePath), { recursive: true });
fs.writeFileSync(archivePath, render(issue.archiveUrl));

console.log(`Built ${outputPath} and ${archivePath} from ${sourcePath} (${issue.events.length} event entries)`);
