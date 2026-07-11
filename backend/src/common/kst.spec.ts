import { kstMidnightUtc, kstMonthStartUtc, kstParts } from './kst';

/**
 * These pin the KST "today"/month boundary contract. The container runs UTC, so
 * the failure mode we guard against is 00:00–09:00 KST (i.e. 15:00–24:00 UTC the
 * previous UTC day) resolving to *yesterday's* UTC midnight.
 */
describe('kst helpers', () => {
  describe('kstMidnightUtc', () => {
    it('maps a Korean-morning instant to the SAME KST day midnight, not yesterday', () => {
      // 2026-07-11T15:30:00Z === 2026-07-12 00:30 KST → KST day is the 12th.
      const now = new Date('2026-07-11T15:30:00Z');
      // KST midnight of 07-12 is 07-11T15:00:00Z.
      expect(kstMidnightUtc(now).toISOString()).toBe(
        '2026-07-11T15:00:00.000Z',
      );
    });

    it('maps a Korean-afternoon instant to today midnight (11:00 KST case)', () => {
      // 2026-07-11T02:00:00Z === 2026-07-11 11:00 KST → KST day is the 11th.
      const now = new Date('2026-07-11T02:00:00Z');
      // KST midnight of 07-11 is 07-10T15:00:00Z.
      expect(kstMidnightUtc(now).toISOString()).toBe(
        '2026-07-10T15:00:00.000Z',
      );
    });

    it('the two above resolve to DIFFERENT KST days (the bug this fixes)', () => {
      const morning = kstMidnightUtc(new Date('2026-07-11T15:30:00Z'));
      const afternoon = kstMidnightUtc(new Date('2026-07-11T02:00:00Z'));
      expect(morning.getTime()).not.toBe(afternoon.getTime());
      // Exactly one KST day apart (24h).
      expect(morning.getTime() - afternoon.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('kstParts', () => {
    it('reports the KST calendar date, rolling the day over at 00:00 KST', () => {
      // 15:00Z on the last day of June is 00:00 KST on July 1 → month 7, day 1.
      expect(kstParts(new Date('2026-06-30T15:00:00Z'))).toEqual({
        year: 2026,
        month: 7,
        day: 1,
      });
      // 14:59Z is still 23:59 KST June 30.
      expect(kstParts(new Date('2026-06-30T14:59:00Z'))).toEqual({
        year: 2026,
        month: 6,
        day: 30,
      });
    });
  });

  describe('kstMonthStartUtc', () => {
    it('anchors to the first of the KST month even during the UTC-previous day', () => {
      // 2026-06-30T20:00:00Z === 2026-07-01 05:00 KST → month start is 07-01 KST.
      const start = kstMonthStartUtc(new Date('2026-06-30T20:00:00Z'));
      // 00:00 KST on 07-01 is 06-30T15:00:00Z.
      expect(start.toISOString()).toBe('2026-06-30T15:00:00.000Z');
    });
  });
});
