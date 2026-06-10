import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Readable } from 'stream';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// PDF Service - Invoice, Receipt & Tax Document Generation
// ============================================

// Company branding configuration
const COMPANY_BRANDING = {
  name: 'Rezin Home Services',
  tagline: 'Premium Home Services Marketplace',
  address: 'Dubai, United Arab Emirates',
  phone: '+971 4 XXX XXXX',
  email: 'support@rezin.ae',
  website: 'www.rezin.ae',
  colors: {
    primary: '#2563EB',      // Blue
    secondary: '#7C3AED',    // Purple
    accent: '#10B981',       // Green
    text: '#1F2937',        // Dark gray
    lightText: '#6B7280',   // Light gray
    background: '#F9FAFB',   // Light background
    border: '#E5E7EB',      // Border color
  },
};

// Invoice line item interface
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serviceId?: string;
}

// Invoice data interface
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;

  // Customer info
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };

  // Provider info
  provider: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    businessName?: string;
    licenseNumber?: string;
  };

  // Service details
  service: {
    name: string;
    category?: string;
    description?: string;
  };

  // Booking details
  booking: {
    number: string;
    date: Date;
    scheduledDate: Date;
    scheduledTime: string;
    locationType: string;
    address?: string;
    duration: number;
  };

  // Line items
  lineItems: InvoiceLineItem[];

  // Pricing breakdown
  pricing: {
    subtotal: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
  };

  // Payment info
  payment: {
    status: 'pending' | 'paid' | 'refunded' | 'partial';
    method?: string;
    paidAt?: Date;
    transactionId?: string;
  };

  // QR code for payment
  qrCodeData?: string;

  // Notes
  notes?: string;
  terms?: string;
}

// Receipt data interface
export interface ReceiptData {
  receiptNumber: string;
  receiptDate: Date;

  customer: {
    name: string;
    email: string;
  };

  provider: {
    name: string;
    businessName?: string;
  };

  service: {
    name: string;
  };

  booking: {
    number: string;
    date: Date;
  };

  payment: {
    amount: number;
    method: string;
    transactionId: string;
    currency: string;
  };

  // Optional breakdown
  breakdown?: {
    subtotal: number;
    tax: number;
    tip?: number;
    total: number;
  };
}

// Tax document data interface
export interface TaxDocumentData {
  documentNumber: string;
  documentType: 'invoice' | 'receipt' | 'tax_statement' | 'credit_note';
  issueDate: Date;
  period?: {
    start: Date;
    end: Date;
  };

  provider: {
    name: string;
    email: string;
    taxId?: string;
    address: string;
  };

  customer?: {
    name: string;
    email: string;
    taxId?: string;
  };

  transactions: Array<{
    transactionId: string;
    date: Date;
    description: string;
    amount: number;
    taxRate: number;
    taxAmount: number;
    netAmount: number;
  }>;

  summary: {
    totalGross: number;
    totalTax: number;
    totalNet: number;
    currency: string;
  };

  taxAuthority?: string;
  vatNumber?: string;
}

export class PDFService {
  /**
   * Generate a PDF buffer from invoice data
   */
  async generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.drawHeader(doc, data.invoiceNumber);

        // Company Info (left) & Customer Info (right)
        this.drawCompanyInfo(doc);
        this.drawCustomerInfo(doc, data.customer);

        // Divider
        doc.moveDown(2);
        this.drawDivider(doc);

        // Invoice details
        this.drawInvoiceDetails(doc, data);

        // Line items table
        this.drawLineItemsTable(doc, data.lineItems, data.pricing.currency);

        // Pricing summary
        this.drawPricingSummary(doc, data.pricing);

        // Payment status
        this.drawPaymentStatus(doc, data.payment);

        // QR Code if provided
        if (data.qrCodeData) {
          await this.drawQRCode(doc, data.qrCodeData);
        }

        // Footer
        this.drawFooter(doc, data.notes, data.terms);

