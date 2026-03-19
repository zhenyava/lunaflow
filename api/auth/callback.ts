import { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';
import { encrypt } from '../utils/encryption';

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

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    // Exchange code for tokens
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

    // If a refresh token is returned, encrypt it and store it in an HttpOnly cookie
    if (refresh_token) {
      const encryptedToken = encrypt(refresh_token);
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/api/auth',
      };
      
      res.setHeader('Set-Cookie', serialize('refresh_token', encryptedToken, cookieOptions));
    }

    // Redirect to the frontend with the access_token in the URL hash fragment
    const frontendUrl = `${protocol}://${host}/#access_token=${access_token}&expires_in=${expires_in}`;
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
