import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { api, getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { ErrorAlert } from '../components/ErrorAlert'
import { Loading } from '../components/Loading'
import { Modal } from '../components/Modal'
import type { Organization } from '../types'
import { formatDate } from '../utils'

type OrganizationModal =
  | { mode: 'create' }
  | { mode: 'edit'; organization: Organization }
  | null

export function OrganizationsPage() {
  const { user } = useAuth()
  const isRoot = user?.role === 'root'

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modal, setModal] = useState<OrganizationModal>(null)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrganizations(await api.listOrganizations())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setName('')
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(organization: Organization) {
    setName(organization.name)
    setFormError('')
    setModal({ mode: 'edit', organization })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal) {
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Name is required')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (modal.mode === 'create') {
        const created = await api.createOrganization(trimmedName)
        setOrganizations((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
        )
      } else {
        const updated = await api.updateOrganization(modal.organization.id, trimmedName)
        setOrganizations((current) =>
          current
            .map((organization) =>
              organization.id === updated.id ? updated : organization,
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      }
      setModal(null)
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(organization: Organization) {
    if (!window.confirm(`Delete "${organization.name}" and all of its users?`)) {
      return
    }

    try {
      await api.deleteOrganization(organization.id)
      setOrganizations((current) =>
        current.filter((item) => item.id !== organization.id),
      )
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRoot
              ? 'Manage every organization and the users inside them.'
              : 'View your organization and manage its users.'}
          </p>
        </div>

        {isRoot && <Button onClick={openCreate}>New organization</Button>}
      </div>

      <ErrorAlert message={error} />

      {loading ? (
        <Loading label="Loading organizations..." />
      ) : organizations.length === 0 ? (
        <div className="card p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No organizations yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isRoot
              ? 'Create your first organization to get started.'
              : 'You are not a member of an organization yet.'}
          </p>
          {isRoot && (
            <Button className="mt-5" onClick={openCreate}>
              New organization
            </Button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Organization
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
                {organizations.map((organization) => (
                  <tr key={organization.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <Link
                        to={`/organizations/${organization.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {organization.name}
                      </Link>
                      {organization.id === user?.organization_id && (
                        <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          your org
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                      {formatDate(organization.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/organizations/${organization.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          Open
                        </Link>
                        {isRoot && (
                          <Button
                            variant="secondary"
                            onClick={() => openEdit(organization)}
                          >
                            Edit
                          </Button>
                        )}
                        {isRoot && organization.id !== user?.organization_id && (
                          <Button
                            variant="danger"
                            onClick={() => void handleDelete(organization)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modal !== null}
        title={modal?.mode === 'edit' ? 'Edit organization' : 'New organization'}
        onClose={() => setModal(null)}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="organization-name">
              Name
            </label>
            <input
              id="organization-name"
              className="input"
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Inc."
            />
          </div>

          <ErrorAlert message={formError} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Saving...'
                : modal?.mode === 'edit'
                  ? 'Save changes'
                  : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
