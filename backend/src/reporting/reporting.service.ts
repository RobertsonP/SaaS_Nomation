import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {
    // Register handlebars helpers
    handlebars.registerHelper('formatDate', (date) => new Date(date).toLocaleString());
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('statusColor', (status) => {
      switch (status) {
        case 'passed': return '#10B981';
        case 'failed': return '#EF4444';
        case 'running': return '#3B82F6';
        default: return '#6B7280';
      }
    });
  }

  async generateExecutionReport(executionId: string) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        test: {
          include: {
            project: {
              include: { organization: true }
            }
          }
        }
      }
    });

    if (!execution) throw new NotFoundException('Execution not found');

    const templatePath = path.join(process.cwd(), 'src/reporting/templates/execution-report.hbs');
    let templateHtml = '';
    
    try {
      templateHtml = await fs.readFile(templatePath, 'utf-8');
    } catch (e) {
      // Fallback template if file not found (dev robustness)
      templateHtml = `
        <html>
          <body>
            <h1>Test Execution Report</h1>
            <p>Test: {{test.name}}</p>
            <p>Status: {{status}}</p>
          </body>
        </html>
      `;
    }

    const template = handlebars.compile(templateHtml);
    const html = template(execution);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      });
      
      return pdf;
    } finally {
      await browser.close();
    }
  }

  async sendReportEmail(executionId: string, email: string) {
    const pdfBuffer = await this.generateExecutionReport(executionId);
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      include: { test: true }
    });

    await this.emailService.sendEmail(
      email,
      `Test Report: ${execution.test.name} - ${execution.status.toUpperCase()}`,
      `
        <h2>Test Execution Report</h2>
        <p>Your test "<strong>${execution.test.name}</strong>" has finished with status: <strong>${execution.status}</strong>.</p>
        <p>Please find the detailed PDF report attached.</p>
      `,
      [{
        filename: `report-${executionId}.pdf`,
        content: pdfBuffer
      }]
    );

    return { success: true };
  }
}
