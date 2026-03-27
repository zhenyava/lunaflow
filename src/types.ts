export type EventType = 'period' | 'ovulation';

export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'spotting';

export interface SymptomOption {
  id: string;
  label: string;
}

export interface SymptomCategory {
  id: string;
  name: string;
  color: string;
  options: SymptomOption[];
}

/**
 * Core data entity representing a single day in the calendar.
 * Replaces the old Event-based model to support multi-device sync and tombstones.
 */
export interface DailyRecord {
  /** The date of the record in ISO YYYY-MM-DD format (e.g., "2024-03-24"). Acts as the Primary Key. */
  date: string; 

  /** 
   * Data related to menstrual flow for this day. 
   * If the property exists, it indicates that tracking for periods was recorded.
   */
  period?: {
    /** Optional detail about the flow volume (for future use). */
    intensity?: FlowIntensity;
  };

  /** 
   * Data related to ovulation tracking. 
   * If the property exists, it indicates that ovulation was recorded.
   */
  ovulation?: Record<string, never>;

  /**
   * Optional map of categoryId to array of optionIds (symptoms).
   */
  symptoms?: Record<string, string[]>;

  /** 
   * Unix timestamp (milliseconds) of the last time this record was modified.
   * Crucial for the Sync Engine (Last-Write-Wins strategy) to resolve conflicts between devices.
   */
  updatedAt: number;

  /** 
   * The "Tombstone" flag. If true, this record is treated as deleted.
   * We keep deleted records to ensure that deletions are synchronized correctly across devices
   * and not "resurrected" by the Google Drive sync engine.
   */
  isDeleted?: boolean;
}

/** 
 * Legacy format used in the initial version of the app.
 * Retained temporarily to support automatic data migration.
 */
export interface LegacyCalendarEvent {
  date: string;
  type: EventType;
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

/**
 * UI-only feedback type consumed exclusively by Header to display the sync icon.
 * Not a logic state — sync decisions are driven by isOnline, isAuthenticated, remoteFileId.
 * TODO: consider moving closer to Header or renaming to reflect its UI-only purpose.
 */
export interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'offline';
  lastSynced?: Date;
}

export interface GoogleToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at?: number; // Calculated expiration timestamp
}

/**
 * Helper to create a DailyRecord with period data.
 */
export const makePeriodRecord = (date: string, updatedAt = Date.now(), intensity?: FlowIntensity): DailyRecord => ({
  date,
  updatedAt,
  period: intensity ? { intensity } : {}
});

/**
 * Helper to create a DailyRecord with ovulation data.
 */
export const makeOvulationRecord = (date: string, updatedAt = Date.now()): DailyRecord => ({
  date,
  updatedAt,
  ovulation: {}
});
