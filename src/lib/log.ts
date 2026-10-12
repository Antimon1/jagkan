/**
 * Minimal logger. Development builds print to the console; production builds stay
 * quiet (no third-party analytics in a kids app, spec 12). Replace with a
 * first-party error reporter later if needed.
 */
export function logError(context: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[JagKan] ${context}`, error);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Okänt fel';
}
