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
