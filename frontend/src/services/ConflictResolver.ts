/**
 * ConflictResolver
 *
 * Multi-device conflict handling service for NILIN mobile app.
 * Provides conflict detection, automatic resolution strategies, and manual resolution queue.
 *
 * Package: com.nilin.app
 * NILIN brand color: #E8B4A8
 */

// =============================================================================
// Types
// =============================================================================

export type ResolutionStrategy = 'server_wins' | 'client_wins' | 'merge' | 'manual';
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface VersionVector {
  [deviceId: string]: number;
}

export interface ConflictField {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  baseValue?: unknown;
  timestamp: number;
}

export interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  conflictType: 'timestamp' | 'version_vector' | 'field_level';
  fields: ConflictField[];
  localVersion: number;
  serverVersion: number;
  localTimestamp: number;
  serverTimestamp: number;
  severity: ConflictSeverity;
  detectedAt: number;
  resolvedAt?: number;
  resolution?: ResolutionStrategy;
  resolvedData?: Record<string, unknown>;
  requiresManualResolution: boolean;
  autoResolved?: boolean;
  resolutionDetails?: string;
}

export interface ConflictDetectionOptions {
  timestampThreshold?: number; // ms difference to consider conflict
  fieldLevelConflictEnabled?: boolean;
  versionVectorEnabled?: boolean;
}

export interface AutoResolutionResult {
  success: boolean;
  strategy: ResolutionStrategy;
  mergedData?: Record<string, unknown>;
  resolutionDetails: string;
  conflictFields: string[];
}

export interface ManualResolutionRequest {
  conflictId: string;
  entityType: string;
  entityId: string;
  fields: ConflictField[];
  suggestedResolutions: {
    server_wins: Record<string, unknown>;
    client_wins: Record<string, unknown>;
    merge: Record<string, unknown>;
  };
  timestamp: number;
}

export interface ConflictStats {
  totalConflicts: number;
  pendingResolution: number;
  autoResolved: number;
  manualResolved: number;
  byEntityType: Record<string, number>;
  bySeverity: Record<ConflictSeverity, number>;
}

// =============================================================================
// Utility Functions
// =============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  // Start with server values
  for (const [key, serverValue] of Object.entries(server)) {
    const localValue = local[key];
    const baseValue = base[key];

    if (isObject(serverValue) && isObject(localValue) && isObject(baseValue)) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, localValue as Record<string, unknown>, serverValue as Record<string, unknown>);
    } else if (JSON.stringify(localValue) === JSON.stringify(baseValue)) {
      // Local hasn't changed, use server
      result[key] = serverValue;
    } else if (JSON.stringify(serverValue) === JSON.stringify(baseValue)) {
      // Server hasn't changed, use local
      result[key] = localValue;
    } else {
      // Both changed - server wins by default in merge
      result[key] = serverValue;
    }
  }

  // Add local-only keys
  for (const [key, localValue] of Object.entries(local)) {
    if (!(key in server)) {
      result[key] = localValue;
    }
  }

  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  const last = parts.pop();
  if (!last) return;

  let current: Record<string, unknown> = obj;
  for (const part of parts) {
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[last] = value;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = ''
): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isObject(value)) {
      result.push(...flattenObject(value, path));
    } else {
      result.push({ path, value });
    }
  }

  return result;
}

// =============================================================================
// ConflictResolver Class
// =============================================================================

class ConflictResolverService {
  private static instance: ConflictResolverService;
  private conflicts: Map<string, Conflict> = new Map();
  private manualResolutionQueue: ManualResolutionRequest[] = [];
  private listeners: Set<(conflict: Conflict) => void> = new Set();
  private options: Required<ConflictDetectionOptions>;
  private readonly STORAGE_KEY = 'nilin_conflicts';
  private readonly MANUAL_QUEUE_KEY = 'nilin_manual_resolution_queue';

  private constructor(options: ConflictDetectionOptions = {}) {
    this.options = {
      timestampThreshold: options.timestampThreshold ?? 5000, // 5 seconds
      fieldLevelConflictEnabled: options.fieldLevelConflictEnabled ?? true,
      versionVectorEnabled: options.versionVectorEnabled ?? true,
    };
    this.loadFromStorage();
  }

  static getInstance(options?: ConflictDetectionOptions): ConflictResolverService {
    if (!ConflictResolverService.instance) {
      ConflictResolverService.instance = new ConflictResolverService(options);
    }
    return ConflictResolverService.instance;
  }

