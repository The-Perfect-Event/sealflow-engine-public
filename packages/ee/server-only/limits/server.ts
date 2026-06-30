import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, SELFHOSTED_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

/**
 * AGPL no-op stub replacing the proprietary Documenso EE plan-tier limits
 * (see sealflow#18).
 *
 * sealflow has no billing, no plans and no subscriptions: every tenant is an
 * internal, unlimited tenant. Upstream `getServerLimits` already returned
 * `SELFHOSTED_PLAN_LIMITS` (unlimited) whenever `IS_BILLING_ENABLED()` was
 * false — which is always the case here — so this stub hardcodes that branch
 * and drops the Stripe / subscription / organisation-claim coupling entirely.
 *
 * `userId` / `teamId` are kept on the signature so the 6 callers and the
 * `/api/limits` handler keep type-checking unchanged.
 */
export const getServerLimits = async (_options: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  return {
    quota: SELFHOSTED_PLAN_LIMITS,
    remaining: SELFHOSTED_PLAN_LIMITS,
    maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
  };
};
