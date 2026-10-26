import { bidiIsolate, createSimplePdf } from './simple-pdf';
import { extractPdfTextLines } from '../__tests__/helpers/pdf-text';

const now = new Date('2031-03-01T10:00:00Z');

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
});
