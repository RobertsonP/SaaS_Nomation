import { IsString, MinLength, MaxLength, IsNotEmpty, Matches } from 'class-validator';

/**
 * DTO for changing user password
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128, { message: 'New password cannot exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    { message: 'New password must contain at least one uppercase letter, one lowercase letter, and one number' }
  )
  newPassword: string;
}
