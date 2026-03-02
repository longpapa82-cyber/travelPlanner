import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
  MaxLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import {
  AnnouncementType,
  AnnouncementPriority,
  AnnouncementDisplayType,
  AnnouncementTargetAudience,
} from '../entities/announcement.entity';

/**
 * Custom validator for i18n Record<string, string> JSONB fields.
 * Validates: object type, max 20 language keys, key length <=10, value is string with max length.
 */
function IsI18nRecord(maxValueLength: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isI18nRecord',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
          const keys = Object.keys(value);
          if (keys.length === 0 || keys.length > 20) return false;
          return keys.every((key) => {
            if (typeof key !== 'string' || key.length > 10) return false;
            if (typeof value[key] !== 'string') return false;
            if (value[key].length > maxValueLength) return false;
            return true;
          });
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a Record<string, string> with valid language keys and values up to ${maxValueLength} chars`;
        },
      },
    });
  };
}

export class CreateAnnouncementDto {
  @IsEnum(AnnouncementType)
  type: AnnouncementType;

  @IsI18nRecord(200)
  title: Record<string, string>;

  @IsI18nRecord(5000)
  content: Record<string, string>;

  @IsEnum(AnnouncementTargetAudience)
  @IsOptional()
  targetAudience?: AnnouncementTargetAudience;

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  priority?: AnnouncementPriority;

  @IsEnum(AnnouncementDisplayType)
  @IsOptional()
  displayType?: AnnouncementDisplayType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  actionUrl?: string;

  @IsI18nRecord(100)
  @IsOptional()
  actionLabel?: Record<string, string>;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
