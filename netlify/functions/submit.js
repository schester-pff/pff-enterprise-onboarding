const SPREADSHEET_ID = '1eHW0R1WY0GNankgEBly9Dh3YWl88mt4WCNifj33x4G4';
const SHEET_NAME = 'Submissions';

// ── Google JWT auth using native Node crypto ─────────────────
async function getAccessToken() {
  const crypto = require('crypto');

  // Netlify stores the key with literal \n — convert to real newlines
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  sign.end();

  // Use pkcs8 key format explicitly
  const keyObject = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs8'
  });

  const signature = sign.sign(keyObject, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Token error: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// ── Append a row to the sheet ────────────────────────────────
async function appendRow(accessToken, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [values] })
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Sheets API error: ' + JSON.stringify(data));
  return data;
}

// ── Main handler ─────────────────────────────────────────────
exports.handler = async function(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const d = JSON.parse(event.body);

    const row = [
      d.submitted_at             || '',
      d.leaving                  || '',
      d.continuation             || '',
      d.name                     || '',
      d.email                    || '',
      d.preferred_email          || '',
      d.initials                 || '',
      d.country                  || '',
      d.us_state                 || '',
      d.timezone                 || '',
      d.years_with_pff           || '',
      d.slack_confirm            || '',
      d.processes                || '',
      d.processes_learning       || '',
      d.process_times            || '',
      d.total_games_last_season  || '',
      d.avg_games_per_week       || '',
      d.preferred_games_per_week || '',
      d.workload_preference      || '',
      d.ideal_schedule           || '',
      d.schedule_notes           || '',
      d.dual_monitor             || '',
      d.os                       || '',
      d.questions_for_us         || '',
      d.avail_saturday           || '',
      d.avail_sunday             || '',
      d.avail_monday             || '',
      d.avail_tuesday            || '',
      d.avail_wednesday          || '',
      d.avail_thursday           || '',
      d.avail_friday             || ''
    ];

    const accessToken = await getAccessToken();
    await appendRow(accessToken, row);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok' })
    };

  } catch(err) {
    console.error('submit error:', err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
