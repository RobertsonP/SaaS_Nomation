import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

/**
 * DTO for analyzing project pages
 */
export class AnalyzeProjectDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urlIds?: string[];

  @IsString()
  @IsNotEmpty({ message: 'Organization ID is required' })
  organizationId: string;
}

/**
 * DTO for importing a GitHub repository
 */
export class ImportGitHubDto {
  @IsString()
  @IsNotEmpty({ message: 'Repository URL is required' })
  repoUrl: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsString()
  @IsNotEmpty({ message: 'Organization ID is required' })
  organizationId: string;
}
