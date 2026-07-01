import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { EmailDomainsNotConfiguredError } from '../stub-errors';

export interface LinkOrganisationAccountOptions {
  token: string;
  requestMeta: RequestMetadata;
}

/**
 * AGPL no-op stub (sealflow#18).
 *
 * Organisation-account linking is part of Documenso's Enterprise organisation
 * SSO feature, which is not enabled in this fork. The throwing error type is
 * shared with the email-domain stubs only for convenience — the feature itself
 * is unrelated; it is never reached on a correctly-configured instance.
 */
export const linkOrganisationAccount = async (_options: LinkOrganisationAccountOptions) => {
  throw new EmailDomainsNotConfiguredError('Organisation account linking is not configured in this deployment.');
};
