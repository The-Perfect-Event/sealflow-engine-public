import { DocumentSigningOrder } from '@prisma/client';

import { isTspEnvelope } from '../../types/signature-level';
import { assertCompatibleSigningOrder } from './assert-compatible-signing-order';

type ResolveSigningOrderOptions = {
  signatureLevel: string;
  requested?: DocumentSigningOrder | null;
};

/**
 * Resolve the persisted `signingOrder` for a new envelope's meta.
 *
 * - Explicit `requested` value: validated via
 *   {@link assertCompatibleSigningOrder} (throws on TSP + `PARALLEL`) and
 *   returned as-is.
 * - Omitted `requested`: defaults to `SEQUENTIAL` for ALL signature levels
 *   (TSP `/ByteRange` invariant requires it; SES matches internal-user
 *   expectations of order-1-signs-then-order-2-gets-notified).
 *
 * Use at every create-time call site instead of the bare `|| PARALLEL`
 * fallback. Mirrors {@link resolveSignatureLevel} in shape — the two pair
 * up to keep create-time defaulting + TSP-mode coercion uniform.
 *
 * Sealflow fork divergence from upstream Documenso: upstream defaults SES
 * envelopes to PARALLEL. We default everything to SEQUENTIAL. The PARALLEL
 * option is still selectable per envelope in the editor.
 */
export const resolveSigningOrder = ({
  signatureLevel,
  requested,
}: ResolveSigningOrderOptions): DocumentSigningOrder => {
  if (requested) {
    assertCompatibleSigningOrder({ signatureLevel, signingOrder: requested });

    return requested;
  }

  // isTspEnvelope retained for future reference but no longer branches the default.
  void isTspEnvelope;

  return DocumentSigningOrder.SEQUENTIAL;
};
