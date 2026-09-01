import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

/**
 * The localized "request" email subject for a recipient's role. An approver is
 * asked to review and approve, not to sign — so the subject must say so — while
 * every other role keeps the signature-request wording.
 */
export const getRecipientRequestSubject = (i18n: I18n, role: RecipientRole, title: string): string =>
  match(role)
    .with(RecipientRole.APPROVER, () => i18n._(msg`Approval requested on "${title}"`))
    .otherwise(() => i18n._(msg`Signature requested on "${title}"`));
