import { test, expect } from '@playwright/test';
import { WORKERS } from '../helpers/constants';
import { ApiHelper } from '../fixtures/api-helper';
import { generateSync } from 'otplib';

// ────────────────────────────────────────────────────────────────
// TC-22: Two-Factor Authentication — Full E2E lifecycle
// Uses W14 (dedicated 2FA test user) to avoid interference.
// ────────────────────────────────────────────────────────────────

const USER = WORKERS.W14;

/** Generate a 6-digit TOTP code for the given base32 secret */
function generateTOTP(secret: string): string {
  return generateSync({ secret, window: 1 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Two-Factor Authentication E2E', () => {
  let api: ApiHelper;
  let token: string;
  let totpSecret: string;
  let backupCodes: string[];

  test.beforeAll(async () => {
    api = new ApiHelper();
    await api.register(USER);
    const auth = await api.login(USER.email, USER.password);
    token = auth.accessToken;
  });

  test('TC-22-01: Setup 2FA returns secret + QR code', async () => {
    const result = await api.setup2FA(token);

    expect(result).toHaveProperty('secret');
    expect(result).toHaveProperty('qrCodeDataUrl');
    expect(result.secret).toBeTruthy();
    expect(result.qrCodeDataUrl).toContain('data:image/png;base64');

    totpSecret = result.secret;
  });

  test('TC-22-02: Enable 2FA with wrong code fails', async () => {
    await expect(api.enable2FA(token, '000000')).rejects.toThrow(/40[01]/);
  });

  test('TC-22-03: Enable 2FA with valid TOTP returns 8 backup codes', async () => {
    // Generate TOTP code right before use to minimize timing issues
    const validCode = generateTOTP(totpSecret);
    const result = await api.enable2FA(token, validCode);

    expect(result).toHaveProperty('backupCodes');
    expect(result.backupCodes).toHaveLength(8);
    result.backupCodes.forEach((code: string) => {
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    backupCodes = result.backupCodes;
  });

  test('TC-22-04: Login with 2FA enabled returns tempToken (no accessToken)', async () => {
    const loginResult = await api.loginRaw(USER.email, USER.password);

    expect(loginResult).toHaveProperty('requiresTwoFactor', true);
    expect(loginResult).toHaveProperty('tempToken');
    expect(loginResult.tempToken).toBeTruthy();
    expect(loginResult).not.toHaveProperty('accessToken');
  });

  test('TC-22-05: Verify 2FA with TOTP completes login', async () => {
    const loginResult = await api.loginRaw(USER.email, USER.password);
    const tempToken = loginResult.tempToken;

    const totpCode = generateTOTP(totpSecret);
    const result = await api.verify2FA(tempToken, totpCode);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.accessToken).toBeTruthy();

    // Verify the new token works
    const me = await api.getMe(result.accessToken);
    expect(me.email).toBe(USER.email);
  });

  test('TC-22-06: Verify 2FA with backup code succeeds', async () => {
    const loginResult = await api.loginRaw(USER.email, USER.password);
    const tempToken = loginResult.tempToken;

    const backupCode = backupCodes[0];
    const result = await api.verify2FA(tempToken, backupCode);

    expect(result).toHaveProperty('accessToken');
    expect(result.accessToken).toBeTruthy();
  });

  test('TC-22-07: Used backup code cannot be reused', async () => {
    const loginResult = await api.loginRaw(USER.email, USER.password);
    const tempToken = loginResult.tempToken;

    // backupCodes[0] was already used in TC-22-06
    const usedCode = backupCodes[0];
    await expect(api.verify2FA(tempToken, usedCode)).rejects.toThrow(/40[01]/);
  });

  test('TC-22-08: Regenerate backup codes invalidates old ones', async () => {
    // Need a fresh access token via TOTP
    const loginResult = await api.loginRaw(USER.email, USER.password);
    const totpCode = generateTOTP(totpSecret);
    const authResult = await api.verify2FA(loginResult.tempToken, totpCode);
    const freshToken = authResult.accessToken;

    // Regenerate with current TOTP
    const newTotpCode = generateTOTP(totpSecret);
    const regen = await api.regenerateBackupCodes(freshToken, newTotpCode);

    expect(regen.backupCodes).toHaveLength(8);

    // Old backup code (index 1, still unused) should no longer work
    const loginResult2 = await api.loginRaw(USER.email, USER.password);
    const oldCode = backupCodes[1];
    await expect(
      api.verify2FA(loginResult2.tempToken, oldCode),
    ).rejects.toThrow(/40[01]/);

    // New backup code should work
    const loginResult3 = await api.loginRaw(USER.email, USER.password);
    const newCode = regen.backupCodes[0];
    const verifyResult = await api.verify2FA(loginResult3.tempToken, newCode);
    expect(verifyResult).toHaveProperty('accessToken');

    backupCodes = regen.backupCodes;
  });

  test('TC-22-09: Disable 2FA with valid TOTP', async () => {
    // Get fresh token
    const loginResult = await api.loginRaw(USER.email, USER.password);
    const totpCode = generateTOTP(totpSecret);
    const authResult = await api.verify2FA(loginResult.tempToken, totpCode);
    const freshToken = authResult.accessToken;

    // Disable
    const disableCode = generateTOTP(totpSecret);
    const result = await api.disable2FA(freshToken, disableCode);
    expect(result).toHaveProperty('message');
  });

  test('TC-22-10: After disabling, login works without 2FA', async () => {
    const loginResult = await api.loginRaw(USER.email, USER.password);

    // Should get accessToken directly, no tempToken
    expect(loginResult).toHaveProperty('accessToken');
    expect(loginResult).not.toHaveProperty('requiresTwoFactor');
    expect(loginResult.accessToken).toBeTruthy();
  });
});
