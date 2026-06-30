/**
 * AGPL no-op stub (sealflow#18). CSC/QES signing is disabled in this fork, so
 * no service-session cookie is ever set; the reader returns `null`.
 */
export const readCscServiceSessionFromRequest = async (_request: Request): Promise<string | null> => {
  return null;
};
