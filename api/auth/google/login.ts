import { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedirectUri } from '../../utils/url.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Missing Google Client ID' });
  }

  const redirectUri = getRedirectUri(req, 'google');

  const scopes = [
    'https://www.googleapis.com/auth/drive.file'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', scopes);
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');

  res.redirect(authUrl.toString());
}
