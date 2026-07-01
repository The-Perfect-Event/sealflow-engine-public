import { StripeNotConfiguredError } from '../stub-errors';

export type SyncStripeCustomerSubscriptionOptions = {
  customerId: string;

  /**
   * When true, the organisationClaim will not be synced.
   *
   * Used by the admin sync route to update only the Subscription
   * row while leaving claim entitlements untouched.
   */
  bypassClaimUpdate?: boolean;
};

/**
 * AGPL no-op stub (sealflow#18). Subscription sync requires Stripe billing,
 * which is disabled in this fork.
 */
export const syncStripeCustomerSubscription = async (_options: SyncStripeCustomerSubscriptionOptions) => {
  throw new StripeNotConfiguredError();
};
