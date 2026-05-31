/**
 * Bulk Upload Service - Handles CSV/Excel parsing and batch service import
 * Backend Service for Provider Dashboard
 */
import mongoose, { ClientSession } from 'mongoose';
import Service, { IService } from '../models/service.model';
import User from '../models/user.model';
import ServiceCategory from '../models/serviceCategory.model';
import { createAuditLog } from './auditLog.service';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServiceTemplateRow {
  name: string;
  category: string;
  description: string;
  basePrice: number;
  duration: number;
  type?: 'standard' | 'premium' | 'basic';
  isActive?: boolean;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface BulkUploadResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: ValidationError[];
  createdIds: string[];
  updatedIds: string[];
}

export interface BulkUploadOptions {
  providerId: string;
  updateExisting?: boolean;
  skipValidation?: boolean;
  session?: ClientSession;
}

// =============================================================================
// Validation Functions
// =============================================================================

const SERVICE_TYPES = ['standard', 'premium', 'basic'] as const;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MIN_PRICE = 0;
const MAX_PRICE = 100000;
const MIN_DURATION = 5;
const MAX_DURATION = 480; // 8 hours

export function validateServiceRow(
  row: ServiceTemplateRow,
  rowNumber: number,
  categories: Set<string>,
  existingServiceNames: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name validation
  if (!row.name || row.name.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'name',
      message: 'Service name is required',
      severity: 'error',
    });
  } else if (row.name.length > MAX_NAME_LENGTH) {
    errors.push({
      row: rowNumber,
      field: 'name',
      message: `Service name must be ${MAX_NAME_LENGTH} characters or less`,
      severity: 'error',
    });
  } else if (existingServiceNames.has(row.name.toLowerCase().trim())) {
    errors.push({
      row: rowNumber,
      field: 'name',
      message: `Service with name "${row.name}" already exists`,
      severity: 'warning',
    });
  }

  // Category validation
  if (!row.category || row.category.trim().length === 0) {
    errors.push({
      row: rowNumber,
      field: 'category',
      message: 'Category is required',
      severity: 'error',
    });
  } else if (!categories.has(row.category.toLowerCase().trim())) {
    errors.push({
      row: rowNumber,
      field: 'category',
      message: `Category "${row.category}" not found`,
      severity: 'error',
    });
  }

  // Description validation (optional but has max length)
  if (row.description && row.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      row: rowNumber,
      field: 'description',
      message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
      severity: 'error',
    });
  }

  // Price validation
  if (row.basePrice === undefined || row.basePrice === null) {
    errors.push({
      row: rowNumber,
      field: 'basePrice',
      message: 'Base price is required',
      severity: 'error',
    });
  } else if (typeof row.basePrice !== 'number' || isNaN(row.basePrice)) {
    errors.push({
      row: rowNumber,
      field: 'basePrice',
      message: 'Base price must be a valid number',
      severity: 'error',
    });
  } else if (row.basePrice < MIN_PRICE) {
    errors.push({
      row: rowNumber,
      field: 'basePrice',
      message: 'Base price cannot be negative',
      severity: 'error',
    });
  } else if (row.basePrice > MAX_PRICE) {
    errors.push({
      row: rowNumber,
      field: 'basePrice',
      message: `Base price cannot exceed ${MAX_PRICE}`,
      severity: 'warning',
    });
  }

  // Duration validation
  if (row.duration === undefined || row.duration === null) {
    errors.push({
      row: rowNumber,
      field: 'duration',
      message: 'Duration is required',
      severity: 'error',
    });
  } else if (typeof row.duration !== 'number' || isNaN(row.duration)) {
    errors.push({
      row: rowNumber,
      field: 'duration',
      message: 'Duration must be a valid number (in minutes)',
      severity: 'error',
    });
  } else if (row.duration < MIN_DURATION) {
    errors.push({
      row: rowNumber,
      field: 'duration',
      message: `Duration must be at least ${MIN_DURATION} minutes`,
      severity: 'error',
    });
  } else if (row.duration > MAX_DURATION) {
    errors.push({
      row: rowNumber,
      field: 'duration',
      message: `Duration cannot exceed ${MAX_DURATION} minutes (8 hours)`,
      severity: 'error',
    });
  }

  // Type validation (optional)
  if (row.type && !SERVICE_TYPES.includes(row.type)) {
    errors.push({
      row: rowNumber,
      field: 'type',
      message: `Invalid type "${row.type}". Use: ${SERVICE_TYPES.join(', ')}`,
      severity: 'error',
    });
  }

  return errors;
}

