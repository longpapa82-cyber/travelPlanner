import { promises as dns } from 'dns';
import { Logger } from '@nestjs/common';

const logger = new Logger('EmailDomain');

// Short timeout so registration latency is never dominated by a slow DNS lookup.
const DNS_TIMEOUT_MS = 3000;

/**
 * Result of a best-effort mailability check on an email's domain.
 * - `deliverable: true`  → domain has MX (or A/AAAA fallback) records, OR the
 *   check could not run conclusively (fail-open). Registration should proceed.
 * - `deliverable: false` → the domain conclusively does not accept mail
 *   (NXDOMAIN / no usable records). Registration should be rejected.
 */
export interface DomainCheckResult {
  deliverable: boolean;
  reason: 'has_mx' | 'has_address_fallback' | 'no_records' | 'check_skipped';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('dns_timeout')), ms),
    ),
  ]);
}

/**
 * Extract the domain part of an email address, lowercased.
 * Returns null when the address has no parseable domain.
 */
export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return (
    email
      .slice(at + 1)
      .toLowerCase()
      .trim() || null
  );
}

/**
 * Best-effort check that the email's domain can receive mail.
 *
 * Policy is FAIL-OPEN: this is a weak, advisory guard whose only job is to
 * catch obvious domain typos (e.g. "gmial.com") before we hand the address to
 * SMTP and trigger a bounce. It must NEVER block a legitimate user, so any
 * inconclusive outcome (DNS timeout/error, unparseable input) resolves to
 * deliverable=true. It also cannot validate the local-part (mailbox) — only
 * the domain — so a valid-domain typo like "typo@gmail.com" still passes.
 */
export async function isEmailDomainDeliverable(
  email: string,
): Promise<DomainCheckResult> {
  const domain = extractDomain(email);
  if (!domain) {
    // Malformed input is the DTO's job (@IsEmail); don't double-reject here.
    return { deliverable: true, reason: 'check_skipped' };
  }

  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx && mx.length > 0) {
      return { deliverable: true, reason: 'has_mx' };
    }
    // No MX record. Per RFC 5321, a domain with an A/AAAA record but no MX can
    // still receive mail (implicit MX). Fall back to an address lookup before
    // declaring the domain undeliverable.
    return await checkAddressFallback(domain);
  } catch (error) {
    return classifyDnsError(error, domain);
  }
}

/**
 * Implicit-MX fallback: a domain with an A/AAAA record but no MX may still
 * accept mail. Returns deliverable=true if any address record exists.
 */
async function checkAddressFallback(
  domain: string,
): Promise<DomainCheckResult> {
  try {
    const addrs = await withTimeout(dns.resolve(domain), DNS_TIMEOUT_MS);
    if (addrs && addrs.length > 0) {
      return { deliverable: true, reason: 'has_address_fallback' };
    }
    return { deliverable: false, reason: 'no_records' };
  } catch (error) {
    return classifyDnsError(error, domain);
  }
}

/**
 * Decide whether a DNS error means "domain definitely doesn't exist" (reject)
 * versus "we couldn't tell" (fail-open).
 *
 * TODO(learning): implement this function body.
 *
 * Node's DNS errors expose a `.code` string. The relevant codes:
 *   - 'ENOTFOUND' / 'ENODATA' → the domain (or its records) does not exist.
 *       These are CONCLUSIVE: the domain cannot receive mail → reject.
 *   - anything else (e.g. 'dns_timeout' from withTimeout, 'ESERVFAIL',
 *       'ETIMEOUT', transient server errors) → INCONCLUSIVE → fail-open.
 *
 * Requirements:
 *   - Return { deliverable: false, reason: 'no_records' } ONLY for the two
 *     conclusive codes above.
 *   - Return { deliverable: true, reason: 'check_skipped' } for everything
 *     else, and log a debug line (use `logger.debug(...)`) noting the domain
 *     and code so transient DNS issues are observable but non-blocking.
 *   - Read the error code defensively: it may be on `(error as any).code`,
 *     or for the timeout path it's an Error with message 'dns_timeout'.
 */
function classifyDnsError(error: unknown, domain: string): DomainCheckResult {
  const code =
    (error as NodeJS.ErrnoException)?.code ??
    (error instanceof Error ? error.message : undefined);

  // Conclusive: the domain (or its records) does not exist → reject.
  if (code === 'ENOTFOUND' || code === 'ENODATA') {
    return { deliverable: false, reason: 'no_records' };
  }

  // Inconclusive (timeout, SERVFAIL, transient) → fail open, but stay observable.
  logger.debug(
    `Skipping domain check for "${domain}" (inconclusive DNS: ${code ?? 'unknown'})`,
  );
  return { deliverable: true, reason: 'check_skipped' };
}
