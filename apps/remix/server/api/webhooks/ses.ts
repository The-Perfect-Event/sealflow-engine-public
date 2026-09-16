import { processSesEmailEvent } from '@documenso/lib/server-only/email/process-ses-email-event';
import { verifySnsMessageSignature, ZSnsMessageSchema } from '@documenso/lib/server-only/email/verify-sns-message';
import { Hono } from 'hono';

import type { HonoEnv } from '../../router';

/**
 * Inbound AWS SNS webhook carrying SES email events (bounces, complaints)
 * for mail the engine sent (#390).
 *
 * Security: the endpoint is public by necessity, so every request must carry
 * a valid SNS signature (verified against Amazon's signing certificate, whose
 * URL must itself be an https SNS host). Invalid or unsigned payloads get a
 * 400 and are never processed.
 *
 * Behavior notes:
 * - SubscriptionConfirmation: confirmed automatically by fetching the
 *   SubscribeURL, so wiring the SNS topic to this endpoint needs no manual
 *   confirmation step.
 * - Notification: handed to processSesEmailEvent. Always answered 200 once
 *   the signature checks out, even for events we ignore or cannot attribute —
 *   SNS retries non-2xx responses aggressively, and a malformed event will
 *   never become processable.
 */
export const sesWebhookRoute = new Hono<HonoEnv>().post('/', async (c) => {
  const log = c.get('logger').child({ module: 'ses-webhook' });

  let parsedBody: unknown;

  try {
    // SNS posts JSON with Content-Type text/plain — always read as text.
    parsedBody = JSON.parse(await c.req.text());
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const messageResult = ZSnsMessageSchema.safeParse(parsedBody);

  if (!messageResult.success) {
    return c.json({ error: 'Not an SNS message' }, 400);
  }

  const message = messageResult.data;

  const isSignatureValid = await verifySnsMessageSignature({ message });

  if (!isSignatureValid) {
    log.warn({ messageId: message.MessageId, type: message.Type }, 'SNS message failed signature verification');

    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (message.Type === 'SubscriptionConfirmation') {
    if (!message.SubscribeURL) {
      return c.json({ error: 'Missing SubscribeURL' }, 400);
    }

    const response = await fetch(message.SubscribeURL);

    log.info({ topicArn: message.TopicArn, confirmed: response.ok }, 'SNS subscription confirmation processed');

    return c.json({ success: response.ok });
  }

  if (message.Type === 'Notification') {
    const result = await processSesEmailEvent(message.Message);

    return c.json({ success: true, kind: result.kind });
  }

  // UnsubscribeConfirmation — acknowledge, nothing to do.
  return c.json({ success: true });
});
