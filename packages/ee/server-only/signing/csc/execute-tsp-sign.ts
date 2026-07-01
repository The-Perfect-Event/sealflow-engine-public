import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { CscSigningNotConfiguredError } from '../../stub-errors';

export type ExecuteTspSignOptions = {
  sessionId: string;
  recipientToken: string;
  requestMetadata?: RequestMetadata;
};

export type ExecuteTspSignResult = { outcome: 'signed' } | { outcome: 'already_signed' };

/**
 * AGPL no-op stub (sealflow#18).
 *
 * Only invoked from the enterprise CSC-sign route. CSC/QES signing is disabled
 * in this fork, so this is unreachable on a correctly-configured instance.
 */
export const executeTspSign = async (_options: ExecuteTspSignOptions): Promise<ExecuteTspSignResult> => {
  throw new CscSigningNotConfiguredError();
};
