import type { ClusterProfile } from '../types'

const STORAGE_KEY = 'rocketmq.clusterProfiles'

export function loadClusterProfiles(): ClusterProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).nameServer === 'string'
      )
      .map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? item.nameServer),
        nameServer: String(item.nameServer),
        aclEnabled: Boolean(item.aclEnabled),
        accessKey: String(item.accessKey ?? ''),
        secretKey: String(item.secretKey ?? ''),
      }))
  } catch {
    return []
  }
}

export function saveClusterProfiles(profiles: ClusterProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export function newProfileId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
