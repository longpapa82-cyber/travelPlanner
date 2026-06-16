import { promises as dns } from 'dns';
import { extractDomain, isEmailDomainDeliverable } from './email-domain';

jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
    resolve: jest.fn(),
  },
}));

const mockResolveMx = dns.resolveMx as jest.Mock;
const mockResolve = dns.resolve as jest.Mock;

function dnsError(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe('extractDomain', () => {
  it('returns the lowercased domain', () => {
    expect(extractDomain('User@Gmail.com')).toBe('gmail.com');
  });

  it('returns null for input without a domain', () => {
    expect(extractDomain('no-at-sign')).toBeNull();
    expect(extractDomain('trailing@')).toBeNull();
  });
});

describe('isEmailDomainDeliverable', () => {
  beforeEach(() => {
    mockResolveMx.mockReset();
    mockResolve.mockReset();
  });

  it('is deliverable when the domain has MX records', async () => {
    mockResolveMx.mockResolvedValue([
      { exchange: 'mx.gmail.com', priority: 10 },
    ]);

    const result = await isEmailDomainDeliverable('test@gmail.com');

    expect(result).toEqual({ deliverable: true, reason: 'has_mx' });
    expect(mockResolveMx).toHaveBeenCalledWith('gmail.com');
  });

  it('falls back to A/AAAA records when there is no MX (implicit MX)', async () => {
    mockResolveMx.mockResolvedValue([]);
    mockResolve.mockResolvedValue(['93.184.216.34']);

    const result = await isEmailDomainDeliverable('test@implicit-mx.example');

    expect(result).toEqual({
      deliverable: true,
      reason: 'has_address_fallback',
    });
  });

  it('rejects when the domain has neither MX nor address records', async () => {
    mockResolveMx.mockResolvedValue([]);
    mockResolve.mockResolvedValue([]);

    const result = await isEmailDomainDeliverable('test@gmial.com');

    expect(result).toEqual({ deliverable: false, reason: 'no_records' });
  });

  it('rejects a non-existent domain (ENOTFOUND is conclusive)', async () => {
    mockResolveMx.mockRejectedValue(dnsError('ENOTFOUND'));

    const result = await isEmailDomainDeliverable(
      'test@definitely-not-real.xyz',
    );

    expect(result).toEqual({ deliverable: false, reason: 'no_records' });
  });

  it('rejects when the domain exists but has no mail records (ENODATA)', async () => {
    mockResolveMx.mockRejectedValue(dnsError('ENODATA'));

    const result = await isEmailDomainDeliverable('test@no-mail.example');

    expect(result).toEqual({ deliverable: false, reason: 'no_records' });
  });

  it('FAILS OPEN on a transient DNS error (must not block real users)', async () => {
    mockResolveMx.mockRejectedValue(dnsError('ESERVFAIL'));

    const result = await isEmailDomainDeliverable('test@gmail.com');

    expect(result.deliverable).toBe(true);
    expect(result.reason).toBe('check_skipped');
  });

  it('FAILS OPEN on DNS timeout', async () => {
    // Never resolves → withTimeout rejects with 'dns_timeout'
    mockResolveMx.mockImplementation(() => new Promise(() => {}));

    const result = await isEmailDomainDeliverable('test@slow-dns.example');

    expect(result.deliverable).toBe(true);
    expect(result.reason).toBe('check_skipped');
  }, 10000);

  it('skips the check (deliverable) for unparseable input', async () => {
    const result = await isEmailDomainDeliverable('garbage');

    expect(result).toEqual({ deliverable: true, reason: 'check_skipped' });
    expect(mockResolveMx).not.toHaveBeenCalled();
  });
});
