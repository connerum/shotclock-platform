import { requireUser } from '@/lib/auth';
import AccountClient from './account-client';

export default async function AccountPage() {
  const user = await requireUser();
  return <AccountClient user={user} />;
}
