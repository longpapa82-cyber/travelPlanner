import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleIdTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;
}
