import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';
import { MAX_AI_TRIP_DAYS } from '../constants';

/**
 * Validates the MAX_AI_TRIP_DAYS duration cap enforced via the
 * @IsWithinMaxDuration decorator on CreateTripDto.endDate.
 *
 * Day count is inclusive of both endpoints, matching
 * `numberOfDays = ceil((end - start) / DAY) + 1`. With MAX_AI_TRIP_DAYS = 31,
 * a trip from 2099-01-01 to 2099-01-31 is exactly 31 days and must pass;
 * 2099-02-01 is 32 days and must fail.
 */
describe('CreateTripDto — trip duration limit', () => {
  const base = {
    destination: 'Tokyo',
    startDate: '2099-01-01',
    planningMode: 'ai' as const,
  };

  const durationErrors = async (endDate: string) => {
    const dto = plainToInstance(CreateTripDto, { ...base, endDate });
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'endDate');
  };

  it('uses 31 as the configured maximum', () => {
    expect(MAX_AI_TRIP_DAYS).toBe(31);
  });

  it('accepts a single-day trip (start === end, 1 day)', async () => {
    expect(await durationErrors('2099-01-01')).toHaveLength(0);
  });

  it('accepts a trip of exactly MAX_AI_TRIP_DAYS days (31)', async () => {
    // 2099-01-01 .. 2099-01-31 inclusive = 31 days
    expect(await durationErrors('2099-01-31')).toHaveLength(0);
  });

  it('rejects a trip of MAX_AI_TRIP_DAYS + 1 days (32)', async () => {
    // 2099-01-01 .. 2099-02-01 inclusive = 32 days
    const errors = await durationErrors('2099-02-01');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isWithinMaxDuration');
  });

  it('rejects a far-too-long trip (1 year)', async () => {
    const errors = await durationErrors('2100-01-01');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].constraints).toHaveProperty('isWithinMaxDuration');
  });
});
