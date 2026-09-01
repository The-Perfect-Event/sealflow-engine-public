import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { zEmail } from '../utils/zod';

export const ZDefaultRecipientSchema = z.object({
  email: zEmail(),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  // Optional position in the signing sequence. When set on any default
  // recipient (e.g. an APPROVER an org wants to review before the signer),
  // the envelope is forced to SEQUENTIAL and these recipients are placed
  // ahead of the sender's own recipients (org-level pre-signature approval).
  signingOrder: z.number().int().optional(),
});

export type TDefaultRecipient = z.infer<typeof ZDefaultRecipientSchema>;

export const ZDefaultRecipientsSchema = z.array(ZDefaultRecipientSchema);

export type TDefaultRecipients = z.infer<typeof ZDefaultRecipientsSchema>;
