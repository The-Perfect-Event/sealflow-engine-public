import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { Column, Img, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentRecipientSignedProps {
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: RecipientRole;
  assetBaseUrl: string;
}

export const TemplateDocumentRecipientSigned = ({
  documentName,
  recipientName,
  recipientEmail,
  recipientRole,
  assetBaseUrl,
}: TemplateDocumentRecipientSignedProps) => {
  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  const recipientReference = recipientName || recipientEmail;

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Section className="mb-4">
          <Column align="center">
            <Text className="font-semibold text-base text-foreground">
              <Img src={getAssetUrl('/static/completed.png')} className="-mt-0.5 mr-2 inline h-7 w-7 align-middle" />
              <Trans>Completed</Trans>
            </Text>
          </Column>
        </Section>

        <Text className="mb-0 text-center font-semibold text-foreground text-lg">
          {match(recipientRole)
            .with(RecipientRole.APPROVER, () => (
              <Trans>
                {recipientReference} has approved "{documentName}"
              </Trans>
            ))
            .otherwise(() => (
              <Trans>
                {recipientReference} has signed "{documentName}"
              </Trans>
            ))}
        </Text>

        <Text className="mx-auto mt-1 mb-6 max-w-[80%] text-center text-base text-muted-foreground">
          {match(recipientRole)
            .with(RecipientRole.APPROVER, () => <Trans>{recipientReference} has approved the document.</Trans>)
            .otherwise(() => (
              <Trans>{recipientReference} has completed signing the document.</Trans>
            ))}
        </Text>
      </Section>
    </>
  );
};

export default TemplateDocumentRecipientSigned;
