/**
 * Per-envelope email subject reference.
 *
 * Gmail collapses emails with identical subjects (and participants) into one
 * thread. A cancel-and-resend creates a NEW envelope that usually carries the
 * SAME title, so its approval/signing request landed inside the cancelled
 * contract's dead thread — the approver opened the old email and found no
 * Approve button (#376, Tony, twice).
 *
 * The fix: stamp every request subject with a short code derived from the
 * envelope's creation moment, e.g. `[ref 0910-2141]` (MMDD-HHMM, Pacific —
 * the business timezone). Different envelopes get different codes, so their
 * emails can never merge; reminders and redistributes of the SAME envelope
 * keep the same code, so they still thread with their own contract.
 */

const SUBJECT_REFERENCE_TIME_ZONE = 'America/Los_Angeles';

export const getEnvelopeSubjectReference = (envelopeCreatedAt: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SUBJECT_REFERENCE_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(envelopeCreatedAt);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';

  // `hour12: false` can yield "24" for midnight in some ICU versions — normalise.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `[ref ${get('month')}${get('day')}-${hour}${get('minute')}]`;
};

/**
 * Append the reference to a resolved subject line (custom or default) unless
 * it is somehow already present.
 */
export const appendEnvelopeSubjectReference = (subject: string, envelopeCreatedAt: Date): string => {
  const reference = getEnvelopeSubjectReference(envelopeCreatedAt);

  if (subject.includes(reference)) {
    return subject;
  }

  return `${subject} ${reference}`;
};
