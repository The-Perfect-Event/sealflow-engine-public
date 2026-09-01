import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { DocumentSigningOrder, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta`;
const pdf = () => fs.readFileSync(path.join(__dirname, '../../../../../assets/a4-size.pdf'));

/**
 * Org-level pre-signature approval (#305): a team configures a default APPROVER
 * with a signing order, and every document it sends must route to the approver
 * first — sequentially — regardless of what the sender requested. The approver
 * is injected by the engine; the sender does nothing.
 */
test.describe('API V2 — org default approver routing (#305)', () => {
  test('injects the default approver ahead of the signer and forces sequential', async ({ request }) => {
    const { user, team } = await seedUser();

    // The org/team configures a pre-signature approver.
    await prisma.teamGlobalSettings.update({
      where: { id: team.teamGlobalSettingsId },
      data: {
        defaultRecipients: [
          { email: 'approver@example.com', name: 'Approver', role: RecipientRole.APPROVER, signingOrder: 1 },
        ],
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'approver-routing',
      expiresIn: null,
    });

    // Sender sends a plain single-signer document and DELIBERATELY asks for
    // PARALLEL — the engine must still force sequential because of the approver.
    const payload = {
      title: 'Approver Routing Test',
      type: 'DOCUMENT',
      meta: { signingOrder: DocumentSigningOrder.PARALLEL },
      recipients: [{ email: 'signer@example.com', name: 'Signer', role: RecipientRole.SIGNER, signingOrder: 1 }],
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    formData.append('files', new File([pdf()], 'a4-size.pdf', { type: 'application/pdf' }));

    const createRes = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: envelopeId } = await createRes.json();

    const getRes = await request.get(`${baseUrl}/envelope/${envelopeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const envelope = await getRes.json();

    // Forced sequential despite the PARALLEL request.
    expect(envelope.documentMeta.signingOrder).toBe(DocumentSigningOrder.SEQUENTIAL);

    const approver = envelope.recipients.find((r: { role: string }) => r.role === RecipientRole.APPROVER);
    const signer = envelope.recipients.find((r: { role: string }) => r.role === RecipientRole.SIGNER);

    // Approver auto-injected and placed first; the sender's signer shifted behind it.
    expect(approver).toBeTruthy();
    expect(approver.email).toBe('approver@example.com');
    expect(Number(approver.signingOrder)).toBe(1);
    expect(Number(signer.signingOrder)).toBe(2);
  });

  test('does not change routing when no default recipient has a signing order', async ({ request }) => {
    const { user, team } = await seedUser();

    // A default CC with no signing order must NOT force sequential (no-op path).
    await prisma.teamGlobalSettings.update({
      where: { id: team.teamGlobalSettingsId },
      data: {
        defaultRecipients: [{ email: 'cc@example.com', name: 'CC', role: RecipientRole.CC }],
      },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'no-approver',
      expiresIn: null,
    });

    const payload = {
      title: 'No Approver Test',
      type: 'DOCUMENT',
      meta: { signingOrder: DocumentSigningOrder.PARALLEL },
      recipients: [{ email: 'signer2@example.com', name: 'Signer', role: RecipientRole.SIGNER }],
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    formData.append('files', new File([pdf()], 'a4-size.pdf', { type: 'application/pdf' }));

    const createRes = await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: envelopeId } = await createRes.json();

    const getRes = await request.get(`${baseUrl}/envelope/${envelopeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const envelope = await getRes.json();

    // Untouched: the sender asked for PARALLEL and there is no ordered approver.
    expect(envelope.documentMeta.signingOrder).toBe(DocumentSigningOrder.PARALLEL);
    expect(envelope.recipients.some((r: { role: string }) => r.role === RecipientRole.APPROVER)).toBe(false);
  });
});
