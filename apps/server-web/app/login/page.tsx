'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to log in');
        return;
      }

      router.push('/devices');
      router.refresh();
    } catch {
      setError('Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cc-shell flex min-h-screen items-center justify-center px-4">
      <div className="cc-card w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="cc-logo-mark">C</span>
          <div>
            <div className="cc-logo-text">Court<span>Cast</span></div>
            <p className="text-sm text-white/50">Sign in to manage your displays</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/60">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded px-3 py-3"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/60">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded px-3 py-3"
              autoComplete="current-password"
              required
            />
          </div>

          <button disabled={loading} className="cc-btn cc-btn-primary w-full py-3 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Need an account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
