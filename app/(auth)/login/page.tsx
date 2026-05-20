import AuthForm from '@/components/auth/auth-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign In — CouchLog',
  description: 'Sign in to your CouchLog account to track your shows and movies.',
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
