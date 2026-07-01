import { EmailDomainsNotConfiguredError } from '../stub-errors';

type ReregisterEmailDomainOptions = {
  emailDomainId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Custom email domains require AWS SES, which is
 * not configured in this fork.
 */
export const reregisterEmailDomain = async (_options: ReregisterEmailDomainOptions) => {
  throw new EmailDomainsNotConfiguredError();
};
