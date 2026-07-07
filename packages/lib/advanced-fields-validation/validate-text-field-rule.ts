import { DateTime } from 'luxon';

import type { TTextFieldValidationRule } from '../types/field-meta';

/**
 * Date input formats accepted for a Text field with the `date` validation rule.
 * US format leads (matches the platform default); a couple of common variants
 * plus ISO are also accepted so signers aren't fighting the parser.
 */
const ACCEPTED_DATE_FORMATS = ['MM/dd/yyyy', 'M/d/yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'] as const;

/**
 * Whether a signer's typed value satisfies a Text field's validation rule.
 *
 * `none`/undefined accepts anything (a plain Text field). `email` / `date`
 * enforce format on signer input — the opt-in "validated field" from AC#5.
 * Pure and side-effect free; callers supply the localized error message.
 */
export const isTextFieldValueValid = (value: string, rule: TTextFieldValidationRule | undefined): boolean => {
  if (!rule || rule === 'none') {
    return true;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return false;
  }

  if (rule === 'email') {
    // Permissive local@domain.tld check — deliberately not RFC-exhaustive.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  if (rule === 'date') {
    return (
      ACCEPTED_DATE_FORMATS.some((format) => DateTime.fromFormat(trimmed, format).isValid) ||
      DateTime.fromISO(trimmed).isValid
    );
  }

  return true;
};
