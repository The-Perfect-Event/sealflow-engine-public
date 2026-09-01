/**
 * Ordering rule for org-level default recipients (pre-signature approval).
 *
 * An organisation can configure a default recipient — typically an APPROVER —
 * that must act before the sender's own recipients (e.g. Tony reviews and
 * approves a contract before it reaches Dan for signature). That intent is
 * expressed by giving the default recipient a `signingOrder`.
 *
 * When any default recipient carries an explicit `signingOrder`, this places
 * those recipients ahead of the sender's recipients — the sender's are shifted
 * to sit strictly after the highest default order — and signals that the
 * envelope must be SEQUENTIAL so the engine's turn-gating only releases the
 * signer once the approver has acted.
 *
 * When no default recipient specifies an order, this is a no-op: recipients are
 * returned untouched and `forceSequential` is false, so existing behaviour for
 * every other org is byte-for-byte unchanged.
 */
export type OrderableRecipient = { signingOrder?: number | null };

export const computeDefaultRecipientOrdering = <Sender extends OrderableRecipient, Default extends OrderableRecipient>(
  senderRecipients: Sender[],
  defaultRecipients: Default[],
): {
  senderRecipients: Sender[];
  defaultRecipients: Default[];
  forceSequential: boolean;
} => {
  const orderedDefaults = defaultRecipients.filter((recipient) => typeof recipient.signingOrder === 'number');

  // No default recipient opts into ordering → leave everything exactly as-is.
  if (orderedDefaults.length === 0) {
    return { senderRecipients, defaultRecipients, forceSequential: false };
  }

  const maxDefaultOrder = Math.max(...orderedDefaults.map((recipient) => recipient.signingOrder as number));

  // Shift the sender's recipients to sit strictly after the highest default
  // order, preserving their given (or positional) order. A sender recipient
  // with no explicit order falls back to its 1-based index.
  const shiftedSenders = senderRecipients.map((recipient, index) => ({
    ...recipient,
    signingOrder: (typeof recipient.signingOrder === 'number' ? recipient.signingOrder : index + 1) + maxDefaultOrder,
  }));

  return { senderRecipients: shiftedSenders, defaultRecipients, forceSequential: true };
};
