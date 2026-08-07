'use client';

import { FormEvent, useEffect, useState } from 'react';

interface ManagedUser {
  id: string; email: string; name: string | null; role: string; isActive: boolean;
  mustChangePassword: boolean; lastLoginAt: string | null; createdAt: string; _count: { devices: number };
}

export default function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });

  async function load() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load users');
    setUsers(data.users);
  }

  useEffect(() => { load().catch(error => setError(error.message)); }, []);

  async function create(event: FormEvent) {
    event.preventDefault(); setError(null);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Failed to create user');
    setForm({ email: '', name: '', password: '', role: 'user' });
    await load();
  }

  async function act(user: ManagedUser, action: 'disable' | 'enable' | 'reset-password') {
    setError(null);
    let password: string | undefined;
    if (action === 'reset-password') {
      password = window.prompt(`Enter a temporary password (12+ characters) for ${user.email}`) || undefined;
      if (!password) return;
    }
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, password }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'User update failed');
    await load();
  }

  return <div>
    <h1 className="text-3xl font-bold">Users</h1>
    <p className="mt-1 text-sm text-white/50">Issue accounts, reset access, and revoke sessions.</p>
    {error && <div className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">{error}</div>}
    <form onSubmit={create} className="cc-card mt-6 grid gap-3 p-5 md:grid-cols-5">
      <input className="rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className="rounded px-3 py-2" type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <input className="rounded px-3 py-2" type="password" minLength={12} placeholder="Temporary password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      <select className="rounded px-3 py-2" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="super">Administrator</option></select>
      <button className="cc-btn cc-btn-primary px-4 py-2">Create account</button>
    </form>
    <div className="cc-card mt-6 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left text-white/50"><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Devices</th><th className="p-4">Last login</th><th className="p-4">Actions</th></tr></thead><tbody>{users.map(user => <tr className="border-b border-white/5" key={user.id}><td className="p-4"><div>{user.name || user.email}</div><div className="text-xs text-white/40">{user.email} · {user.isActive ? (user.mustChangePassword ? 'password change required' : 'active') : 'disabled'}</div></td><td className="p-4">{user.role === 'super' ? 'Administrator' : 'User'}</td><td className="p-4">{user._count.devices}</td><td className="p-4">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td><td className="p-4"><div className="flex flex-wrap gap-2"><button className="cc-btn cc-btn-secondary px-3 py-1" onClick={() => act(user, 'reset-password')}>Reset password</button>{user.id !== currentUserId && <button className="cc-btn cc-btn-secondary px-3 py-1" onClick={() => act(user, user.isActive ? 'disable' : 'enable')}>{user.isActive ? 'Disable' : 'Enable'}</button>}</div></td></tr>)}</tbody></table></div>
  </div>;
}
