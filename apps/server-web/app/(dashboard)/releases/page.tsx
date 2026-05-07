import { redirect } from 'next/navigation';
import { isSuperUser, requireUser } from '@/lib/auth';
import ReleasesClient from './releases-client';

export default async function ReleasesPage() {
  const user = await requireUser();

  if (!isSuperUser(user)) {
    redirect('/devices');
  }

  return <ReleasesClient />;
}
