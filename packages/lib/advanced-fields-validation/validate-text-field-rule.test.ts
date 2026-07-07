import { describe, expect, it } from 'vitest';

import { isTextFieldValueValid } from './validate-text-field-rule';

describe('isTextFieldValueValid', () => {
  it('accepts anything when there is no rule', () => {
    expect(isTextFieldValueValid('literally anything', undefined)).toBe(true);
    expect(isTextFieldValueValid('literally anything', 'none')).toBe(true);
    expect(isTextFieldValueValid('', 'none')).toBe(true);
  });

  it('validates email format', () => {
    expect(isTextFieldValueValid('dan@busamerican.com', 'email')).toBe(true);
    expect(isTextFieldValueValid('  dan@theperfectevent.com  ', 'email')).toBe(true);
    expect(isTextFieldValueValid('not-an-email', 'email')).toBe(false);
    expect(isTextFieldValueValid('missing@domain', 'email')).toBe(false);
    expect(isTextFieldValueValid('', 'email')).toBe(false);
  });

  it('validates date format (US-first, plus common variants + ISO)', () => {
    expect(isTextFieldValueValid('07/04/2026', 'date')).toBe(true);
    expect(isTextFieldValueValid('7/4/2026', 'date')).toBe(true);
    expect(isTextFieldValueValid('2026-07-04', 'date')).toBe(true);
    expect(isTextFieldValueValid('not a date', 'date')).toBe(false);
    expect(isTextFieldValueValid('13/45/2026', 'date')).toBe(false);
    expect(isTextFieldValueValid('', 'date')).toBe(false);
  });
});
