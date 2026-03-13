import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { stripHtml } from '../../common/utils/sanitize';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(stripHtml)
  name?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Profile image must be a valid URL' })
  profileImage?: string;
}
