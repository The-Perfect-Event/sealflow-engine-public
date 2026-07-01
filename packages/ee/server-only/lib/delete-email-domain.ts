import { EmailDomainsNotConfiguredError } from '../stub-errors';

type DeleteEmailDomainOptions = {
  emailDomainId: string;
};

/**
 * AGPL no-op stub (sealflow#18). Custom email domains require AWS SES, which is
 * not configured in this fork.
 */
export const deleteEmailDomain = async (_options: DeleteEmailDomainOptions) => {
  throw new EmailDomainsNotConfiguredError();
};
