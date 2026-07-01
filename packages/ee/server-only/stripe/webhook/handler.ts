/**
 * AGPL no-op stub (sealflow#18) replacing the proprietary Documenso EE Stripe
 * webhook handler.
 *
 * Stripe billing is disabled in this fork, so there is no webhook to process.
 * The route stays mounted (to preserve the import surface) but always responds
 * 501 Not Implemented — no webhook secret, no signature verification, no
 * upstream billing endpoints.
 */
export const stripeWebhookHandler = async (_req: Request): Promise<Response> => {
  return new Response('Stripe billing is not configured in this deployment.', {
    status: 501,
  });
};
