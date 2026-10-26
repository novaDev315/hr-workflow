import { formatGeneratedAt } from './document-format';

type PdfLine = {
  text: string;
  fontSize?: number;
  font?: 'regular' | 'bold';
};

type PdfSection = {
  heading?: string;
  lines: string[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN_LEFT = 50;
const PAGE_MARGIN_TOP = 740;
const PAGE_MARGIN_BOTTOM = 60;
const DEFAULT_FONT_SIZE = 11;
const DEFAULT_LINE_HEIGHT = 16;
const MAX_TEXT_WIDTH = 92;

// Fonts are the standard Helvetica pair with WinAnsiEncoding, so printable ASCII
// and Latin-1 (0xA0-0xFF) characters render. Everything else becomes '?'.
// Known limitation: no embedded Unicode font, so Arabic and other non-Latin
// scripts cannot be drawn; see isLatin1Text / describeNameForPdf.
function sanitizePdfText(value: string) {
  let output = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    if (code === 0x5c) {
      output += '\\\\';
    } else if (code === 0x28) {
      output += '\\(';
    } else if (code === 0x29) {
      output += '\\)';
    } else if (code >= 0x20 && code <= 0x7e) {
      output += char;
    } else if (code >= 0xa0 && code <= 0xff) {
      output += `\\${code.toString(8).padStart(3, '0')}`;
    } else if (code === 0x2013) {
      output += '\\226'; // WinAnsi en dash
    } else if (code === 0x2014) {
      output += '\\227'; // WinAnsi em dash
    } else {
      output += '?';
    }
  }
  return output;
}

/** True when every character can be drawn with the built-in Latin-1 fonts. */
export function isLatin1Text(value: string) {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const printable = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
    if (!printable) {
      return false;
    }
  }
  return true;
}

/** "Name: Jane Doe", or a pointer to the employee record when the name is not printable. */
export function describeNameForPdf(label: string, name: string, employeeNumber: string) {
  return isLatin1Text(name)
    ? `${label}: ${name}`
    : `${label}: see employee record (${employeeNumber})`;
}

/** "Jane Doe (EMP001)", or "Employee EMP001" when the name is not printable. */
export function personLabelForPdf(name: string, employeeNumber: string) {
  return isLatin1Text(name) ? `${name} (${employeeNumber})` : `Employee ${employeeNumber}`;
}

function wrapText(value: string, maxLength = MAX_TEXT_WIDTH) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [''];
  }

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    const chunks = word.match(new RegExp(`.{1,${maxLength}}`, 'g')) ?? [word];
    lines.push(...chunks.slice(0, -1));
    current = chunks[chunks.length - 1] ?? '';
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export type SimplePdfOptions = {
  /** IANA zone for the "Generated at" stamp; falls back to UTC. */
  timeZone?: string | null;
  /** Overrides the generation time (tests). */
  now?: Date;
};

function buildLineLayout(
  title: string,
  subtitle: string | null,
  sections: PdfSection[],
  options: SimplePdfOptions = {},
) {
  const lines: PdfLine[] = [
    { text: title, fontSize: 20, font: 'bold' },
  ];

  if (subtitle?.trim()) {
    lines.push({ text: subtitle.trim(), fontSize: 11 });
  }

  lines.push({
    text: `Generated at ${formatGeneratedAt(options.now ?? new Date(), options.timeZone)}`,
    fontSize: 9,
  });

  lines.push({ text: '', fontSize: 11 });

  for (const section of sections) {
    if (section.heading?.trim()) {
      lines.push({ text: section.heading.trim(), fontSize: 13, font: 'bold' });
    }

    for (const row of section.lines) {
      for (const wrapped of wrapText(row)) {
        lines.push({ text: wrapped, fontSize: DEFAULT_FONT_SIZE });
      }
    }

    lines.push({ text: '', fontSize: 11 });
  }

  return lines;
}

function paginateLines(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let cursorY = PAGE_MARGIN_TOP;

  for (const line of lines) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    const lineHeight = Math.max(DEFAULT_LINE_HEIGHT, fontSize + 5);

    if (cursorY - lineHeight < PAGE_MARGIN_BOTTOM && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      cursorY = PAGE_MARGIN_TOP;
    }

    currentPage.push(line);
    cursorY -= lineHeight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildPageContent(page: PdfLine[], pageIndex: number, pageCount: number) {
  const commands = [
    '0.18 0.36 0.68 RG',
    '1.4 w',
    `${PAGE_MARGIN_LEFT} 724 m ${PAGE_WIDTH - PAGE_MARGIN_LEFT} 724 l S`,
    'BT',
  ];
  let cursorY = PAGE_MARGIN_TOP;

  for (const line of page) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    commands.push(`/${line.font === 'bold' ? 'F2' : 'F1'} ${fontSize} Tf`);
    commands.push(`1 0 0 1 ${PAGE_MARGIN_LEFT} ${cursorY} Tm`);
    commands.push(`(${sanitizePdfText(line.text)}) Tj`);
    cursorY -= Math.max(DEFAULT_LINE_HEIGHT, fontSize + 5);
  }

  commands.push(`/F1 9 Tf`);
  commands.push(`1 0 0 1 ${PAGE_MARGIN_LEFT} 36 Tm`);
  commands.push(`(HRFlow Pro | Page ${pageIndex + 1} of ${pageCount}) Tj`);
  commands.push('ET');

  return commands.join('\n');
}

function renderPdfDocument(pageContents: string[]) {
  const objects: string[] = [];
  const pageRefs: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  for (let index = 0; index < pageContents.length; index += 1) {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageRefs.push(`${pageObjectNumber} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );

    const stream = pageContents[index];
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
    );
  }

  objects[1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.join(' ')}] >>`;

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, 'utf8');
}

export function createSimplePdf(
  title: string,
  subtitle: string | null,
  sections: PdfSection[],
  options: SimplePdfOptions = {},
) {
  const lines = buildLineLayout(title, subtitle, sections, options);
  const pages = paginateLines(lines);
  const pageContents = pages.map((page, index) =>
    buildPageContent(page, index, pages.length),
  );

  return renderPdfDocument(pageContents);
}
