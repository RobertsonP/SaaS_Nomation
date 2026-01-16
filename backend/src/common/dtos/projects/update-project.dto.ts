import { IsString, IsOptional, IsArray, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectUrlDto } from './create-project.dto';

/**
 * DTO for updating an existing project
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Project name cannot exceed 200 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectUrlDto)
  urls?: ProjectUrlDto[];
}
