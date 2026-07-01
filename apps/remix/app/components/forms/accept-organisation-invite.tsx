import { authClient } from '@documenso/auth/client';
import { ZNameSchema } from '@documenso/lib/constants/auth';
import { AppError } from '@documenso/lib/errors/app-error';
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';

export const ZAcceptInviteFormSchema = z.object({
  name: ZNameSchema,
  password: ZPasswordSchema,
  signature: z.string().min(1, { message: msg`We need your signature to sign documents`.id }),
});

export type TAcceptInviteFormSchema = z.infer<typeof ZAcceptInviteFormSchema>;

export type AcceptOrganisationInviteFormProps = {
  className?: string;
  token: string;
  email: string;
};

/**
 * Invite-only account setup (sealflow#14). Replaces the public signup form for
 * a new member: the email is fixed by the invite, the account is created and
 * the invite accepted in one call, and the member is signed straight in.
 */
export const AcceptOrganisationInviteForm = ({ className, token, email }: AcceptOrganisationInviteFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<TAcceptInviteFormSchema>({
    values: {
      name: '',
      password: '',
      signature: '',
    },
    resolver: zodResolver(ZAcceptInviteFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onFormSubmit = async ({ name, password, signature }: TAcceptInviteFormSchema) => {
    try {
      await authClient.emailPassword.acceptOrganisationInvite({
        token,
        name,
        password,
        signature,
      });

      await navigate('/');
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`An error occurred`),
        description: error.message ?? _(msg`We were unable to set up your account. Please try again.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form className={cn('flex w-full flex-col gap-y-4', className)} onSubmit={form.handleSubmit(onFormSubmit)}>
        <FormItem>
          <FormLabel>
            <Trans>Email</Trans>
          </FormLabel>
          <FormControl>
            <Input type="email" value={email} disabled />
          </FormControl>
        </FormItem>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Full name</Trans>
              </FormLabel>
              <FormControl>
                <Input type="text" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Password</Trans>
              </FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="signature"
          render={({ field: { onChange, value } }) => (
            <FormItem>
              <FormLabel>
                <Trans>Signature</Trans>
              </FormLabel>
              <FormControl>
                <SignaturePadDialog
                  className="h-44 w-full"
                  value={value}
                  onChange={(v) => onChange(v ?? '')}
                  typedSignatureEnabled
                  uploadSignatureEnabled
                  drawSignatureEnabled
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" loading={isSubmitting} className="mt-2">
          <Trans>Accept invitation</Trans>
        </Button>
      </form>
    </Form>
  );
};
