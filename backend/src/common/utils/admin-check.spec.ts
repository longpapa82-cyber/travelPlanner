/**
 * V172 (B-2): admin policy unit tests.
 *
 * The two helpers exist to keep "operational admin" (env email OR DB role)
 * and "security admin" (DB role only) explicitly separated. These tests
 * pin the policy down so a future refactor cannot silently merge them.
 */

describe('admin-check', () => {
  const ORIGINAL_ENV = process.env.ADMIN_EMAILS;
  const ORIGINAL_SERVICE_ENV = process.env.SERVICE_ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL_ENV;
    process.env.SERVICE_ADMIN_EMAILS = ORIGINAL_SERVICE_ENV;
    jest.resetModules();
  });

  function load(envEmails?: string, serviceEmails?: string) {
    if (envEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = envEmails;
    }
    if (serviceEmails === undefined) {
      delete process.env.SERVICE_ADMIN_EMAILS;
    } else {
      process.env.SERVICE_ADMIN_EMAILS = serviceEmails;
    }
    // Force re-import so the module-level email lists are rebuilt.
    return jest.requireActual<typeof import('./admin-check')>('./admin-check');
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

  describe('isServiceAdmin', () => {
    test('SERVICE_ADMIN_EMAILS email alone (role=user) → true', () => {
      const { isServiceAdmin } = load('', 'hoonjae723@gmail.com');
      expect(isServiceAdmin('hoonjae723@gmail.com', 'user')).toBe(true);
    });

    test('DB role=admin alone → true (OR path for future role migration)', () => {
      const { isServiceAdmin } = load('', '');
      expect(isServiceAdmin('someone@example.com', 'admin')).toBe(true);
    });

    test('does NOT honor ADMIN_EMAILS — operational admin is not service admin', () => {
      // In ADMIN_EMAILS but NOT in SERVICE_ADMIN_EMAILS, role=user.
      const { isServiceAdmin } = load('ops@example.com', 'svc@example.com');
      expect(isServiceAdmin('ops@example.com', 'user')).toBe(false);
    });

    test('email match is case-insensitive', () => {
      const { isServiceAdmin } = load('', 'Svc@Example.com');
      expect(isServiceAdmin('svc@example.COM', 'user')).toBe(true);
    });

    test('empty SERVICE_ADMIN_EMAILS → role-only check', () => {
      const { isServiceAdmin } = load('', '');
      expect(isServiceAdmin('user@example.com', 'admin')).toBe(true);
      expect(isServiceAdmin('user@example.com', 'user')).toBe(false);
    });

    test('null email and role → false', () => {
      const { isServiceAdmin } = load('', 'svc@example.com');
      expect(isServiceAdmin(null, null)).toBe(false);
    });
  });
});
