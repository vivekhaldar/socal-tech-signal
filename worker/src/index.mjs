const encoder = new TextEncoder();
const decoder = new TextDecoder();
const memoryRateLimit = new Map();

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const isValidEmail = (email) => {
  if (!email || email.length > 254 || /[\s\r\n]/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0].length > 64) return false;
  return /^[^<>()[\]\\,;:\"]+$/.test(parts[0])
    && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parts[1]);
};

const bytesToBase64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBytes = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importSigningKey = (secret) => crypto.subtle.importKey(
  'raw',
  encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
);

export const createConfirmationToken = async (email, secret, now = Date.now()) => {
  if (!secret) throw new Error('CONFIRMATION_SECRET is required');
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    email,
    exp: now + (24 * 60 * 60 * 1000),
  })));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
};

export const verifyConfirmationToken = async (token, secret, now = Date.now()) => {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  try {
    const key = await importSigningKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const data = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    if (!isValidEmail(data.email) || !Number.isFinite(data.exp) || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
};

const json = (body, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  },
});

const preflight = (origin) => new Response(null, {
  status: 204,
  headers: {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  },
});

const allowedOrigin = (request, env) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://socaltech.live,http://localhost:4173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : '';
};

const sha256 = async (value) => bytesToBase64Url(new Uint8Array(
  await crypto.subtle.digest('SHA-256', encoder.encode(value)),
));

const checkRateLimit = async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = `signup:${await sha256(`${ip}:${bucket}`)}`;

  if (env.SIGNUP_RATE_LIMIT?.get && env.SIGNUP_RATE_LIMIT?.put) {
    const count = Number(await env.SIGNUP_RATE_LIMIT.get(key) || 0);
    if (count >= 5) return false;
    await env.SIGNUP_RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 1800 });
    return true;
  }

  const count = memoryRateLimit.get(key) || 0;
  memoryRateLimit.set(key, count + 1);
  return count < 5;
};

const resendRequest = async (env, pathname, init = {}) => {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch(`https://api.resend.com${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

const confirmationEmail = (confirmUrl) => ({
  subject: 'Confirm your SoCal Tech Signal subscription',
  text: `Confirm your weekly SoCal Tech Signal subscription:\n\n${confirmUrl}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`,
  html: `<!doctype html><html><body style="margin:0;background:#f8f7f0;color:#171629;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="600" style="width:100%;max-width:600px;"><tr><td style="padding:26px;background:#dfff35;border-bottom:1px solid #171629;font-size:14px;font-weight:800;">SoCal / Signal</td></tr><tr><td style="padding:38px 26px;"><h1 style="margin:0 0 18px;font-size:34px;line-height:1;letter-spacing:-1.5px;">One click, then you’re in.</h1><p style="font-size:17px;line-height:1.5;">Confirm your subscription to the complete weekly SoCal AI + tech event list.</p><p style="margin:28px 0;"><a href="${confirmUrl}" style="display:inline-block;padding:14px 18px;background:#171629;color:#f8f7f0;font-weight:800;text-decoration:none;">Confirm subscription</a></p><p style="color:#555466;font-size:13px;line-height:1.5;">This link expires in 24 hours. If you didn’t request it, ignore this email.</p></td></tr></table></td></tr></table></body></html>`,
});

const parseBody = async (request) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) return request.json();
  if (contentType.includes('form')) return Object.fromEntries(await request.formData());
  throw new Error('Unsupported content type');
};

const subscribe = async (request, env, origin) => {
  if (!origin) return json({ message: 'Origin not allowed.' }, 403, 'null');
  if (!await checkRateLimit(request, env)) {
    return json({ message: 'Too many attempts. Try again in a few minutes.' }, 429, origin);
  }

  let input;
  try {
    input = await parseBody(request);
  } catch {
    return json({ message: 'Send a valid signup request.' }, 400, origin);
  }

  if (input.website) return json({ message: 'Check your inbox to confirm.' }, 202, origin);
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return json({ message: 'Enter a valid email address.' }, 400, origin);

  if (env.SIGNUP_MODE === 'mock') return json({ message: 'Check your inbox to confirm.' }, 202, origin);

  const token = await createConfirmationToken(email, env.CONFIRMATION_SECRET);
  const confirmationBase = env.CONFIRM_URL || new URL('/confirm', request.url).href;
  const confirmUrl = `${confirmationBase}?token=${encodeURIComponent(token)}`;
  const message = confirmationEmail(confirmUrl);
  const { response } = await resendRequest(env, '/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [email],
      reply_to: env.RESEND_REPLY_TO || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: 'category', value: 'socal_signal_confirm' }],
    }),
  });
  if (!response.ok) return json({ message: 'Couldn’t start your signup. Try again in a moment.' }, 503, origin);
  return json({ message: 'Check your inbox to confirm.' }, 202, origin);
};

const updateExistingContact = async (env, email) => {
  const encodedEmail = encodeURIComponent(email);
  const update = await resendRequest(env, `/contacts/${encodedEmail}`, {
    method: 'PATCH',
    body: JSON.stringify({ unsubscribed: false }),
  });
  if (!update.response.ok) return update;

  const segment = await resendRequest(env, `/contacts/${encodedEmail}/segments/${env.RESEND_SEGMENT_ID}`, {
    method: 'POST',
  });
  if (!segment.response.ok && segment.response.status !== 409) return segment;

  return resendRequest(env, `/contacts/${encodedEmail}/topics`, {
    method: 'PATCH',
    body: JSON.stringify({ topics: [{ id: env.RESEND_TOPIC_ID, subscription: 'opt_in' }] }),
  });
};

const confirm = async (request, env) => {
  const siteUrl = env.SITE_URL || 'https://socaltech.live';
  const token = new URL(request.url).searchParams.get('token');
  const data = await verifyConfirmationToken(token, env.CONFIRMATION_SECRET);
  if (!data) return Response.redirect(`${siteUrl}/subscribed.html?status=invalid`, 303);
  if (!env.RESEND_SEGMENT_ID || !env.RESEND_TOPIC_ID) {
    return Response.redirect(`${siteUrl}/subscribed.html?status=service`, 303);
  }

  const created = await resendRequest(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      unsubscribed: false,
      segments: [{ id: env.RESEND_SEGMENT_ID }],
      topics: [{ id: env.RESEND_TOPIC_ID, subscription: 'opt_in' }],
    }),
  });
  const result = created.response.status === 409
    ? await updateExistingContact(env, data.email)
    : created;
  if (!result.response.ok) return Response.redirect(`${siteUrl}/subscribed.html?status=service`, 303);
  return Response.redirect(`${siteUrl}/subscribed.html?status=confirmed`, 303);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') return preflight(origin || 'null');
    if (url.pathname === '/subscribe' && request.method === 'POST') return subscribe(request, env, origin);
    if (url.pathname === '/confirm' && request.method === 'GET') return confirm(request, env);
    return json({ message: 'Not found.' }, 404, origin || 'null');
  },
};
