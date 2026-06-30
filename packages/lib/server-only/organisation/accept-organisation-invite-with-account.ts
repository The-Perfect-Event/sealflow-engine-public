import { prisma } from '@documenso/prisma';
import { OrganisationMemberInviteStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { createUser } from '../user/create-user';
import { acceptOrganisationInvitation } from './accept-organisation-invitation';

export type AcceptOrganisationInviteWithAccountOptions = {
  /** One-time invite token from the `/organisation/invite/{token}` link. */
  token: string;
  name: string;
  password: string;
  signature?: string | null;
};

/**
 * Invite-only account provisioning (sealflow#14).
 *
 * Sealflow has no public signup. A new member only ever gets an account by
 * consuming a one-time organisation-invite token: this creates the user
 * directly inside the inviting organisation, with NO personal organisation and
 * the email pre-verified (possession of the emailed token already proves
 * ownership of the address).
 *
 * Returns the created user so the caller (the auth route) can establish a
 * session immediately — no separate sign-in or email-verification round-trip.
 */
export const acceptOrganisationInviteWithAccount = async ({
  token,
  name,
  password,
  signature,
}: AcceptOrganisationInviteWithAccountOptions) => {
  const invite = await prisma.organisationMemberInvite.findFirst({
    where: {
      token,
      status: OrganisationMemberInviteStatus.PENDING,
    },
  });

  if (!invite) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'This invitation is invalid or has already been used.',
    });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: invite.email,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'An account already exists for this email. Please sign in to accept the invitation.',
    });
  }

  const user = await createUser({
    name,
    email: invite.email,
    password,
    signature,
    skipPersonalOrganisation: true,
    emailVerified: true,
  });

  await acceptOrganisationInvitation({ token });

  return user;
};
