import { redirect } from 'next/navigation';
import { isSuperUser, requireUser } from '@/lib/auth';
import UsersClient from './users-client';

export default async function UsersPage() {
  const user = await requireUser();
  if (!isSuperUser(user)) redirect('/devices');
  return <UsersClient currentUserId={user.id} />;
}
