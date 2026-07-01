import { prisma } from '@documenso/prisma';
import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
  /**
   * When true (the default), the new user does not get a personal organisation.
   * sealflow#14: sealflow is invite-only with no personal-org concept — users
   * are provisioned into a tenant organisation via invite. Pass `false` only
   * for an explicit opt-in (e.g. seeding).
   */
  skipPersonalOrganisation?: boolean;
  /**
   * When true, the account is created already email-verified. Used by the
   * invite-acceptance flow (sealflow#14): possession of the one-time invite
   * token emailed to the address already proves ownership, so no separate
   * email-verification round-trip is required.
   */
  emailVerified?: boolean;
}

export const createUser = async ({
  name,
  email,
  password,
  signature,
  skipPersonalOrganisation = true,
  emailVerified = false,
}: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword, // Todo: (RR7) Drop password.
      signature,
      emailVerified: emailVerified ? new Date() : null,
    },
  });

  // Todo: (RR7) Migrate to use this after RR7.
  // Note: If we actually ever proceed with this, there are multiple
  // locations where we will need to update this.
  // const user = await prisma.$transaction(async (tx) => {
  //   const user = await tx.user.create({
  //     data: {
  //       name,
  //       email: email.toLowerCase(),
  //       password: hashedPassword, // Todo: (RR7) Drop password.
  //       signature,
  //     },
  //   });

  //   await tx.account.create({
  //     data: {
  //       userId: user.id,
  //       type: 'emailPassword', // Todo: (RR7)
  //       provider: 'DOCUMENSO', // Todo: (RR7) Enums
  //       providerAccountId: user.id.toString(),
  //       password: hashedPassword,
  //     },
  //   });

  //   return user;
  // });

  // Not used at the moment, uncomment if required.
  await onCreateUserHook(user, { skipPersonalOrganisation }).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  return user;
};

export type OnCreateUserHookOptions = {
  /**
   * Whether to skip creating a "Personal Organisation" for the new user.
   *
   * sealflow#14: sealflow is invite-only and has no personal-organisation
   * concept — every user is provisioned into a tenant organisation via invite.
   * Personal-org creation is therefore OPT-IN: it only runs when this is
   * explicitly set to `false`. Left undefined/true, no personal org is created.
   * (Upstream Documenso created one for every new user by default.)
   */
  skipPersonalOrganisation?: boolean;
};

/**
 * Should be run after a user is created, e.g. during invite acceptance or
 * OAuth sign-in.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User, options: OnCreateUserHookOptions = {}) => {
  if (options.skipPersonalOrganisation === false) {
    await createPersonalOrganisation({ userId: user.id });
  }

  return user;
};
