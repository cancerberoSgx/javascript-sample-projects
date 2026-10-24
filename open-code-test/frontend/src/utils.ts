export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** exponent
  const formatted = value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[exponent]}`
}

export function isTextFileType(fileType: string | null | undefined): boolean {
  if (!fileType) {
    return false
  }

  const value = fileType.split(';', 1)[0].trim().toLowerCase()
  return (
    value.startsWith('text/') ||
    [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-javascript',
      'image/svg+xml',
    ].includes(value) ||
    value.endsWith('+json') ||
    value.endsWith('+xml')
  )
}

const IMAGE_FILE_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/jpg',
  'image/jxl',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

const IMAGE_EXTENSION_PATTERN =
  /\.(avif|bmp|gif|heic|heif|ico|jpe?g|jxl|png|svg|tiff?|webp)$/i

export function isImageFileType(
  fileType: string | null | undefined,
): boolean {
  if (!fileType) {
    return false
  }
  return IMAGE_FILE_TYPES.has(fileType.split(';', 1)[0].trim().toLowerCase())
}

export function isImageFile(
  fileType: string | null | undefined,
  name: string,
): boolean {
  return isImageFileType(fileType) || IMAGE_EXTENSION_PATTERN.test(name)
}
