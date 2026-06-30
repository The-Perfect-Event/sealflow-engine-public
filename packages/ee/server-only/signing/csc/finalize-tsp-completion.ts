import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { CreateDocumentAuditLogDataResponse } from '@documenso/lib/utils/document-audit-logs';
import type { DocumentData, DocumentMeta, Envelope, EnvelopeItem, Recipient, User } from '@prisma/client';

import { CscSigningNotConfiguredError } from '../../stub-errors';

export type FinalizeTspEnvelopeCompletionOptions = {
  envelope: Envelope & {
    documentMeta: DocumentMeta | null;
    recipients: Recipient[];
    envelopeItems: Array<EnvelopeItem & { documentData: DocumentData }>;
    user: Pick<User, 'name' | 'email'>;
  };
  envelopeCompletedAuditLog: CreateDocumentAuditLogDataResponse;
  requestMetadata?: RequestMetadata;
};

/**
 * AGPL no-op stub (sealflow#18).
 *
 * The seal-document job calls this ONLY inside an `if (isTspEnvelope(envelope))`
 * branch (see `seal-document.handler.ts`, a frozen path). TSP (AES/QES)
 * envelopes only exist when a CSC provider is configured, which never happens
 * in this fork — so this branch is dead in production.
 *
 * Critically, we THROW rather than return: a silent no-op here would let the
 * seal job flip the envelope to COMPLETED without ever applying the PAdES
 * B-LTA archival upgrade, producing an envelope that claims to be sealed but
 * is not. Throwing fails the job loudly and leaves the envelope un-completed,
 * which is the safe failure mode. (We do not touch the frozen seal handler;
 * only the implementation it imports changes.)
 */
export const finalizeTspEnvelopeCompletion = async (_options: FinalizeTspEnvelopeCompletionOptions): Promise<void> => {
  throw new CscSigningNotConfiguredError();
};
