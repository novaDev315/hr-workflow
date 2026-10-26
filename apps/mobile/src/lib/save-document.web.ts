export interface ExportedDocument {
  fileName: string
  mimeType: string
  contentBase64: string
}

export function safeFileName(name: string, fallback = 'document.pdf'): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

/** Web preview: download the file through the browser. */
export async function saveAndShareDocument(document: ExportedDocument): Promise<string | null> {
  const binary = atob(document.contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType || 'application/pdf' }))
  const link = window.document.createElement('a')
  link.href = url
  const fileName = safeFileName(document.fileName)
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return `Downloaded ${fileName}. Find it in your downloads.`
}
