import { EmailDomainsNotConfiguredError } from '../stub-errors';

/**
 * AGPL no-op stub (sealflow#18). Custom email domains require AWS SES, which is
 * not configured in this fork.
 */
export const verifyEmailDomain = async (_emailDomainId: string) => {
  throw new EmailDomainsNotConfiguredError();
};
