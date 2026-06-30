import { StripeNotConfiguredError } from '../stub-errors';

export type GetPortalSessionOptions = {
  customerId: string;
  returnUrl?: string;
};

/**
 * AGPL no-op stub (sealflow#18). The Stripe billing portal is unavailable in
 * this fork.
 */
export const getPortalSession = async (_options: GetPortalSessionOptions): Promise<string> => {
  throw new StripeNotConfiguredError();
};
