const STORAGE_KEY = 'rocketmq.nameServerHistory'
const MAX_ENTRIES = 10

export function loadNameServerHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function saveHistory(entries: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage may be unavailable; history then lasts for this session only.
  }
}

export function addNameServerHistory(address: string): string[] {
  const value = address.trim()
  if (!value) return loadNameServerHistory()
  const entries = [value, ...loadNameServerHistory().filter((item) => item !== value)].slice(0, MAX_ENTRIES)
  saveHistory(entries)
  return entries
}

export function removeNameServerHistory(address: string): string[] {
  const entries = loadNameServerHistory().filter((item) => item !== address)
  saveHistory(entries)
  return entries
}
