/**
 * V172 (B-2): admin policy unit tests.
 *
 * The two helpers exist to keep "operational admin" (env email OR DB role)
 * and "security admin" (DB role only) explicitly separated. These tests
 * pin the policy down so a future refactor cannot silently merge them.
 */

describe('admin-check', () => {
  const ORIGINAL_ENV = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL_ENV;
    jest.resetModules();
  });

  function load(envEmails?: string) {
    if (envEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = envEmails;
    }
    // Force re-import so the module-level ADMIN_EMAILS list is rebuilt.
    return require('./admin-check');
  }

  describe('isOperationalAdmin', () => {
    test('DB role=admin alone → true', () => {
      const { isOperationalAdmin } = load('');
      expect(isOperationalAdmin('user@example.com', 'admin')).toBe(true);
    });

    test('env email alone (role=user) → true (V171 longpapa82 case)', () => {
      const { isOperationalAdmin } = load('longpapa82@gmail.com');
      expect(isOperationalAdmin('longpapa82@gmail.com', 'user')).toBe(true);
    });

    test('env email is case-insensitive on the user side', () => {
      const { isOperationalAdmin } = load('admin@example.com');
      expect(isOperationalAdmin('Admin@Example.COM', 'user')).toBe(true);
    });

    test('regular user (no env, role=user) → false', () => {
      const { isOperationalAdmin } = load('admin@example.com');
      expect(isOperationalAdmin('user@example.com', 'user')).toBe(false);
    });

    test('null email and role → false', () => {
      const { isOperationalAdmin } = load('admin@example.com');
      expect(isOperationalAdmin(null, null)).toBe(false);
    });

    test('empty ADMIN_EMAILS env → role-only check', () => {
      const { isOperationalAdmin } = load('');
      expect(isOperationalAdmin('user@example.com', 'admin')).toBe(true);
      expect(isOperationalAdmin('user@example.com', 'user')).toBe(false);
    });

    test('multiple comma-separated emails', () => {
      const { isOperationalAdmin } = load('a@x.com,b@x.com,c@x.com');
      expect(isOperationalAdmin('b@x.com', 'user')).toBe(true);
      expect(isOperationalAdmin('d@x.com', 'user')).toBe(false);
    });
  });

  describe('isSecurityAdmin', () => {
    test('honors DB role only', () => {
      const { isSecurityAdmin } = load('user@example.com');
      // Even though user@example.com is in env, security admin is role-only.
      expect(isSecurityAdmin('user')).toBe(false);
      expect(isSecurityAdmin('admin')).toBe(true);
    });

    test('null role → false', () => {
      const { isSecurityAdmin } = load('');
      expect(isSecurityAdmin(null)).toBe(false);
      expect(isSecurityAdmin(undefined)).toBe(false);
    });
  });
});
