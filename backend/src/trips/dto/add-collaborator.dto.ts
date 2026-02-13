import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { CollaboratorRole } from '../entities/collaborator.entity';

export class AddCollaboratorDto {
  @IsEmail()
  email: string;

  @IsEnum(CollaboratorRole)
  @IsOptional()
  role?: CollaboratorRole = CollaboratorRole.VIEWER;
}