  // ==========================================================================
  // Conflict Detection
  // ==========================================================================

  /**
   * Detect conflicts between local and server data
   */
  detectConflict(
    entityType: string,
    entityId: string,
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    localMetadata?: {
      version?: number;
      timestamp?: number;
      versionVector?: VersionVector;
    },
    serverMetadata?: {
      version?: number;
      timestamp?: number;
      versionVector?: VersionVector;
    }
  ): Conflict | null {
    const localTimestamp = localMetadata?.timestamp || Date.now();
    const serverTimestamp = serverMetadata?.timestamp || Date.now();
    const localVersion = localMetadata?.version || 0;
    const serverVersion = serverMetadata?.version || 0;

    const conflictFields: ConflictField[] = [];

    // Detect timestamp-based conflicts
    const timestampDiff = Math.abs(localTimestamp - serverTimestamp);

    if (timestampDiff > this.options.timestampThreshold) {
      // Significant time difference - potential conflict
      const localFlat = flattenObject(localData);
      const serverFlat = flattenObject(serverData);

      const allFields = new Set([
        ...localFlat.map(f => f.path),
        ...serverFlat.map(f => f.path),
      ]);

      // Find conflicting fields
      for (const path of allFields) {
        const localValue = localFlat.find(f => f.path === path)?.value;
        const serverValue = serverFlat.find(f => f.path === path)?.value;

        if (localValue !== undefined && serverValue !== undefined && JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
          conflictFields.push({
            field: path,
            localValue,
            serverValue,
            timestamp: Math.max(localTimestamp, serverTimestamp),
          });
        }
      }
    }

    // Detect version vector conflicts if enabled
    if (this.options.versionVectorEnabled && localMetadata?.versionVector && serverMetadata?.versionVector) {
      const vvConflict = this.detectVersionVectorConflict(
        localMetadata.versionVector,
        serverMetadata.versionVector
      );
      if (vvConflict) {
        conflictFields.push(...vvConflict);
      }
    }

    // If no conflicts detected, return null
    if (conflictFields.length === 0) {
      return null;
    }

    // Determine severity
    const severity = this.calculateSeverity(conflictFields);

    // Determine if manual resolution is required
    const requiresManual = this.requiresManualResolution(conflictFields);

    const conflict: Conflict = {
      id: this.generateConflictId(),
      entityType,
      entityId,
      conflictType: conflictFields.length > 0 ? 'field_level' : 'timestamp',
      fields: conflictFields,
      localVersion,
      serverVersion,
      localTimestamp,
      serverTimestamp,
      severity,
      detectedAt: Date.now(),
      requiresManualResolution: requiresManual,
    };

    this.conflicts.set(conflict.id, conflict);
    this.saveToStorage();
    this.notifyListeners(conflict);

    console.log(`[ConflictResolver] Conflict detected for ${entityType}:${entityId}`, {
      severity,
      fieldCount: conflictFields.length,
      requiresManual,
    });

    return conflict;
  }

  /**
   * Detect version vector conflicts
   */
  private detectVersionVectorConflict(
    localVV: VersionVector,
    serverVV: VersionVector
  ): ConflictField[] | null {
    const conflicts: ConflictField[] = [];
    const allDevices = new Set([...Object.keys(localVV), ...Object.keys(serverVV)]);

    for (const deviceId of allDevices) {
      const localVersion = localVV[deviceId] || 0;
      const serverVersion = serverVV[deviceId] || 0;

      if (localVersion !== serverVersion) {
        conflicts.push({
          field: `_version_vector.${deviceId}`,
          localValue: localVersion,
          serverValue: serverVersion,
          timestamp: Date.now(),
        });
      }
    }

    return conflicts.length > 0 ? conflicts : null;
  }

  /**
   * Calculate conflict severity based on affected fields
   */
  private calculateSeverity(fields: ConflictField[]): ConflictSeverity {
    // Critical fields that always require manual resolution
    const criticalFields = ['payment', 'transaction', 'amount', 'password', 'pin'];
    const highFields = ['booking.status', 'booking.time', 'address', 'phone', 'email'];
    const mediumFields = ['name', 'preferences', 'settings'];

    for (const field of fields) {
      const fieldName = field.field.toLowerCase();

      if (criticalFields.some(cf => fieldName.includes(cf))) {
        return 'critical';
      }
    }

    for (const field of fields) {
      const fieldName = field.field.toLowerCase();

      if (highFields.some(hf => fieldName.includes(hf))) {
        return 'high';
      }
    }

    for (const field of fields) {
      const fieldName = field.field.toLowerCase();

      if (mediumFields.some(mf => fieldName.includes(mf))) {
        return 'medium';
      }
    }

    return 'low';
  }

