export function downloadBase64File(
  fileName: string,
  mimeType: string,
  contentBase64: string
) {
  const byteCharacters = window.atob(contentBase64)
  const byteNumbers = new Array(byteCharacters.length)

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index)
  }

  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function readFileAsBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return window.btoa(binary)
}
