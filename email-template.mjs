import { REGION_NAMES, REGION_ORDER } from './lib/issue.mjs';

const COLORS = {
  paper: '#f8f7f0',
  ink: '#171629',
  inkSoft: '#555466',
  line: '#d7d4c5',
  signal: '#dfff35',
  cobalt: '#4059e8',
  vermilion: '#f05b3d',
  green: '#20a875',
  purple: '#8d4c91',
};

const REGION_COLORS = {
  OC: COLORS.vermilion,
  LA: COLORS.cobalt,
  SD: COLORS.green,
  Later: COLORS.purple,
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const eventRows = (events, color) => events.map((event) => `
  <tr>
    <td style="padding:24px 0;border-bottom:1px solid ${COLORS.line};">
      <p style="margin:0 0 7px;color:${COLORS.inkSoft};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:1.45;">${escapeHtml(event.meta)}</p>
      <h3 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;line-height:1.12;letter-spacing:-0.4px;">
        <a href="${escapeHtml(event.url)}" style="color:${COLORS.ink};text-decoration:none;">${event.starred ? `<span style="color:${color};">★</span> ` : ''}${escapeHtml(event.title)}&nbsp;↗</a>
      </h3>
      <p style="margin:9px 0 0;color:${COLORS.inkSoft};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">${escapeHtml(event.description)}</p>
    </td>
  </tr>`).join('');

const featuredRows = (featured) => {
  const backgrounds = [COLORS.ink, COLORS.cobalt, COLORS.vermilion];
  const foregrounds = [COLORS.paper, COLORS.paper, COLORS.ink];
  return featured.map((event, index) => `
    <tr>
      <td style="padding:0 0 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${backgrounds[index]};color:${foregrounds[index]};">
          <tr>
            <td style="padding:25px 25px 27px;">
              <p style="margin:0 0 15px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">Editor’s pick 0${index + 1}</p>
              <h3 style="margin:0;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:25px;font-weight:900;line-height:1.02;letter-spacing:-1px;">
                <a href="${escapeHtml(event.url)}" style="color:${foregrounds[index]};text-decoration:none;">${escapeHtml(event.title)}&nbsp;↗</a>
              </h3>
              <p style="margin:13px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:1.45;">${escapeHtml(event.meta)}</p>
              <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">${escapeHtml(event.description)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
};

export const renderEmailHtml = (issue, options = {}) => {
  const postalAddress = options.postalAddress || 'Postal address required before launch';
  const unsubscribeUrl = options.unsubscribeUrl || '{{{RESEND_UNSUBSCRIBE_URL}}}';
  const preheader = `${issue.featured.map((event) => event.title).join(' · ')} — plus the complete ${issue.events.length}-event list.`;
  const countSummary = REGION_ORDER
    .filter((region) => issue.counts[region] > 0)
    .map((region) => `${region.toUpperCase()} ${issue.counts[region]}`)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  const regionSections = REGION_ORDER.map((region) => {
    const events = issue.events.filter((event) => event.region === region);
    if (!events.length) return '';
    return `
      <tr>
        <td style="padding:44px 28px 0;background:${COLORS.paper};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding:0 0 11px;border-bottom:4px solid ${REGION_COLORS[region]};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td><h2 style="margin:0;color:${COLORS.ink};font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:27px;font-weight:900;line-height:1;letter-spacing:-1px;">${escapeHtml(REGION_NAMES[region])}</h2></td>
                    <td align="right" style="color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;">${events.length}</td>
                  </tr>
                </table>
              </td>
            </tr>
            ${eventRows(events, REGION_COLORS[region])}
          </table>
        </td>
      </tr>`;
  }).join('');

  return `<!doctype html>
<!-- socal-tech-signal:${escapeHtml(issue.slug)} -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(issue.publication)} — ${escapeHtml(issue.issueDate)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.paper};color:${COLORS.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.paper};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;margin:0 auto;background:${COLORS.paper};">
          <tr>
            <td style="padding:20px 28px;background:${COLORS.paper};border-bottom:1px solid ${COLORS.ink};font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:16px;font-weight:900;letter-spacing:-0.5px;">SoCal <span style="color:${COLORS.vermilion};font-weight:400;">/</span> Signal</td>
                  <td align="right" style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Updated weekly</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:42px 28px 44px;background:${COLORS.signal};border-bottom:1px solid ${COLORS.ink};">
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;"><span style="color:${COLORS.vermilion};">━━━━</span>&nbsp;&nbsp;Curated in-person</p>
              <h1 style="max-width:500px;margin:0;color:${COLORS.ink};font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:45px;font-weight:900;line-height:0.96;letter-spacing:-2.5px;">SoCal AI + Tech Events</h1>
              <p style="margin:25px 0 0;color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;line-height:1.25;">${escapeHtml(issue.issueDate)}<br><span style="font-size:14px;font-weight:600;">${escapeHtml(issue.coverage)}</span></p>
              <p style="margin:28px 0 0;">
                <a href="${escapeHtml(issue.webUrl)}" style="display:inline-block;padding:13px 17px;background:${COLORS.ink};color:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;text-decoration:none;">View this issue on the web&nbsp;↗</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:42px 28px 32px;background:${COLORS.paper};">
              <h2 style="margin:0 0 9px;color:${COLORS.ink};font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:31px;font-weight:900;line-height:1;letter-spacing:-1.4px;">Three to circle.</h2>
              <p style="margin:0 0 23px;color:${COLORS.inkSoft};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;">The strongest reasons to rearrange the week.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${featuredRows(issue.featured)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:13px 28px;background:${COLORS.ink};color:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:0.4px;">
              ${countSummary}
            </td>
          </tr>
          ${regionSections}
          <tr>
            <td style="padding:44px 28px;background:${COLORS.paper};">
              <a href="${escapeHtml(issue.webUrl)}" style="display:block;padding:17px;background:${COLORS.signal};color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;text-align:center;text-decoration:none;">Open the full web issue&nbsp;↗</a>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px;background:${COLORS.ink};color:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;">
              <p style="margin:0 0 12px;font-weight:800;">SoCal Tech Signal</p>
              <p style="margin:0 0 12px;">The complete weekly field guide for technical founders, builders, engineering and security leaders, and hands-on operators across Southern California.</p>
              <p style="margin:0 0 12px;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.signal};">Unsubscribe</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://socaltech.live/privacy.html" style="color:${COLORS.signal};">Privacy</a></p>
              <p style="margin:0;color:#c8c5d0;">${escapeHtml(postalAddress)}</p>
              <p style="margin:12px 0 0;color:#c8c5d0;">Made with <span style="color:${COLORS.vermilion};">♥</span> by <a href="https://vivekhaldar.com/" style="color:${COLORS.paper};">Vivek Haldar</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const renderEmailText = (issue, options = {}) => {
  const postalAddress = options.postalAddress || 'Postal address required before launch';
  const unsubscribeUrl = options.unsubscribeUrl || '{{{RESEND_UNSUBSCRIBE_URL}}}';
  const lines = [
    `SOCAL TECH SIGNAL — ${issue.issueDate}`,
    issue.coverage,
    '',
    `View this issue on the web: ${issue.webUrl}`,
    '',
    'THREE TO CIRCLE',
    '',
  ];

  issue.featured.forEach((event, index) => {
    lines.push(
      `EDITOR'S PICK 0${index + 1}: ${event.title}`,
      event.meta,
      event.description,
      event.url,
      '',
    );
  });

  REGION_ORDER.forEach((region) => {
    const events = issue.events.filter((event) => event.region === region);
    if (!events.length) return;
    lines.push(`${REGION_NAMES[region].toUpperCase()} (${events.length})`, '');
    events.forEach((event) => {
      lines.push(
        `${event.starred ? '★ ' : ''}${event.title}`,
        event.meta,
        event.description,
        event.url,
        '',
      );
    });
  });

  lines.push(
    `Full web issue: ${issue.webUrl}`,
    '',
    'SoCal Tech Signal',
    postalAddress,
    `Unsubscribe: ${unsubscribeUrl}`,
    'Privacy: https://socaltech.live/privacy.html',
    'Made with love by Vivek Haldar — https://vivekhaldar.com/',
  );
  return `${lines.join('\n').trim()}\n`;
};
