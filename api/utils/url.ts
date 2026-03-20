import { VercelRequest } from '@vercel/node';

/**
 * Dynamically determines the application's base URL (e.g., http://localhost:3000 or https://lunaflow.vercel.app)
 * based on the incoming request headers.
 */
export const getBaseUrl = (req: VercelRequest): string => {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
};

/**
 * Returns the full absolute URL for the OAuth callback endpoint.
 */
export const getRedirectUri = (req: VercelRequest): string => {
  return `${getBaseUrl(req)}/api/auth/callback`;
};
