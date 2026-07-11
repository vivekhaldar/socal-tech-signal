import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const latestIssue = fs.readdirSync(path.join(here, 'content'))
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .sort()
  .at(-1);
if (!latestIssue) throw new Error('No dated Markdown issue found under content/');
const sourcePath = path.resolve(here, process.argv[2] || path.join('content', latestIssue));
const templatePath = path.join(here, 'template.html');
const outputPath = path.join(here, 'index.html');

const md = fs.readFileSync(sourcePath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');

const sectionText = (name, nextNames = []) => {
  const start = md.indexOf(`## ${name}`);
  if (start < 0) return '';
  const candidates = nextNames
    .map((next) => md.indexOf(`## ${next}`, start + 3))
    .filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : md.length;
  return md.slice(start, end);
};

const parseEvents = (text, region) => {
  const events = [];
  const eventPattern = /###\s+(⭐\s+)?\[([^\]]+)\]\(([^)]+)\)\n\n\*\*(.+?)\*\*(?:<br>)?\n([\s\S]*?)(?=\n\n###\s|\n\n##\s|$)/g;
  let match;
  while ((match = eventPattern.exec(text))) {
    const [, starred, title, url, meta, description] = match;
    events.push({
      title: title.trim(),
      url: url.trim(),
      meta: meta.trim(),
      description: description.trim().replace(/\n---\s*$/, '').trim().replace(/\n+/g, ' '),
      region,
      starred: Boolean(starred),
      tags: inferTags(`${title} ${description}`),
    });
  }
  return events;
};

function inferTags(text) {
  const value = text.toLowerCase();
  const rules = [
    ['AI builders', /ai|agent|claude|codex|llm|genai/],
    ['Security', /security|cyber|isaca|issa|owasp/],
    ['Founders', /founder|startup|operator|capital|business/],
    ['Hands-on', /workshop|hack|build|coding|demo|clinic/],
    ['Research', /paper|quantum|research|evaluation|gis|spatial/],
  ];
  return rules.filter(([, expression]) => expression.test(value)).map(([label]) => label).slice(0, 2);
}

const introMatch = md.match(/AI, engineering, security, and founder events[^\n]*\.\n\n([^\n]+)\n\n([^\n]+)?/);
const issueDate = md.match(/\*\*(?:Pilot edition|Edition) · ([^*]+)\*\*/)?.[1] || 'Current edition';
const coverage = md.match(/\*\*Events from ([^*]+)\*\*/)?.[1] || '';

const featured = parseEvents(
  sectionText('⭐ Editor’s picks', ['Worth the drive']),
  'Featured',
);

const regions = [
  ['Orange County', 'OC', ['Los Angeles']],
  ['Los Angeles', 'LA', ['San Diego']],
  ['San Diego', 'SD', ['Later on the radar']],
  ['Later on the radar', 'Later', ['How this issue was made']],
];

const events = regions.flatMap(([heading, label, next]) =>
  parseEvents(sectionText(heading, next), label),
);

const data = {
  publication: 'SoCal Tech Signal',
  issueDate,
  coverage,
  dek: 'The in-person AI, engineering, security, and founder events worth leaving the house for.',
  intro: introMatch?.[1] || '',
  audience: 'For technical founders, builders, engineering and security leaders, and hands-on operators across Southern California.',
  cadence: 'Updated weekly',
  featured,
  events,
  counts: Object.fromEntries(regions.map(([, label]) => [label, events.filter((event) => event.region === label).length])),
};

const serialized = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
const html = template.replace('__ISSUE_DATA__', serialized);
fs.writeFileSync(outputPath, html);
console.log(`Built ${outputPath} from ${sourcePath} (${events.length} event entries)`);
