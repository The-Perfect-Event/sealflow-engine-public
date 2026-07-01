import type { OrganisationClaim, Subscription } from '@prisma/client';

import { StripeNotConfiguredError } from '../stub-errors';

export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity: number;
  priceId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Stripe billing is disabled in this fork.
 */
export const updateSubscriptionItemQuantity = async (_options: UpdateSubscriptionItemQuantityOptions) => {
  throw new StripeNotConfiguredError();
};

/**
 * Seat-cap enforcement no-op.
 *
 * Called from the organisation member-invite flow, but only inside an
 * `if (subscription)` guard. A `subscription` row only exists when Stripe
 * billing is enabled, which it never is in this fork — so this never runs.
 * sealflow has no seat caps (every tenant is unlimited), so the correct
 * behaviour even if reached is to allow the invite: return without throwing.
 */
export const assertMemberCountWithinCap = async (
  _subscription: Subscription,
  _organisationClaim: OrganisationClaim,
  _quantity: number,
): Promise<void> => {
  return;
};

/**
 * Seat-count → Stripe sync no-op.
 *
 * Same `if (subscription)` gating as {@link assertMemberCountWithinCap}; with
 * no Stripe seat plan there is nothing to sync, so this is a safe no-op rather
 * than a throw (it sits on the success path of member invite / removal).
 */
export const syncMemberCountWithStripeSeatPlan = async (
  _subscription: Subscription,
  _organisationClaim: OrganisationClaim,
  _quantity: number,
): Promise<void> => {
  return;
};
