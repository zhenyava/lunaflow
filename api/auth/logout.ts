import { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../utils/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  res.status(200).json({ success: true });
}
