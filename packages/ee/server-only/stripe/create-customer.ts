import type Stripe from 'stripe';

import { StripeNotConfiguredError } from '../stub-errors';

type CreateCustomerOptions = {
  name: string;
  email: string;
};

/**
 * AGPL no-op stub (sealflow#18). Billing is disabled in this fork; every caller
 * is gated behind `IS_BILLING_ENABLED()`, which is always false here, so this
 * is never reached on a correctly-configured instance.
 *
 * Return type preserved (`Stripe.Customer`, callers read `.id`) so the import
 * surface keeps type-checking; the body throws rather than producing a value.
 */
export const createCustomer = async (_options: CreateCustomerOptions): Promise<Stripe.Customer> => {
  throw new StripeNotConfiguredError();
};
