import { getCertificateStatus } from '@documenso/lib/server-only/cert/cert-status';
import { isRedisReachable } from '@documenso/lib/server-only/redis/redis-status';
import { prisma } from '@documenso/prisma';

type CheckStatus = 'ok' | 'warning' | 'error';

/**
 * Readiness check — verifies the dependencies this instance actually needs to
 * do useful work: PostgreSQL and Redis (BullMQ reminders/sealing crons), plus
 * the signing certificate. Point synthetic monitoring here, not /api/health —
 * this one does real dependency calls and is not meant to be hit on every ALB
 * health-check tick.
 *
 * No Chromium/Playwright check: certificate and audit-log PDF generation are
 * both `@deprecated` in favour of Konva rendering, and nothing in the live
 * request path calls chromium.launch() anymore.
 */
export const loader = async () => {
  const checks: {
    database: { status: CheckStatus };
    redis: { status: CheckStatus };
    certificate: { status: CheckStatus };
  } = {
    database: { status: 'ok' },
    redis: { status: 'ok' },
    certificate: { status: 'ok' },
  };

  let overallStatus: CheckStatus = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = { status: 'error' };
    overallStatus = 'error';
  }

  if (!(await isRedisReachable())) {
    checks.redis = { status: 'error' };
    overallStatus = 'error';
  }

  try {
    const certStatus = getCertificateStatus();

    if (certStatus.isAvailable) {
      checks.certificate = { status: 'ok' };
    } else {
      checks.certificate = { status: 'warning' };

      if (overallStatus === 'ok') {
        overallStatus = 'warning';
      }
    }
  } catch {
    checks.certificate = { status: 'error' };
    overallStatus = 'error';
  }

  return Response.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: overallStatus === 'error' ? 500 : 200 },
  );
};
