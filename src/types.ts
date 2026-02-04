export type EventType = 'period' | 'ovulation';

export interface CalendarEvent {
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

export interface Wish {
  id: string;
  text: string;
  votes: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}
