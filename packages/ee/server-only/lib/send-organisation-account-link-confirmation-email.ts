import type { TOrganisationAccountLinkMetadata } from '@documenso/lib/types/organisation';

import { EmailDomainsNotConfiguredError } from '../stub-errors';

export type SendOrganisationAccountLinkConfirmationEmailProps = TOrganisationAccountLinkMetadata & {
  organisationName: string;
};

/**
 * AGPL no-op stub (sealflow#18).
 *
 * Part of Documenso's Enterprise organisation SSO account-link flow, which is
 * not enabled in this fork. Never reached on a correctly-configured instance.
 */
export const sendOrganisationAccountLinkConfirmationEmail = async (
  _props: SendOrganisationAccountLinkConfirmationEmailProps,
) => {
  throw new EmailDomainsNotConfiguredError('Organisation account linking is not configured in this deployment.');
};
