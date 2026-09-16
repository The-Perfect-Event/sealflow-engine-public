import { createVerify } from 'node:crypto';

import { z } from 'zod';

/**
 * AWS SNS message verification for the SES events webhook (#390).
 *
 * SNS signs every delivered message; the webhook must verify the signature
 * before trusting the payload, since the endpoint is necessarily public.
 * Implemented with node:crypto (no new dependency), following the documented
 * SNS scheme: rebuild the canonical string-to-sign from a fixed field list
 * per message type, fetch the signing certificate from the URL the message
 * names (which must be an https amazonaws.com SNS host), and verify the
 * RSA signature (SignatureVersion 1 = SHA1, 2 = SHA256).
 */

export const ZSnsMessageSchema = z.object({
  Type: z.enum(['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation']),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  SignatureVersion: z.string(),
  Signature: z.string(),
  SigningCertURL: z.string(),
  Subject: z.string().optional(),
  Token: z.string().optional(),
  SubscribeURL: z.string().optional(),
});

export type TSnsMessage = z.infer<typeof ZSnsMessageSchema>;

/**
 * The exact fields (in byte order) that participate in the string-to-sign,
 * per message type, from the SNS verification spec. Optional fields are only
 * included when present.
 */
const SIGNED_FIELDS_BY_TYPE: Record<TSnsMessage['Type'], string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

export const buildSnsStringToSign = (message: TSnsMessage): string => {
  const fields = SIGNED_FIELDS_BY_TYPE[message.Type];

  let stringToSign = '';

  for (const field of fields) {
    const value = message[field as keyof TSnsMessage];

    if (typeof value === 'string') {
      stringToSign += `${field}\n${value}\n`;
    }
  }

  return stringToSign;
};

/**
 * The signing certificate may only come from an SNS endpoint over https —
 * anything else means a forged message pointing at an attacker's cert.
 */
export const isValidSigningCertUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);

    return url.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};

export type VerifySnsMessageOptions = {
  message: TSnsMessage;
  /**
   * Injectable certificate fetcher for tests. Defaults to fetching the
   * SigningCertURL over https.
   */
  fetchCertificate?: (url: string) => Promise<string>;
};

const defaultFetchCertificate = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch SNS signing certificate: HTTP ${response.status}`);
  }

  return await response.text();
};

/**
 * Verify an SNS message's signature. Returns true only when the certificate
 * URL is a legitimate SNS host AND the RSA signature over the canonical
 * string-to-sign checks out against that certificate.
 */
export const verifySnsMessageSignature = async ({
  message,
  fetchCertificate = defaultFetchCertificate,
}: VerifySnsMessageOptions): Promise<boolean> => {
  if (!isValidSigningCertUrl(message.SigningCertURL)) {
    return false;
  }

  const algorithm = message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';

  try {
    const certificate = await fetchCertificate(message.SigningCertURL);

    const verifier = createVerify(algorithm);
    verifier.update(buildSnsStringToSign(message), 'utf8');

    return verifier.verify(certificate, message.Signature, 'base64');
  } catch {
    return false;
  }
};
