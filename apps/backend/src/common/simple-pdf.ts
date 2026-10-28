import { createHash } from 'crypto';
import { deflateSync } from 'zlib';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import bidiFactory from 'bidi-js';
import * as fontkit from 'fontkit';
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

// Latin text keeps the built-in Helvetica pair (WinAnsiEncoding): printable ASCII,
// Latin-1 (0xA0-0xFF) and the en/em dash. Everything else (Arabic and any other
// script) is drawn with an embedded, subset Noto Naskh Arabic; lines that need it
// are shaped (contextual joining via the font's GSUB/GPOS) and put in visual
// order with the Unicode bidi algorithm. See drawUnicodeLine.
function isHelveticaChar(code: number) {
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    code === 0x2013 ||
    code === 0x2014
  );
}

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

// Bidi formatting characters never get a glyph and are removed from extracted text.
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const FSI = 0x2068;
const PDI = 0x2069;

function isBidiControl(code: number) {
  return (
    code === 0x61c ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function stripBidiControls(value: string) {
  return value.replace(BIDI_CONTROLS, '');
}

/**
 * Wraps a user-supplied value (name, department, leave type...) in a first-strong
 * isolate (FSI ... PDI) so an Arabic value keeps its own direction and cannot pull
 * the digits or punctuation around it into its right-to-left run.
 */
export function bidiIsolate(value: string) {
  return `\u2068${stripBidiControls(value)}\u2069`;
}

/** "Name: Jane Doe". The employee number is kept for call-site compatibility. */
export function describeNameForPdf(label: string, name: string, _employeeNumber?: string) {
  return `${label}: ${bidiIsolate(name)}`;
}

/** "Jane Doe (EMP001)". */
export function personLabelForPdf(name: string, employeeNumber: string) {
  return `${bidiIsolate(name)} (${bidiIsolate(employeeNumber)})`;
}

// --- Helvetica metrics (AFM widths for 0x20-0x7E, 1000 units per em) -------------

const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// AFM widths for WinAnsi 0xA0-0xFF (the Latin-1 half Helvetica is allowed to draw).
const HELVETICA_LATIN1_WIDTHS = [
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];
const HELVETICA_BOLD_LATIN1_WIDTHS = [
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

function helveticaWidth(text: string, fontSize: number, bold: boolean) {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  const latin1 = bold ? HELVETICA_BOLD_LATIN1_WIDTHS : HELVETICA_LATIN1_WIDTHS;
  let total = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (code >= 0x20 && code <= 0x7e) {
      total += table[code - 0x20];
    } else if (code >= 0xa0 && code <= 0xff) {
      total += latin1[code - 0xa0];
    } else if (code === 0x2013) {
      total += 556; // en dash
    } else if (code === 0x2014) {
      total += 1000; // em dash
    } else {
      total += 556; // drawn as '?'
    }
  }
  return (total * fontSize) / 1000;
}

// --- Embedded Arabic font ------------------------------------------------------

type FkGlyph = {
  id: number;
  codePoints: number[];
  advanceWidth: number;
};
type FkPosition = { xAdvance: number; xOffset: number; yOffset: number };
type FkFont = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  hasGlyphForCodePoint(codePoint: number): boolean;
  layout(
    text: string,
    features?: unknown,
    script?: string,
    language?: string,
    direction?: string,
  ): { glyphs: FkGlyph[]; positions: FkPosition[] };
  createSubset(): {
    includeGlyph(glyph: FkGlyph | number): number;
    encode(): Uint8Array;
  };
};

const FONT_FILES = {
  regular: 'NotoNaskhArabic-Regular.ttf',
  bold: 'NotoNaskhArabic-Bold.ttf',
} as const;

const loadedFonts = new Map<'regular' | 'bold', FkFont>();

/**
 * apps/backend/assets/fonts, found relative to this module (src/common under
 * ts-jest, dist/src/common after nest build), never relative to the cwd.
 */
function resolveFontFile(fileName: string) {
  const candidates = [
    join(__dirname, '..', '..', 'assets', 'fonts', fileName),
    join(__dirname, '..', '..', '..', 'assets', 'fonts', fileName),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`PDF font ${fileName} not found; looked in ${candidates.join(', ')}`);
  }
  return found;
}

