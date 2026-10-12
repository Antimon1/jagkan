/** Notifications are not supported in the web preview; these are safe no-ops. */
export function configureNotifications(): void {}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function getPushToken(): Promise<string | null> {
  return null;
}

export async function scheduleDailyReminder(_hour: number, _title: string, _body: string): Promise<void> {}

export async function cancelDailyReminder(): Promise<void> {}

export async function notifyNow(_title: string, _body: string, _url: string): Promise<void> {}

export function onNotificationTap(_callback: (url: string) => void): () => void {
  return () => undefined;
}
