export const APP_DATA_FILENAME = 'lunaflow_data.json';
export const LOCAL_STORAGE_KEY = 'lunaflow_events';

// Colors for the calendar
export const PERIOD_COLOR = 'bg-rose-500 text-white hover:bg-rose-600';
export const PERIOD_LIGHT_COLOR = 'bg-rose-100 text-rose-700';
export const OVULATION_COLOR = 'bg-violet-500 text-white hover:bg-violet-600';
export const OVULATION_LIGHT_COLOR = 'bg-violet-100 text-violet-700';

// Google API Scopes
// We use drive.appdata to store files in a hidden folder app-specific
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

/**
 * CLIENT ID CONFIGURATION
 * 
 * Since this is a client-side app, the Client ID is public knowledge.
 * Security is enforced by "Authorized JavaScript origins" in Google Cloud Console.
 * 
 * We attempt to load it from various sources:
 * 1. Vite environment variables (import.meta.env.VITE_GOOGLE_CLIENT_ID)
 * 2. Node process environment (process.env.GOOGLE_CLIENT_ID) - usually replaced by bundlers
 * 3. Fallback to empty string (Application will prompt user via UI)
 */

let envClientId = '176231985601-5ivq7l5u9ok8d85ot2l2nicsa59bc2tb.apps.googleusercontent.com';

// Try to get from Vite (Modern standard)
try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    // @ts-ignore
    envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }
} catch (e) {}

// Try to get from Process (Legacy/Webpack/Node) without crashing browser
try {
  // @ts-ignore
  if (!envClientId && typeof process !== 'undefined' && process.env && process.env.GOOGLE_CLIENT_ID) {
    // @ts-ignore
    envClientId = process.env.GOOGLE_CLIENT_ID;
  }
} catch (e) {}

export const GOOGLE_CLIENT_ID = envClientId;