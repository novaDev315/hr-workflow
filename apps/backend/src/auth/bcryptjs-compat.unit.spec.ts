import * as bcrypt from 'bcryptjs';

// Hash produced by the native `bcrypt` package (v5) with cost 10 before it was
// replaced by bcryptjs. Existing accounts hold hashes like this one.
const NATIVE_BCRYPT_HASH =
  '$2b$10$s/YQYWypQpiras7UCBP/Ie71JfqInO2O4SO.hbnFA.QTS3w2wOP.G';
const NATIVE_BCRYPT_PASSWORD = 'Compat-Check-2026!';

describe('bcryptjs compatibility with native bcrypt hashes', () => {
  it('verifies a $2b$ hash produced by native bcrypt', async () => {
    expect(await bcrypt.compare(NATIVE_BCRYPT_PASSWORD, NATIVE_BCRYPT_HASH)).toBe(true);
  });

  it('rejects a wrong password against a native bcrypt hash', async () => {
    expect(await bcrypt.compare('wrong-password', NATIVE_BCRYPT_HASH)).toBe(false);
  });

  it('keeps cost factor 10 and the $2b$ prefix for new hashes', async () => {
    const hash = await bcrypt.hash('another-password', 10);
    expect(hash.startsWith('$2b$10$')).toBe(true);
    expect(bcrypt.getRounds(hash)).toBe(10);
    expect(await bcrypt.compare('another-password', hash)).toBe(true);
  });
});
