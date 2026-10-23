import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api, getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { ErrorAlert } from '../components/ErrorAlert'
import { Loading } from '../components/Loading'
import { Modal } from '../components/Modal'
import { RoleBadge } from '../components/RoleBadge'
import type { Organization, Role, User } from '../types'
import { formatDate } from '../utils'

type UserModal = { mode: 'create' } | { mode: 'edit'; user: User } | null

interface UserFormState {
  email: string
  password: string
  role: Role
}

const emptyUserForm: UserFormState = {
  email: '',
  password: '',
  role: 'member',
}

export function OrganizationDetailPage() {
  const { organizationId: organizationIdParam } = useParams<{
    organizationId: string
  }>()
  const organizationId = Number(organizationIdParam)
  const navigate = useNavigate()
  const { user, refreshUser, impersonate } = useAuth()
  const isRoot = user?.role === 'root'

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [userModal, setUserModal] = useState<UserModal>(null)
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm)
  const [userFormError, setUserFormError] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgFormError, setOrgFormError] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      setError('Invalid organization')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [loadedOrganization, loadedUsers] = await Promise.all([
        api.getOrganization(organizationId),
        api.listUsers(organizationId),
      ])
      setOrganization(loadedOrganization)
      setUsers(loadedUsers)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void load()
  }, [load])

  function openCreateUser() {
    setUserForm(emptyUserForm)
    setUserFormError('')
    setUserModal({ mode: 'create' })
  }

  function openEditUser(target: User) {
    setUserForm({ email: target.email, password: '', role: target.role })
    setUserFormError('')
    setUserModal({ mode: 'edit', user: target })
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userModal) {
      return
    }

    setSavingUser(true)
    setUserFormError('')

    try {
      if (userModal.mode === 'create') {
        const created = await api.createUser(organizationId, {
          email: userForm.email.trim(),
          password: userForm.password,
          role: isRoot ? userForm.role : 'member',
        })
        setUsers((current) =>
          [...current, created].sort((a, b) => a.email.localeCompare(b.email)),
        )
      } else {
        const updated = await api.updateUser(organizationId, userModal.user.id, {
          email: userForm.email.trim(),
          ...(isRoot ? { role: userForm.role } : {}),
          ...(userForm.password ? { password: userForm.password } : {}),
        })
        setUsers((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        if (updated.id === user?.id) {
          await refreshUser()
        }
      }
      setUserModal(null)
    } catch (err) {
      setUserFormError(getErrorMessage(err))
    } finally {
      setSavingUser(false)
    }
  }

  async function handleUserImpersonate(target: User) {
    try {
      await impersonate(organizationId, target.id)
      navigate('/organizations', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleUserDelete(target: User) {
    if (!window.confirm(`Delete user "${target.email}"?`)) {
      return
    }

    try {
      await api.deleteUser(organizationId, target.id)
      setUsers((current) => current.filter((item) => item.id !== target.id))
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function openOrgEdit() {
    if (!organization) {
      return
    }
    setOrgName(organization.name)
    setOrgFormError('')
    setOrgModalOpen(true)
  }

  async function handleOrgSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organization) {
      return
    }

    const trimmedName = orgName.trim()
    if (!trimmedName) {
      setOrgFormError('Name is required')
      return
    }

    setSavingOrg(true)
    setOrgFormError('')

    try {
      const updated = await api.updateOrganization(organization.id, trimmedName)
      setOrganization(updated)
      setOrgModalOpen(false)
    } catch (err) {
      setOrgFormError(getErrorMessage(err))
    } finally {
      setSavingOrg(false)
    }
  }

  async function handleOrgDelete() {
    if (!organization) {
      return
    }

    if (
      !window.confirm(
        `Delete "${organization.name}" and all of its users? This cannot be undone.`,
      )
    ) {
      return
    }

    try {
      await api.deleteOrganization(organization.id)
      navigate('/organizations', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (loading) {
    return <Loading label="Loading organization..." />
  }

  if (!organization) {
    return (
      <div className="space-y-4">
        <Link
          to="/organizations"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Organizations
        </Link>
        <ErrorAlert message={error || 'Organization not found'} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/organizations"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Organizations
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {organization.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Organization #{organization.id} · Created{' '}
              {formatDate(organization.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/organizations/${organization.id}/drives`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Open drives
            </Link>
            {isRoot && (
              <>
                <Button variant="secondary" onClick={openOrgEdit}>
                  Edit organization
                </Button>
                {organization.id !== user?.organization_id && (
                  <Button
                    variant="danger"
                    onClick={() => void handleOrgDelete()}
                  >
                    Delete organization
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {isRoot
                ? 'Add, edit, and remove any user in this organization.'
                : 'Add, edit, and remove members of your organization.'}
            </p>
          </div>
          <Button onClick={openCreateUser}>Add user</Button>
        </div>

        <div className="card mt-4 overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No users in this organization yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((target) => {
                    const isSelf = target.id === user?.id
                    const canManage = isRoot || target.role !== 'root'

                    return (
                      <tr key={target.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900">
                            {target.email}
                          </span>
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              you
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={target.role} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                          {formatDate(target.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-2">
                              {isRoot && target.role === 'member' && (
                                <Button
                                  variant="ghost"
                                  onClick={() => void handleUserImpersonate(target)}
                                >
                                  Impersonate
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                onClick={() => openEditUser(target)}
                              >
                                Edit
                              </Button>
                              {!isSelf && (
                                <Button
                                  variant="danger"
                                  onClick={() => void handleUserDelete(target)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-right text-xs text-slate-400">
                              Root user
                            </p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={userModal !== null}
        title={userModal?.mode === 'edit' ? 'Edit user' : 'Add user'}
        onClose={() => setUserModal(null)}
      >
        <form className="space-y-4" onSubmit={handleUserSubmit}>
          <div>
            <label className="field-label" htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              className="input"
              type="email"
              autoFocus
              required
              value={userForm.email}
              onChange={(event) =>
                setUserForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="user-password">
              Password
            </label>
            <input
              id="user-password"
              className="input"
              type="password"
              autoComplete="new-password"
              required={userModal?.mode === 'create'}
              minLength={6}
              value={userForm.password}
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={
                userModal?.mode === 'edit'
                  ? 'Leave blank to keep the current password'
                  : 'At least 6 characters'
              }
            />
          </div>

          <div>
            <label className="field-label" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              className="input"
              value={userForm.role}
              disabled={
                !isRoot ||
                (userModal?.mode === 'edit' && userModal.user.id === user?.id)
              }
              onChange={(event) =>
                setUserForm((current) => ({
                  ...current,
                  role: event.target.value as Role,
                }))
              }
            >
              <option value="member">member</option>
              {isRoot && <option value="root">root</option>}
            </select>
            {!isRoot && (
              <p className="mt-1 text-xs text-slate-500">
                Only root users can assign roles.
              </p>
            )}
            {isRoot &&
              userModal?.mode === 'edit' &&
              userModal.user.id === user?.id && (
                <p className="mt-1 text-xs text-slate-500">
                  You cannot change your own role.
                </p>
              )}
          </div>

          <ErrorAlert message={userFormError} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUserModal(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingUser}>
              {savingUser
                ? 'Saving...'
                : userModal?.mode === 'edit'
                  ? 'Save changes'
                  : 'Add user'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={orgModalOpen}
        title="Edit organization"
        onClose={() => setOrgModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleOrgSubmit}>
          <div>
            <label className="field-label" htmlFor="edit-organization-name">
              Name
            </label>
            <input
              id="edit-organization-name"
              className="input"
              autoFocus
              required
              maxLength={120}
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
            />
          </div>

          <ErrorAlert message={orgFormError} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOrgModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingOrg}>
              {savingOrg ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
