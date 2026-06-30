import type { Subscription } from '@prisma/client';
import type Stripe from 'stripe';

import { StripeNotConfiguredError } from '../stub-errors';

export type GetSubscriptionOptions = {
  userId: number;
  organisationId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Subscriptions require Stripe billing, which is
 * disabled in this fork.
 *
 * Return type preserved verbatim — the billing settings loader destructures
 * `{ organisationSubscription, stripeSubscription }` (or `null`) — so the
 * import surface keeps type-checking; the body throws.
 */
export const getSubscription = async (
  _options: GetSubscriptionOptions,
): Promise<{
  organisationSubscription: Subscription;
  stripeSubscription: Stripe.Response<Stripe.Subscription>;
} | null> => {
  throw new StripeNotConfiguredError();
};
