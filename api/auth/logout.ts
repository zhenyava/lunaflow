import { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    expires: new Date(0), // Expire immediately
    path: '/api/auth',
  };
  
  res.setHeader('Set-Cookie', serialize('refresh_token', '', cookieOptions));
  res.status(200).json({ success: true });
}
