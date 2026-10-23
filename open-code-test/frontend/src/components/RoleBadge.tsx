import type { Role } from '../types'

export function RoleBadge({ role }: { role: Role }) {
  const isRoot = role === 'root'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isRoot
          ? 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200'
          : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
      }`}
    >
      {role}
    </span>
  )
}
