import { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../utils/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google Refresh Error:', data);
      return res.status(tokenResponse.status).json(data);
    }
    
    // Apply the 30-second safety buffer on the backend
    const safe_expires_in = Math.max(0, data.expires_in - 30);

    // Reset the 30-day session timer (rolling session)
    await session.save();

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: safe_expires_in,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}
