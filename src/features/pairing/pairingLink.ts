import type { PairSecret } from '@/lib/api';

/** The QR code a parent shows. Scanning it with the phone camera also opens the app. */
export function pairingLink(token: string): string {
  return `jagkan://pair?token=${token}`;
}

/** A scanned QR code or a link: the QR token, or the six-digit code of older QR codes. */
export function secretFromScan(data: string): PairSecret | null {
  const token = /token=([A-Za-z2-9]{32})(?![A-Za-z0-9])/.exec(data);
  if (token) return { token: token[1].toUpperCase() };
  const code = /code=(\d{6})(?!\d)/.exec(data) ?? /^(\d{6})$/.exec(data.trim());
  return code ? { code: code[1] } : null;
}
