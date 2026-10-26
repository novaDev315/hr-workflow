// Mirrors the server allowlist for policy uploads. The declared MIME type
// must match the extension, so it is always derived from the extension.
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

export const MAX_POLICY_FILE_BYTES = 10 * 1024 * 1024

export const POLICY_FILE_ACCEPT = [
  ...Object.keys(MIME_BY_EXTENSION).map((extension) => `.${extension}`),
  ...new Set(Object.values(MIME_BY_EXTENSION)),
].join(',')

export const POLICY_FILE_HINT = 'PDF, Word, text, PNG or JPG, up to 10 MB.'

function extensionOf(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim())
  return match ? match[1].toLowerCase() : ''
}

export type PolicyFileCheck =
  | { ok: true; mimeType: string }
  | { ok: false; message: string }

export function checkPolicyFile(file: File): PolicyFileCheck {
  const mimeType = MIME_BY_EXTENSION[extensionOf(file.name)]
  if (!mimeType) {
    return {
      ok: false,
      message: `“${file.name}” can't be uploaded. Use a PDF, Word, text, PNG or JPG file.`,
    }
  }
  if (file.size > MAX_POLICY_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      message: `“${file.name}” is ${sizeMb} MB. Files must be 10 MB or smaller.`,
    }
  }
  if (file.size === 0) {
    return { ok: false, message: `“${file.name}” is empty.` }
  }
  return { ok: true, mimeType }
}

// Files the server stores itself are only downloadable once published.
export function isUploadedFile(policy: { documentOriginalName?: string | null }) {
  return Boolean(policy.documentOriginalName)
}
