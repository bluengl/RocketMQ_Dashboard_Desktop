import { useEffect, useState } from 'react'
import { Settings, Server, Plus, Pencil, Trash2, Plug, Unplug, X } from 'lucide-react'
import type { ClusterProfile } from './types'
import { errorMessage } from './utils/errors'
import { loadClusterProfiles, saveClusterProfiles, newProfileId } from './utils/clusterProfiles'
import ErrorNotice from './components/ErrorNotice'

interface OpsPageProps {
  connected: boolean
  connecting: boolean
  currentNameServer: string
  onConnect: (profile: ClusterProfile) => Promise<boolean>
  onDisconnect: () => Promise<void>
}

interface ProfileForm {
  name: string
  nameServer: string
  aclEnabled: boolean
  accessKey: string
  secretKey: string
}

const emptyForm = (nameServer: string): ProfileForm => ({
  name: '',
  nameServer,
  aclEnabled: false,
  accessKey: '',
  secretKey: '',
})

export default function OpsPage({
  connected,
  connecting,
  currentNameServer,
  onConnect,
  onDisconnect,
}: OpsPageProps) {
  const [profiles, setProfiles] = useState<ClusterProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm(''))

  useEffect(() => {
    setProfiles(loadClusterProfiles())
  }, [])

  const persist = (next: ClusterProfile[]) => {
    setProfiles(next)
    saveClusterProfiles(next)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm(currentNameServer))
    setError(null)
    setShowForm(true)
  }

  const openEdit = (profile: ClusterProfile) => {
    setEditingId(profile.id)
    setForm({
      name: profile.name,
      nameServer: profile.nameServer,
      aclEnabled: profile.aclEnabled,
      accessKey: profile.accessKey,
      secretKey: profile.secretKey,
    })
    setError(null)
    setShowForm(true)
  }

  const handleSave = () => {
    const nameServer = form.nameServer.trim()
    if (!nameServer) {
      setError('NameServer address is required')
      return
    }

    const profile: ClusterProfile = {
      id: editingId ?? newProfileId(),
      name: form.name.trim() || nameServer,
      nameServer,
      aclEnabled: form.aclEnabled,
      accessKey: form.aclEnabled ? form.accessKey.trim() : '',
      secretKey: form.aclEnabled ? form.secretKey.trim() : '',
    }

    persist(
      editingId
        ? profiles.map((item) => (item.id === editingId ? profile : item))
        : [...profiles, profile]
    )
    setShowForm(false)
  }

  const handleDelete = (profile: ClusterProfile) => {
    if (!window.confirm(`Delete cluster profile "${profile.name}"?`)) return
    persist(profiles.filter((item) => item.id !== profile.id))
  }

  const handleConnect = async (profile: ClusterProfile) => {
    setBusyId(profile.id)
    setError(null)
    try {
      const ok = await onConnect(profile)
      if (!ok) {
        setError(`Connection to ${profile.nameServer} failed`)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  const currentProfile = profiles.find((item) => item.nameServer === currentNameServer)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Settings className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">OPS</h1>
          <p className="text-sm text-slate-400">NameServer profiles and multi-cluster switching</p>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-600'}`}
            />
            <div>
              <div className="text-sm font-medium text-slate-100">
                {connected ? 'Connected' : 'Not connected'}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {connected ? currentNameServer : 'Select a cluster profile to connect'}
              </div>
            </div>
          </div>
          {connected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Unplug className="w-4 h-4" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
        {connected && currentProfile && (
          <div className="mt-3 text-xs text-slate-400">
            Active profile: <span className="text-slate-200">{currentProfile.name}</span>
            {currentProfile.aclEnabled && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">ACL</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <Server className="w-4 h-4 text-slate-400" />
            Cluster Profiles ({profiles.length})
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Cluster
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400">
            No saved clusters. Add a NameServer profile to switch between clusters quickly.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-xs">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">NameServer</th>
                <th className="text-left px-4 py-2 font-medium">ACL</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {profiles.map((profile) => {
                const isCurrent = connected && profile.nameServer === currentNameServer
                return (
                  <tr key={profile.id} className="hover:bg-slate-750 text-sm">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{profile.name}</div>
                      {isCurrent && (
                        <div className="text-[11px] text-green-400">active connection</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{profile.nameServer}</td>
                    <td className="px-4 py-3">
                      {profile.aclEnabled ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300">
                          enabled
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleConnect(profile)}
                          disabled={connecting || busyId === profile.id || isCurrent}
                          className="px-3 py-1 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <Plug className="w-3.5 h-3.5" />
                          {busyId === profile.id ? 'Connecting...' : isCurrent ? 'Connected' : 'Connect'}
                        </button>
                        <button
                          onClick={() => openEdit(profile)}
                          className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-100"
                          title="Edit profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(profile)}
                          className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400"
                          title="Delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[30rem] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingId ? 'Edit Cluster Profile' : 'Add Cluster Profile'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <ErrorNotice error={error} compact />}

            <div>
              <label className="text-sm text-slate-400 block mb-1">Display Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. production"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">NameServer Address</label>
              <input
                type="text"
                value={form.nameServer}
                onChange={(e) => setForm({ ...form, nameServer: e.target.value })}
                placeholder="192.168.1.100:9876"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.aclEnabled}
                onChange={(e) => setForm({ ...form, aclEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900"
              />
              Require ACL credentials
            </label>

            {form.aclEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Access Key</label>
                  <input
                    type="text"
                    value={form.accessKey}
                    onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Secret Key</label>
                  <input
                    type="password"
                    value={form.secretKey}
                    onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
