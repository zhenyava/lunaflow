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

// --- Schema validation ---

import * as v from 'valibot';

const FlowIntensitySchema = v.picklist(['light', 'medium', 'heavy', 'spotting']);

export const DailyRecordSchema = v.object({
  date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date format')),
  period: v.optional(v.object({ intensity: v.optional(FlowIntensitySchema) })),
  ovulation: v.optional(
    v.custom<Record<string, never>>((input) => typeof input === 'object' && input !== null && !Array.isArray(input))
  ),
  symptoms: v.optional(v.record(v.string(), v.array(v.string()))),
  updatedAt: v.number(),
  isDeleted: v.optional(v.boolean()),
});

/**
 * Validates an array of unknown values, returning only the records that pass.
 * Invalid records are dropped with a warning.
 */
export const validateDailyRecords = (data: unknown[]): DailyRecord[] => {
  const valid: DailyRecord[] = [];
  for (let i = 0; i < data.length; i++) {
    const result = v.safeParse(DailyRecordSchema, data[i]);
    if (result.success) {
      valid.push(result.output);
    } else {
      console.warn(`[LunaFlow] Dropped invalid record at index ${i}:`, result.issues);
    }
  }
  return valid;
};
