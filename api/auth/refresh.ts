import { VercelRequest, VercelResponse } from '@vercel/node';
import { parse } from 'cookie';
import { decrypt } from '../utils/encryption.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cookies = parse(req.headers.cookie || '');
  const encryptedRefreshToken = cookies.refresh_token;

  if (!encryptedRefreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const refreshToken = decrypt(encryptedRefreshToken);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google Refresh Error:', data);
      return res.status(tokenResponse.status).json(data);
    }

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}
