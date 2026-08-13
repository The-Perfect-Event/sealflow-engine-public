import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const cancelEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/cancel',
    summary: 'Cancel envelope',
    tags: ['Envelope'],
  },
};

export const ZCancelEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  reason: z.string().optional(),
  /**
   * Whether to email recipients about the cancellation. Defaults to true.
   * Set false for housekeeping cancellations the recipients should not hear
   * about — e.g. voiding a live envelope because a hard-signed copy was
   * uploaded, where a "cancelled" notice would contradict what just happened.
   */
  sendEmail: z.boolean().optional(),
});

export const ZCancelEnvelopeResponseSchema = ZSuccessResponseSchema;

export type TCancelEnvelopeRequest = z.infer<typeof ZCancelEnvelopeRequestSchema>;
export type TCancelEnvelopeResponse = z.infer<typeof ZCancelEnvelopeResponseSchema>;
