import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'], { message: 'Theme must be one of: light, dark, system' })
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Timezone cannot exceed 50 characters' })
  timezone?: string;
}
