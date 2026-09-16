#!/usr/bin/env node
/**
 * One-off remediation for the 2026-09-01 key-rotation incident (issue #308):
 * both ENCRYPTION_KEY and ENCRYPTION_SECONDARY_KEY were rotated at once, with
 * no bridge, leaving 2FA secrets encrypted under a primary key that no
 * longer exists in .env. This decrypts twoFactorSecret / twoFactorBackupCodes
 * with the OLD primary key and re-encrypts them under the current one, so
 * affected users don't have to be locked out or forced to re-enroll.
 *
 * Standalone by design: meant to run inside the production container itself
 * (via `docker cp` + `npx tsx`), which ships a pruned image — @documenso/lib
 * only includes client-only/server-only/universal (per its package.json
 * "files" field), and @documenso/prisma's raw source isn't present at all.
 * So this reimplements the small bit of crypto logic directly against
 * @noble/ciphers + @noble/hashes (matching packages/lib/universal/crypto.ts
 * exactly) and talks to the DB via @prisma/client directly, both of which
 * are real installed dependencies rather than pruned workspace source.
 *
 * Usage (inside the container):
 *   OLD_ENCRYPTION_KEY=<old primary key> npx tsx recrypt-2fa-secrets.ts [--apply]
 *
 * Without --apply this only reports what it would do. The current primary
 * key is read from NEXT_PRIVATE_ENCRYPTION_KEY, which is already set in the
 * container's environment by docker-compose — never touched or changed here.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
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

const symmetricDecrypt = ({ key, data }: { key: string; data: string }) => {
  const keyAsBytes = sha256(key);
  const dataAsBytes = hexToBytes(data);
  const chacha = managedNonce(xchacha20poly1305)(keyAsBytes);
  return chacha.decrypt(dataAsBytes);
};

const APPLY = process.argv.includes('--apply');

const decryptWith = (key: string, data: string) => Buffer.from(symmetricDecrypt({ key, data })).toString('utf-8');

const main = async () => {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const currentKey = process.env.NEXT_PRIVATE_ENCRYPTION_KEY;

  if (!oldKey) {
    throw new Error('OLD_ENCRYPTION_KEY env var is required (the pre-rotation primary key).');
  }

  if (!currentKey) {
    throw new Error('Missing current NEXT_PRIVATE_ENCRYPTION_KEY in the environment.');
  }

  if (oldKey === currentKey) {
    throw new Error('OLD_ENCRYPTION_KEY is identical to the current key — refusing to run.');
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ twoFactorSecret: { not: null } }, { twoFactorBackupCodes: { not: null } }],
    },
    select: { id: true, email: true, twoFactorSecret: true, twoFactorBackupCodes: true },
  });

  console.log(`Found ${users.length} user(s) with 2FA data set.`);

  let migrated = 0;
  let alreadyCurrent = 0;
  let failed = 0;

  for (const user of users) {
    // Already decryptable under the current key — nothing to do (safe to re-run this script).
    try {
      if (user.twoFactorSecret) {
        decryptWith(currentKey, user.twoFactorSecret);
      }
      if (user.twoFactorBackupCodes) {
        decryptWith(currentKey, user.twoFactorBackupCodes);
      }

      alreadyCurrent++;
      continue;
    } catch {
      // Not decryptable under the current key — expected for pre-rotation users, fall through.
    }

    try {
      const newTwoFactorSecret = user.twoFactorSecret
        ? symmetricEncrypt({ key: currentKey, data: decryptWith(oldKey, user.twoFactorSecret) })
        : null;

      const newTwoFactorBackupCodes = user.twoFactorBackupCodes
        ? symmetricEncrypt({ key: currentKey, data: decryptWith(oldKey, user.twoFactorBackupCodes) })
        : null;

      console.log(`${APPLY ? 'Re-encrypting' : '[dry-run] Would re-encrypt'} 2FA data for ${user.email} (${user.id})`);

      if (APPLY) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorSecret: newTwoFactorSecret,
            twoFactorBackupCodes: newTwoFactorBackupCodes,
          },
        });
      }

      migrated++;
    } catch (error) {
      failed++;
      console.error(`Failed to decrypt 2FA data for ${user.email} (${user.id}) with OLD_ENCRYPTION_KEY:`, error);
    }
  }

  console.log('\nSummary');
  console.log(`  Already under current key: ${alreadyCurrent}`);
  console.log(`  ${APPLY ? 'Re-encrypted' : 'Would re-encrypt'}: ${migrated}`);
  console.log(`  Failed (undecryptable with OLD_ENCRYPTION_KEY): ${failed}`);

  if (!APPLY && migrated > 0) {
    console.log('\nThis was a dry run — re-run with --apply to write changes.');
  }

  if (failed > 0) {
    console.log(
      '\nFailed users could not be decrypted with OLD_ENCRYPTION_KEY either — they may need admin resetTwoFactor() instead.',
    );
  }

  await prisma.$disconnect();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
