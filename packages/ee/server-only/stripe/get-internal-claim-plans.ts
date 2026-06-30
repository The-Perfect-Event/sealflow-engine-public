import type { INTERNAL_CLAIM_ID, InternalClaim } from '@documenso/lib/types/subscription';
import type Stripe from 'stripe';

import { StripeNotConfiguredError } from '../stub-errors';

/**
 * Preserved verbatim so the UI components and tRPC procedures that import this
 * type keep type-checking. The stub never produces a value of this type — it
 * exists purely for the import surface (sealflow#18).
 */
export type InternalClaimPlans = {
  [key in INTERNAL_CLAIM_ID]: InternalClaim & {
    monthlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
    yearlyPrice?: Stripe.Price & {
      product: Stripe.Product;
      isVisibleInApp: boolean;
      friendlyPrice: string;
    };
  };
};

/**
 * AGPL no-op stub (sealflow#18). Plan listing requires Stripe billing, which is
 * disabled in this fork.
 */
export const getInternalClaimPlans = async (): Promise<InternalClaimPlans> => {
  throw new StripeNotConfiguredError();
};
