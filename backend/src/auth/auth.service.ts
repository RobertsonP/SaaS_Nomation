import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !await bcrypt.compare(data.password, user.password)) {
      throw new Error('Invalid credentials');
    }

    const token = this.jwtService.sign({ userId: user.id });
    
    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async register(data: { name: string; email: string; password: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    const token = this.jwtService.sign({ userId: user.id });
    
    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}