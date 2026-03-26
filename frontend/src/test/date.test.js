import { describe, it, expect } from 'vitest';
import { parseLocalDate } from '../utils/date.js';

describe('parseLocalDate', () => {
  it('parses a valid YYYY-MM-DD date into correct year/month/day', () => {
    const d = parseLocalDate('2025-09-01');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(8); // 0-indexed: September = 8
    expect(d.getDate()).toBe(1);
  });

  it('parses Jan 1st correctly', () => {
    const d = parseLocalDate('2024-01-01');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('parses Dec 31st correctly', () => {
    const d = parseLocalDate('2023-12-31');
    expect(d.getFullYear()).toBe(2023);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });

  it('returns Date(NaN) for empty string — no throw', () => {
    const d = parseLocalDate('');
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('returns Date(NaN) for null — no throw', () => {
    const d = parseLocalDate(null);
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('returns Date(NaN) for undefined — no throw', () => {
    const d = parseLocalDate(undefined);
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('returns Date(NaN) for non-date string', () => {
    const d = parseLocalDate('hello world');
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('returns Date(NaN) for partial date string (missing day)', () => {
    const d = parseLocalDate('2025-09');
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('returns Date(NaN) for numeric input', () => {
    const d = parseLocalDate(20250901);
    expect(isNaN(d.getTime())).toBe(true);
  });
});
