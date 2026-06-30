import { Hono } from 'hono';

/**
 * AGPL no-op stub (sealflow#18) replacing the proprietary Documenso EE CSC
 * OAuth/signing Hono sub-app.
 *
 * CSC/QES signing is disabled in this fork. The app stays mounted (so
 * `apps/remix/server/router.ts` keeps type-checking and routing) but every
 * route responds 501 Not Implemented.
 */
export const csc = new Hono().all('*', (c) => {
  return c.text('CSC/QES signing is not configured in this deployment.', 501);
});

export type CscAppType = typeof csc;
