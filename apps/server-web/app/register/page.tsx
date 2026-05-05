'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        return;
      }

      router.push('/devices');
      router.refresh();
    } catch {
      setError('Failed to create account');
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
            <p className="text-sm text-white/50">Create an account to pair displays</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/60">Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded px-3 py-3"
              autoComplete="name"
            />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button disabled={loading} className="cc-btn cc-btn-primary w-full py-3 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
