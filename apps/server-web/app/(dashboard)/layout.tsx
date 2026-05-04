// Dashboard layout with navigation

import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-bold text-green-500">
                Shotclock
              </Link>
              <div className="flex space-x-4">
                <Link
                  href="/devices"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
                >
                  Devices
                </Link>
                <Link
                  href="/pair"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
                >
                  Pair
                </Link>
                <Link
                  href="/releases"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
                >
                  Releases
                </Link>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Shotclock Platform v0.1.0
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
