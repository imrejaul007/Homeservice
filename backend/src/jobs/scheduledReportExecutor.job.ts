import mongoose from 'mongoose';
import logger from '../utils/logger';
import { sendEmail } from '../services/email.service';

// Import the report service for generating report data
// Note: We import dynamically to avoid circular dependencies
let reportService: any = null;

const getReportService = async () => {
  if (!reportService) {
    const module = await import('../services/report.service');
    reportService = module.reportService;
  }
  return reportService;
};

// ScheduledReport model interface
interface IScheduledReport {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'churn' | 'revenue' | 'booking' | 'customer' | 'provider' | 'performance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'json' | 'csv' | 'pdf';
  recipients: string[];
  filters?: {
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    providers?: string[];
    regions?: string[];
  };
  enabled: boolean;
  lastRunDate?: Date;
  lastRunStatus?: 'success' | 'failed';
  lastRunError?: string;
  nextRunDate: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Brand colors for email template
const BRAND_COLORS = {
  primary: '#E11D48',
  primaryDark: '#BE123C',
  primaryLight: '#FCE7F3',
  secondary: '#F97316',
  text: '#1F2937',
  textLight: '#6B7280',
  background: '#FFF1F2',
  white: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#E5E7EB',
};

/**
 * Calculate the next run date based on frequency
 */
function calculateNextRunDate(fromDate: Date, frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'): Date {
  const next = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
      break;

    case 'weekly':
      const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      next.setHours(6, 0, 0, 0);
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(6, 0, 0, 0);
      break;

    case 'quarterly':
      const currentQuarter = Math.floor(next.getMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;
      next.setMonth(nextQuarterMonth);
      if (nextQuarterMonth > 11) {
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(0);
      }
      next.setDate(1);
      next.setHours(6, 0, 0, 0);
      break;
  }

  return next;
}

/**
 * Format report data as HTML email body
 */
function formatReportAsHtml(
  report: IScheduledReport,
  data: any
): string {
  const { summary, data: reportData } = data;
  const periodLabel = `${report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)} Report`;

  // Generate summary cards
  const summaryCards = Object.entries(summary || {})
    .slice(0, 6)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').trim();
      const formattedValue = typeof value === 'number'
        ? value.toLocaleString()
        : String(value);
      return `
        <td style="padding: 16px; background: ${BRAND_COLORS.background}; border-radius: 8px; text-align: center; width: 33.33%;">
          <p style="margin: 0 0 4px; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.text};">${formattedValue}</p>
          <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">${label}</p>
        </td>
      `;
    })
    .join('');

  // Generate table for array data (e.g., dailyRevenue, topCustomers, etc.)
  let dataTable = '';
  if (reportData && typeof reportData === 'object') {
    const arrayData = Object.entries(reportData).find(([_, v]) => Array.isArray(v));
    if (arrayData && Array.isArray(arrayData[1]) && arrayData[1].length > 0) {
      const items = arrayData[1] as any[];
      const firstItem = items[0];
      const headers = Object.keys(firstItem);

      dataTable = `
        <tr>
          <td style="padding: 24px;">
            <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.text};">
              ${arrayData[0].replace(/([A-Z])/g, ' $1')}
            </h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: ${BRAND_COLORS.primary}; color: white;">
                  ${headers.map(h => `
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${h.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${items.slice(0, 10).map(item => `
                  <tr style="border-bottom: 1px solid ${BRAND_COLORS.border};">
                    ${headers.map(h => {
                      let val = item[h];
                      if (typeof val === 'number') val = val.toLocaleString();
                      if (val instanceof Date) val = val.toLocaleDateString();
                      return `<td style="padding: 12px 16px; font-size: 14px; color: ${BRAND_COLORS.textLight};">${val ?? '-'}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </td>
        </tr>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.name} - NILIN Reports</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0 0 4px; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
        <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">Automated Reports</p>
      </td>
    </tr>

    <!-- Report Title -->
    <tr>
      <td style="padding: 32px 24px 16px;">
        <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: ${BRAND_COLORS.text};">
          ${report.name}
        </h2>
        <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
          ${periodLabel} | Generated on ${new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </td>
    </tr>

    <!-- Summary Stats -->
    ${summaryCards ? `
    <tr>
      <td style="padding: 0 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="8">
          <tr>
            ${summaryCards}
          </tr>
        </table>
      </td>
    </tr>
    ` : ''}

    <!-- Data Table -->
    ${dataTable}

    <!-- Footer -->
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <p style="margin: 0 0 16px; font-size: 12px; color: ${BRAND_COLORS.textLight};">
          This report was automatically generated by NILIN.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://nilin.com'}/admin/reports" style="display: inline-block; padding: 12px 24px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">
                View Full Report Dashboard
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">
          &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: ${BRAND_COLORS.textLight};">
          <a href="${process.env.FRONTEND_URL || 'https://nilin.com'}/admin/reports/scheduled" style="color: ${BRAND_COLORS.textLight};">Manage scheduled reports</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Format report data as CSV for email attachment
 */
function formatReportAsCsv(data: any): string {
  const { data: reportData } = data;

  if (!reportData || typeof reportData !== 'object') {
    return '';
  }

  // Find the first array in the data
  const arrayData = Object.entries(reportData).find(([_, v]) => Array.isArray(v));

  if (!arrayData || !Array.isArray(arrayData[1]) || arrayData[1].length === 0) {
    return '';
  }

  const items = arrayData[1] as any[];
  const headers = Object.keys(items[0]);

  const csvRows = [
    headers.join(','),
    ...items.map(item =>
      headers.map(h => {
        let val = item[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}

/**
 * Generate a simple PDF report from data
 */
async function generateReportPdf(
  report: IScheduledReport,
  data: any
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { colors } = {
        colors: {
          primary: BRAND_COLORS.primary,
          text: BRAND_COLORS.text,
          lightText: BRAND_COLORS.textLight,
          background: BRAND_COLORS.background,
          border: BRAND_COLORS.border,
        },
      };

      // Header
      doc.rect(0, 0, 595, 80).fill(BRAND_COLORS.primary);
      doc.fillColor('#FFFFFF').fontSize(24).text('NILIN', 50, 25);
      doc.fillColor('#FCE7F3').fontSize(10).text('Automated Reports', 50, 52);

      // Report title
      let y = 100;
      doc.fillColor(colors.text).fontSize(20).text(report.name, 50, y);
      y += 30;

      doc.fillColor(colors.lightText).fontSize(10)
        .text(`Report Type: ${report.type.toUpperCase()}`, 50, y)
        .text(`Frequency: ${report.frequency}`, 50, y + 14)
        .text(`Generated: ${new Date().toLocaleString('en-AE')}`, 50, y + 28);
      y += 60;

      // Summary section
      if (data?.summary && typeof data.summary === 'object') {
        doc.fillColor(colors.text).fontSize(14).text('Summary', 50, y);
        y += 24;

        doc.fillColor(colors.background)
          .rect(50, y, 495, 100)
          .fill();

        let x = 60;
        const entries = Object.entries(data.summary).slice(0, 4);
        entries.forEach(([key, value], index) => {
          const label = key.replace(/([A-Z])/g, ' $1').trim();
          const formattedValue = typeof value === 'number'
            ? value.toLocaleString()
            : String(value);

          if (index % 2 === 0) {
            doc.fillColor(colors.text).fontSize(18).text(formattedValue, x, y + 15);
            doc.fillColor(colors.lightText).fontSize(9).text(label, x, y + 40);
          } else {
            x = 320;
            doc.fillColor(colors.text).fontSize(18).text(formattedValue, x, y + 15);
            doc.fillColor(colors.lightText).fontSize(9).text(label, x, y + 40);
            x = 60;
            y += 50;
          }
        });
        y += 110;
      }

      // Data table
      if (data?.data && typeof data.data === 'object') {
        const arrayData = Object.entries(data.data).find(([_, v]) => Array.isArray(v));
        if (arrayData && Array.isArray(arrayData[1]) && arrayData[1].length > 0) {
          const items = arrayData[1] as any[];
          const firstItem = items[0];
          const headers = Object.keys(firstItem).slice(0, 5); // Limit columns

          doc.fillColor(colors.text).fontSize(14).text(arrayData[0].replace(/([A-Z])/g, ' $1'), 50, y);
          y += 24;

          // Table header
          doc.fillColor(BRAND_COLORS.primary)
            .rect(50, y, 495, 20)
            .fill();

          headers.forEach((header, i) => {
            doc.fillColor('#FFFFFF').fontSize(8)
              .text(header.replace(/([A-Z])/g, ' $1').trim(), 55 + i * 95, y + 6, { width: 90 });
          });
          y += 25;

          // Table rows
          items.slice(0, 15).forEach((item, rowIndex) => {
            if (rowIndex % 2 === 0) {
              doc.fillColor('#FFFFFF')
                .rect(50, y - 2, 495, 18)
                .fill();
            }

            headers.forEach((header, i) => {
              let val = item[header];
              if (typeof val === 'number') val = val.toLocaleString();
              if (val instanceof Date) val = val.toLocaleDateString();
              if (val === null || val === undefined) val = '-';

              doc.fillColor(colors.lightText).fontSize(8)
                .text(String(val).substring(0, 15), 55 + i * 95, y, { width: 90 });
            });
            y += 18;
          });
        }
      }

      // Footer
      doc.fillColor(colors.lightText).fontSize(8)
        .text(`Page 1 of 1`, 50, 750)
        .text('NILIN - Automated Report System', 400, 750);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Execute a single scheduled report
 */
async function executeScheduledReport(report: IScheduledReport): Promise<{
  success: boolean;
  error?: string;
}> {
  const service = await getReportService();

  try {
    logger.info('Executing scheduled report', {
      reportId: report._id.toString(),
      name: report.name,
      type: report.type,
      recipients: report.recipients.length,
    });

    // Generate report data using the report service
    const reportData = await service.triggerReport(report._id.toString());

    if (!reportData.success) {
      throw new Error(reportData.error || 'Failed to generate report data');
    }

    const { data } = reportData;

    // Format email content based on format preference
    const subject = `${report.name} - ${report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)} Report`;

    if (report.format === 'json') {
      // Send as HTML email with summary
      const html = formatReportAsHtml(report, data);
      await Promise.all(
        report.recipients.map(recipient =>
          sendEmail(recipient, subject, html)
        )
      );
    } else if (report.format === 'csv') {
      // Generate CSV content and include as link or attachment note
      const csvContent = formatReportAsCsv(data);
      const html = formatReportAsHtml(report, data);
      await Promise.all(
        report.recipients.map(recipient =>
          sendEmail(recipient, subject, html)
        )
      );
    } else if (report.format === 'pdf') {
      // Generate PDF and send as email with PDF as attachment note
      const pdfBuffer = await generateReportPdf(report, data);
      const html = formatReportAsHtml(report, data);

      // Send email - note: actual PDF attachment would require nodemailer with attachments
      // For now, we send the HTML and note that PDF is available for download
      const htmlWithPdfNote = html + `
        <div style="margin-top: 24px; padding: 16px; background: #DCFCE7; border-radius: 8px; border-left: 4px solid #10B981;">
          <p style="margin: 0; color: #166534; font-size: 14px;">
            <strong>PDF Report Available:</strong> This report has been generated as PDF. Please access the report dashboard to download the PDF version.
          </p>
        </div>
      `;

      await Promise.all(
        report.recipients.map(recipient =>
          sendEmail(recipient, subject, htmlWithPdfNote)
        )
      );

      logger.info('PDF report generated for scheduled report', {
        reportId: report._id.toString(),
        pdfSize: pdfBuffer.length,
      });
    }

    // Update the report's lastRun and nextRun
    await mongoose.model('ScheduledReport').findByIdAndUpdate(report._id, {
      $set: {
        lastRunDate: new Date(),
        lastRunStatus: 'success',
        lastRunError: null,
        nextRunDate: calculateNextRunDate(new Date(), report.frequency),
      },
    });

    logger.info('Scheduled report executed successfully', {
      reportId: report._id.toString(),
      name: report.name,
      recipients: report.recipients.length,
    });

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update the report's lastRun with failure status
    await mongoose.model('ScheduledReport').findByIdAndUpdate(report._id, {
      $set: {
        lastRunDate: new Date(),
        lastRunStatus: 'failed',
        lastRunError: errorMessage,
      },
    });

    logger.error('Scheduled report execution failed', {
      reportId: report._id.toString(),
      name: report.name,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Main job function: Execute all due scheduled reports
 */
export async function executeScheduledReports(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const now = new Date();
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Find all enabled reports where nextRunDate <= now
    const dueReports = await mongoose.model('ScheduledReport').find({
      enabled: true,
      nextRunDate: { $lte: now },
    }).lean();

    logger.info('Found scheduled reports to execute', {
      count: dueReports.length,
      timestamp: now.toISOString(),
    });

    for (const report of dueReports) {
      result.processed++;
      const execution = await executeScheduledReport(report as unknown as IScheduledReport);

      if (execution.success) {
        result.succeeded++;
      } else {
        result.failed++;
        if (execution.error) {
          result.errors.push(`${report.name}: ${execution.error}`);
        }
      }
    }

    logger.info('Scheduled reports execution completed', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });

  } catch (error) {
    logger.error('Failed to query scheduled reports', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

export default executeScheduledReports;
