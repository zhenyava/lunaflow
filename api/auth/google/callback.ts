import { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../../utils/session.js';
import { getBaseUrl, getRedirectUri } from '../../utils/url.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const redirectUri = getRedirectUri(req);

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google Auth Error:', data);
      return res.status(tokenResponse.status).json(data);
    }

    const { access_token, refresh_token, expires_in } = data;

    if (refresh_token) {
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      session.refreshToken = refresh_token;
      session.providerId = 'google-drive';
      await session.save();
    }

    const safe_expires_in = Math.max(0, expires_in - 30);

    const frontendUrl = `${getBaseUrl(req)}/calendar/#access_token=${access_token}&expires_in=${safe_expires_in}`;
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
