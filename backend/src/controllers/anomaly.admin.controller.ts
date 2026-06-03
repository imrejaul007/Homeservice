import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { anomalyDetectionService, AnomalyType, AnomalySeverity, AnomalyStatus, EntityType } from '../services/anomalyDetection.service';

/**
 * Get All Anomalies (Paginated with Filters)
 * GET /api/admin/anomalies
 */
export const getAllAnomalies = asyncHandler(async (req: Request, res: Response) => {
  const {
    type,
    severity,
    status,
    entityType,
    entityId,
    startDate,
    endDate,
    page = '1',
    limit = '20',
  } = req.query;

  const filters: any = {};

  if (type) filters.type = type as AnomalyType;
  if (severity) filters.severity = severity as AnomalySeverity;
  if (status) filters.status = status as AnomalyStatus;
  if (entityType) filters.entityType = entityType as EntityType;
  if (entityId) filters.entityId = entityId as string;

  if (startDate || endDate) {
    filters.startDate = startDate ? new Date(startDate as string) : undefined;
    filters.endDate = endDate ? new Date(endDate as string) : undefined;
  }

  filters.page = parseInt(page as string, 10);
  filters.limit = Math.min(parseInt(limit as string, 10), 100);

  const result = await anomalyDetectionService.getAnomalies(filters);

  return res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

/**
 * Get Anomaly by ID
 * GET /api/admin/anomalies/:id
 */
export const getAnomalyById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Anomaly ID is required');
  }

  const anomaly = await anomalyDetectionService.getAnomalyById(id);

  if (!anomaly) {
    throw new ApiError(404, 'Anomaly not found');
  }

  return res.json({
    success: true,
    data: anomaly,
  });
});

/**
 * Get Anomaly Statistics
 * GET /api/admin/anomalies/stats
 */
export const getAnomalyStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await anomalyDetectionService.getAnomalyStats();

  return res.json({
    success: true,
    data: stats,
  });
});

/**
 * Get Severity Chart Data
 * GET /api/admin/anomalies/chart/severity
 */
export const getSeverityChartData = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();

  // Get anomalies grouped by date and severity
  const anomalies = await anomalyDetectionService.getAnomalies({
    startDate: start,
    endDate: end,
    limit: 10000,
  });

  // Group by date and severity
  const chartData: Record<string, { date: string; critical: number; high: number; medium: number; low: number }> = {};

  for (const anomaly of anomalies.data) {
    const date = new Date(anomaly.detectedAt).toISOString().split('T')[0];

    if (!chartData[date]) {
      chartData[date] = { date, critical: 0, high: 0, medium: 0, low: 0 };
    }

    chartData[date][anomaly.severity]++;
  }

  // Convert to array and sort by date
  const result = Object.values(chartData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // Last 30 days

  return res.json({
    success: true,
    data: result,
  });
});

/**
 * Get Type Chart Data
 * GET /api/admin/anomalies/chart/type
 */
export const getTypeChartData = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const filters: any = {};

  if (startDate || endDate) {
    filters.startDate = startDate ? new Date(startDate as string) : undefined;
    filters.endDate = endDate ? new Date(endDate as string) : undefined;
  }

  const result = await anomalyDetectionService.getAnomalies({ ...filters, limit: 10000 });

  // Count by type
  const typeCounts: Record<string, number> = {
    fraud: 0,
    booking: 0,
    payment: 0,
    behavior: 0,
  };

  for (const anomaly of result.data) {
    typeCounts[anomaly.type]++;
  }

  const chartData = Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
  }));

  return res.json({
    success: true,
    data: chartData,
  });
});

/**
 * Update Anomaly Status
 * PATCH /api/admin/anomalies/:id/status
 */
export const updateAnomalyStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resolution } = req.body;

  if (!id) {
    throw new ApiError(400, 'Anomaly ID is required');
  }

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const validStatuses: AnomalyStatus[] = ['pending', 'investigating', 'resolved', 'false_positive'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Get admin ID from request (set by auth middleware)
  const adminId = (req as any).user?.id || 'system';

  const anomaly = await anomalyDetectionService.updateAnomalyStatus(id, status, adminId, resolution);

  if (!anomaly) {
    throw new ApiError(404, 'Anomaly not found');
  }

  return res.json({
    success: true,
    data: anomaly,
    message: `Anomaly status updated to ${status}`,
  });
});

