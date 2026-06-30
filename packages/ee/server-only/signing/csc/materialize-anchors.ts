import { CscSigningNotConfiguredError } from '../../stub-errors';

export type MaterializeTspAnchorsForEnvelopeOptions = {
  envelopeId: string;
};

/**
 * AGPL no-op stub (sealflow#18).
 *
 * Only invoked from `send-document` behind an `isTspEnvelope(envelope)` guard.
 * TSP (AES/QES) envelopes can only be created when a CSC provider is
 * configured, which never happens in this fork — so this is unreachable on a
 * correctly-configured instance. We throw (rather than no-op) so a
 * misconfiguration fails loudly instead of producing an unsealed envelope.
 */
export const materializeTspAnchorsForEnvelope = async (_options: MaterializeTspAnchorsForEnvelopeOptions) => {
  throw new CscSigningNotConfiguredError();
};
