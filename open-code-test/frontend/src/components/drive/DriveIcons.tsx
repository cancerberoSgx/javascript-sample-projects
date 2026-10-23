interface IconProps {
  className?: string
}

export function DriveIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2h6A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
    </svg>
  )
}

export function FolderIcon({
  open = false,
  className = 'h-4 w-4',
}: IconProps & { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M3.5 8.5h6l1.7 1.7H20a1 1 0 0 1 .9 1.4l-2.6 6.2a2 2 0 0 1-1.8 1.2H5.3a2 2 0 0 1-2-2V9.5a1 1 0 0 1 .2-1Z" />
          <path d="M3.5 8.5V7A2 2 0 0 1 5.5 5h3.2l2 2h6.8a2 2 0 0 1 2 2v1.2" />
        </>
      ) : (
        <path d="M3.5 7A2 2 0 0 1 5.5 5h3.2l2 2h7.8a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" />
      )}
    </svg>
  )
}

export function FileIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8l-4.5-4.5Z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h4.5" />
    </svg>
  )
}

export function ChevronIcon({
  open,
  className = 'h-3.5 w-3.5',
}: IconProps & { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  )
}
