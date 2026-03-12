import { createClerkClient } from '@clerk/backend';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

interface OauthAccessToken {
  token: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the Clerk token
    const payload = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    const userId = payload.sub;
    if (!userId) {
       return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    // Fetch Google OAuth token
    const response = await clerkClient.users.getUserOauthAccessToken(userId, 'oauth_google');
    
    // Clerk SDK v5: response has a data property
    // Clerk SDK v4: response is an array
    const data = (response as unknown as { data: OauthAccessToken[] }).data || (response as unknown as OauthAccessToken[]);
    const googleToken = Array.isArray(data) ? data[0]?.token : undefined;

    if (!googleToken) {
      return res.status(404).json({ error: 'Google OAuth token not found for user' });
    }

    res.status(200).json({ accessToken: googleToken });
  } catch (error) {
    console.error('Error in get-drive-token:', error);
    res.status(500).json({ error: 'Internal Server Error', details: (error as Error).message });
  }
}
