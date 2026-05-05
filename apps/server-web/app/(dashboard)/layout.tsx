// Dashboard layout with navigation

import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
                <Link
                  href="/releases"
                  className="cc-nav-link px-3 py-2"
                >
                  Releases
                </Link>
              </div>
            </div>
            <div className="cc-status cc-status-muted px-3 py-1 text-xs font-semibold">
              <span className="cc-dot"></span>
              Platform v0.1.0
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
