import { EmailDomainsNotConfiguredError } from '../stub-errors';

type CreateEmailDomainOptions = {
  domain: string;
  organisationId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Custom email domains require AWS SES, which is
 * not configured in this fork.
 */
export const createEmailDomain = async (_options: CreateEmailDomainOptions) => {
  throw new EmailDomainsNotConfiguredError();
};
