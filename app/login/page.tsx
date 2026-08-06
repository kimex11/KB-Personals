import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div
      data-testid="login-page"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-serif text-2xl text-gold">
          KB
        </span>
        <h1 className="font-serif text-2xl text-neutral-900">Sign in</h1>
      </div>
      <LoginForm />
    </div>
  );
}
