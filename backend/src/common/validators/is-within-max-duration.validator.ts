import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Validates that the span from a related start-date field to this end-date
 * field does not exceed `maxDays` (inclusive of both endpoints).
 *
 * Uses the same inclusive day count as the rest of the codebase
 * (`ceil((end - start) / DAY) + 1`) so the DTO boundary matches the
 * trips.service runtime check exactly.
 *
 * Skips validation if either field is missing or unparseable — that is the
 * responsibility of @IsDateString / @IsAfterDate, keeping each validator
 * single-purpose.
 */
export function IsWithinMaxDuration(
  startProperty: string,
  maxDays: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isWithinMaxDuration',
      target: object.constructor,
      propertyName,
      constraints: [startProperty, maxDays],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [startPropertyName, max] = args.constraints as [string, number];
          const startValue = (args.object as Record<string, unknown>)[
            startPropertyName
          ];
          if (!value || !startValue) return true;

          const start = new Date(startValue as string);
          const end = new Date(value as string);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;

          const numberOfDays =
            Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
          return numberOfDays <= max;
        },
        defaultMessage(args: ValidationArguments) {
          const [, max] = args.constraints as [string, number];
          return `Trip duration must not exceed ${max} days`;
        },
      },
    });
  };
}
