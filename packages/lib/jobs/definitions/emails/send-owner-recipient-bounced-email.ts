import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_ID = 'send.owner.recipient.bounced.email';

const SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  recipientId: z.number(),
  envelopeId: z.string(),
});

export type TSendOwnerRecipientBouncedEmailJobDefinition = z.infer<
  typeof SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION = {
  id: SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Owner Recipient Bounced Email',
  version: '1.0.0',
  trigger: {
    name: SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-owner-recipient-bounced-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_OWNER_RECIPIENT_BOUNCED_EMAIL_JOB_DEFINITION_ID,
  TSendOwnerRecipientBouncedEmailJobDefinition
>;
