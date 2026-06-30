/**
 * Stub error types for the no-op EE modules.
 *
 * The original Documenso Enterprise Edition modules under `packages/ee` were
 * proprietary. In sealflow-engine they are replaced by AGPL-3.0 no-op
 * stubs (see sealflow#18). None of the features they implemented — Stripe
 * billing, plan tiers, CSC/QES signing, SES email domains — are enabled or
 * implemented in this fork.
 *
 * Every real operation in those modules is gated upstream behind a config
 * check (`IS_BILLING_ENABLED()`, `IS_INSTANCE_CSC_MODE()`, `isTspEnvelope()`,
 * a present `subscription`, etc.) that is always false in this deployment, so
 * these throwing stubs are never reached on a correctly-configured instance.
 * If one is reached it means the deployment was misconfigured to advertise a
 * feature it cannot provide — we throw loudly rather than return a silent,
 * data-corrupting no-op.
 */

export class StripeNotConfiguredError extends Error {
  constructor(message = 'Stripe billing is not configured in this deployment.') {
    super(message);
    this.name = 'StripeNotConfiguredError';
  }
}

export class EmailDomainsNotConfiguredError extends Error {
  constructor(message = 'Email domains (SES) are not configured in this deployment.') {
    super(message);
    this.name = 'EmailDomainsNotConfiguredError';
  }
}

export class CscSigningNotConfiguredError extends Error {
  constructor(message = 'CSC/QES signing is not configured in this deployment.') {
    super(message);
    this.name = 'CscSigningNotConfiguredError';
  }
}
