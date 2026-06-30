/**
 * AGPL no-op stub (sealflow#18). CSC/QES signing is disabled in this fork, so
 * no SAD-session cookie is ever set; the reader returns `null` ("no session").
 */
export const readCscSadSessionFromRequest = async (_request: Request): Promise<string | null> => {
  return null;
};
