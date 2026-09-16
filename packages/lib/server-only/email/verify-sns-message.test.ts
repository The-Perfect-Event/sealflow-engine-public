import { createSign, generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { TSnsMessage } from './verify-sns-message';
import { buildSnsStringToSign, isValidSigningCertUrl, verifySnsMessageSignature } from './verify-sns-message';

/**
 * #390 — SNS signature verification. Generates a real RSA keypair and a
 * self-signed-style certificate stand-in (public key PEM works with
 * crypto.verify) so the signature path is exercised end to end without
 * network access.
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const signMessage = (message: TSnsMessage, algorithm: 'RSA-SHA1' | 'RSA-SHA256'): string => {
  const signer = createSign(algorithm);
  signer.update(buildSnsStringToSign(message), 'utf8');

  return signer.sign(privateKey, 'base64');
};

const buildNotification = (overrides: Partial<TSnsMessage> = {}): TSnsMessage => {
  const base: TSnsMessage = {
    Type: 'Notification',
    MessageId: 'msg-123',
    TopicArn: 'arn:aws:sns:us-west-1:657636060906:sealflow-email-events',
    Message: '{"eventType":"Bounce"}',
    Timestamp: '2026-09-16T00:00:00.000Z',
    SignatureVersion: '1',
    Signature: '',
    SigningCertURL: 'https://sns.us-west-1.amazonaws.com/SimpleNotificationService-abc.pem',
    ...overrides,
  };

  return { ...base, Signature: signMessage(base, base.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1') };
};

const fetchCertificate = () => Promise.resolve(publicKeyPem);

describe('isValidSigningCertUrl', () => {
  it('accepts the real SNS certificate host over https', () => {
    expect(isValidSigningCertUrl('https://sns.us-west-1.amazonaws.com/cert.pem')).toBe(true);
  });

  it('rejects non-https, non-SNS and lookalike hosts', () => {
    expect(isValidSigningCertUrl('http://sns.us-west-1.amazonaws.com/cert.pem')).toBe(false);
    expect(isValidSigningCertUrl('https://evil.example.com/cert.pem')).toBe(false);
    expect(isValidSigningCertUrl('https://sns.us-west-1.amazonaws.com.evil.com/cert.pem')).toBe(false);
    expect(isValidSigningCertUrl('not a url')).toBe(false);
  });
});

describe('buildSnsStringToSign', () => {
  it('uses the Notification field set in order, skipping absent optionals', () => {
    const message = buildNotification();

    expect(buildSnsStringToSign(message)).toBe(
      `Message\n${message.Message}\n` +
        `MessageId\n${message.MessageId}\n` +
        `Timestamp\n${message.Timestamp}\n` +
        `TopicArn\n${message.TopicArn}\n` +
        `Type\nNotification\n`,
    );
  });

  it('includes Subject when present', () => {
    const message = buildNotification({ Subject: 'Amazon SES Email Event Notification' });

    expect(buildSnsStringToSign(message)).toContain(`Subject\n${message.Subject}\n`);
  });
});

describe('verifySnsMessageSignature', () => {
  it('verifies a correctly signed SignatureVersion 1 message', async () => {
    const message = buildNotification();

    await expect(verifySnsMessageSignature({ message, fetchCertificate })).resolves.toBe(true);
  });

  it('verifies a correctly signed SignatureVersion 2 (SHA256) message', async () => {
    const message = buildNotification({ SignatureVersion: '2' });

    await expect(verifySnsMessageSignature({ message, fetchCertificate })).resolves.toBe(true);
  });

  it('rejects a tampered message', async () => {
    const message = { ...buildNotification(), Message: '{"eventType":"Bounce","forged":true}' };

    await expect(verifySnsMessageSignature({ message, fetchCertificate })).resolves.toBe(false);
  });

  it('rejects a message whose certificate URL is not an SNS host, without fetching', async () => {
    const message = buildNotification({ SigningCertURL: 'https://evil.example.com/cert.pem' });
    // Re-sign so only the URL is the problem.
    message.Signature = signMessage(message, 'RSA-SHA1');

    let fetched = false;

    await expect(
      verifySnsMessageSignature({
        message,
        fetchCertificate: (url: string) => {
          void url;
          fetched = true;
          return Promise.resolve(publicKeyPem);
        },
      }),
    ).resolves.toBe(false);

    expect(fetched).toBe(false);
  });

  it('returns false (not a throw) when the certificate fetch fails', async () => {
    const message = buildNotification();

    await expect(
      verifySnsMessageSignature({
        message,
        fetchCertificate: () => Promise.reject(new Error('network down')),
      }),
    ).resolves.toBe(false);
  });
});
