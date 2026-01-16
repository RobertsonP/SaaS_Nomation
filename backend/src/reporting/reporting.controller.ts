import { Controller, Get, Post, Param, Body, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';

@Controller('reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private reportingService: ReportingService) {}

  @Get('execution/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.reportingService.generateExecutionReport(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('execution/:id/email')
  async emailReport(@Param('id') id: string, @Body() body: { email: string }) {
    return this.reportingService.sendReportEmail(id, body.email);
  }
}
