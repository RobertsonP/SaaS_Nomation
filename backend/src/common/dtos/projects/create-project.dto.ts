import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for project URL entries
 */
export class ProjectUrlDto {
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsNotEmpty({ message: 'URL is required' })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;
}

/**
 * DTO for creating a new project
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  @MaxLength(200, { message: 'Project name cannot exceed 200 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectUrlDto)
  urls: ProjectUrlDto[];

  @IsString()
  @IsNotEmpty({ message: 'Organization ID is required' })
  organizationId: string;
}