/**
 * Bulk Update Anomaly Statuses
 * POST /api/admin/anomalies/bulk-update
 */
export const bulkUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { anomalyIds, status, resolution } = req.body;

  if (!anomalyIds || !Array.isArray(anomalyIds) || anomalyIds.length === 0) {
    throw new ApiError(400, 'anomalyIds array is required');
  }

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const validStatuses: AnomalyStatus[] = ['pending', 'investigating', 'resolved', 'false_positive'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Get admin ID from request
  const adminId = (req as any).user?.id || 'system';

  let updated = 0;
  const errors: string[] = [];

  for (const anomalyId of anomalyIds) {
    try {
      const result = await anomalyDetectionService.updateAnomalyStatus(anomalyId, status, adminId, resolution);
      if (result) updated++;
    } catch (error) {
      errors.push(`Failed to update ${anomalyId}: ${(error as Error).message}`);
    }
  }

  return res.json({
    success: true,
    data: {
      updated,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    message: `Updated ${updated} anomalies`,
  });
});

/**
 * Run Detection for Entity
 * POST /api/admin/anomalies/detect
 */
export const runDetection = asyncHandler(async (req: Request, res: Response) => {
  const { entityId, entityType } = req.body;

  if (!entityId) {
    throw new ApiError(400, 'entityId is required');
  }

  if (!entityType) {
    throw new ApiError(400, 'entityType is required');
  }

  const validEntityTypes: EntityType[] = ['user', 'provider', 'booking', 'payment'];
  if (!validEntityTypes.includes(entityType)) {
    throw new ApiError(400, `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
  }

  const anomalies = await anomalyDetectionService.runFullDetectionForEntity(entityId, entityType);
  const score = await anomalyDetectionService.calculateBehavioralScore(entityId, entityType);

  return res.json({
    success: true,
    data: {
      anomalies,
      score,
    },
    message: `Detection complete. Found ${anomalies.length} anomalies.`,
  });
});

/**
 * Get Recent Anomalies
 * GET /api/admin/anomalies/recent
 */
export const getRecentAnomalies = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '10' } = req.query;

  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const result = await anomalyDetectionService.getAnomalies({
    limit: limitNum,
  });

  return res.json({
    success: true,
    data: result.data,
  });
});

/**
 * Get High Risk Entities
 * GET /api/admin/anomalies/high-risk
 */
export const getHighRiskEntities = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20' } = req.query;

  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  // Get all anomalies and extract unique high-risk entities
  const result = await anomalyDetectionService.getAnomalies({
    severity: 'high',
    status: 'pending',
    limit: 1000,
  });

  // Group by entity and calculate risk score
  const entityScores: Record<string, { entityId: string; entityType: EntityType; score: number; anomalyCount: number }> = {};

  for (const anomaly of result.data) {
    if (!entityScores[anomaly.entityId]) {
      entityScores[anomaly.entityId] = {
        entityId: anomaly.entityId,
        entityType: anomaly.entityType,
        score: 0,
        anomalyCount: 0,
      };
    }
    entityScores[anomaly.entityId].anomalyCount++;

    // Calculate score based on severity
    const severityScore = { critical: 40, high: 25, medium: 10, low: 5 };
    entityScores[anomaly.entityId].score += severityScore[anomaly.severity] || 0;
  }

  // Sort by score and limit
  const highRiskEntities = Object.values(entityScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limitNum);

  return res.json({
    success: true,
    data: highRiskEntities,
  });
});

/**
 * Get Behavioral Score for Entity
 * GET /api/admin/anomalies/score/:entityType/:entityId
 */
export const getBehavioralScore = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;

  if (!entityType || !entityId) {
    throw new ApiError(400, 'entityType and entityId are required');
  }

  const validEntityTypes: EntityType[] = ['user', 'provider', 'booking', 'payment'];
  if (!validEntityTypes.includes(entityType as EntityType)) {
    throw new ApiError(400, `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
  }

  const score = await anomalyDetectionService.calculateBehavioralScore(entityId, entityType as EntityType);

  return res.json({
    success: true,
    data: score,
  });
});

/**
 * Export Anomalies (CSV)
 * GET /api/admin/anomalies/export
 */
export const exportAnomalies = asyncHandler(async (req: Request, res: Response) => {
  const {
    type,
    severity,
    status,
    entityType,
    startDate,
    endDate,
  } = req.query;

  const filters: any = {};

  if (type) filters.type = type as AnomalyType;
  if (severity) filters.severity = severity as AnomalySeverity;
  if (status) filters.status = status as AnomalyStatus;
  if (entityType) filters.entityType = entityType as EntityType;

  if (startDate || endDate) {
    filters.startDate = startDate ? new Date(startDate as string) : undefined;
    filters.endDate = endDate ? new Date(endDate as string) : undefined;
  }

  const result = await anomalyDetectionService.getAnomalies({ ...filters, limit: 10000 });

  // Generate CSV
  const headers = ['ID', 'Type', 'Severity', 'Entity Type', 'Entity ID', 'Description', 'Confidence', 'Status', 'Detected At', 'Resolved At', 'Resolution'];
  const rows = result.data.map(a => [
    a.id,
    a.type,
    a.severity,
    a.entityType,
    a.entityId,
    `"${a.description.replace(/"/g, '""')}"`,
    (a.confidence * 100).toFixed(1) + '%',
    a.status,
    new Date(a.detectedAt).toISOString(),
    a.resolvedAt ? new Date(a.resolvedAt).toISOString() : '',
    a.resolution ? `"${a.resolution.replace(/"/g, '""')}"` : '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=anomalies-export-${new Date().toISOString().split('T')[0]}.csv`);

  return res.send(csv);
});

/**
 * Generate Anomaly Report
 * POST /api/admin/anomalies/report
 */
export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, format = 'csv' } = req.body;

  if (!startDate || !endDate) {
    throw new ApiError(400, 'startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const filters = {
    startDate: start,
    endDate: end,
    limit: 10000,
  };

  const [anomaliesResult, stats] = await Promise.all([
    anomalyDetectionService.getAnomalies(filters),
    anomalyDetectionService.getAnomalyStats(),
  ]);

  // Generate report based on format
  if (format === 'csv') {
    // Generate CSV
    const headers = ['Date', 'Type', 'Severity', 'Status', 'Description'];
    const rows = anomaliesResult.data.map(a => [
      new Date(a.detectedAt).toLocaleDateString(),
      a.type,
      a.severity,
      a.status,
      `"${a.description.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=anomaly-report-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`);

    return res.send(csv);
  }

  // JSON format (default)
  return res.json({
    success: true,
    data: {
      report: {
        generatedAt: new Date().toISOString(),
        period: { start: startDate, end: endDate },
        stats,
        anomalies: anomaliesResult.data,
      },
    },
  });
});

/**
 * Get Related Tickets for Anomaly
 * GET /api/admin/anomalies/:id/tickets
 */
export const getRelatedTickets = asyncHandler(async (_req: Request, res: Response) => {
  // Placeholder - support ticket integration would go here
  // For now, return empty array
  return res.json({
    success: true,
    data: [],
    message: 'Support ticket integration not yet implemented',
  });
});

/**
 * Create Ticket for Anomaly Investigation
 * POST /api/admin/anomalies/:id/ticket
 */
export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!id) {
    throw new ApiError(400, 'Anomaly ID is required');
  }

  if (!message) {
    throw new ApiError(400, 'Message is required');
  }

  // Placeholder - support ticket integration would go here
  // For now, return a placeholder ticket
  const ticketId = `ANOMALY-${id.substring(0, 8)}-${Date.now()}`;

  return res.status(201).json({
    success: true,
    data: {
      ticketId,
      anomalyId: id,
      message: 'Support ticket integration not yet fully implemented',
    },
    message: 'Ticket creation placeholder - integration pending',
  });
});
