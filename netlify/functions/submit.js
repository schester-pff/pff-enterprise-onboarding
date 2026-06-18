const SPREADSHEET_ID = '1eHW0R1WY0GNankgEBly9Dh3YWl88mt4WCNifj33x4G4';
const SHEET_NAME = 'Submissions';

async function getAccessToken() {
  const crypto = require('crypto');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let raw = process.env.GOOGLE_PRIVATE_KEY || '';

  // Netlify may store newlines as \n literals or as spaces — handle all cases
  // 1. Replace literal \n sequences
  raw = raw.replace(/\\n/g, '\n');
  // 2. Reconstruct if spaces have replaced newlines inside the key body
  // Extract just the base64 body between the headers
  const beginMarker = '-----BEGIN PRIVATE KEY-----';
  const endMarker   = '-----END PRIVATE KEY-----';
  let body = raw;
  body = body.replace(beginMarker, '').replace(endMarker, '');
  // Remove all whitespace from body then rechunk at 64 chars
  body = body.replace(/\s+/g, '');
  const chunked = body.match(/.{1,64}/g).join('\n');
  const privateKey = `${beginMarker}\n${chunked}\n${endMarker}`;

  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims  = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const signingInput = `${header}.${claims}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function appendRow(accessToken, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Sheets error: ' + JSON.stringify(data));
  return data;
}

exports.handler = async function(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  try {
    const d = JSON.parse(event.body);
    const row = [
      d.submitted_at||'', d.leaving||'', d.continuation||'',
      d.name||'', d.email||'', d.preferred_email||'', d.initials||'',
      d.country||'', d.us_state||'', d.timezone||'', d.years_with_pff||'',
      d.slack_confirm||'', d.processes||'', d.processes_learning||'',
      d.process_times||'', d.total_games_last_season||'',
      d.avg_games_per_week||'', d.preferred_games_per_week||'',
      d.workload_preference||'', d.ideal_schedule||'', d.schedule_notes||'',
      d.dual_monitor||'', d.os||'', d.questions_for_us||'',
      d.avail_saturday||'', d.avail_sunday||'', d.avail_monday||'',
      d.avail_tuesday||'', d.avail_wednesday||'', d.avail_thursday||'',
      d.avail_friday||''
    ];

    const token = await getAccessToken();
    await appendRow(token, row);

    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok' }) };
  } catch(err) {
    console.error('submit error:', err.message);
    return { statusCode: 500, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'error', message: err.message }) };
  }
};
