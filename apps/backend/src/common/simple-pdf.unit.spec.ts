import { bidiIsolate, createSimplePdf, createSimplePdfDocuments, personLabelForPdf } from './simple-pdf';
import { extractPdfTextLines } from '../__tests__/helpers/pdf-text';

const now = new Date('2031-03-01T10:00:00Z');

/** Per drawn line (ActualText span): its pieces in draw order with their x position. */
function drawnLines(pdf: Buffer) {
  const source = pdf.toString('latin1');
  return source
    .split('/Span << /ActualText')
    .slice(1)
    .map((chunk) => {
      const body = chunk.slice(0, chunk.indexOf('\nEMC'));
      return [...body.matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm\n(<[0-9A-F]{4}>|\((?:\\.|[^\\)])*\)) Tj/g)].map(
        (m) => ({ x: Number(m[1]), op: m[2] }),
      ).filter((piece) => piece.op !== '()');
    });
}

describe('createSimplePdf', () => {
  it('keeps Latin-only documents on Helvetica without embedding a font', () => {
    const pdf = createSimplePdf('Payslip', null, [{ heading: 'Employee', lines: ['Name: José Müller'] }], { now });
    const source = pdf.toString('latin1');
    expect(source).toContain('/BaseFont /Helvetica');
    expect(source).not.toContain('NotoNaskhArabic');
    expect(extractPdfTextLines(pdf)).toContain('Name: José Müller');
  });

  it('embeds a subset Naskh font for Arabic and keeps the logical text extractable', () => {
    const pdf = createSimplePdf(
      'Payslip',
      null,
      [{ heading: 'Employee', lines: ['Name: محمد علي', 'محمد علي (EMP002) - 3 days', 'Total: 1,250.00 AED'] }],
      { now },
    );
    const lines = extractPdfTextLines(pdf);
    expect(lines).toContain('Name: محمد علي');
    expect(lines).toContain('محمد علي (EMP002) - 3 days');
    expect(lines).toContain('Total: 1,250.00 AED');
    expect(lines.join('')).not.toContain('?');

    const source = pdf.toString('latin1');
    expect(source).toContain('/Subtype /CIDFontType2');
    expect(source).toContain('/ToUnicode');
    // Subset, not the 150 KB font; Latin-only text did not pull in the bold face.
    expect(pdf.length).toBeLessThan(40_000);
    expect(source).not.toContain('NotoNaskhArabic-Bold');
  });

  it('draws characters neither font has as a visible question mark', () => {
    const pdf = createSimplePdf('T', null, [{ lines: ['名前'] }], { now });
    expect(pdf.toString('latin1')).toContain('(??) Tj');
  });

  it('writes a well-formed cross-reference table', () => {
    const pdf = createSimplePdf('T', null, [{ lines: ['محمد'] }], { now });
    const source = pdf.toString('latin1');
    const startxref = Number(/startxref\n(\d+)\n%%EOF$/.exec(source)![1]);
    expect(source.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...source.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((offset, index) => {
      expect(source.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
  });

  it('isolates user values so following digits stay in the left-to-right text', () => {
    const line = `Ali (E1) - ${bidiIsolate('إجازة سنوية')}, 10 Oct 2026 (1 day)`;
    const pdf = createSimplePdf('T', null, [{ lines: [line] }], { now });
    // Extracted text is clean logical text: no isolate characters.
    const lines = extractPdfTextLines(pdf);
    expect(lines).toContain('Ali (E1) - إجازة سنوية, 10 Oct 2026 (1 day)');
    expect(lines.join('')).not.toMatch(/[\u2066-\u2069\u200e\u200f]/);
    expect(pdf.toString('latin1')).not.toMatch(/\/ActualText <[0-9A-F]*206[6-9]/);
    // The tail after the isolate is drawn left to right, after the Arabic run.
    const stream = pdf.toString('latin1');
    expect(stream).toMatch(/\(, 10 Oct 2026 \\\(1 day\\\)\) Tj/);
    const xs = [...stream.matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm\n(<[0-9A-F]{4}>|\([^\n]*\)) Tj/g)];
    const tail = xs.find((m) => m[2].startsWith('(, 10'))!;
    const arabicXs = xs.filter((m) => m[2].startsWith('<')).map((m) => Number(m[1]));
    expect(Math.max(...arabicXs)).toBeLessThan(Number(tail[1]));
  });

  it('strips bidi controls from Latin-only lines and isolates values defensively', () => {
    const pdf = createSimplePdf('T', null, [{ lines: [`Dept: ${bidiIsolate('Sales\u202e')}`] }], { now });
    expect(extractPdfTextLines(pdf)).toContain('Dept: Sales');
    expect(pdf.toString('latin1')).not.toContain('NotoNaskhArabic');
  });

  it('closes and reopens an isolate that a line break splits', () => {
    const leaveType = Array.from({ length: 6 }, () => 'إجازة سنوية مدفوعة').join(' ');
    const line = `${personLabelForPdf('Ali', 'E1')} - ${bidiIsolate(leaveType)}, 12 Mar 2031 \u2013 15 Mar 2031 (4 days)`;
    const pdf = createSimplePdf('T', null, [{ lines: [line] }], { now });
    const body = extractPdfTextLines(pdf).slice(3, -2); // after title, stamp, blank
    expect(body.length).toBe(2);
    expect(body.join(' ')).toBe(line.replace(/[\u2066-\u2069]/g, ''));

    const [first, second] = drawnLines(pdf).slice(-2);
    // Continuation line: Arabic run, then the left-to-right tail in reading order.
    const tailIndex = second.findIndex((piece) => piece.op.startsWith('(, 12 Mar 2031'));
    expect(tailIndex).toBeGreaterThan(0);
    expect(second[tailIndex].op).toContain('(4 days');
    const arabicXs = second.filter((piece) => piece.op.startsWith('<')).map((piece) => piece.x);
    expect(Math.max(...arabicXs)).toBeLessThan(second[tailIndex].x);
    // First line is the left-to-right head followed by Arabic only.
    expect(first[0].op).toBe('(Ali)');
  });

  it('ignores unisolated embedding and override controls when ordering a line', () => {
    const pdf = createSimplePdf('T', null, [{ lines: ['محمد \u202e Net pay: 1000 AED'] }], { now });
    const stream = pdf.toString('latin1');
    expect(stream).toContain('Net pay: 1000 AED) Tj');
    expect(extractPdfTextLines(pdf)).toContain('محمد  Net pay: 1000 AED');
  });

  it('splits words longer than the line limit even after other text', () => {
    const long = 'x'.repeat(300);
    const pdf = createSimplePdf('T', null, [{ lines: [`short ${long} tail`] }], { now });
    const lines = extractPdfTextLines(pdf).filter((text) => /x|short|tail/.test(text) && !text.startsWith('Generated'));
    expect(lines.length).toBeGreaterThanOrEqual(4);
    lines.forEach((text) => expect(text.length).toBeLessThanOrEqual(92));
    expect(lines.join(' ').replace(/ /g, '')).toBe(`short${long}tail`);

    const emoji = createSimplePdf('T', null, [{ lines: ['😀'.repeat(100)] }], { now });
    extractPdfTextLines(emoji)
      .filter((text) => text.includes('😀'))
      .forEach((text) => expect(text).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/));
  });

  it('measures Latin-1 and dash characters with Helvetica widths', () => {
    const pdf = createSimplePdf('T', null, [{ lines: [`Müller – ${bidiIsolate('محمد')} © 2031`] }], { now });
    const [line] = drawnLines(pdf).slice(-1);
    const head = line.find((piece) => piece.op.startsWith('(M'))!;
    const arabic = line.find((piece) => piece.op.startsWith('<'))!;
    // "Müller – " at 11pt: M 833 u 556 l 222 l 222 e 556 r 333 space 278 en dash 556 space 278 = 3834
    expect(arabic.x - head.x).toBeGreaterThan(41.5);
    expect(arabic.x - head.x).toBeLessThan(42.9);
  });

  it('derives subset names from the glyph set', () => {
    const name = (text: string) => /\/BaseFont \/([A-Z]{6})\+NotoNaskhArabic-Regular/.exec(
      createSimplePdf('T', null, [{ lines: [text] }], { now }).toString('latin1'),
    )![1];
    expect(name('محمد')).toBe(name('محمد'));
    expect(name('محمد')).not.toBe(name('علي'));
  });
});

describe('createSimplePdfDocuments', () => {
  const doc = (name: string) => ({
    title: 'Payslip',
    subtitle: null,
    sections: [{ heading: 'Employee', lines: [`Name: ${name}`] }],
  });

  it('starts every document on its own page and numbers pages across the file', () => {
    const pdf = createSimplePdfDocuments([doc('Ann'), doc('Bob'), doc('Cy')], { now });
    const source = pdf.toString('latin1');
    expect(source).toContain('/Count 3');
    const pages = source.split('/Type /Page /Parent').length - 1;
    expect(pages).toBe(3);
    const lines = extractPdfTextLines(pdf);
    expect(lines).toEqual(
      expect.arrayContaining(['Name: Ann', 'Name: Bob', 'Name: Cy', 'HRFlow Pro | Page 3 of 3']),
    );
    // Each name sits on a different page: one page footer follows each.
    const footers = lines.filter((line) => line.startsWith('HRFlow Pro | Page'));
    expect(footers).toHaveLength(3);
    expect(lines.indexOf('Name: Ann')).toBeLessThan(lines.indexOf(footers[0]));
    expect(lines.indexOf('Name: Bob')).toBeGreaterThan(lines.indexOf(footers[0]));
    expect(lines.indexOf('Name: Bob')).toBeLessThan(lines.indexOf(footers[1]));
  });

  it('produces the same bytes as createSimplePdf for a single document', () => {
    const one = doc('Ann');
    expect(createSimplePdfDocuments([one], { now }).equals(
      createSimplePdf(one.title, one.subtitle, one.sections, { now }),
    )).toBe(true);
  });
});
