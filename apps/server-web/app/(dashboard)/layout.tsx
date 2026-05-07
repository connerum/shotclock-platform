// Dashboard layout with navigation

import Link from 'next/link';
import { isSuperUser, requireUser } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="cc-shell">
      <nav className="cc-header">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="cc-logo-mark">C</span>
                <span className="cc-logo-text">Court<span>Cast</span></span>
              </Link>
              <div className="flex space-x-4">
                <Link
                  href="/devices"
                  className="cc-nav-link px-3 py-2"
                >
                  Devices
                </Link>
                <Link
                  href="/pair"
                  className="cc-nav-link px-3 py-2"
                >
                  Pair
                </Link>
                {isSuperUser(user) && (
                  <Link
                    href="/releases"
                    className="cc-nav-link px-3 py-2"
                  >
                    Releases
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right text-xs text-white/50 sm:block">
                <div className="font-semibold text-white/70">{user.email}</div>
                <div>{user.role === 'super' ? 'Super Admin' : 'User'}</div>
              </div>
              <form action="/api/auth/logout" method="post">
                <button className="cc-btn cc-btn-secondary px-3 py-1.5 text-xs" type="submit">
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
