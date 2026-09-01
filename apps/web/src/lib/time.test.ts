import { describe, it, expect } from 'vitest';
import {
  dayName,
  formatMinutesAsWeeklyHours,
  formatMinutesOfDay,
  formatShiftWindow,
  parseMinutesOfDay,
} from './time';

/**
 * Hand-computed display expectations. The rest of the app never formats
 * times — this file is the domain rule's enforcement point.
 */
describe('time utility', () => {
  describe('dayName', () => {
    it('maps day 0 to Monday and day 6 to Sunday', () => {
      expect(dayName(0)).toBe('Monday');
      expect(dayName(4)).toBe('Friday');
      expect(dayName(5)).toBe('Saturday');
      expect(dayName(6)).toBe('Sunday');
    });

    it('throws on an out-of-range day', () => {
      expect(() => dayName(7)).toThrow(RangeError);
      expect(() => dayName(-1)).toThrow(RangeError);
    });
  });

  describe('formatMinutesOfDay', () => {
    it('formats known minutes by hand-computed expectations', () => {
      expect(formatMinutesOfDay(0)).toBe('00:00');
      expect(formatMinutesOfDay(480)).toBe('08:00');
      expect(formatMinutesOfDay(541)).toBe('09:01');
      expect(formatMinutesOfDay(720)).toBe('12:00');
      expect(formatMinutesOfDay(1439)).toBe('23:59');
      expect(formatMinutesOfDay(1440)).toBe('24:00');
    });

    it('throws on invalid minutes', () => {
      expect(() => formatMinutesOfDay(-1)).toThrow(RangeError);
      expect(() => formatMinutesOfDay(1441)).toThrow(RangeError);
      expect(() => formatMinutesOfDay(90.5)).toThrow(RangeError);
    });
  });

  describe('parseMinutesOfDay', () => {
    it('round-trips formatted values', () => {
      expect(parseMinutesOfDay('08:00')).toBe(480);
      expect(parseMinutesOfDay('09:01')).toBe(541);
      expect(parseMinutesOfDay('23:59')).toBe(1439);
      expect(parseMinutesOfDay('24:00')).toBe(1440);
      expect(parseMinutesOfDay(formatMinutesOfDay(777))).toBe(777);
    });

    it('throws on malformed input', () => {
      expect(() => parseMinutesOfDay('8:00')).toThrow(RangeError);
      expect(() => parseMinutesOfDay('08:60')).toThrow(RangeError);
      expect(() => parseMinutesOfDay('25:00')).toThrow(RangeError);
      expect(() => parseMinutesOfDay('eight')).toThrow(RangeError);
    });
  });

  describe('formatShiftWindow', () => {
    it('formats a window with an en dash', () => {
      expect(formatShiftWindow({ startMinute: 480, endMinute: 720 })).toBe('08:00–12:00');
      expect(formatShiftWindow({ startMinute: 1260, endMinute: 1440 })).toBe('21:00–24:00');
    });
  });

  describe('formatMinutesAsWeeklyHours', () => {
    it('formats caps as hours', () => {
      expect(formatMinutesAsWeeklyHours(60)).toBe('1 h');
      expect(formatMinutesAsWeeklyHours(2400)).toBe('40 h');
      expect(formatMinutesAsWeeklyHours(2405)).toBe('40.08 h');
    });

    it('throws on invalid amounts', () => {
      expect(() => formatMinutesAsWeeklyHours(0)).toThrow(RangeError);
      expect(() => formatMinutesAsWeeklyHours(-5)).toThrow(RangeError);
    });
  });
});
