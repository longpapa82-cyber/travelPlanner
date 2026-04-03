/**
 * AdMob Test Device Detection - Web stub
 *
 * Web platform doesn't support AdMob, so this is a no-op stub.
 */

export async function isTestDevice(): Promise<boolean> {
  return false;
}

export async function logTestDeviceInfo(): Promise<void> {
  console.log('[AdTestDevice] Web platform - ads not supported');
}

export function configureTestDevices(): void {
  // No-op on web
}