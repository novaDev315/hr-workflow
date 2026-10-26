import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  buildContentDisposition,
  getPolicyFileType,
  POLICY_FILE_MAX_BASE64_LENGTH,
  STORED_POLICY_FILE_NAME_PATTERN,
} from './policy-file-types';
import { CreatePolicyDocumentInput, UpdatePolicyDocumentInput } from './policy.types';

describe('policy file types', () => {
  it('maps allowlisted extensions to canonical mime types', () => {
    expect(getPolicyFileType('.PDF')?.mimeType).toBe('application/pdf');
    expect(getPolicyFileType('jpeg')?.mimeType).toBe('image/jpeg');
    expect(getPolicyFileType('.html')).toBeNull();
    expect(getPolicyFileType('svg')).toBeNull();
    expect(getPolicyFileType('constructor')).toBeNull();
  });

  it('serves only pdf and images inline', () => {
    expect(buildContentDisposition(getPolicyFileType('pdf')!, 'a.pdf')).toMatch(/^inline;/);
    expect(buildContentDisposition(getPolicyFileType('png')!, 'a.png')).toMatch(/^inline;/);
    expect(buildContentDisposition(getPolicyFileType('docx')!, 'a.docx')).toMatch(/^attachment;/);
    expect(buildContentDisposition(getPolicyFileType('txt')!, 'a.txt')).toMatch(/^attachment;/);
  });

  it('encodes the filename per RFC 5987 without raw quotes', () => {
    const header = buildContentDisposition(
      getPolicyFileType('pdf')!,
      `we"ird 'na(me)*.pdf`,
    );
    expect(header).toBe(
      "inline; filename*=UTF-8''we%22ird%20%27na%28me%29%2A.pdf",
    );
    expect(header).not.toContain('"');
  });

  it('does not throw on a lone surrogate in the filename', () => {
    expect(buildContentDisposition(getPolicyFileType('pdf')!, '\ud800.pdf')).toContain(
      "filename*=UTF-8''policy-file",
    );
  });

  it('only accepts uuid-shaped stored names', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(STORED_POLICY_FILE_NAME_PATTERN.test(`${uuid}.pdf`)).toBe(true);
    expect(STORED_POLICY_FILE_NAME_PATTERN.test(`${uuid}.PDF`)).toBe(false);
    expect(STORED_POLICY_FILE_NAME_PATTERN.test(`../${uuid}.pdf`)).toBe(false);
    expect(STORED_POLICY_FILE_NAME_PATTERN.test('x.pdf')).toBe(false);
  });

  it('derives the base64 cap from the 10 MB decoded limit', () => {
    expect(POLICY_FILE_MAX_BASE64_LENGTH).toBe(13981016);
  });
});

describe('policy documentUrl validation', () => {
  const base = {
    title: 'T',
    category: 'C',
    version: '1',
    effectiveDate: '2026-01-01',
    description: 'D',
  };

  const errorsFor = async (documentUrl: string | null | undefined) =>
    validate(plainToInstance(CreatePolicyDocumentInput, { ...base, documentUrl }));

  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'ftp://x.example/a', 'not a url'])(
    'rejects %s',
    async (url) => {
      const errors = await errorsFor(url);
      expect(errors.map((error) => error.property)).toContain('documentUrl');
    },
  );

  it.each(['https://example.test/policy.pdf', 'http://localhost:4001/policy-files/x.pdf'])(
    'accepts %s',
    async (url) => {
      expect(await errorsFor(url)).toHaveLength(0);
    },
  );

  it.each([undefined, null, '', '   '])('allows clearing with %p', async (value) => {
    expect(await errorsFor(value as string | null | undefined)).toHaveLength(0);
  });

  it('applies the same rule on update', async () => {
    const errors = await validate(
      plainToInstance(UpdatePolicyDocumentInput, { id: '1', documentUrl: 'javascript:alert(1)' }),
    );
    expect(errors.map((error) => error.property)).toContain('documentUrl');
  });
});
