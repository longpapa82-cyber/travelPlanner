/**
 * V172 (B-2): Unified admin detection helpers.
 *
 * Two distinct policies coexist in this codebase, and conflating them was
 * the root cause of the V171 longpapa82 anomaly (UI showed "관리자" while
 * AI quota counters kept ticking up):
 *
 *  - **Quota / informational flag** (`isOperationalAdmin`): a soft signal
 *    used to bypass usage caps and surface an admin badge in the UI. Both
 *    DB `users.role === 'admin'` AND membership in the `ADMIN_EMAILS` env
 *    list count, OR-combined. This matches the operator intent of "I added
 *    my email to the env list, treat me as admin in the app." Safe to
 *    OR-extend because it only ever *grants* leniency, never API privilege.
 *
 *  - **Security gate** (`isSecurityAdmin`): used by AdminGuard and
 *    admin-exempt throttler to authorize destructive endpoints (manage
 *    users, write announcements, etc). DB `users.role` is the only source
 *    of truth here. We deliberately do NOT honor the env list because a
 *    typo or leaked deployment env would otherwise grant write access.
 *
 * Keep these two policies separate. If a future change wants to merge them,
 * audit every call site first — silently widening the security gate to
 * cover env-only admins is exactly the kind of bug we cannot see in tests.
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Service-admin allowlist. A *narrower* class than operational admin: it gates
 * the in-app admin menu (revenue dashboard, manual subscription override, user
 * management, error logs). Sourced from its OWN env var `SERVICE_ADMIN_EMAILS`
 * — deliberately separate from ADMIN_EMAILS so an operational admin (quota
 * bypass) is not automatically granted the financial/destructive admin UI.
 */
const SERVICE_ADMIN_EMAILS = (process.env.SERVICE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Soft admin check for quota bypass and UI flag. Honors both DB role and
 * the ADMIN_EMAILS env list (OR-combined). Treats `email`/`role` as
 * optional so it can be called with partial user rows.
 */
export function isOperationalAdmin(
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (role === 'admin') return true;
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Strict admin check for security gates (AdminGuard, throttler exemption,
 * admin-only mutations). DB role is the only source of truth.
 *
 * Do NOT change this to OR with ADMIN_EMAILS without explicit security
 * review — see the file-level docstring for why.
 */
export function isSecurityAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Service-admin check for the in-app admin menu (revenue dashboard, manual
 * subscription override, user management). Grants when the email is in
 * SERVICE_ADMIN_EMAILS OR the DB role is admin — the DB role is OR'd in so a
 * future migration to pure role-based admin (the security-preferred path) works
 * without touching the env list.
 *
 * This intentionally does NOT honor ADMIN_EMAILS: operational admin (quota
 * bypass) is a wider, lower-trust class. Keeping the lists separate means
 * adding someone to ADMIN_EMAILS for unlimited AI trips does not also hand them
 * the financial/destructive admin screens.
 */
export function isServiceAdmin(
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (role === 'admin') return true;
  if (!email) return false;
  return SERVICE_ADMIN_EMAILS.includes(email.toLowerCase());
}