function loadFont(face: 'regular' | 'bold') {
  let font = loadedFonts.get(face);
  if (!font) {
    font = fontkit.create(readFileSync(resolveFontFile(FONT_FILES[face]))) as unknown as FkFont;
    loadedFonts.set(face, font);
  }
  return font;
}

const bidi = bidiFactory();

type Placed = {
  kind: 'helvetica' | 'naskh';
  text: string; // visual-order text for helvetica
  glyphs?: { gid: number; x: number; y: number }[]; // naskh, relative to run origin
  width: number;
};

/** Per-document subset of one Naskh face plus the data its PDF objects need. */
class NaskhSubset {
  readonly subset;
  readonly widths = new Map<number, number>(); // new gid -> width in 1/1000 em
  readonly unicode = new Map<number, number[]>(); // new gid -> code points
  readonly sourceGlyphs = new Set<number>(); // glyph ids in the source font
  constructor(readonly font: FkFont) {
    this.subset = font.createSubset();
  }
  include(glyph: FkGlyph) {
    const gid = this.subset.includeGlyph(glyph);
    this.sourceGlyphs.add(glyph.id);
    if (!this.widths.has(gid)) {
      this.widths.set(gid, Math.round((glyph.advanceWidth * 1000) / this.font.unitsPerEm));
      this.unicode.set(gid, glyph.codePoints);
    }
    return gid;
  }
}

type DocumentFonts = { regular?: NaskhSubset; bold?: NaskhSubset };

function naskhFor(fonts: DocumentFonts, face: 'regular' | 'bold') {
  fonts[face] ??= new NaskhSubset(loadFont(face));
  return fonts[face];
}

/**
 * Drops every bidi control except the first-strong isolate pair that bidiIsolate
 * emits, and keeps that pair balanced: unmatched PDIs are removed and isolates
 * still open at the end are closed. Embeddings, overrides and marks can no longer
 * steer level resolution.
 */
function normalizeIsolates(text: string) {
  let output = '';
  let depth = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === FSI) {
      depth += 1;
      output += char;
    } else if (code === PDI) {
      if (depth > 0) {
        depth -= 1;
        output += char;
      }
    } else if (!isBidiControl(code)) {
      output += char;
    }
  }
  return output + String.fromCodePoint(PDI).repeat(depth);
}

function needsUnicodeFont(text: string) { // expects text without bidi controls
  for (const char of text) {
    if (!isHelveticaChar(char.codePointAt(0) ?? 0)) {
      return true;
    }
  }
  return false;
}

/**
 * Lays out one line that contains non-Latin text: bidi levels, one segment per
 * (level, face) run, shaping for Naskh segments, then visual order. Returns the
 * visual-order pieces and their total width.
 */