// =============================================================================
// CSV/Excel Parsing Functions
// =============================================================================

/**
 * Parse CSV content into service rows
 */
export function parseCSVContent(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

/**
 * Map CSV rows to ServiceTemplateRow objects
 */
export function mapRowsToServices(
  headers: string[],
  rows: string[][],
  rowOffset: number = 1
): Array<{ row: number; data: ServiceTemplateRow }> {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  const getValue = (row: string[], field: string): string | number | undefined => {
    const index = headerMap[field];
    if (index === undefined || index >= row.length) return undefined;
    const value = row[index];

    // Convert numeric fields
    if (field === 'baseprice' || field === 'price') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    if (field === 'duration') {
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    }

    return value || undefined;
  };

  return rows.map((row, i) => ({
    row: i + rowOffset,
    data: {
      name: (getValue(row, 'name') as string) || '',
      category: (getValue(row, 'category') as string) || '',
      description: (getValue(row, 'description') as string) || '',
      basePrice: (getValue(row, 'baseprice') as number) || (getValue(row, 'price') as number) || 0,
      duration: (getValue(row, 'duration') as number) || 30,
      type: (getValue(row, 'type') as ServiceTemplateRow['type']) || 'standard',
      isActive: getValue(row, 'isactive') !== 'false',
    },
  }));
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Bulk upload services from parsed data
 */
export async function bulkUploadServices(
  services: ServiceTemplateRow[],
  options: BulkUploadOptions
): Promise<BulkUploadResult> {
  const { providerId, updateExisting = false, session } = options;

  const result: BulkUploadResult = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [],
    createdIds: [],
    updatedIds: [],
  };

  // Get provider
  const provider = await User.findById(providerId).session(session || null);
  if (!provider || provider.role !== 'provider') {
    throw new Error('Provider not found');
  }

  // Get categories
  const categories = await ServiceCategory.find({}).session(session || null);
  const categorySet = new Set(categories.map((c: { name: string }) => c.name.toLowerCase()));

  // Get existing service names for this provider
  const existingServices = await Service.find({ providerId }).session(session || null);
  const existingServiceNames = new Set(
    existingServices.map((s: IService) => s.name.toLowerCase())
  );
  const existingServiceMap = new Map<string, IService>(
    existingServices.map((s: IService) => [s.name.toLowerCase(), s])
  );

  // Process each service
  for (const serviceData of services) {
    const rowNumber = services.indexOf(serviceData) + 2; // +2 for header row and 1-indexing

    // Validate
    const errors = validateServiceRow(
      serviceData,
      rowNumber,
      categorySet,
      existingServiceNames
    );

    const criticalErrors = errors.filter((e) => e.severity === 'error');
    if (criticalErrors.length > 0) {
      result.errors.push(...criticalErrors);
      result.failed++;
      continue;
    }

    // Add warnings to result
    result.errors.push(...errors.filter((e) => e.severity === 'warning'));

    try {
      const serviceName = serviceData.name.toLowerCase().trim();
      const existingService = existingServiceMap.get(serviceName);

      if (existingService) {
        // Update existing service
        if (updateExisting) {
          existingService.name = serviceData.name;
          existingService.description = serviceData.description;
          existingService.category = serviceData.category;
          existingService.price = {
            amount: serviceData.basePrice,
            currency: 'AED',
            type: 'fixed' as const,
          };
          existingService.duration = serviceData.duration;
          existingService.isActive = serviceData.isActive !== false;

          await existingService.save({ session });
          result.updatedIds.push(existingService._id.toString());
          result.imported++;
        } else {
          result.failed++;
        }
      } else {
        // Create new service
        const newService = new Service({
          providerId,
          name: serviceData.name,
          description: serviceData.description,
          category: serviceData.category,
          subcategory: '',
          price: {
            amount: serviceData.basePrice,
            currency: 'AED',
            type: 'fixed' as const,
          },
          duration: serviceData.duration,
          isActive: serviceData.isActive !== false,
          location: provider.address,
          serviceArea: undefined,
        });

        await newService.save({ session });
        result.createdIds.push(newService._id.toString());
        result.imported++;
      }
    } catch (error) {
      result.errors.push({
        row: rowNumber,
        field: 'database',
        message: error instanceof Error ? error.message : 'Database error',
        severity: 'error',
      });
      result.failed++;
    }
  }

  result.success = result.failed === 0;

  // Log the bulk upload
  await createAuditLog({
    userId: providerId,
    action: 'data_access_completed',
    resource: 'user_profile',
    resourceId: providerId,
    details: {
      totalRows: services.length,
      imported: result.imported,
      failed: result.failed,
      createdIds: result.createdIds.length,
      updatedIds: result.updatedIds.length,
    },
  });

  return result;
}

/**
 * Generate CSV template for service upload
 */
export function generateCSVTemplate(): string {
  const headers = ['name', 'category', 'description', 'basePrice', 'duration', 'type', 'isActive'];
  const sampleRows = [
    ['Classic Haircut', 'Hair Cutting', 'Standard haircut with wash and style', '150', '45', 'standard', 'true'],
    ['Full Color Treatment', 'Hair Coloring', 'Complete hair coloring service', '350', '90', 'premium', 'true'],
    ['Basic Manicure', 'Nail Care', 'Simple nail shaping and polish', '80', '30', 'basic', 'true'],
  ];

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [
    headers.join(','),
    ...sampleRows.map((row) => row.map(escapeCSV).join(',')),
  ];

  return lines.join('\n');
}

/**
 * Validate entire CSV content before processing
 */
export async function validateCSVContent(
  content: string,
  providerId: string
): Promise<{ valid: boolean; errors: ValidationError[]; rowCount: number }> {
  const errors: ValidationError[] = [];

  // Parse CSV
  const { headers, rows } = parseCSVContent(content);

  if (headers.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, field: 'file', message: 'Empty CSV file', severity: 'error' }],
      rowCount: 0,
    };
  }

  // Validate headers
  const requiredHeaders = ['name', 'category', 'baseprice', 'price', 'duration'];
  const missingHeaders = requiredHeaders.filter(
    (h) => !headers.includes(h) && (h !== 'baseprice' || !headers.includes('price'))
  );

  if (missingHeaders.length > 0) {
    errors.push({
      row: 1,
      field: 'headers',
      message: `Missing required headers: ${missingHeaders.filter((h) => h !== 'price').join(', ')}`,
      severity: 'error',
    });
  }

  if (rows.length === 0) {
    errors.push({
      row: 2,
      field: 'data',
      message: 'No data rows found',
      severity: 'error',
    });
  }

  // Get categories for validation
  const categories = await ServiceCategory.find({});
  const categorySet = new Set(categories.map((c: { name: string }) => c.name.toLowerCase()));

  // Get existing service names
  const existingServices = await Service.find({ providerId });
  const existingServiceNames = new Set(
    existingServices.map((s: IService) => s.name.toLowerCase())
  );

  // Validate each row
  const mappedServices = mapRowsToServices(headers, rows);
  for (const { row, data } of mappedServices) {
    const rowErrors = validateServiceRow(data, row, categorySet, existingServiceNames);
    errors.push(...rowErrors.filter((e) => e.severity === 'error'));
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    rowCount: rows.length,
  };
}

// =============================================================================
// Export
// =============================================================================

export const bulkUploadService = {
  validateServiceRow,
  parseCSVContent,
  mapRowsToServices,
  bulkUploadServices,
  generateCSVTemplate,
  validateCSVContent,
};

export default bulkUploadService;
