import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { CscSigningNotConfiguredError } from '../../stub-errors';

export type PrepareCscRecipientSigningOptions = {
  /** Recipient token from `/sign/{token}` URL. */
  recipientToken: string;
  /** Forwarded for audit log attribution. */
  requestMetadata?: RequestMetadata;
};

export type PrepareCscRecipientSigningResult = {
  status: 'REDIRECT';
  redirectUrl: string;
};

/**
 * AGPL no-op stub (sealflow#18).
 *
 * Only invoked from the recipient router behind a CSC-mode guard. CSC/QES
 * signing is disabled in this fork, so this is unreachable on a
 * correctly-configured instance.
 */
export const prepareCscRecipientSigning = async (
  _options: PrepareCscRecipientSigningOptions,
): Promise<PrepareCscRecipientSigningResult> => {
  throw new CscSigningNotConfiguredError();
};
