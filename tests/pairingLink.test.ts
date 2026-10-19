import { pairingLink, secretFromScan } from '@/features/pairing/pairingLink';

const TOKEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

describe('pairing QR codes', () => {
  it('puts the long token in the QR code and reads it back', () => {
    expect(pairingLink(TOKEN)).toBe(`jagkan://pair?token=${TOKEN}`);
    expect(secretFromScan(pairingLink(TOKEN))).toEqual({ token: TOKEN });
    expect(secretFromScan(`jagkan://pair?token=${TOKEN.toLowerCase()}`)).toEqual({ token: TOKEN });
  });

  it('still reads six-digit codes from older QR codes and plain text', () => {
    expect(secretFromScan('jagkan://pair?code=123456')).toEqual({ code: '123456' });
    expect(secretFromScan(' 654321 ')).toEqual({ code: '654321' });
  });

  it('ignores anything else', () => {
    expect(secretFromScan('https://example.com')).toBeNull();
    expect(secretFromScan('jagkan://pair?token=SHORT')).toBeNull();
    expect(secretFromScan('jagkan://pair?code=1234567')).toBeNull();
  });
});
