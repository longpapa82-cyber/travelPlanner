import { IsEmail, IsEnum, IsOptional, Matches } from 'class-validator';
import { CollaboratorRole } from '../entities/collaborator.entity';

export class AddCollaboratorDto {
  @IsEmail()
  @Matches(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/, {
    message: 'Email must contain only ASCII characters',
  })
  email: string;

  @IsEnum(CollaboratorRole)
  @IsOptional()
  role?: CollaboratorRole = CollaboratorRole.VIEWER;
}
