/**
 * Test Device Helper - Web stub
 *
 * Web platform doesn't support AdMob, so this is a no-op stub.
 */

export async function logTestDeviceInfo(): Promise<void> {
  console.log('[TestDeviceHelper] Web platform - ads not supported');
}