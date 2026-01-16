import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

export class LoginDto {
  email: string;
  password: string;
}

export class RegisterDto {
  name: string;
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Stricter rate limiting for login (prevent brute force)
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Stricter for registration (prevent spam)
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 registrations per hour
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Request() req) {
    return this.authService.getFullProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() body: { name?: string; theme?: string; timezone?: string }) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body);
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@Request() req) {
    return this.authService.getNotificationPreferences(req.user.id);
  }

  @Patch('notifications')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPreferences(@Request() req, @Body() body: any) {
    return this.authService.updateNotificationPreferences(req.user.id, body);
  }
}