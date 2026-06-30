/**
 * AGPL no-op stub (sealflow#18) replacing the proprietary Documenso EE CSC
 * blocking-error cookie helpers.
 *
 * CSC/QES signing is not enabled in this fork (`IS_INSTANCE_CSC_MODE()` is
 * always false), so no blocking-error cookie is ever set. The recipient signing
 * loader still imports these, so the reader returns `null` (no error present) —
 * exactly the value the loader treats as "no CSC blocking state".
 */

export type TCscBlockingErrorPayload = {
  /** `AppErrorCode` value, e.g. `'CSC_CREDENTIAL_LIST_EMPTY'`. */
  code: string;
  /** Recipient token from `/sign/{token}`; the loader scopes the error to its recipient. */
  recipientToken: string;
};

export const readCscBlockingErrorFromRequest = async (_request: Request): Promise<TCscBlockingErrorPayload | null> => {
  return null;
};

/**
 * Returns a `Set-Cookie` header value that expires the (never-set) cookie.
 * Harmless to emit; kept so the loader's clear-on-read path still type-checks.
 */
export const buildClearCscBlockingErrorCookieHeader = (): string => {
  return 'csc_blocking_error=; Path=/; Max-Age=0; SameSite=Lax';
};
