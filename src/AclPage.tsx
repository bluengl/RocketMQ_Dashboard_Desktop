import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Shield, RefreshCw, Plus, Pencil, Trash2, Eye, EyeOff, Network } from 'lucide-react'
import type {
  AclUserInfo,
  BrokerAclRules,
  BrokerAclUsers,
} from './types'
import { errorMessage } from './utils/errors'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import { usePagination } from './hooks/usePagination'

interface AclPageProps {
  connected: boolean
}

type Tab = 'users' | 'rules'

const USER_TYPES = ['Normal', 'Super']
const USER_STATUSES = ['enable', 'disable']
const ACTIONS = ['Pub', 'Sub', 'Any', 'Create', 'Update', 'Delete', 'Get', 'List', 'All']
const DECISIONS = ['Allow', 'Deny']

interface UserForm {
  username: string
  password: string
  userType: string
  userStatus: string
}

interface RuleForm {
  subject: string
  resource: string
  actions: string[]
  sourceIps: string
  decision: string
}

interface FlatRule {
  key: string
  subject: string
  resource: string
  actions: string[]
  sourceIps: string[]
  decision: string
  policyType: string
  brokers: string[]
}

const emptyUserForm = (): UserForm => ({
  username: '',
  password: '',
  userType: 'Normal',
  userStatus: 'enable',
})

const emptyRuleForm = (): RuleForm => ({
  subject: '',
  resource: '',
  actions: ['Pub', 'Sub'],
  sourceIps: '',
  decision: 'Allow',
})

const toList = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

