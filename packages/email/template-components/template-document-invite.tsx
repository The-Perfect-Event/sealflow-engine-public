import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationType, RecipientRole } from '@prisma/client';
import { match, P } from 'ts-pattern';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentInviteProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
  selfSigner: boolean;
  teamName?: string;
  includeSenderDetails?: boolean;
  organisationType?: OrganisationType;
}

export const TemplateDocumentInvite = ({
  inviterName,
  documentName,
  signDocumentLink,
  assetBaseUrl,
  role,
  selfSigner,
  teamName,
  includeSenderDetails,
  organisationType,
}: TemplateDocumentInviteProps) => {
  const { _ } = useLingui();

  const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[role];

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-foreground text-lg">
          {match({ role, selfSigner, organisationType, includeSenderDetails, teamName })
            .with({ role: RecipientRole.CC }, () => (
              <Trans>
                You have been copied on
                <br />"{documentName}"
              </Trans>
            ))
            .with({ selfSigner: true }, () => (
              <Trans>
                Please {_(actionVerb).toLowerCase()} your document
                <br />"{documentName}"
              </Trans>
            ))
            .with(
              {
                organisationType: OrganisationType.ORGANISATION,
                includeSenderDetails: true,
                teamName: P.string,
              },
              () => (
                <Trans>
                  {inviterName} on behalf of "{teamName}" has invited you to {_(actionVerb).toLowerCase()}
                  <br />"{documentName}"
                </Trans>
              ),
            )
            .with({ organisationType: OrganisationType.ORGANISATION, teamName: P.string }, () => (
              <Trans>
                {teamName} has invited you to {_(actionVerb).toLowerCase()}
                <br />"{documentName}"
              </Trans>
            ))
            .otherwise(() => (
              <Trans>
                {inviterName} has invited you to {_(actionVerb).toLowerCase()}
                <br />"{documentName}"
              </Trans>
            ))}
        </Text>

        {/* CC recipients have no action to take, so we omit the "continue by…"
            line and the CTA button entirely (rendering them empty leaves a
            dangling blank button). The custom body explains they'll receive the
            final signed copy on completion. */}
        {role !== RecipientRole.CC && (
          <>
            <Text className="my-1 text-center text-base text-muted-foreground">
              {match(role)
                .with(RecipientRole.SIGNER, () => <Trans>Continue by signing the document.</Trans>)
                .with(RecipientRole.VIEWER, () => <Trans>Continue by viewing the document.</Trans>)
                .with(RecipientRole.APPROVER, () => <Trans>Continue by approving the document.</Trans>)
                .with(RecipientRole.ASSISTANT, () => <Trans>Continue by assisting with the document.</Trans>)
                .otherwise(() => '')}
            </Text>

            <Section className="mt-8 mb-6 text-center">
              <Button
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground text-sbase no-underline"
                href={signDocumentLink}
                // Open the signing session in its own tab so the recipient
                // keeps the email they came from — and, after signing, the
                // completion page doesn't replace whatever they were reading.
                target="_blank"
                rel="noopener noreferrer"
              >
                {match(role)
                  .with(RecipientRole.SIGNER, () => <Trans>View Document to sign</Trans>)
                  .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
                  .with(RecipientRole.APPROVER, () => <Trans>View Document to approve</Trans>)
                  .with(RecipientRole.ASSISTANT, () => <Trans>View Document to assist</Trans>)
                  .otherwise(() => '')}
              </Button>
            </Section>
          </>
        )}

        {/* Self-whitelisting nudge (Adobe Sign parity): recipients who add the
            sender to their contacts stop consumer-Gmail spam filtering for
            every future document. Worded without the literal address — the
            sender varies per white-labeled organisation. */}
        <Text className="mt-6 mb-0 text-center text-muted-foreground text-xs">
          <Trans>
            To make sure future documents always reach you, please add this email's sender to your contacts or
            safe-senders list.
          </Trans>
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentInvite;