  /**
   * Determine if conflict requires manual resolution
   */
  private requiresManualResolution(fields: ConflictField[]): boolean {
    const manualFields = ['payment', 'transaction', 'amount', 'price', 'booking.status'];

    // Critical severity always requires manual
    if (fields.length > 3) {
      return true;
    }

    return fields.some(field =>
      manualFields.some(mf => field.field.toLowerCase().includes(mf))
    );
  }

  /**
   * Check if there's an existing conflict for an entity
   */
  hasConflict(entityType: string, entityId: string): boolean {
    for (const conflict of this.conflicts.values()) {
      if (conflict.entityType === entityType && conflict.entityId === entityId && !conflict.resolvedAt) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get conflict for an entity
   */
  getConflict(entityType: string, entityId: string): Conflict | null {
    for (const conflict of this.conflicts.values()) {
      if (conflict.entityType === entityType && conflict.entityId === entityId && !conflict.resolvedAt) {
        return conflict;
      }
    }
    return null;
  }

  // ==========================================================================
  // Automatic Resolution
  // ==========================================================================

  /**
   * Attempt automatic conflict resolution
   */
  autoResolve(conflict: Conflict): AutoResolutionResult {
    if (conflict.requiresManualResolution) {
      return {
        success: false,
        strategy: 'manual',
        resolutionDetails: 'Conflict requires manual resolution due to critical fields',
        conflictFields: conflict.fields.map(f => f.field),
      };
    }

    // Determine best strategy based on severity
    let strategy: ResolutionStrategy;

    switch (conflict.severity) {
      case 'critical':
        // Critical conflicts need manual resolution
        return {
          success: false,
          strategy: 'manual',
          resolutionDetails: 'Critical severity conflicts require manual resolution',
          conflictFields: conflict.fields.map(f => f.field),
        };

      case 'high':
        // High severity - prefer server wins for safety
        strategy = 'server_wins';
        break;

      case 'medium':
        // Medium severity - try merge first
        strategy = 'merge';
        break;

      case 'low':
        // Low severity - prefer client wins for better UX
        strategy = 'client_wins';
        break;

      default:
        strategy = 'merge';
    }

    return this.executeResolution(conflict, strategy);
  }

  /**
   * Execute a specific resolution strategy
   */
  executeResolution(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): AutoResolutionResult {
    const { fields } = conflict;

    switch (strategy) {
      case 'server_wins':
        return this.executeServerWins(conflict);

      case 'client_wins':
        return this.executeClientWins(conflict);

      case 'merge':
        return this.executeMerge(conflict);

      case 'manual':
        return {
          success: false,
          strategy: 'manual',
          resolutionDetails: 'Manual resolution required',
          conflictFields: fields.map(f => f.field),
        };
    }
  }

  /**
   * Execute server wins strategy
   */
  private executeServerWins(conflict: Conflict): AutoResolutionResult {
    const mergedData: Record<string, unknown> = {};

    for (const field of conflict.fields) {
      setNestedValue(mergedData, field.field, field.serverValue);
    }

    this.markResolved(conflict.id, 'server_wins', mergedData);

    return {
      success: true,
      strategy: 'server_wins',
      mergedData,
      resolutionDetails: `Resolved ${conflict.fields.length} conflicts using server values`,
      conflictFields: conflict.fields.map(f => f.field),
    };
  }

  /**
   * Execute client wins strategy
   */
  private executeClientWins(conflict: Conflict): AutoResolutionResult {
    const mergedData: Record<string, unknown> = {};

    for (const field of conflict.fields) {
      setNestedValue(mergedData, field.field, field.localValue);
    }

    this.markResolved(conflict.id, 'client_wins', mergedData);

    return {
      success: true,
      strategy: 'client_wins',
      mergedData,
      resolutionDetails: `Resolved ${conflict.fields.length} conflicts using client values`,
      conflictFields: conflict.fields.map(f => f.field),
    };
  }

  /**
   * Execute merge strategy (non-conflicting fields merged automatically)
   */
  private executeMerge(conflict: Conflict): AutoResolutionResult {
    const mergedData: Record<string, unknown> = {};
    const conflictFields: string[] = [];

    // For merge, we take server values for conflicting fields
    // but this could be enhanced with field-specific rules
    for (const field of conflict.fields) {
      // Default to server value for conflicts
      setNestedValue(mergedData, field.field, field.serverValue);
      conflictFields.push(field.field);
    }

    this.markResolved(conflict.id, 'merge', mergedData);

    return {
      success: true,
      strategy: 'merge',
      mergedData,
      resolutionDetails: `Merged ${conflict.fields.length} conflicting fields (server values taken)`,
      conflictFields,
    };
  }

  /**
   * Mark a conflict as resolved
   */
  private markResolved(
    conflictId: string,
    strategy: ResolutionStrategy,
    resolvedData?: Record<string, unknown>
  ): void {
    const conflict = this.conflicts.get(conflictId);
    if (conflict) {
      conflict.resolvedAt = Date.now();
      conflict.resolution = strategy;
      conflict.resolvedData = resolvedData;
      conflict.autoResolved = strategy !== 'manual';

      this.conflicts.set(conflictId, conflict);
      this.saveToStorage();

      console.log(`[ConflictResolver] Conflict ${conflictId} resolved with ${strategy}`);
    }
  }

  // ==========================================================================
  // Manual Resolution Queue
  // ==========================================================================

  /**
   * Queue a conflict for manual resolution
   */
  queueForManualResolution(conflict: Conflict): ManualResolutionRequest {
    const request: ManualResolutionRequest = {
      conflictId: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      fields: conflict.fields,
      suggestedResolutions: {
        server_wins: this.buildResolvedData(conflict, 'server_wins'),
        client_wins: this.buildResolvedData(conflict, 'client_wins'),
        merge: this.buildResolvedData(conflict, 'merge'),
      },
      timestamp: Date.now(),
    };

    this.manualResolutionQueue.push(request);
    this.saveManualQueue();

    // Mark conflict as requiring manual resolution
    conflict.requiresManualResolution = true;
    this.conflicts.set(conflict.id, conflict);
    this.saveToStorage();

    console.log(`[ConflictResolver] Queued conflict ${conflict.id} for manual resolution`);
    return request;
  }

  /**
   * Build resolved data based on strategy
   */
  private buildResolvedData(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const field of conflict.fields) {
      let value: unknown;

      switch (strategy) {
        case 'server_wins':
          value = field.serverValue;
          break;
        case 'client_wins':
          value = field.localValue;
          break;
        case 'merge':
          // Default to server value in merge
          value = field.serverValue;
          break;
        default:
          value = field.serverValue;
      }

      setNestedValue(data, field.field, value);
    }

    return data;
  }

  /**
   * Get all conflicts pending manual resolution
   */
  getManualResolutionQueue(): ManualResolutionRequest[] {
    return [...this.manualResolutionQueue];
  }

  /**
   * Get count of conflicts pending manual resolution
   */
  getManualResolutionCount(): number {
    return this.manualResolutionQueue.length;
  }

  /**
   * Resolve a conflict manually
   */
  resolveManually(
    conflictId: string,
    resolution: 'server_wins' | 'client_wins' | 'merge' | Record<string, unknown>
  ): AutoResolutionResult {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return {
        success: false,
        strategy: 'manual',
        resolutionDetails: 'Conflict not found',
        conflictFields: [],
      };
    }

    let resolvedData: Record<string, unknown>;
    let strategy: ResolutionStrategy;

    if (typeof resolution === 'string') {
      strategy = resolution;
      resolvedData = this.buildResolvedData(conflict, resolution);
    } else {
      // Custom resolution with field-specific values
      strategy = 'manual';
      resolvedData = resolution;
    }

    this.markResolved(conflictId, strategy, resolvedData);

    // Remove from manual queue
    this.manualResolutionQueue = this.manualResolutionQueue.filter(
      r => r.conflictId !== conflictId
    );
    this.saveManualQueue();

    return {
      success: true,
      strategy,
      mergedData: resolvedData,
      resolutionDetails: `Manually resolved conflict with ${strategy}`,
      conflictFields: conflict.fields.map(f => f.field),
    };
  }

