import { IsEnum } from 'class-validator';
import { CollaboratorRole } from '../entities/collaborator.entity';

export class UpdateCollaboratorRoleDto {
  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;
}
