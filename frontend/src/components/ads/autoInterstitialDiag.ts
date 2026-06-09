/**
 * ⚠️ TEMP DIAGNOSTIC (2026-06-09) — REMOVE AFTER AUTO-AD INVESTIGATION
 *
 * Production Hermes does NOT forward console.log to the device syslog, so the
 * Console.app approach showed nothing. Instead, useAutoInterstitial writes its
 * progress here (AsyncStorage), and AdDebugScreen reads + displays it — giving
 * an on-device, console-free trace of exactly where the auto-interstitial path
 * stops on a real (OTA/production) build.
 *
 * Delete this file + its call sites when the investigation concludes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@autoIntl_diag';

/** Append a stage to the rolling diagnostic trace (keeps the last ~12 lines). */
export async function logAutoIntl(stage: string): Promise<void> {
  try {
    const prev = (await AsyncStorage.getItem(KEY)) ?? '';
    const lines = prev ? prev.split('\n') : [];
    // No Date.now() concerns here — runtime allows it in app code.
    const stamped = `${new Date().toLocaleTimeString()} ${stage}`;
    lines.push(stamped);
    const trimmed = lines.slice(-12).join('\n');
    await AsyncStorage.setItem(KEY, trimmed);
  } catch {
    // best-effort
  }
}

/** Read the diagnostic trace for display in AdDebugScreen. */
export async function readAutoIntlDiag(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? '(no auto-interstitial activity yet)';
  } catch {
    return '(diag read error)';
  }
}

/** Clear the trace (Ad Debug "clear" affordance). */
export async function clearAutoIntlDiag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