        doc.end();
      } catch (error) {
        logger.error('Error generating invoice PDF', { error, invoiceNumber: data.invoiceNumber });
        reject(error);
      }
    });
  }

  /**
   * Generate receipt PDF
   */
  async generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A5', layout: 'landscape' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.drawReceiptHeader(doc, data.receiptNumber);

        // Receipt info
        doc.fontSize(10).fillColor(COLORS.text)
           .text(`Date: ${this.formatDate(data.receiptDate)}`, 50, 100)
           .text(`Transaction ID: ${data.payment.transactionId}`, 50, 115);

        doc.moveDown(2);

        // Customer & Provider
        doc.fontSize(11).fillColor(COLORS.primary)
           .text('Customer:', 50, 150)
           .fillColor(COLORS.text)
           .text(data.customer.name, 130, 150)
           .text(data.customer.email, 130, 165);

        doc.fillColor(COLORS.primary)
           .text('Service Provider:', 50, 195)
           .fillColor(COLORS.text)
           .text(data.provider.businessName || data.provider.name, 160, 195);

        doc.moveDown(2);

        // Service & Booking
        doc.fillColor(COLORS.text)
           .text(`Service: ${data.service.name}`, 50, 235)
           .text(`Booking: ${data.booking.number}`, 50, 250);

        doc.moveDown(2);

        // Payment summary
        this.drawReceiptPaymentSummary(doc, data);

        // QR Code
        const qrData = `REZIN|RECEIPT|${data.receiptNumber}|${data.payment.amount}`;
        await this.drawQRCodeSmall(doc, qrData, 300, 320);

        // Footer
        this.drawReceiptFooter(doc);

        doc.end();
      } catch (error) {
        logger.error('Error generating receipt PDF', { error, receiptNumber: data.receiptNumber });
        reject(error);
      }
    });
  }

  /**
   * Generate tax document PDF
   */
  async generateTaxDocumentPDF(data: TaxDocumentData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Tax document header
        this.drawTaxDocumentHeader(doc, data);

        // Provider info
        this.drawTaxProviderInfo(doc, data.provider);

        // Customer info (if available)
        if (data.customer) {
          this.drawTaxCustomerInfo(doc, data.customer);
        }

        // Period info
        if (data.period) {
          this.drawTaxPeriodInfo(doc, data.period);
        }

        doc.moveDown(2);

        // Transactions table
        this.drawTaxTransactionsTable(doc, data.transactions, data.summary.currency);

        // Summary
        this.drawTaxSummary(doc, data.summary);

        // Tax authority info
        if (data.taxAuthority) {
          this.drawTaxAuthorityInfo(doc, data);
        }

        // Footer
        this.drawTaxDocumentFooter(doc);

        doc.end();
      } catch (error) {
        logger.error('Error generating tax document PDF', { error, documentNumber: data.documentNumber });
        reject(error);
      }
    });
  }

  /**
   * Generate invoice from booking ID
   */
  async generateInvoiceFromBooking(bookingId: string): Promise<Buffer> {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'firstName lastName email phone')
      .populate('providerId', 'firstName lastName email phone')
      .populate('serviceId', 'name description category');

    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }

    const invoiceData: InvoiceData = {
      invoiceNumber: `INV-${booking.bookingNumber}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days

      customer: {
        name: booking.customerId
          ? `${(booking.customerId as any).firstName} ${(booking.customerId as any).lastName}`
          : booking.guestInfo?.name || 'Guest',
        email: booking.customerId
          ? (booking.customerId as any).email
          : booking.guestInfo?.email || '',
        phone: booking.customerId
          ? (booking.customerId as any).phone
          : booking.guestInfo?.phone,
        address: this.formatAddress(booking.location.address),
      },

      provider: {
        name: `${(booking.providerId as any).firstName} ${(booking.providerId as any).lastName}`,
        email: (booking.providerId as any).email,
        phone: (booking.providerId as any).phone,
      },

      service: {
        name: (booking.serviceId as any)?.name || 'Service',
        description: (booking.serviceId as any)?.description,
      },

      booking: {
        number: booking.bookingNumber,
        date: booking.createdAt,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        locationType: booking.locationType,
        address: this.formatAddress(booking.location.address),
        duration: booking.duration,
      },

      lineItems: [
        {
          description: (booking.serviceId as any)?.name || 'Service',
          quantity: 1,
          unitPrice: booking.pricing.basePrice,
          total: booking.pricing.basePrice,
        },
        ...booking.pricing.addOns.map(addon => ({
          description: addon.name,
          quantity: 1,
          unitPrice: addon.price,
          total: addon.price,
        })),
      ],

      pricing: {
        subtotal: booking.pricing.subtotal,
        discount: booking.pricing.couponDiscount +
          booking.pricing.discounts.reduce((sum, d) => sum + d.amount, 0),
        taxRate: booking.pricing.totalAmount > 0
          ? (booking.pricing.tax / (booking.pricing.totalAmount - booking.pricing.tax)) * 100
          : 0,
        taxAmount: booking.pricing.tax,
        total: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
      },

      payment: {
        status: booking.payment.status as any,
        method: booking.payment.method,
        paidAt: booking.payment.paidAt,
        transactionId: booking.payment.transactionId,
      },

      notes: `Booking #${booking.bookingNumber}`,
      terms: 'Payment due within 14 days of service completion.',
    };

    return this.generateInvoicePDF(invoiceData);
  }

  // ============================================
  // Private Drawing Methods
  // ============================================

  private drawHeader(doc: typeof PDFDocument.prototype, invoiceNumber: string): void {
    const { colors } = COMPANY_BRANDING;

    // Company name
    doc.fontSize(24).fillColor(colors.primary)
       .text(COMPANY_BRANDING.name, 50, 50, { align: 'left' });

    // Tagline
    doc.fontSize(10).fillColor(colors.lightText)
       .text(COMPANY_BRANDING.tagline, 50, 78);

    // Invoice label
    doc.fontSize(28).fillColor(colors.text)
       .text('INVOICE', 450, 50, { align: 'right' });

    // Invoice number
    doc.fontSize(12).fillColor(colors.primary)
       .text(invoiceNumber, 450, 82, { align: 'right' });
  }

  private drawCompanyInfo(doc: typeof PDFDocument.prototype): void {
    const { colors, name, address, phone, email, website } = COMPANY_BRANDING;

    doc.fontSize(10).fillColor(colors.lightText)
       .text(name, 50, 120)
       .text(address, 50, 135)
       .text(phone, 50, 150)
       .text(email, 50, 165)
       .text(website, 50, 180);
  }

  private drawCustomerInfo(doc: typeof PDFDocument.prototype, customer: InvoiceData['customer']): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(10).fillColor(colors.lightText)
       .text('Bill To:', 350, 120)
       .fontSize(12).fillColor(colors.text)
       .text(customer.name, 350, 135)
       .fontSize(10)
       .text(customer.email, 350, 152);

    if (customer.phone) {
      doc.text(customer.phone, 350, 167);
    }

    if (customer.address) {
      doc.text(customer.address, 350, 184, { width: 200 });
    }
  }

  private drawDivider(doc: typeof PDFDocument.prototype): void {
    doc.strokeColor(COLORS.border)
       .lineWidth(1)
       .moveTo(50, 220)
       .lineTo(545, 220)
       .stroke();
  }

  private drawInvoiceDetails(doc: typeof PDFDocument.prototype, data: InvoiceData): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(10).fillColor(colors.lightText)
       .text('Invoice Date:', 50, 240)
       .text('Due Date:', 50, 255)
       .text('Service Date:', 50, 270)
       .text('Booking Reference:', 50, 285);

    doc.fillColor(colors.text)
       .text(this.formatDate(data.invoiceDate), 160, 240)
       .text(data.dueDate ? this.formatDate(data.dueDate) : 'Upon Receipt', 160, 255)
       .text(`${this.formatDate(data.booking.scheduledDate)} at ${data.booking.scheduledTime}`, 160, 270)
       .text(data.booking.number, 160, 285);

    // Service info on right side
    doc.fillColor(colors.lightText)
       .text('Service:', 350, 240)
       .text('Category:', 350, 255)
       .text('Duration:', 350, 270)
       .text('Location:', 350, 285);

    doc.fillColor(colors.text)
       .text(data.service.name, 430, 240)
       .text(data.service.category || 'General', 430, 255)
       .text(`${data.booking.duration} minutes`, 430, 270)
       .text(data.booking.locationType.replace('_', ' ').toUpperCase(), 430, 285);
  }

  private drawLineItemsTable(
    doc: typeof PDFDocument.prototype,
    lineItems: InvoiceLineItem[],
    currency: string
  ): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 320;

    // Table header
    doc.fontSize(10).fillColor(colors.primary)
       .rect(50, startY, 495, 25).fill(colors.background)
       .text('Description', 55, startY + 8)
       .text('Qty', 340, startY + 8)
       .text('Unit Price', 400, startY + 8)
       .text('Total', 490, startY + 8, { align: 'right' });

    // Table rows
    let rowY = startY + 30;
    doc.fillColor(colors.text);

    lineItems.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, rowY - 5, 495, 22).fill('#FFFFFF');
      } else {
        doc.rect(50, rowY - 5, 495, 22).fill(colors.background);
      }

      doc.text(item.description, 55, rowY)
         .text(item.quantity.toString(), 345, rowY)
         .text(`${this.formatCurrency(item.unitPrice, currency)}`, 400, rowY)
         .text(this.formatCurrency(item.total, currency), 490, rowY, { align: 'right' });

      rowY += 22;
    });

    // Table border
    doc.strokeColor(colors.border)
       .lineWidth(0.5)
       .rect(50, startY, 495, rowY - startY)
       .stroke();
  }

  private drawPricingSummary(doc: typeof PDFDocument.prototype, pricing: InvoiceData['pricing']): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 480;

    const summaryX = 350;
    const valueX = 490;

    doc.fontSize(10).fillColor(colors.text);

    // Subtotal
    doc.text('Subtotal:', summaryX, startY)
       .text(this.formatCurrency(pricing.subtotal, pricing.currency), valueX, startY, { align: 'right' });

    // Discount
    if (pricing.discount > 0) {
      doc.fillColor(colors.accent)
         .text('Discount:', summaryX, startY + 18)
         .text(`-${this.formatCurrency(pricing.discount, pricing.currency)}`, valueX, startY + 18, { align: 'right' });
      doc.fillColor(colors.text);
    }

    // Tax
    doc.text(`Tax (${pricing.taxRate.toFixed(1)}%):`, summaryX, startY + 36)
       .text(this.formatCurrency(pricing.taxAmount, pricing.currency), valueX, startY + 36, { align: 'right' });

    // Divider
    doc.moveTo(summaryX, startY + 55).lineTo(545, startY + 55).stroke();

    // Total
    doc.fontSize(14).fillColor(colors.primary)
       .text('Total:', summaryX, startY + 65)
       .text(this.formatCurrency(pricing.total, pricing.currency), valueX, startY + 65, { align: 'right' });

    doc.fontSize(10).fillColor(colors.lightText);
  }

  private drawPaymentStatus(doc: typeof PDFDocument.prototype, payment: InvoiceData['payment']): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 570;

    doc.fontSize(10).fillColor(colors.lightText)
       .text('Payment Status:', 50, startY);

    const statusColors: Record<string, string> = {
      paid: colors.accent,
      pending: '#F59E0B',
      refunded: '#EF4444',
      partial: '#8B5CF6',
    };

    doc.fillColor(statusColors[payment.status] || colors.text)
       .text(payment.status.toUpperCase(), 150, startY);

    if (payment.method) {
      doc.fillColor(colors.lightText)
         .text(`Method: ${payment.method.toUpperCase()}`, 50, startY + 18);
    }

    if (payment.transactionId) {
      doc.text(`Transaction ID: ${payment.transactionId}`, 50, startY + 36);
    }

    if (payment.paidAt) {
      doc.text(`Paid on: ${this.formatDate(payment.paidAt)}`, 50, startY + 54);
    }
  }

  private async drawQRCode(doc: typeof PDFDocument.prototype, data: string): Promise<void> {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, { width: 100 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, 450, 570, { width: 80 });
      doc.fontSize(8).fillColor(COLORS.lightText)
         .text('Scan to pay', 455, 655);
    } catch (error) {
      logger.warn('Failed to generate QR code', { error });
    }
  }

  private drawFooter(doc: typeof PDFDocument.prototype, notes?: string, terms?: string): void {
    const { colors } = COMPANY_BRANDING;
    const footerY = 680;

    doc.moveTo(50, footerY - 20).lineTo(545, footerY - 20).stroke();

    if (notes) {
      doc.fontSize(10).fillColor(colors.text)
         .text(`Notes: ${notes}`, 50, footerY);
    }

    if (terms) {
      doc.fontSize(9).fillColor(colors.lightText)
         .text(`Terms: ${terms}`, 50, footerY + 20);
    }

    // Page number
    doc.text(
      `Page 1 of 1`,
      50,
      750,
      { align: 'center', width: 495 }
    );
  }

  private drawReceiptHeader(doc: typeof PDFDocument.prototype, receiptNumber: string): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(20).fillColor(colors.primary)
       .text('RECEIPT', 50, 40, { align: 'center' });

    doc.fontSize(12).fillColor(colors.text)
       .text(COMPANY_BRANDING.name, 50, 65, { align: 'center' });

    doc.fontSize(10).fillColor(colors.primary)
       .text(receiptNumber, 50, 85, { align: 'center' });
  }

  private drawReceiptPaymentSummary(doc: typeof PDFDocument.prototype, data: ReceiptData): void {
    const { colors } = COMPANY_BRANDING;

    const startY = 290;
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(50, startY)
       .lineTo(550, startY)
       .stroke();

    doc.fontSize(12).fillColor(colors.primary)
       .text('Payment Summary', 50, startY + 10);

    const summaryX = 350;
    const valueX = 530;

    doc.fontSize(11).fillColor(colors.text);

    if (data.breakdown) {
      doc.text('Subtotal:', summaryX, startY + 40)
         .text(this.formatCurrency(data.breakdown.subtotal, data.payment.currency), valueX, startY + 40, { align: 'right' });

      doc.text('Tax:', summaryX, startY + 58)
         .text(this.formatCurrency(data.breakdown.tax, data.payment.currency), valueX, startY + 58, { align: 'right' });

      if (data.breakdown.tip) {
        doc.text('Tip:', summaryX, startY + 76)
           .text(this.formatCurrency(data.breakdown.tip, data.payment.currency), valueX, startY + 76, { align: 'right' });
      }

      doc.moveTo(summaryX, startY + 90).lineTo(550, startY + 90).stroke();
    }

    doc.fontSize(14).fillColor(colors.primary)
       .text('Total Paid:', summaryX, startY + 100)
       .text(this.formatCurrency(data.payment.amount, data.payment.currency), valueX, startY + 100, { align: 'right' });
  }

  private async drawQRCodeSmall(
    doc: typeof PDFDocument.prototype,
    data: string,
    x: number,
    y: number
  ): Promise<void> {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, { width: 60 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, x, y, { width: 50 });
    } catch (error) {
      logger.warn('Failed to generate QR code', { error });
    }
  }

  private drawReceiptFooter(doc: typeof PDFDocument.prototype): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(9).fillColor(colors.lightText)
       .text('Thank you for your business!', 50, 400, { align: 'center' })
       .text(`${COMPANY_BRANDING.email} | ${COMPANY_BRANDING.website}`, 50, 415, { align: 'center' });
  }

  private drawTaxDocumentHeader(doc: typeof PDFDocument.prototype, data: TaxDocumentData): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(24).fillColor(colors.primary)
       .text(data.documentType.toUpperCase().replace('_', ' '), 50, 50);

    doc.fontSize(14).fillColor(colors.text)
       .text(data.documentNumber, 50, 80);

    doc.fontSize(10).fillColor(colors.lightText)
       .text(`Issue Date: ${this.formatDate(data.issueDate)}`, 50, 100);
  }

  private drawTaxProviderInfo(doc: typeof PDFDocument.prototype, provider: TaxDocumentData['provider']): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(12).fillColor(colors.primary)
       .text('Service Provider', 50, 140);

    doc.fontSize(10).fillColor(colors.text)
       .text(provider.name, 50, 160)
       .text(provider.address, 50, 175)
       .text(provider.email, 50, 190);

    if (provider.taxId) {
      doc.fillColor(colors.lightText)
         .text(`Tax ID: ${provider.taxId}`, 50, 205);
    }
  }

  private drawTaxCustomerInfo(doc: typeof PDFDocument.prototype, customer: TaxDocumentData['customer'] | undefined): void {
    const { colors } = COMPANY_BRANDING;
    if (!customer) return;

    doc.fontSize(12).fillColor(colors.primary)
       .text('Customer', 350, 140);

    doc.fontSize(10).fillColor(colors.text)
       .text(customer.name, 350, 160)
       .text(customer.email, 350, 175);

    if (customer.taxId) {
      doc.fillColor(colors.lightText)
         .text(`Tax ID: ${customer.taxId}`, 350, 190);
    }
  }

  private drawTaxPeriodInfo(doc: typeof PDFDocument.prototype, period: { start: Date; end: Date }): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(10).fillColor(colors.lightText)
       .text(`Period: ${this.formatDate(period.start)} - ${this.formatDate(period.end)}`, 50, 230);
  }

  private drawTaxTransactionsTable(
    doc: typeof PDFDocument.prototype,
    transactions: TaxDocumentData['transactions'],
    currency: string
  ): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 260;

    // Header
    doc.fontSize(9).fillColor(colors.primary)
       .rect(50, startY, 495, 20).fill(colors.background)
       .text('Date', 55, startY + 6)
       .text('Description', 120, startY + 6)
       .text('Amount', 350, startY + 6)
       .text('Tax', 410, startY + 6)
       .text('Net', 490, startY + 6, { align: 'right' });

    // Rows
    let rowY = startY + 25;
    doc.fillColor(colors.text);

    transactions.forEach((tx, index) => {
      if (index % 2 === 0) {
        doc.rect(50, rowY - 3, 495, 18).fill('#FFFFFF');
      }

      doc.text(this.formatDate(tx.date), 55, rowY)
         .text(tx.description.substring(0, 40), 120, rowY)
         .text(this.formatCurrency(tx.amount, currency), 350, rowY)
         .text(this.formatCurrency(tx.taxAmount, currency), 410, rowY)
         .text(this.formatCurrency(tx.netAmount, currency), 490, rowY, { align: 'right' });

      rowY += 18;
    });

    doc.strokeColor(colors.border)
       .rect(50, startY, 495, rowY - startY)
       .stroke();
  }

  private drawTaxSummary(doc: typeof PDFDocument.prototype, summary: TaxDocumentData['summary']): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 450;

    doc.moveTo(300, startY).lineTo(545, startY).stroke();

    doc.fontSize(10).fillColor(colors.text)
       .text('Total Gross Amount:', 300, startY + 10)
       .text(this.formatCurrency(summary.totalGross, summary.currency), 490, startY + 10, { align: 'right' });

    doc.text('Total Tax:', 300, startY + 28)
       .text(this.formatCurrency(summary.totalTax, summary.currency), 490, startY + 28, { align: 'right' });

    doc.moveTo(300, startY + 45).lineTo(545, startY + 45).stroke();

    doc.fontSize(12).fillColor(colors.primary)
       .text('Total Net:', 300, startY + 55)
       .text(this.formatCurrency(summary.totalNet, summary.currency), 490, startY + 55, { align: 'right' });
  }

  private drawTaxAuthorityInfo(doc: typeof PDFDocument.prototype, data: TaxDocumentData): void {
    const { colors } = COMPANY_BRANDING;

    doc.fontSize(9).fillColor(colors.lightText)
       .text(`Tax Authority: ${data.taxAuthority || 'Federal Tax Authority'}`, 50, 530);

    if (data.vatNumber) {
      doc.text(`VAT Registration Number: ${data.vatNumber}`, 50, 545);
    }
  }

  private drawTaxDocumentFooter(doc: typeof PDFDocument.prototype): void {
    const { colors } = COMPANY_BRANDING;

    doc.moveTo(50, 580).lineTo(545, 580).stroke();

    doc.fontSize(8).fillColor(colors.lightText)
       .text('This is a computer-generated document. No signature required.', 50, 590)
       .text(`Generated on: ${new Date().toISOString()}`, 50, 605)
       .text(COMPANY_BRANDING.name, 50, 750, { align: 'center' });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency || 'AED',
    }).format(amount);
  }

  private formatAddress(address?: any): string {
    if (!address) return '';
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  // ============================================
  // Package PDF Generation
  // ============================================

  /**
   * Generate a professional PDF document for package details
   */
  async generatePackagePDF(data: PackagePDFData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Draw header
        this.drawPackageHeader(doc, data);

        // Draw package title and basic info
        this.drawPackageInfo(doc, data);

        // Draw pricing section
        this.drawPackagePricing(doc, data);

        // Draw features/inclusions
        this.drawPackageFeatures(doc, data);

        // Draw exclusions if any
        if (data.exclusions && data.exclusions.length > 0) {
          this.drawPackageExclusions(doc, data.exclusions);
        }

        // Draw add-ons if any
        if (data.addOns && data.addOns.length > 0) {
          this.drawPackageAddOns(doc, data.addOns, data.pricing.currency);
        }

        // Draw provider info
        this.drawPackageProvider(doc, data.provider);

        // Draw terms if any
        if (data.terms) {
          this.drawPackageTerms(doc, data.terms);
        }

        // Draw footer
        this.drawPackageFooter(doc, data);

        doc.end();
      } catch (error) {
        logger.error('Error generating package PDF', { error, packageName: data.name });
        reject(error);
      }
    });
  }

  // Package PDF drawing methods - Modern Professional Design
  private drawPackageHeader(doc: typeof PDFDocument.prototype, data: PackagePDFData): void {
    const { colors } = COMPANY_BRANDING;

    // Gradient-style header bar at top
    doc.rect(0, 0, 595, 80).fill(colors.primary);

    // Company name
    doc.fillColor('#FFFFFF')
       .fontSize(26)
       .text(COMPANY_BRANDING.name, 50, 25);

    // Tagline
    doc.fillColor('rgba(255,255,255,0.8)')
       .fontSize(11)
       .text(COMPANY_BRANDING.tagline, 50, 52);

    // Package badge on right
    doc.fillColor('rgba(255,255,255,0.2)')
       .roundedRect(420, 20, 130, 40, 8)
       .fill();
    doc.fillColor('#FFFFFF')
       .fontSize(14)
       .text('PACKAGE DETAILS', 435, 32, { width: 100, align: 'center' });
  }

  private drawPackageInfo(doc: typeof PDFDocument.prototype, data: PackagePDFData): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 100;

    // Package name with elegant styling
    const packageName = data.name || 'Package Details';
    doc.fillColor(colors.text)
       .fontSize(26)
       .text(packageName, 50, startY);

    // Decorative line
    doc.strokeColor(colors.primary)
       .lineWidth(3)
       .moveTo(50, startY + 35)
       .lineTo(150, startY + 35)
       .stroke();

    // Category badge
    const category = data.category || 'Package';
    const badgeWidth = Math.min(category.length * 8 + 30, 150);
    doc.fillColor(colors.primary)
       .roundedRect(50, startY + 48, badgeWidth, 28, 6)
       .fill();
    doc.fillColor('#FFFFFF')
       .fontSize(11)
       .text(category.toUpperCase(), 60, startY + 55);

    // Description
    if (data.description && data.description.length > 0) {
      doc.fillColor(colors.lightText)
         .fontSize(12)
         .text(data.description, 50, startY + 95, { width: 495, lineGap: 4 });
    }
  }

  private drawPackagePricing(doc: typeof PDFDocument.prototype, data: PackagePDFData): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 200;

    // Pricing card with rounded corners
    doc.fillColor(colors.background)
       .roundedRect(50, startY, 495, 90, 12)
       .fill();
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .roundedRect(50, startY, 495, 90, 12)
       .stroke();

    // Left side - Price
    if (data.pricing.currentPrice > 0) {
      // Current price
      doc.fillColor(colors.primary)
         .fontSize(36)
         .text(this.formatCurrency(data.pricing.currentPrice, data.pricing.currency), 70, startY + 15);

      // Original price with strikethrough
      if (data.pricing.originalPrice > data.pricing.currentPrice && data.pricing.originalPrice > 0) {
        doc.fillColor(colors.lightText)
           .fontSize(16)
           .text(this.formatCurrency(data.pricing.originalPrice, data.pricing.currency), 70, startY + 55);

        // Savings badge
        const savingsPct = data.pricing.savingsPercentage ?? 0;
        if (savingsPct > 0) {
          doc.fillColor('#10B981')
             .roundedRect(250, startY + 15, 80, 28, 6)
             .fill();
          doc.fillColor('#FFFFFF')
             .fontSize(12)
             .text(`SAVE ${savingsPct}%`, 258, startY + 22);
        }
      }

      // Duration info on right side
      if (data.duration?.totalMinutes && data.duration.totalMinutes > 0) {
        doc.fillColor(colors.lightText)
           .fontSize(11)
           .text('Duration:', 350, startY + 20);
        doc.fillColor(colors.text)
           .fontSize(14)
           .text(data.duration.formatted, 350, startY + 38);
      }

      // Rating on right
      if (data.reviews && data.reviews.totalReviews > 0 && data.reviews.averageRating > 0) {
        const stars = '★'.repeat(Math.round(data.reviews.averageRating));
        doc.fillColor('#F59E0B')
           .fontSize(14)
           .text(stars, 350, startY + 55);
        doc.fillColor(colors.lightText)
           .fontSize(11)
           .text(`(${data.reviews.totalReviews} reviews)`, 400, startY + 57);
      }
    } else {
      doc.fillColor(colors.primary)
         .fontSize(20)
         .text('Contact for Pricing', 70, startY + 35);
    }
  }

  private drawPackageFeatures(doc: typeof PDFDocument.prototype, data: PackagePDFData): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 310;

    doc.fillColor(colors.text)
       .fontSize(16)
       .text("What's Included", 50, startY);

    // Decorative dot
    doc.fillColor(colors.primary)
       .circle(195, startY + 8, 4)
       .fill();

    // Collect all features
    const features: string[] = [];
    if (data.features && data.features.length > 0) {
      data.features.forEach(f => {
        if (f.included) features.push(f.name);
      });
    }
    if (data.includedItems && data.includedItems.length > 0) {
      features.push(...data.includedItems);
    }

    if (features.length === 0) {
      doc.fillColor(colors.lightText)
         .fontSize(11)
         .text('Premium package with quality services', 50, startY + 35);
      return;
    }

    // Draw features as elegant list
    let yPos = startY + 35;
    features.forEach((feature, index) => {
      // Checkmark circle
      doc.fillColor(colors.primary)
         .circle(60, yPos + 6, 8)
         .fill();
      doc.fillColor('#FFFFFF')
         .fontSize(10)
         .text('✓', 56, yPos + 1, { width: 10, align: 'center' });

      // Feature text
      doc.fillColor(colors.text)
         .fontSize(12)
         .text(feature, 80, yPos);

      yPos += 28;
    });
  }

  private drawPackageExclusions(doc: typeof PDFDocument.prototype, exclusions: string[]): void {
    if (!exclusions || exclusions.length === 0) return;

    const { colors } = COMPANY_BRANDING;
    const startY = 450;

    doc.fillColor(colors.text)
       .fontSize(14)
       .text('Not Included', 50, startY);

    doc.strokeColor(colors.border)
       .lineWidth(0.5)
       .moveTo(50, startY + 20)
       .lineTo(545, startY + 20)
       .stroke();

    exclusions.slice(0, 4).forEach((exclusion, index) => {
      const yPos = startY + 35 + (index * 22);

      // X circle
      doc.fillColor('#EF4444')
         .circle(60, yPos + 6, 8)
         .fill();
      doc.fillColor('#FFFFFF')
         .fontSize(10)
         .text('✕', 56, yPos + 1, { width: 10, align: 'center' });

      doc.fillColor(colors.lightText)
         .fontSize(11)
         .text(exclusion, 80, yPos);
    });
  }

  private drawPackageAddOns(doc: typeof PDFDocument.prototype, addOns: PackageAddOn[], currency: string): void {
    if (!addOns || addOns.length === 0) return;

    const { colors } = COMPANY_BRANDING;
    const startY = 540;

    doc.fillColor(colors.text)
       .fontSize(14)
       .text('Available Add-Ons', 50, startY);

    doc.strokeColor(colors.border)
       .lineWidth(0.5)
       .moveTo(50, startY + 20)
       .lineTo(545, startY + 20)
       .stroke();

    addOns.slice(0, 4).forEach((addon, index) => {
      const yPos = startY + 35 + (index * 30);

      // Add-on box
      doc.fillColor(index % 2 === 0 ? '#FFFFFF' : colors.background)
         .roundedRect(50, yPos - 5, 495, 28, 6)
         .fill();

      // Plus icon
      doc.fillColor(colors.primary)
         .circle(65, yPos + 10, 8)
         .fill();
      doc.fillColor('#FFFFFF')
         .fontSize(12)
         .text('+', 61, yPos + 4, { width: 10, align: 'center' });

      doc.fillColor(colors.text)
         .fontSize(11)
         .text(addon.name, 85, yPos);

      doc.fillColor(colors.primary)
         .fontSize(12)
         .text(`+${this.formatCurrency(addon.price, currency)}`, 500, yPos, { align: 'right' });
    });
  }

  private drawPackageProvider(doc: typeof PDFDocument.prototype, provider: PackagePDFData['provider']): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 600;

    doc.fontSize(14).fillColor(colors.text)
       .text('Service Provider', 50, startY);

    doc.strokeColor(colors.border)
       .lineWidth(0.5)
       .moveTo(50, startY + 25)
       .lineTo(545, startY + 25)
       .stroke();

    // Provider info box
    doc.rect(50, startY + 30, 495, 50).fill(colors.background);

    // Provider name or default - use full name from providerName passed by controller
    const providerName = provider.name && provider.name.trim() ? provider.name.trim() : 'Service Provider';
    const initial = providerName.charAt(0).toUpperCase();

    // Provider initial circle
    doc.fillColor(colors.primary)
       .circle(75, startY + 55, 15)
       .fill();

    doc.fillColor('#FFFFFF').fontSize(12)
       .text(initial, 70, startY + 48, { width: 20, align: 'center' });

    // Provider name - show full name
    doc.fillColor(colors.text).fontSize(12)
       .text(providerName, 100, startY + 48);

    // Only show rating if we have meaningful data (less than 1000 reviews is realistic for a local service)
    const reviewsCount = provider.totalReviews || 0;
    // Sanity check: cap at 999 reviews and only show if rating is between 1-5
    const providerRating = provider.rating || 0;
    const validRating = providerRating >= 1 && providerRating <= 5;
    const reasonableReviews = reviewsCount > 0 && reviewsCount <= 999;

    if (validRating && reasonableReviews) {
      doc.fillColor(colors.lightText).fontSize(10)
         .text(`★ ${providerRating.toFixed(1)} (${reviewsCount} reviews)`, 100, startY + 62);
    } else if (validRating) {
      // Has rating but unreasonable review count - just show the rating
      doc.fillColor(colors.lightText).fontSize(10)
         .text(`★ ${providerRating.toFixed(1)}`, 100, startY + 62);
    } else {
      // No rating, show placeholder
      doc.fillColor(colors.lightText).fontSize(10)
         .text('Premium service provider', 100, startY + 62);
    }
  }

  private drawPackageTerms(doc: typeof PDFDocument.prototype, terms: string): void {
    const { colors } = COMPANY_BRANDING;
    const startY = 670;

    doc.fontSize(12).fillColor(colors.text)
       .text('Terms & Conditions', 50, startY);

    doc.fontSize(9).fillColor(colors.lightText)
       .text(terms.substring(0, 500), 50, startY + 15, { width: 495, lineGap: 2 });
  }

  private drawPackageFooter(doc: typeof PDFDocument.prototype, data: PackagePDFData): void {
    const { colors } = COMPANY_BRANDING;
    const footerY = 750;

    doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).stroke();

    // Printed date
    doc.fontSize(9).fillColor(colors.lightText)
       .text(`Document generated on ${new Date().toLocaleString('en-AE')}`, 50, footerY);

    // Source URL
    doc.text(`${COMPANY_BRANDING.website}/packages/${data.packageId}`, 400, footerY);

    // Disclaimer
    doc.fontSize(8).fillColor(colors.lightText)
       .text('This is a promotional document. Prices and availability are subject to change.', 50, footerY + 15);
  }
}

