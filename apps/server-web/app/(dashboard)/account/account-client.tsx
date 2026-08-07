'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface User { email: string; name: string | null; role: string; mustChangePassword: boolean }

export default function AccountClient({ user }: { user: User }) {
  const router = useRouter();
  const params = useSearchParams();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) return setError('New passwords do not match');
    setSaving(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || 'Password change failed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated. Other signed-in sessions have been revoked.');
      router.refresh();
    } catch {
      setError('Password change failed');
    } finally {
      setSaving(false);
    }
  }

  const required = user.mustChangePassword || params.get('required') === '1';
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Account</h1>
      <p className="mt-1 text-sm text-white/50">{user.email} · {user.role === 'super' ? 'Administrator' : 'User'}</p>
      {required && <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">Change the temporary password before continuing operational work.</div>}
      {error && <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
      {message && <div className="mt-6 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-green-300">{message}</div>}
      <form onSubmit={submit} className="cc-card mt-6 space-y-4 p-6">
        <h2 className="text-xl font-semibold">Change password</h2>
        <label className="block text-sm text-white/60">Current password<input className="mt-1 w-full rounded px-3 py-2" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>
        <label className="block text-sm text-white/60">New password<input className="mt-1 w-full rounded px-3 py-2" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label>
        <label className="block text-sm text-white/60">Confirm new password<input className="mt-1 w-full rounded px-3 py-2" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>
        <button className="cc-btn cc-btn-primary px-5 py-2 disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}
