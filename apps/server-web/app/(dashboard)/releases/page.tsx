// Firmware releases page

export default function ReleasesPage() {
  const releases = [
    {
      version: '0.1.0',
      date: '2024-01-01',
      mandatory: false,
      size: '50 MB',
      notes: 'Initial release',
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Firmware Releases</h1>
        <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md text-sm font-medium">
          Upload New Release
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Release Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {releases.map((release) => (
              <tr key={release.version}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="font-mono">{release.version}</span>
                    {release.mandatory && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-900 text-red-200">
                        Mandatory
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {release.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {release.size}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Latest
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {release.notes}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button className="text-green-500 hover:text-green-400 mr-4">
                    Edit
                  </button>
                  <button className="text-red-500 hover:text-red-400">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
