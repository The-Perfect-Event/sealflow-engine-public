import { getResetTokenValidity } from '@documenso/lib/server-only/user/get-reset-token-validity';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { redirect } from 'react-router';

import { ResetPasswordForm } from '~/components/forms/reset-password';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/reset-password.$token';

export function meta() {
  return appMetaTags(msg`Reset Password`);
}

export async function loader({ params }: Route.LoaderArgs) {
  const { token } = params;

  const isValid = await getResetTokenValidity({ token });

  if (!isValid) {
    throw redirect('/reset-password');
  }

  return {
    token,
  };
}

export default function ResetPasswordPage({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="font-semibold text-4xl">
          <Trans>Reset Password</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>Please choose your new password</Trans>
        </p>

        <ResetPasswordForm token={token} className="mt-4" />
      </div>
    </div>
  );
}