function layoutUnicodeLine(
  rawText: string,
  fontSize: number,
  face: 'regular' | 'bold',
  fonts: DocumentFonts,
) {
  const text = normalizeIsolates(rawText);
  // Documents are English-labelled, so every line is a left-to-right paragraph in
  // which Arabic names or values form right-to-left runs.
  const embedding = bidi.getEmbeddingLevels(text, 'ltr');
  const levels: Uint8Array = embedding.levels;
  const mirrored: Map<number, string> = bidi.getMirroredCharactersMap(text, levels);
  const naskh = naskhFor(fonts, face);

  // Face per UTF-16 unit: Helvetica for what it can draw, Naskh for the rest.
  // Inside right-to-left runs, spaces and punctuation that Naskh has stay with
  // the Arabic so shaping and spacing match the surrounding words.
  const faceOf: ('helvetica' | 'naskh')[] = [];
  const units: string[] = [];
  let i = 0;
  while (i < text.length) {
    const code = text.codePointAt(i) ?? 63;
    const width = code > 0xffff ? 2 : 1;
    let kind: 'helvetica' | 'naskh' = isHelveticaChar(code) ? 'helvetica' : 'naskh';
    let unit = String.fromCodePoint(code);
    if (isBidiControl(code)) {
      // Takes part in level resolution but draws nothing.
      kind = 'helvetica';
      unit = '';
    }
    if (kind === 'naskh' && !naskh.font.hasGlyphForCodePoint(code)) {
      // Neither font has it (other scripts): a visible '?' like before.
      kind = 'helvetica';
      unit = '?';
    }
    if (
      kind === 'helvetica' &&
      levels[i] % 2 === 1 &&
      !/[\p{L}\p{N}]/u.test(String.fromCodePoint(code)) &&
      naskh.font.hasGlyphForCodePoint(code)
    ) {
      kind = 'naskh';
    }
    for (let k = 0; k < width; k += 1) {
      faceOf.push(kind);
      units.push(k === 0 ? unit : '');
    }
    i += width;
  }

  type Segment = { start: number; end: number; level: number; kind: 'helvetica' | 'naskh' };
  const segments: Segment[] = [];
  const segmentOf: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = segments[segments.length - 1];
    if (last && last.level === levels[index] && last.kind === faceOf[index]) {
      last.end = index + 1;
    } else {
      segments.push({ start: index, end: index + 1, level: levels[index], kind: faceOf[index] });
    }
    segmentOf.push(segments.length - 1);
  }

  const visual: number[] = bidi.getReorderedIndices(text, embedding);
  const order: number[] = [];
  for (const index of visual) {
    if (order[order.length - 1] !== segmentOf[index]) {
      order.push(segmentOf[index]);
    }
  }

  const placed: Placed[] = [];
  for (const segmentIndex of order) {
    const segment = segments[segmentIndex];
    const odd = segment.level % 2 === 1;
    let logical = '';
    for (let index = segment.start; index < segment.end; index += 1) {
      logical += odd && mirrored.has(index) ? mirrored.get(index) : units[index];
    }

    if (segment.kind === 'helvetica') {
      const visualText = odd ? Array.from(logical).reverse().join('') : logical;
      placed.push({
        kind: 'helvetica',
        text: visualText,
        width: helveticaWidth(visualText, fontSize, face === 'bold'),
      });
      continue;
    }

    const run = naskh.font.layout(logical, undefined, 'arab', 'ar', odd ? 'rtl' : 'ltr');
    const scale = fontSize / naskh.font.unitsPerEm;
    const glyphs: { gid: number; x: number; y: number }[] = [];
    let pen = 0;
    run.glyphs.forEach((glyph, glyphIndex) => {
      const position = run.positions[glyphIndex];
      glyphs.push({
        gid: naskh.include(glyph),
        x: pen + position.xOffset * scale,
        y: position.yOffset * scale,
      });
      pen += position.xAdvance * scale;
    });
    placed.push({ kind: 'naskh', text: logical, glyphs, width: pen });
  }

  return { placed, width: placed.reduce((sum, piece) => sum + piece.width, 0) };
}

function toHex(value: number, digits = 4) {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}

function utf16Hex(text: string) {
  let output = 'FEFF';
  for (let index = 0; index < text.length; index += 1) {
    output += toHex(text.charCodeAt(index));
  }
  return output;
}

