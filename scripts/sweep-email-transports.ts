#!/usr/bin/env node
/**
 * Read-only diagnostic for issue #362 (and the general #308 aftermath):
 * lists every EmailTransport row and checks whether its stored config
 * still decrypts under the CURRENT ENCRYPTION_SECONDARY_KEY. Any that
 * don't are orphans from the 2026-09-02 rotation (#308) that haven't
 * been re-encrypted yet — transport_ats was one; this finds the rest
 * before they surprise anyone the way that one did.
 *
 * Never writes anything, never prints decrypted content — only which
 * transports pass/fail and their non-secret metadata (id, name, type,
 * fromAddress).
 *
 * Standalone by design (same reasons as recrypt-2fa-secrets.ts /
 * fix-email-transport.ts): the production image doesn't ship
 * @documenso/lib's constants/ or @documenso/prisma's raw source, so this
 * uses @noble/ciphers, @noble/hashes, and @prisma/client directly.
 *
 * Usage (inside the container): npx tsx sweep-email-transports.ts
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hexToBytes } from '@noble/ciphers/utils';
import { managedNonce } from '@noble/ciphers/webcrypto';
import { sha256 } from '@noble/hashes/sha2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const symmetricDecrypt = ({ key, data }: { key: string; data: string }) => {
  const keyAsBytes = sha256(key);
  const dataAsBytes = hexToBytes(data);
  const chacha = managedNonce(xchacha20poly1305)(keyAsBytes);
  return chacha.decrypt(dataAsBytes);
};

const main = async () => {
  const secondaryKey = process.env.NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY;

  if (!secondaryKey) {
    throw new Error('Missing NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY in the environment.');
  }

  const transports = await prisma.emailTransport.findMany({
    select: { id: true, name: true, type: true, fromAddress: true, updatedAt: true, config: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${transports.length} EmailTransport row(s).\n`);

  const orphaned: typeof transports = [];
  const healthy: typeof transports = [];

  for (const t of transports) {
    try {
      const decrypted = Buffer.from(symmetricDecrypt({ key: secondaryKey, data: t.config })).toString('utf-8');
      JSON.parse(decrypted); // confirm it's not just garbage bytes that happened to pass the AEAD tag
      healthy.push(t);
    } catch {
      orphaned.push(t);
    }
  }

  console.log('OK (decrypts under current key):');
  for (const t of healthy) {
    console.log(
      `  - ${t.id}  ${t.name}  type=${t.type}  from=${t.fromAddress}  updatedAt=${t.updatedAt.toISOString()}`,
    );
  }

  console.log('\nORPHANED (does NOT decrypt under current key — needs re-encrypt):');
  if (orphaned.length === 0) {
    console.log('  (none)');
  }
  for (const t of orphaned) {
    console.log(
      `  - ${t.id}  ${t.name}  type=${t.type}  from=${t.fromAddress}  updatedAt=${t.updatedAt.toISOString()}`,
    );
  }

  console.log(`\nSummary: ${healthy.length} OK, ${orphaned.length} orphaned, ${transports.length} total.`);

  await prisma.$disconnect();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
