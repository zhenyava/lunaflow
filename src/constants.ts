export const APP_DATA_FILENAME = 'lunaflow_data.json';
export const LOCAL_STORAGE_KEY = 'lunaflow_events';
export const LAUNCHED_KEY = 'lunaflow_has_launched';
export const STORAGE_CURRENT_VERSION = 2;

// Colors for the calendar
export const PERIOD_COLOR = 'bg-rose-500 text-white hover:bg-rose-600';
export const PERIOD_LIGHT_COLOR = 'bg-rose-100 text-rose-700';
export const OVULATION_COLOR = 'bg-violet-500 text-white hover:bg-violet-600';
export const OVULATION_LIGHT_COLOR = 'bg-violet-100 text-violet-700';

export const FOLDER_NAME = 'LunaFlow';

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

/**
 * CLIENT ID CONFIGURATION
 * 
 * Since this is a client-side app, the Client ID is public knowledge.
 * Security is enforced by "Authorized JavaScript origins" in Google Cloud Console.
 * 
 * We load it from Vite environment variables (VITE_GOOGLE_CLIENT_ID).
 * If not found, the application will handle the missing ID gracefully.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
