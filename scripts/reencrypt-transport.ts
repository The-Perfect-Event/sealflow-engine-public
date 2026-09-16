#!/usr/bin/env node
/**
 * Generalized version of the #308 direct-DB-write fix. fix-email-transport.ts
 * was hardcoded to transport_tpe only — #362 flagged this gap when
 * transport_ats turned out to be orphaned by the same rotation. This takes
 * the target transport id as a CLI arg and the new SMTP_AUTH config as JSON
 * on stdin (host, port, username, password — secure is derived from port
 * unless given explicitly), so it works for any transport regardless of
 * where its credentials come from (global env, Secrets Manager, wherever) —
 * the caller decides that; this script only ever handles the JSON payload
 * it's given, on stdin, never as a CLI arg or env var it reads itself.
 *
 * Same reasoning as #308: no decrypt of the existing stored config — the
 * app's own admin.emailTransport.update mutation can't do this once the
 * key's rotated out from under it (decrypt-then-merge fails with
 * "invalid tag", documented on #308). This replaces the config outright.
 *
 * Standalone by design (same reasons as the other #308/#362 scripts): the
 * production image doesn't ship @documenso/lib's constants/ or
 * @documenso/prisma's raw source, so this uses @noble/ciphers,
 * @noble/hashes, and @prisma/client directly.
 *
 * Usage (inside the container):
 *   echo '{"host":"...","port":587,"username":"...","password":"..."}' \
 *     | npx tsx reencrypt-transport.ts <transport-id> [--apply]
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils';
import { managedNonce } from '@noble/ciphers/webcrypto';
import { sha256 } from '@noble/hashes/sha2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const symmetricEncrypt = ({ key, data }: { key: string; data: string }) => {
  const keyAsBytes = sha256(key);
  const dataAsBytes = utf8ToBytes(data);
  const chacha = managedNonce(xchacha20poly1305)(keyAsBytes);
  return bytesToHex(chacha.encrypt(dataAsBytes));
};

const readStdin = (): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });

const APPLY = process.argv.includes('--apply');
const TRANSPORT_ID = process.argv[2];

const main = async () => {
  if (!TRANSPORT_ID || TRANSPORT_ID.startsWith('--')) {
    throw new Error('Usage: reencrypt-transport.ts <transport-id> [--apply], with JSON config on stdin.');
  }

  const secondaryKey = process.env.NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY;

  if (!secondaryKey) {
    throw new Error('Missing NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY in the environment.');
  }

  const raw = await readStdin();
  const input = JSON.parse(raw);

  const { host, username, password } = input;
  const port = Number(input.port);

  if (!host || !port || !username || !password) {
    throw new Error('stdin JSON must include host, port, username, password.');
  }

  const secure = typeof input.secure === 'boolean' ? input.secure : port === 465;

  const existing = await prisma.emailTransport.findUnique({ where: { id: TRANSPORT_ID } });

  if (!existing) {
    throw new Error(`No EmailTransport row found with id=${TRANSPORT_ID}.`);
  }

  console.log(`Found transport: ${existing.name} (current type=${existing.type})`);

  const config = {
    type: 'SMTP_AUTH' as const,
    host,
    port,
    secure,
    ignoreTLS: false,
    username,
    password,
  };

  const encryptedConfig = symmetricEncrypt({ key: secondaryKey, data: JSON.stringify(config) });

  console.log(
    `${APPLY ? 'Updating' : '[dry-run] Would update'} ${TRANSPORT_ID}: host=${host} port=${port} secure=${secure} username=${username} (password: ${password.length} chars, not shown)`,
  );

  if (APPLY) {
    await prisma.emailTransport.update({
      where: { id: TRANSPORT_ID },
      data: { config: encryptedConfig, type: 'SMTP_AUTH' },
    });
    console.log('Updated.');
  } else {
    console.log('Dry run only — re-run with --apply to write.');
  }

  await prisma.$disconnect();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
