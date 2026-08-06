/**
 * Liveness check — process is up and serving requests. No dependency calls
 * (DB/Redis/etc.) on purpose: this is what the load balancer / orchestrator
 * should poll to decide whether to route traffic to this instance at all.
 * For an actual readiness check (DB + Redis reachable), see /api/health/deep.
 */
export const loader = () => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};
