import type Stripe from 'stripe';

import { StripeNotConfiguredError } from '../stub-errors';

export type GetInvoicesOptions = {
  customerId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Invoices require Stripe billing, which is
 * disabled in this fork. Return type preserved (callers read `.data`).
 */
export const getInvoices = async (_options: GetInvoicesOptions): Promise<Stripe.ApiList<Stripe.Invoice>> => {
  throw new StripeNotConfiguredError();
};
