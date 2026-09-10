import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

export type BuildEnvelopeEmailHeadersOptions = {
  userId: number;
  envelopeId: string;
  teamId: number;
};

const getMessageIdHost = (): string => {
  try {
    return new URL(NEXT_PUBLIC_WEBAPP_URL() || 'https://sealflow.local').hostname;
  } catch {
    return 'sealflow.local';
  }
};

/**
 * Builds headers stamped onto outgoing envelope emails.
 *
 * Sender attribution (X-Sealflow-*): opaque IDs that appear in AWS SES
 * bounce/complaint notifications (when "include original headers" is enabled)
 * so an abusive send can be traced back to the originating Sealflow user via
 * the admin panel. Only opaque IDs are included so recipients cannot see the
 * sender's email address or name in the delivered message source.
 *
 * Threading (References / X-Entity-Ref-ID): every email about one envelope
 * references the same synthetic per-envelope root message-id. Since Gmail's
 * 2019 "definite relationship" threading model, a message carrying a
 * References header is only threaded with messages it explicitly references —
 * so one envelope's emails thread together, and a cancel-and-resend (a NEW
 * envelope with the same title) can never collapse into the cancelled
 * contract's thread (#376, Tony, twice). Without these headers Gmail falls
 * back to same-subject-and-sender grouping, which is exactly what merged the
 * two contracts. X-Entity-Ref-ID is the complementary grouping hint some
 * clients honour. No visible subject clutter.
 */
export const buildEnvelopeEmailHeaders = ({
  userId,
  envelopeId,
  teamId,
}: BuildEnvelopeEmailHeadersOptions): Record<string, string> => {
  const threadRootMessageId = `<${envelopeId}@${getMessageIdHost()}>`;

  return {
    'X-Sealflow-Sender-User-Id': String(userId),
    'X-Sealflow-Envelope-Id': envelopeId,
    'X-Sealflow-Team-Id': String(teamId),
    References: threadRootMessageId,
    'X-Entity-Ref-ID': envelopeId,
  };
};
