import AuthForm from '@/components/auth/auth-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create Account — CouchLog',
  description: 'Join CouchLog to start tracking your TV shows and movies.',
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
