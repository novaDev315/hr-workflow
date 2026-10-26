/** Extracts the drawn text lines of a PDF made by createSimplePdf (uncompressed, Latin-1). */
export function extractPdfTextLines(pdf: Buffer | string): string[] {
  const buffer = typeof pdf === 'string' ? Buffer.from(pdf, 'base64') : pdf;
  const source = buffer.toString('latin1');
  const lines: string[] = [];
  const pattern = /\(((?:\\.|[^\\)])*)\) Tj/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    lines.push(
      match[1]
        .replace(/\\([0-7]{3})/g, (_all, octal: string) => {
          const code = parseInt(octal, 8);
          return code === 0x96 ? '–' : code === 0x97 ? '—' : String.fromCharCode(code);
        })
        .replace(/\\(.)/g, '$1'),
    );
  }
  return lines;
}
