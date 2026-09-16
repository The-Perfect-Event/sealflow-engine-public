import { Trans } from '@lingui/react/macro';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export type TemplateRecipientBouncedProps = {
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  documentLink: string;
  assetBaseUrl: string;
};

export const TemplateRecipientBounced = ({
  documentName,
  recipientName,
  recipientEmail,
  documentLink,
  assetBaseUrl,
}: TemplateRecipientBouncedProps) => {
  const displayName = recipientName || recipientEmail;

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mx-auto mb-0 max-w-[80%] text-center font-semibold text-foreground text-lg">
          <Trans>
            Email to "{displayName}" could not be delivered on "{documentName}"
          </Trans>
        </Text>

        <Text className="my-1 text-center text-base text-muted-foreground">
          <Trans>
            The email sent to {recipientEmail} for document "{documentName}" was returned as undeliverable, so this
            recipient has not received it. Please check the email address, correct it on the document if needed, and
            resend to this recipient.
          </Trans>
        </Text>

        <Section className="my-4 text-center">
          <Button
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-center font-medium text-primary-foreground text-sm no-underline"
            href={documentLink}
          >
            <Trans>View Document</Trans>
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateRecipientBounced;