/** Content-stream commands for one line containing non-Latin text. */
function drawUnicodeLine(
  line: PdfLine,
  cursorY: number,
  fonts: DocumentFonts,
  commands: string[],
) {
  const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
  const face = line.font === 'bold' ? 'bold' : 'regular';
  const layout = layoutUnicodeLine(line.text, fontSize, face, fonts);
  let x = PAGE_MARGIN_LEFT;

  // ActualText keeps the logical text extractable (search, copy, tests).
  commands.push(`/Span << /ActualText <${utf16Hex(stripBidiControls(line.text))}> >> BDC`);
  for (const piece of layout.placed) {
    if (piece.kind === 'helvetica') {
      commands.push(`/${face === 'bold' ? 'F2' : 'F1'} ${fontSize} Tf`);
      commands.push(`1 0 0 1 ${round(x)} ${cursorY} Tm`);
      commands.push(`(${sanitizePdfText(piece.text)}) Tj`);
    } else {
      commands.push(`/${face === 'bold' ? 'F4' : 'F3'} ${fontSize} Tf`);
      for (const glyph of piece.glyphs ?? []) {
        commands.push(`1 0 0 1 ${round(x + glyph.x)} ${round(cursorY + glyph.y)} Tm`);
        commands.push(`<${toHex(glyph.gid)}> Tj`);
      }
    }
    x += piece.width;
  }
  commands.push('EMC');
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isolateDelta(code: number) {
  if (code === FSI) {
    return 1;
  }
  return code === PDI ? -1 : 0;
}

/**
 * Greedy word wrap on visible length (bidi controls take no width). A break inside
 * an isolated value closes it with PDI at the end of the line and reopens it with
 * FSI at the start of the next, so each line stays a balanced, self-contained
 * bidi unit. Words longer than the limit are split by code point, never between
 * a base character and its combining marks.
 */
function wrapText(value: string, maxLength = MAX_TEXT_WIDTH) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [''];
  }

  const closer = String.fromCodePoint(PDI);
  const opener = String.fromCodePoint(FSI);
  const lines: string[] = [];
  let current = '';
  let visible = 0; // visible code points on the current line
  let open = 0; // isolates open at the end of `current`

  const flush = () => {
    lines.push(current + closer.repeat(open));
    current = opener.repeat(open);
    visible = 0;
  };
  const append = (char: string) => {
    current += char;
    open = Math.max(0, open + isolateDelta(char.codePointAt(0) ?? 0));
  };

  for (const word of trimmed.split(/\s+/)) {
    const chars = Array.from(word);
    const wordVisible = chars.filter((char) => !isBidiControl(char.codePointAt(0) ?? 0)).length;

    if (visible > 0 && visible + 1 + wordVisible > maxLength) {
      flush();
    }
    if (visible > 0) {
      append(' ');
      visible += 1;
    }

    for (const char of chars) {
      const code = char.codePointAt(0) ?? 0;
      if (isBidiControl(code)) {
        append(char);
        continue;
      }
      const combining = /^[\p{M}\u200d\u200c]$/u.test(char);
      if (visible >= maxLength && !combining) {
        flush();
      }
      append(char);
      visible += 1;
    }
  }

  if (visible > 0) {
    lines.push(current + closer.repeat(open));
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

function buildPageContent(
  page: PdfLine[],
  pageIndex: number,
  pageCount: number,
  fonts: DocumentFonts,
) {
  const commands = [
    '0.18 0.36 0.68 RG',
    '1.4 w',
    `${PAGE_MARGIN_LEFT} 724 m ${PAGE_WIDTH - PAGE_MARGIN_LEFT} 724 l S`,
    'BT',
  ];
  let cursorY = PAGE_MARGIN_TOP;

  for (const line of page) {
    const fontSize = line.fontSize ?? DEFAULT_FONT_SIZE;
    const plain = stripBidiControls(line.text);
    if (needsUnicodeFont(plain)) {
      drawUnicodeLine(line, cursorY, fonts, commands);
    } else {
      commands.push(`/${line.font === 'bold' ? 'F2' : 'F1'} ${fontSize} Tf`);
      commands.push(`1 0 0 1 ${PAGE_MARGIN_LEFT} ${cursorY} Tm`);
      commands.push(`(${sanitizePdfText(plain)}) Tj`);
    }
    cursorY -= Math.max(DEFAULT_LINE_HEIGHT, fontSize + 5);
  }

  commands.push(`/F1 9 Tf`);
  commands.push(`1 0 0 1 ${PAGE_MARGIN_LEFT} 36 Tm`);
  commands.push(`(HRFlow Pro | Page ${pageIndex + 1} of ${pageCount}) Tj`);
  commands.push('ET');

  return commands.join('\n');
}

function streamObject(dictionary: string, data: Buffer) {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

function buildToUnicode(subset: NaskhSubset) {
  const entries = [...subset.unicode.entries()]
    .filter(([, codePoints]) => codePoints.length > 0)
    .sort((left, right) => left[0] - right[0]);
  const body: string[] = [];
  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    body.push(`${chunk.length} beginbfchar`);
    for (const [gid, codePoints] of chunk) {
      const hex = codePoints
        .map((cp) => utf16Hex(String.fromCodePoint(cp)).slice(4))
        .join('');
      body.push(`<${toHex(gid)}> <${hex}>`);
    }
    body.push('endbfchar');
  }
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...body,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
  return Buffer.from(cmap, 'latin1');
}

/**
 * Six uppercase letters derived from the subset's glyph set (PDF 32000 9.6.4), so
 * the tag is stable for a glyph set and differs between different subsets.
 */
function subsetTag(name: string, glyphs: Set<number>) {
  const digest = createHash('sha256')
    .update(`${name}:${[...glyphs].sort((a, b) => a - b).join(',')}`)
    .digest();
  let tag = '';
  for (let index = 0; index < 6; index += 1) {
    tag += String.fromCharCode(65 + (digest[index] % 26));
  }
  return tag;
}

/** The five objects of one embedded subset: Type0, CIDFont, descriptor, file, ToUnicode. */
function buildNaskhObjects(subset: NaskhSubset, firstObject: number, name: string) {
  const { font } = subset;
  const scale = 1000 / font.unitsPerEm;
  const fontFile = Buffer.from(subset.subset.encode());
  const widths = [...subset.widths.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([gid, width]) => `${gid} [${width}]`)
    .join(' ');
  const baseName = `${subsetTag(name, subset.sourceGlyphs)}+NotoNaskhArabic-${name}`;
  const [cid, descriptor] = [firstObject + 1, firstObject + 2];
  return [
    Buffer.from(
      `<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${firstObject + 4} 0 R >>`,
      'latin1',
    ),
    Buffer.from(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${widths}] >>`,
      'latin1',
    ),
    Buffer.from(
      `<< /Type /FontDescriptor /FontName /${baseName} /Flags 4 /FontBBox [${Math.round(font.bbox.minX * scale)} ${Math.round(font.bbox.minY * scale)} ${Math.round(font.bbox.maxX * scale)} ${Math.round(font.bbox.maxY * scale)}] /ItalicAngle 0 /Ascent ${Math.round(font.ascent * scale)} /Descent ${Math.round(font.descent * scale)} /CapHeight ${Math.round((font.capHeight || font.ascent) * scale)} /StemV 80 /FontFile2 ${firstObject + 3} 0 R >>`,
      'latin1',
    ),
    streamObject(
      `/Filter /FlateDecode /Length1 ${fontFile.length}`,
      deflateSync(fontFile),
    ),
    streamObject('/Filter /FlateDecode', deflateSync(buildToUnicode(subset))),
  ];
}

function renderPdfDocument(pageContents: string[], fonts: DocumentFonts) {
  const objects: Buffer[] = [];
  const pageRefs: string[] = [];
  const pageObjectsEnd = 5 + pageContents.length * 2; // first free object number
  const fontResources = ['/F1 3 0 R', '/F2 4 0 R'];
  const extraObjects: Buffer[] = [];

  for (const [face, key, name] of [
    ['regular', 'F3', 'Regular'],
    ['bold', 'F4', 'Bold'],
  ] as const) {
    const subset = fonts[face];
    if (subset) {
      const first = pageObjectsEnd + extraObjects.length;
      fontResources.push(`/${key} ${first} 0 R`);
      extraObjects.push(...(buildNaskhObjects(subset, first, name)));
    }
  }

  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(Buffer.from(''));
  objects.push(
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
  );
  objects.push(
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
  );

  for (let index = 0; index < pageContents.length; index += 1) {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageRefs.push(`${pageObjectNumber} 0 R`);
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << ${fontResources.join(' ')} >> >> /Contents ${contentObjectNumber} 0 R >>`,
      ),
    );
    objects.push(streamObject('', Buffer.from(pageContents[index], 'latin1')));
  }

  objects[1] = Buffer.from(`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.join(' ')}] >>`);
  objects.push(...extraObjects);

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let length = chunks[0].length;
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(length);
    const wrapped = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
      object,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    chunks.push(wrapped);
    length += wrapped.length;
  });

  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    trailer += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  trailer += `startxref\n${length}\n%%EOF`;
  chunks.push(Buffer.from(trailer, 'latin1'));

  return Buffer.concat(chunks);
}

export type SimplePdfDocument = {
  title: string;
  subtitle: string | null;
  sections: PdfSection[];
};

/**
 * Several documents in one PDF. Each document starts on a new page (its own
 * title block and rule), and page numbers run across the whole file.
 */
export function createSimplePdfDocuments(
  documents: SimplePdfDocument[],
  options: SimplePdfOptions = {},
) {
  const pages = documents.flatMap((document) =>
    paginateLines(
      buildLineLayout(document.title, document.subtitle, document.sections, options),
    ),
  );
  const fonts: DocumentFonts = {};
  const pageContents = pages.map((page, index) =>
    buildPageContent(page, index, pages.length, fonts),
  );

  return renderPdfDocument(pageContents, fonts);
}

export function createSimplePdf(
  title: string,
  subtitle: string | null,
  sections: PdfSection[],
  options: SimplePdfOptions = {},
) {
  return createSimplePdfDocuments([{ title, subtitle, sections }], options);
}
