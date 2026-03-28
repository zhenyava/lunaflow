import { describe, it, expect } from 'vitest';
import symptomsData from './symptoms.json';
import type { SymptomCategory, SymptomOption } from '../store/DailyRecord';

describe('Symptoms JSON Configuration', () => {
  it('should have a valid structure', () => {
    expect(symptomsData).toHaveProperty('categories');
    expect(Array.isArray(symptomsData.categories)).toBe(true);

    symptomsData.categories.forEach((category: SymptomCategory) => {
      expect(typeof category.id).toBe('string');
      expect(typeof category.name).toBe('string');
      expect(typeof category.color).toBe('string');
      expect(Array.isArray(category.options)).toBe(true);

      category.options.forEach((option: SymptomOption) => {
        expect(typeof option.id).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });
  });

  it('should have unique category ids', () => {
    const categoryIds = symptomsData.categories.map((c: SymptomCategory) => c.id);
    const uniqueIds = new Set(categoryIds);
    expect(uniqueIds.size).toBe(categoryIds.length);
  });

  it('should have unique category names', () => {
    const categoryNames = symptomsData.categories.map((c: SymptomCategory) => c.name);
    const uniqueNames = new Set(categoryNames);
    expect(uniqueNames.size).toBe(categoryNames.length);
  });

  it('should have unique option ids within each category', () => {
    symptomsData.categories.forEach((category: SymptomCategory) => {
      const optionIds = category.options.map((o: SymptomOption) => o.id);
      const uniqueOptionIds = new Set(optionIds);
      expect(uniqueOptionIds.size).toBe(optionIds.length);
    });
  });

  it('should have valid CSS hex codes for category colors', () => {
    const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    symptomsData.categories.forEach((category: SymptomCategory) => {
      expect(hexColorRegex.test(category.color)).toBe(true);
    });
  });
});
