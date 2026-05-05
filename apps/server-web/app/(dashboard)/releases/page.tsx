'use client';

import { useEffect, useState } from 'react';

interface Release {
  id: string;
  version: string;
  releaseDate: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  notes: string;
  isMandatory: boolean;
  minServerVersion?: string;
  createdAt: string;
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    version: '',
    downloadUrl: '',
    checksum: '',
    size: '',
    notes: '',
    isMandatory: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      const res = await fetch('/api/updates/releases');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReleases(data.releases || []);
    } catch (err) {
      setError('Failed to load releases');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/updates/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to create release');
      
      setFormData({
        version: '',
        downloadUrl: '',
        checksum: '',
        size: '',
        notes: '',
        isMandatory: false,
      });
      setShowForm(false);
      fetchReleases();
    } catch (err) {
      setError('Failed to create release');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading releases...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Firmware Releases</h1>
          <p className="mt-1 text-sm text-white/50">Publish and track display update packages</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`cc-btn px-4 py-2 text-sm ${showForm ? 'cc-btn-secondary' : 'cc-btn-primary'}`}
        >
          {showForm ? 'Cancel' : 'Upload New Release'}
        </button>
      </div>

      {error && (
        <div className="cc-card border-red-500/40 bg-red-500/10 p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Create Release Form */}
      {showForm && (
        <div className="cc-card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Release</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Version</label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                  required
                  className="w-full rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Download URL</label>
                <input
                  type="url"
                  value={formData.downloadUrl}
                  onChange={(e) => setFormData({ ...formData, downloadUrl: e.target.value })}
                  placeholder="https://..."
                  required
                  className="w-full rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Checksum</label>
                <input
                  type="text"
                  value={formData.checksum}
                  onChange={(e) => setFormData({ ...formData, checksum: e.target.value })}
                  placeholder="sha256:..."
                  required
                  className="w-full rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Size (bytes)</label>
                <input
                  type="number"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="52428800"
                  required
                  className="w-full rounded px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Release Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="What's new in this release..."
                rows={3}
                className="w-full rounded px-3 py-2"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isMandatory"
                checked={formData.isMandatory}
                onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="isMandatory" className="text-sm text-gray-400">
                Mandatory update (devices must install before connecting)
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="cc-btn cc-btn-primary px-6 py-2 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Release'}
            </button>
          </form>
        </div>
      )}

      {/* Releases Table */}
      {releases.length === 0 ? (
        <div className="cc-card p-8 text-center">
          <p className="text-gray-400">No releases found</p>
        </div>
      ) : (
        <div className="cc-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {releases.map((release, index) => (
                <tr key={release.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-mono">{release.version}</span>
                      {release.isMandatory && (
                        <span className="ml-2 cc-status cc-status-warn px-2 py-0.5 text-xs">
                          Mandatory
                        </span>
                      )}
                      {index === 0 && (
                        <span className="ml-2 cc-status px-2 py-0.5 text-xs">
                          Latest
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDate(release.releaseDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatSize(release.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {index === 0 ? (
                      <span className="cc-status px-2 text-xs font-semibold">
                        <span className="cc-dot"></span>
                        Latest
                      </span>
                    ) : (
                      <span className="cc-status cc-status-muted px-2 text-xs font-semibold">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {release.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
