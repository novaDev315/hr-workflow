/**
 * Allowlist of policy document file types. The canonical mime type comes from
 * here, never from the client, and drives the Content-Type served later.
 */
export interface PolicyFileType {
  mimeType: string;
  /** Rendered in the browser; everything else is downloaded. */
  inline: boolean;
  /** Full Content-Type header value. */
  contentType: string;
}

export const POLICY_FILE_TYPES: Record<string, PolicyFileType> = {
  pdf: { mimeType: 'application/pdf', inline: true, contentType: 'application/pdf' },
  doc: {
    mimeType: 'application/msword',
    inline: false,
    contentType: 'application/msword',
  },
  docx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    inline: false,
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  txt: {
    mimeType: 'text/plain',
    inline: false,
    contentType: 'text/plain; charset=utf-8',
  },
  png: { mimeType: 'image/png', inline: true, contentType: 'image/png' },
  jpg: { mimeType: 'image/jpeg', inline: true, contentType: 'image/jpeg' },
  jpeg: { mimeType: 'image/jpeg', inline: true, contentType: 'image/jpeg' },
};

export const POLICY_FILE_MAX_BYTES = 10 * 1024 * 1024;
/** Largest base64 string that can decode to POLICY_FILE_MAX_BYTES. */
export const POLICY_FILE_MAX_BASE64_LENGTH =
  Math.ceil(POLICY_FILE_MAX_BYTES / 3) * 4;

export const STORED_POLICY_FILE_NAME_PATTERN = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

export function getPolicyFileType(extension: string): PolicyFileType | null {
  const key = extension.replace(/^\./, '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(POLICY_FILE_TYPES, key)
    ? POLICY_FILE_TYPES[key]
    : null;
}

/** RFC 5987 / 8187 `filename*` value without raw quotes. */
export function encodeContentDispositionFilename(name: string): string {
  let encoded: string;
  try {
    encoded = encodeURIComponent(name);
  } catch {
    encoded = 'policy-file';
  }

  return encoded.replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildContentDisposition(
  fileType: PolicyFileType,
  originalName: string,
): string {
  const disposition = fileType.inline ? 'inline' : 'attachment';
  return `${disposition}; filename*=UTF-8''${encodeContentDispositionFilename(originalName)}`;
}
