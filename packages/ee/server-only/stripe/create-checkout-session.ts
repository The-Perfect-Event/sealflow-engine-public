import { StripeNotConfiguredError } from '../stub-errors';

export type CreateCheckoutSessionOptions = {
  customerId: string;
  priceId: string;
  returnUrl: string;
};

/**
 * AGPL no-op stub (sealflow#18). Checkout requires Stripe billing, which is
 * disabled in this fork.
 */
export const createCheckoutSession = async (_options: CreateCheckoutSessionOptions): Promise<string> => {
  throw new StripeNotConfiguredError();
};
