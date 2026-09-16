import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Hr, Html, Preview, Section } from '../components';
import { TemplateBrandingLogo } from '../template-components/template-branding-logo';
import { TemplateFooter } from '../template-components/template-footer';
import type { TemplateRecipientBouncedProps } from '../template-components/template-recipient-bounced';
import { TemplateRecipientBounced } from '../template-components/template-recipient-bounced';

export type RecipientBouncedEmailTemplateProps = Partial<TemplateRecipientBouncedProps>;

export const RecipientBouncedTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  recipientName = 'John Doe',
  recipientEmail = 'john@example.com',
  documentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
}: RecipientBouncedEmailTemplateProps) => {
  const { _ } = useLingui();

  const previewText = msg`The email to "${recipientEmail}" for document "${documentName}" could not be delivered.`;

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto bg-background font-sans">
        <Section>
          <Container className="mx-auto mt-8 mb-2 max-w-xl rounded-lg border border-border border-solid p-4 backdrop-blur-sm">
            <Section>
              <TemplateBrandingLogo assetBaseUrl={assetBaseUrl} className="mb-4 h-6" />

              <TemplateRecipientBounced
                documentName={documentName}
                recipientName={recipientName}
                recipientEmail={recipientEmail}
                documentLink={documentLink}
                assetBaseUrl={assetBaseUrl}
              />
            </Section>
          </Container>

          <Hr className="mx-auto mt-12 max-w-xl" />

          <Container className="mx-auto max-w-xl">
            <TemplateFooter />
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

export default RecipientBouncedTemplate;
