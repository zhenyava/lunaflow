export type EventType = 'period' | 'ovulation';

export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'spotting';

export interface DailyRecord {
  date: string; // ISO format YYYY-MM-DD
  period?: {
    isFlowing: boolean;
    intensity?: FlowIntensity;
  };
  ovulation?: {
    isPredicted?: boolean;
    isConfirmed?: boolean;
  };
  updatedAt: number;
  isDeleted?: boolean;
}

export interface LegacyCalendarEvent {
  date: string; // ISO format YYYY-MM-DD
  type: EventType;
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSynced?: Date;
}

export interface GoogleToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at?: number; // Calculated expiration timestamp
}
