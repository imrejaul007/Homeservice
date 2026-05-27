import mongoose from 'mongoose';
import logger from '../utils/logger';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'wallet' | 'booking' | 'auth' | 'payment' | 'system' | 'realtime';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

const AlertSchema = new mongoose.Schema({
  type: { type: String, enum: ['wallet', 'booking', 'auth', 'payment', 'system', 'realtime'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: String,
  acknowledgedAt: Date,
  resolved: { type: Boolean, default: false },
  resolvedBy: String,
  resolvedAt: Date,
}, { timestamps: true });

export const AlertModel = mongoose.model('Alert', AlertSchema);

class AlertService {
  private toAlert(doc: mongoose.Document): Alert {
    const obj = doc.toObject();
    return {
      id: obj._id?.toString() || '',
      type: obj.type,
      severity: obj.severity,
      message: obj.message,
      metadata: obj.metadata,
      acknowledged: obj.acknowledged,
      acknowledgedBy: obj.acknowledgedBy,
      acknowledgedAt: obj.acknowledgedAt,
      resolved: obj.resolved,
      resolvedBy: obj.resolvedBy,
      resolvedAt: obj.resolvedAt,
      createdAt: obj.createdAt,
    };
  }

  async create(type: AlertType, severity: AlertSeverity, message: string, metadata?: Record<string, any>): Promise<Alert> {
    const alert = new AlertModel({ type, severity, message, metadata });
    await alert.save();
    logger.info('Alert created', {
      context: 'AlertService',
      action: 'ALERT_CREATED',
      type,
      severity,
      message,
      metadata,
    });
    return this.toAlert(alert);
  }

  async acknowledge(alertId: string, userId: string): Promise<void> {
    await AlertModel.findByIdAndUpdate(alertId, {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    });
  }

  async resolve(alertId: string, userId: string): Promise<void> {
    await AlertModel.findByIdAndUpdate(alertId, {
      resolved: true,
      resolvedBy: userId,
      resolvedAt: new Date(),
    });
  }

  async getActive(): Promise<Alert[]> {
    const docs = await AlertModel.find({ resolved: false }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toAlert(doc));
  }

  async getBySeverity(severity: AlertSeverity): Promise<Alert[]> {
    const docs = await AlertModel.find({ severity, resolved: false });
    return docs.map((doc) => this.toAlert(doc));
  }
}

export const alertService = new AlertService();

// Convenience functions
export const logWalletAlert = (message: string, metadata?: Record<string, any>) =>
  alertService.create('wallet', 'high', message, metadata);

export const logSystemAlert = (message: string, severity: AlertSeverity = 'medium') =>
  alertService.create('system', severity, message);

export const logPaymentAlert = (message: string, metadata?: Record<string, any>) =>
  alertService.create('payment', 'critical', message, metadata);

export default alertService;