export default function AclPage({ connected }: AclPageProps) {
  const [userResults, setUserResults] = useState<BrokerAclUsers[]>([])
  const [ruleResults, setRuleResults] = useState<BrokerAclRules[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('users')

  const [editingUser, setEditingUser] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm())
  const [savingUser, setSavingUser] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const [editingRule, setEditingRule] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm())
  const [savingRule, setSavingRule] = useState(false)

  const load = async () => {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const [users, rules] = await Promise.all([
        invoke<BrokerAclUsers[]>('list_acl_users', { filter: null }),
        invoke<BrokerAclRules[]>('list_acl_rules', { subject: null, resource: null }),
      ])
      setUserResults(users)
      setRuleResults(rules)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected) {
      load()
    } else {
      setUserResults([])
      setRuleResults([])
    }
  }, [connected])

  const users = useMemo(() => {
    const merged = new Map<string, { user: AclUserInfo; brokers: string[] }>()
    userResults.forEach((result) => {
      result.users.forEach((user) => {
        const existing = merged.get(user.username)
        if (existing) {
          existing.brokers.push(result.broker_addr)
        } else {
          merged.set(user.username, { user, brokers: [result.broker_addr] })
        }
      })
    })
    return Array.from(merged.values()).sort((a, b) =>
      a.user.username.localeCompare(b.user.username)
    )
  }, [userResults])

  const rules = useMemo(() => {
    const merged = new Map<string, FlatRule>()
    ruleResults.forEach((result) => {
      result.rules.forEach((acl) => {
        acl.policies.forEach((policy) => {
          policy.entries.forEach((entry) => {
            const key = `${acl.subject}\u0000${entry.resource}`
            const existing = merged.get(key)
            if (existing) {
              if (!existing.brokers.includes(result.broker_addr)) {
                existing.brokers.push(result.broker_addr)
              }
            } else {
              merged.set(key, {
                key,
                subject: acl.subject,
                resource: entry.resource,
                actions: entry.actions,
                sourceIps: entry.sourceIps,
                decision: entry.decision,
                policyType: policy.policyType || 'Custom',
                brokers: [result.broker_addr],
              })
            }
          })
        })
      })
    })
    return Array.from(merged.values()).sort(
      (a, b) =>
        a.subject.localeCompare(b.subject) || a.resource.localeCompare(b.resource)
    )
  }, [ruleResults])

  const brokerErrors = [...userResults, ...ruleResults].filter((result) => result.error)
  const userPager = usePagination(users, 20)
  const rulePager = usePagination(rules, 20)

  const openCreateUser = () => {
    setEditingUser(false)
    setUserForm(emptyUserForm())
    setError(null)
    setShowUserForm(true)
  }

  const openEditUser = (user: AclUserInfo) => {
    setEditingUser(true)
    setUserForm({
      username: user.username,
      password: user.password ?? '',
      userType: user.userType || 'Normal',
      userStatus: user.userStatus || 'enable',
    })
    setError(null)
    setShowUserForm(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.username.trim()) {
      setError('Username is required')
      return
    }
    if (!userForm.password.trim()) {
      setError('Password is required')
      return
    }

    setSavingUser(true)
    setError(null)
    try {
      if (editingUser) {
        await invoke('update_acl_user', {
          username: userForm.username.trim(),
          password: userForm.password,
          userType: userForm.userType,
          userStatus: userForm.userStatus,
        })
      } else {
        await invoke('create_acl_user', {
          username: userForm.username.trim(),
          password: userForm.password,
          userType: userForm.userType,
        })
      }
      setShowUserForm(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingUser(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Delete ACL user "${username}" from all brokers?`)) return
    setError(null)
    try {
      await invoke('delete_acl_user', { username })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openCreateRule = () => {
    setEditingRule(false)
    setRuleForm(emptyRuleForm())
    setError(null)
    setShowRuleForm(true)
  }

  const openEditRule = (rule: FlatRule) => {
    setEditingRule(true)
    setRuleForm({
      subject: rule.subject,
      resource: rule.resource,
      actions: rule.actions.length > 0 ? rule.actions : ['Pub', 'Sub'],
      sourceIps: rule.sourceIps.join(', '),
      decision: rule.decision || 'Allow',
    })
    setError(null)
    setShowRuleForm(true)
  }

  const toggleAction = (action: string) => {
    setRuleForm((current) => {
      const actions = current.actions.includes(action)
        ? current.actions.filter((item) => item !== action)
        : [...current.actions, action]
      return { ...current, actions }
    })
  }

  const handleSaveRule = async () => {
    if (!ruleForm.subject.trim()) {
      setError('Subject is required')
      return
    }
    if (!ruleForm.resource.trim()) {
      setError('Resource is required')
      return
    }
    if (ruleForm.actions.length === 0) {
      setError('Select at least one action')
      return
    }

    setSavingRule(true)
    setError(null)
    try {
      await invoke(editingRule ? 'update_acl_rule' : 'create_acl_rule', {
        subject: ruleForm.subject.trim(),
        resources: [ruleForm.resource.trim()],
        actions: ruleForm.actions,
        sourceIps: toList(ruleForm.sourceIps),
        decision: ruleForm.decision,
      })
      setShowRuleForm(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (rule: FlatRule) => {
    if (!window.confirm(`Delete ACL rule "${rule.subject} → ${rule.resource}"?`)) return
    setError(null)
    try {
      await invoke('delete_acl_rule', {
        subject: rule.subject,
        resource: rule.resource,
      })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const toggleReveal = (username: string) => {
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(username)) next.delete(username)
      else next.add(username)
      return next
    })
  }

  const renderChips = (values: string[]) =>
    values.length === 0 ? (
      <span className="text-slate-500">—</span>
    ) : (
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <span
            key={value}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300"
          >
            {value}
          </span>
        ))}
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">ACL Management</h1>
            <p className="text-sm text-slate-400">
              {users.length} users · {rules.length} rules · {userResults.length} brokers
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={!connected || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={tab === 'users' ? openCreateUser : openCreateRule}
            disabled={!connected}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {tab === 'users' ? 'Create User' : 'Create Rule'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        {(['users', 'rules'] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === item
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {item === 'users' ? 'Users' : 'ACL Rules'}
          </button>
        ))}
      </div>

      {error && <ErrorNotice error={error} />}

      {brokerErrors.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm space-y-1">
          <div className="font-medium">Some brokers returned errors</div>
          {brokerErrors.map((result, index) => (
            <div key={`${result.broker_addr}-${index}`} className="font-mono text-xs">
              {result.broker_addr}: {result.error}
            </div>
          ))}
        </div>
      )}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">
          Please connect to RocketMQ to manage ACL
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading ACL configuration...
        </div>
      ) : tab === 'users' ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-sm">
                  <th className="text-left px-4 py-3 font-medium">Username</th>
                  <th className="text-left px-4 py-3 font-medium">Password</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Brokers</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No ACL users found. ACL (authentication) may not be enabled on the broker.
                    </td>
                  </tr>
                ) : (
                  userPager.pageItems.map(({ user, brokers }) => (
                    <tr key={user.username} className="hover:bg-slate-750 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-slate-100">
                        {user.username}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">
                            {revealed.has(user.username) ? user.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => toggleReveal(user.username)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-200"
                            title={revealed.has(user.username) ? 'Hide password' : 'Show password'}
                          >
                            {revealed.has(user.username) ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.userType === 'Super'
                              ? 'bg-orange-500/10 text-orange-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {user.userType || 'Normal'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.userStatus === 'disable'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-green-500/10 text-green-400'
                          }`}
                        >
                          {user.userStatus || 'enable'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Network className="w-3.5 h-3.5" />
                          {brokers.length}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditUser(user)}
                            className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-100"
                            title="Edit user"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={userPager.page}
            pageSize={userPager.pageSize}
            total={userPager.total}
            totalPages={userPager.totalPages}
            onPageChange={userPager.setPage}
            onPageSizeChange={userPager.setPageSize}
          />
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-sm">
                  <th className="text-left px-4 py-3 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 font-medium">Resource</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                  <th className="text-left px-4 py-3 font-medium">Source IPs</th>
                  <th className="text-left px-4 py-3 font-medium">Decision</th>
                  <th className="text-left px-4 py-3 font-medium">Brokers</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No ACL rules found. ACL (authorization) may not be enabled on the broker.
                    </td>
                  </tr>
                ) : (
                  rulePager.pageItems.map((rule) => (
                    <tr key={rule.key} className="hover:bg-slate-750 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-slate-100">
                        {rule.subject}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {rule.resource}
                      </td>
                      <td className="px-4 py-3">{renderChips(rule.actions)}</td>
                      <td className="px-4 py-3">{renderChips(rule.sourceIps)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            rule.decision === 'Deny'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-green-500/10 text-green-400'
                          }`}
                        >
                          {rule.decision || 'Allow'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Network className="w-3.5 h-3.5" />
                          {rule.brokers.length}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditRule(rule)}
                            className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-100"
                            title="Edit rule"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule)}
                            className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400"
                            title="Delete rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={rulePager.page}
            pageSize={rulePager.pageSize}
            total={rulePager.total}
            totalPages={rulePager.totalPages}
            onPageChange={rulePager.setPage}
            onPageSizeChange={rulePager.setPageSize}
          />
        </div>
      )}

      {showUserForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[480px] space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">
              {editingUser ? 'Edit ACL User' : 'Create ACL User'}
            </h3>

            {error && <ErrorNotice error={error} compact />}

            <div>
              <label className="text-sm text-slate-400 block mb-1">Username</label>
              <input
                type="text"
                value={userForm.username}
                disabled={editingUser}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">Password</label>
              <input
                type="text"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">User Type</label>
                <select
                  value={userForm.userType}
                  onChange={(e) => setUserForm({ ...userForm, userType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {USER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Status</label>
                <select
                  value={userForm.userStatus}
                  disabled={!editingUser}
                  onChange={(e) => setUserForm({ ...userForm, userStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                >
                  {USER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Changes are applied to every master broker in the cluster.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUserForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={savingUser}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
              >
                {savingUser ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRuleForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[560px] max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">
              {editingRule ? 'Edit ACL Rule' : 'Create ACL Rule'}
            </h3>

            {error && <ErrorNotice error={error} compact />}

            <div>
              <label className="text-sm text-slate-400 block mb-1">Subject</label>
              <input
                type="text"
                list="acl-subjects"
                value={ruleForm.subject}
                disabled={editingRule}
                onChange={(e) => setRuleForm({ ...ruleForm, subject: e.target.value })}
                placeholder="username"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
              <datalist id="acl-subjects">
                {users.map(({ user }) => (
                  <option key={user.username} value={user.username} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">Resource</label>
              <input
                type="text"
                value={ruleForm.resource}
                disabled={editingRule}
                onChange={(e) => setRuleForm({ ...ruleForm, resource: e.target.value })}
                placeholder="topic:myTopic / group:myGroup / *"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-2">Actions</label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <label
                    key={action}
                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      ruleForm.actions.includes(action)
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={ruleForm.actions.includes(action)}
                      onChange={() => toggleAction(action)}
                    />
                    {action}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Source IPs <span className="text-slate-500">(optional, comma separated)</span>
              </label>
              <input
                type="text"
                value={ruleForm.sourceIps}
                onChange={(e) => setRuleForm({ ...ruleForm, sourceIps: e.target.value })}
                placeholder="192.168.1.0/24, 10.0.0.1"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">Decision</label>
              <select
                value={ruleForm.decision}
                onChange={(e) => setRuleForm({ ...ruleForm, decision: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {DECISIONS.map((decision) => (
                  <option key={decision} value={decision}>
                    {decision}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500">
              Changes are applied to every master broker in the cluster.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRuleForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={savingRule}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
              >
                {savingRule ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
