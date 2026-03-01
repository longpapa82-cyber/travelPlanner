import { IsString, MaxLength, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(200)
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'Invalid Expo push token format',
  })
  token: string;
}