// ============================================
// Package PDF Types & Interface
// ============================================

export interface PackageFeature {
  name: string;
  included: boolean;
}

export interface PackageAddOn {
  name: string;
  price: number;
  description?: string;
}

export interface PackageDurationOption {
  duration: number;
  price: number;
  label: string;
}

export interface PackagePDFData {
  // Package basic info
  packageId: string;
  name: string;
  description: string;
  category: string;

  // Pricing
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
    savings?: number;
    savingsPercentage?: number;
  };

  // Duration
  duration: {
    totalMinutes: number;
    formatted: string;
  };

  // Provider info
  provider: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
    totalReviews?: number;
  };

  // Package content
  features?: PackageFeature[];
  includedItems?: string[];
  exclusions?: string[];
  addOns?: PackageAddOn[];
  durationOptions?: PackageDurationOption[];

  // Reviews summary
  reviews?: {
    averageRating: number;
    totalReviews: number;
  };

  // Terms
  terms?: string;

  // Print settings
  printedAt?: Date;
  printedBy?: string;
}

// ============================================
// Color Constants (Private to this module)
// ============================================
const COLORS = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  accent: '#10B981',
  text: '#1F2937',
  lightText: '#6B7280',
  background: '#F9FAFB',
  border: '#E5E7EB',
};

// Export singleton instance
export const pdfService = new PDFService();
export default pdfService;
