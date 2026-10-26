/**
 * Extracts the drawn text lines of a PDF made by createSimplePdf. Content streams
 * are uncompressed; Latin lines are `(..) Tj` strings, lines that needed the
 * embedded Arabic font are wrapped in a marked-content span whose ActualText is
 * the logical (unshaped) text.
 */
export function extractPdfTextLines(pdf: Buffer | string): string[] {
  const buffer = typeof pdf === 'string' ? Buffer.from(pdf, 'base64') : pdf;
  const source = buffer.toString('latin1');
  const lines: string[] = [];
  const pattern =
    /\/Span << \/ActualText <([0-9A-F]+)> >> BDC[\s\S]*?\nEMC|\(((?:\\.|[^\\)])*)\) Tj/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (match[1] !== undefined) {
      lines.push(decodeUtf16BeHex(match[1]));
      continue;
    }
    lines.push(
      match[2]
        .replace(/\\([0-7]{3})/g, (_all, octal: string) => {
          const code = parseInt(octal, 8);
          return code === 0x96 ? '–' : code === 0x97 ? '—' : String.fromCharCode(code);
        })
        .replace(/\\(.)/g, '$1'),
    );
  }
  return lines;
}

function decodeUtf16BeHex(hex: string) {
  let text = '';
  // Skip the FEFF byte-order mark.
  for (let index = 4; index < hex.length; index += 4) {
    text += String.fromCharCode(parseInt(hex.slice(index, index + 4), 16));
  }
  return text;
}
