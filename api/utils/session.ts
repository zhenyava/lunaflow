import { SessionOptions } from 'iron-session';

export interface SessionData {
  refreshToken?: string;
}

const defaultPassword = 'complex_password_at_least_32_characters_long';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 
    ? process.env.SESSION_SECRET 
    : defaultPassword,
  cookieName: 'lunaflow_auth_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
