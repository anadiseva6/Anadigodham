// POST { externalId, title, message } → sends a push notification to that
// customer's subscribed device(s) via OneSignal.
//
// This runs on Vercel's servers, never in the customer's browser — so the
// REST API Key (a real secret; anyone holding it could message every
// subscriber) stays safe as an environment variable and never ships in the
// HTML/JS your customers download.
//
// FILE LOCATION — this exact path matters for Vercel to detect it:
//   api/send-notification.js   (an "api" folder at your PROJECT ROOT,
//                                same level as customerapp.html)
// Vercel automatically turns any file inside /api into a live endpoint —
// no extra config needed. This file becomes:
//   https://your-project.vercel.app/api/send-notification
//
// Setup:
//   1. Vercel dashboard → your project → Settings → Environment Variables
//      → add:
//        ONESIGNAL_APP_ID       = your OneSignal App ID
//        ONESIGNAL_REST_API_KEY = your OneSignal REST API Key
//      (Both from onesignal.com → your app → Settings → Keys & IDs.
//      The REST API Key is different from the App ID — don't mix them up,
//      and don't ever put the REST API Key in customerapp.html.)
//   2. After adding env vars, redeploy (Vercel dashboard → Deployments →
//      "..." menu on the latest deploy → Redeploy) so the function picks
//      them up.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { externalId, title, message } = req.body || {};
  if (!externalId || !message) {
    return res.status(400).json({ error: 'externalId and message are required' });
  }

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_REST_API_KEY;
  if (!APP_ID || !API_KEY) {
    console.error('Missing ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY env vars');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        // Targets the customer by the Firebase key we tagged their
        // subscription with via OneSignal.login(custId) in the app.
        include_aliases: { external_id: [externalId] },
        target_channel: 'push',
        headings: { en: title || 'Anadi Godham' },
        contents: { en: message }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OneSignal API error', data);
      return res.status(502).json(data);
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error('Send notification failed', e);
    return res.status(500).json({ error: 'Send failed' });
  }
}
