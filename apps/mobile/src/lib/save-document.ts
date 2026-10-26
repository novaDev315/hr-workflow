import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

export interface ExportedDocument {
  fileName: string
  mimeType: string
  contentBase64: string
}

export function safeFileName(name: string, fallback = 'document.pdf'): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

/** Writes the document to the cache folder and opens the system share sheet. */
export async function saveAndShareDocument(document: ExportedDocument): Promise<void> {
  if (!FileSystem.cacheDirectory) throw new Error("This device can't save files right now.")
  const uri = `${FileSystem.cacheDirectory}${safeFileName(document.fileName)}`
  await FileSystem.writeAsStringAsync(uri, document.contentBase64, {
    encoding: FileSystem.EncodingType.Base64,
  })
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.")
  }
  await Sharing.shareAsync(uri, {
    mimeType: document.mimeType || 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your payslip',
  })
}
