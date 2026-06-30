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
   * When true, the new user does not get a personal organisation created for
   * them. Used by the invite-acceptance flow (sealflow#14), where the user is
   * provisioned directly into the inviting organisation rather than a personal
   * space.
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
  skipPersonalOrganisation = false,
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
   * When true, do not create a "Personal Organisation" for the new user.
   * Used by the Organisation SSO signup path, where the user is intended
   * to operate inside the SSO organisation rather than a personal space.
   *
   * Defaults to false — preserves the historical behaviour of creating a
   * personal organisation for every new user.
   */
  skipPersonalOrganisation?: boolean;
};

/**
 * Should be run after a user is created, example during email password signup or google sign in.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User, options: OnCreateUserHookOptions = {}) => {
  if (!options.skipPersonalOrganisation) {
    await createPersonalOrganisation({ userId: user.id });
  }

  return user;
};
