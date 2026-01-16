import { Controller, Get, Post, Body, Param, UseGuards, Request, Put, Delete, Patch } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard, RequireRole } from '../auth/guards/organization.guard';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Request() req, @Body() data: { name: string; slug?: string }) {
    return this.organizationsService.create(req.user.id, data);
  }

  @Get()
  findAll(@Request() req) {
    return this.organizationsService.findByUser(req.user.id);
  }

  @Get(':id')
  @UseGuards(OrganizationGuard)
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post(':id/invites')
  @UseGuards(OrganizationGuard)
  @RequireRole('admin')
  invite(@Request() req, @Param('id') id: string, @Body() body: { email: string; role?: string }) {
    return this.organizationsService.inviteMember(req.organization.id, req.user.id, body.email, body.role);
  }

  @Delete(':id/invites/:inviteId')
  @UseGuards(OrganizationGuard)
  @RequireRole('admin')
  revokeInvite(@Request() req, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.organizationsService.revokeInvite(req.organization.id, req.user.id, inviteId);
  }

  @Post('accept-invite')
  acceptInvite(@Request() req, @Body() body: { token: string }) {
    return this.organizationsService.acceptInvite(req.user.id, body.token);
  }

  @Delete(':id/members/:userId')
  @UseGuards(OrganizationGuard)
  @RequireRole('admin')
  removeMember(@Request() req, @Param('id') id: string, @Param('userId') userId: string) {
    return this.organizationsService.removeMember(req.organization.id, req.user.id, userId);
  }

  @Delete(':id')
  @UseGuards(OrganizationGuard)
  @RequireRole('owner')
  delete(@Request() req, @Param('id') id: string) {
    return this.organizationsService.delete(req.organization.id, req.user.id);
  }

  @Patch(':id/members/:userId')
  @UseGuards(OrganizationGuard)
  @RequireRole('admin')
  updateMemberRole(
    @Request() req, 
    @Param('id') id: string, 
    @Param('userId') userId: string,
    @Body() body: { role: string }
  ) {
    return this.organizationsService.updateMemberRole(req.organization.id, req.user.id, userId, body.role);
  }
}
