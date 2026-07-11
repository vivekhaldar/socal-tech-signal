import fs from 'node:fs';
import path from 'node:path';

export const REGION_NAMES = {
  OC: 'Orange County',
  LA: 'Los Angeles',
  SD: 'San Diego',
  Later: 'Later on the radar',
};

export const REGION_ORDER = ['OC', 'LA', 'SD', 'Later'];

const REGION_SECTIONS = [
  ['Orange County', 'OC', ['Los Angeles']],
  ['Los Angeles', 'LA', ['San Diego']],
  ['San Diego', 'SD', ['Later on the radar']],
  ['Later on the radar', 'Later', ['How this issue was made']],
];

const inferTags = (text) => {
  const value = text.toLowerCase();
  const rules = [
    ['AI builders', /ai|agent|claude|codex|llm|genai/],
    ['Security', /security|cyber|isaca|issa|owasp/],
    ['Founders', /founder|startup|operator|capital|business/],
    ['Hands-on', /workshop|hack|build|coding|demo|clinic/],
    ['Research', /paper|quantum|research|evaluation|gis|spatial/],
  ];
  return rules
    .filter(([, expression]) => expression.test(value))
    .map(([label]) => label)
    .slice(0, 2);
};

const sectionText = (markdown, name, nextNames = []) => {
  const start = markdown.indexOf(`## ${name}`);
  if (start < 0) return '';
  const candidates = nextNames
    .map((next) => markdown.indexOf(`## ${next}`, start + 3))
    .filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : markdown.length;
  return markdown.slice(start, end);
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
      description: description
        .trim()
        .replace(/\n---\s*$/, '')
        .trim()
        .replace(/\n+/g, ' '),
      region,
      starred: Boolean(starred),
      tags: inferTags(`${title} ${description}`),
    });
  }
  return events;
};

const validateIssue = (issue) => {
  const problems = [];
  if (!issue.issueDate || issue.issueDate === 'Current edition') problems.push('missing edition date');
  if (!issue.coverage) problems.push('missing coverage window');
  if (issue.featured.length !== 3) problems.push(`expected 3 editor's picks, found ${issue.featured.length}`);
  if (!issue.events.length) problems.push('no regional events');

  for (const event of [...issue.featured, ...issue.events]) {
    if (!event.title || !event.meta || !event.description) problems.push(`incomplete event: ${event.title || '(untitled)'}`);
    try {
      const url = new URL(event.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      problems.push(`invalid event URL: ${event.url || '(missing)'}`);
    }
  }

  if (problems.length) throw new Error(`Issue validation failed:\n- ${[...new Set(problems)].join('\n- ')}`);
};

export const findLatestIssuePath = (rootDirectory) => {
  const contentDirectory = path.join(rootDirectory, 'content');
  const latestIssue = fs.readdirSync(contentDirectory)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort()
    .at(-1);
  if (!latestIssue) throw new Error('No dated Markdown issue found under content/');
  return path.join(contentDirectory, latestIssue);
};

export const loadIssue = (sourcePath) => {
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const slug = path.basename(sourcePath, path.extname(sourcePath));
  const introMatch = markdown.match(/AI, engineering, security, and founder events[^\n]*\.\n\n([^\n]+)\n\n([^\n]+)?/);
  const featured = parseEvents(
    sectionText(markdown, '⭐ Editor’s picks', ['Worth the drive']),
    'Featured',
  );
  const events = REGION_SECTIONS.flatMap(([heading, label, next]) =>
    parseEvents(sectionText(markdown, heading, next), label),
  );

  const issue = {
    publication: 'SoCal Tech Signal',
    slug,
    issueDate: markdown.match(/\*\*(?:Pilot edition|Edition) · ([^*]+)\*\*/)?.[1] || 'Current edition',
    coverage: markdown.match(/\*\*Events from ([^*]+)\*\*/)?.[1] || '',
    dek: 'The in-person AI, engineering, security, and founder events worth leaving the house for.',
    intro: introMatch?.[1] || '',
    audience: 'For technical founders, builders, engineering and security leaders, and hands-on operators across Southern California.',
    cadence: 'Updated weekly',
    webUrl: `https://socaltech.live/issues/${slug}/`,
    featured,
    events,
    counts: Object.fromEntries(
      REGION_ORDER.map((region) => [region, events.filter((event) => event.region === region).length]),
    ),
  };

  validateIssue(issue);
  return issue;
};

export const serializeForScript = (value) => JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