  /**
   * Dismiss a conflict without resolving (user chose to ignore)
   */
  dismissConflict(conflictId: string): void {
    const conflict = this.conflicts.get(conflictId);
    if (conflict) {
      conflict.resolvedAt = Date.now();
      conflict.resolution = 'server_wins'; // Default
      conflict.autoResolved = false;
      conflict.resolutionDetails = 'Dismissed by user';

      this.conflicts.set(conflictId, conflict);
      this.saveToStorage();

      // Remove from manual queue
      this.manualResolutionQueue = this.manualResolutionQueue.filter(
        r => r.conflictId !== conflictId
      );
      this.saveManualQueue();
    }
  }

  // ==========================================================================
  // Getters and Queries
  // ==========================================================================

  /**
   * Get all unresolved conflicts
   */
  getUnresolvedConflicts(): Conflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolvedAt);
  }

  /**
   * Get conflict history (resolved conflicts)
   */
  getConflictHistory(limit: number = 50): Conflict[] {
    return Array.from(this.conflicts.values())
      .filter(c => c.resolvedAt)
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0))
      .slice(0, limit);
  }

  /**
   * Get conflict statistics
   */
  getStats(): ConflictStats {
    const allConflicts = Array.from(this.conflicts.values());
    const resolved = allConflicts.filter(c => c.resolvedAt);
    const autoResolved = resolved.filter(c => c.autoResolved);

    const byEntityType: Record<string, number> = {};
    const bySeverity: Record<ConflictSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const conflict of allConflicts) {
      byEntityType[conflict.entityType] = (byEntityType[conflict.entityType] || 0) + 1;
      bySeverity[conflict.severity]++;
    }

    return {
      totalConflicts: allConflicts.length,
      pendingResolution: allConflicts.filter(c => !c.resolvedAt).length,
      autoResolved: autoResolved.length,
      manualResolved: resolved.length - autoResolved.length,
      byEntityType,
      bySeverity,
    };
  }

  /**
   * Clear resolved conflicts older than specified time
   */
  clearResolvedConflicts(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    for (const [id, conflict] of this.conflicts.entries()) {
      if (conflict.resolvedAt && conflict.resolvedAt < cutoff) {
        this.conflicts.delete(id);
      }
    }
    this.saveToStorage();
  }

  // FIX #9: Clear all resolved conflicts from queue
  /**
   * Clear all resolved conflicts from memory and storage
   * This prevents the conflict queue from growing indefinitely
   */
  clearResolvedConflictsAll(): void {
    const resolvedCount = Array.from(this.conflicts.values()).filter(c => c.resolvedAt).length;
    for (const [id, conflict] of this.conflicts.entries()) {
      if (conflict.resolvedAt) {
        this.conflicts.delete(id);
      }
    }
    this.saveToStorage();
    console.log(`[ConflictResolver] Cleared ${resolvedCount} resolved conflicts`);
  }

  // FIX #9: Clear conflicts by entity
  /**
   * Clear all conflicts for a specific entity
   */
  clearConflictsByEntity(entityType: string, entityId: string): void {
    let cleared = 0;
    for (const [id, conflict] of this.conflicts.entries()) {
      if (conflict.entityType === entityType && conflict.entityId === entityId) {
        this.conflicts.delete(id);
        cleared++;
      }
    }
    if (cleared > 0) {
      this.saveToStorage();
      console.log(`[ConflictResolver] Cleared ${cleared} conflicts for ${entityType}:${entityId}`);
    }
  }

  // ==========================================================================
  // Subscription
  // ==========================================================================

  /**
   * Subscribe to new conflicts
   */
  subscribe(callback: (conflict: Conflict) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(conflict: Conflict): void {
    this.listeners.forEach(cb => {
      try {
        cb(conflict);
      } catch (error) {
        console.error('[ConflictResolver] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  private async saveToStorage(): Promise<void> {
    try {
      const data = Array.from(this.conflicts.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[ConflictResolver] Failed to save conflicts:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: [string, Conflict][] = JSON.parse(stored);
        this.conflicts = new Map(data);
      }
    } catch (error) {
      console.error('[ConflictResolver] Failed to load conflicts:', error);
      this.conflicts = new Map();
    }
  }

  private saveManualQueue(): void {
    try {
      localStorage.setItem(this.MANUAL_QUEUE_KEY, JSON.stringify(this.manualResolutionQueue));
    } catch (error) {
      console.error('[ConflictResolver] Failed to save manual queue:', error);
    }
  }

  private loadManualQueue(): void {
    try {
      const stored = localStorage.getItem(this.MANUAL_QUEUE_KEY);
      if (stored) {
        this.manualResolutionQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ConflictResolver] Failed to load manual queue:', error);
      this.manualResolutionQueue = [];
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const conflictResolver = ConflictResolverService.getInstance();

export default conflictResolver;
