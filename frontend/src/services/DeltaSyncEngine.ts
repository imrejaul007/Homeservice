/**
 * DeltaSyncEngine
 *
 * Advanced delta synchronization engine for NILIN mobile app.
 * Tracks field-level changes, computes diffs between local and server state,
 * and only syncs changed fields to minimize bandwidth and improve performance.
 *
 * Package: com.nilin.app
 * NILIN brand color: #E8B4A8
 */

import { offlineStorage } from './OfflineStorage';

// =============================================================================
// Types
// =============================================================================

export interface EntityChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface DeltaRecord {
  entityType: string;
  entityId: string;
  changes: EntityChange[];
  version: number;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  baseVersion?: number;
}

export interface FieldMetadata {
  field: string;
  type: 'primitive' | 'object' | 'array' | 'date' | 'nested';
  comparable: boolean;
  ignoreFields?: string[];
}

export interface DeltaSyncOptions {
  maxChangesPerEntity?: number;
  storagePrefix?: string;
  enableCompression?: boolean;
  fieldMetadata?: Record<string, FieldMetadata[]>;
}

export interface SyncDelta {
  entityType: string;
  entityId: string;
  changes: EntityChange[];
  version: number;
  timestamp: number;
}

export interface ApplyDeltaResult {
  success: boolean;
  mergedData?: Record<string, unknown>;
  conflicts?: EntityChange[];
  error?: string;
}

export interface SyncResult {
  timestamp: number;
  itemsChanged: number;
  bytesSaved: number;
}

// Force delta sync enabled (battery optimization)
const enableDeltaSync = true;

/**
 * Log sync efficiency metrics
 */
function logSyncEfficiency(result: SyncResult): void {
  console.log(`[DeltaSync] Sync completed: ${result.itemsChanged} items, ~${result.bytesSaved} bytes saved`);
}

// =============================================================================
// Deep Diff Utilities
// =============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  return dateRegex.test(value);
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (isDateString(a) && isDateString(b)) {
    return new Date(a as string).getTime() === new Date(b as string).getTime();
  }
  if (isObject(a) && isObject(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (isArray(a) && isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function getFieldValue(obj: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setFieldValue(obj: Record<string, unknown>, fieldPath: string, value: unknown): void {
  const parts = fieldPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || !isObject(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = '',
  result: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[fieldPath] = null;
    } else if (isObject(value) && !isDateString(value)) {
      flattenObject(value, fieldPath, result);
    } else {
      result[fieldPath] = value;
    }
  }
  return result;
}

function unflattenObject(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [fieldPath, value] of Object.entries(flat)) {
    setFieldValue(result, fieldPath, value);
  }

  return result;
}

// =============================================================================
// DeltaSyncEngine Class
// =============================================================================

class DeltaSyncEngine {
  private static instance: DeltaSyncEngine;
  private deltas: Map<string, DeltaRecord> = new Map();
  private localState: Map<string, Record<string, unknown>> = new Map();
  private serverState: Map<string, Record<string, unknown>> = new Map();
  private options: Required<DeltaSyncOptions>;
  private listeners: Set<(delta: DeltaRecord) => void> = new Set();
  private readonly STORAGE_KEY: string;
  // FIX #8: Add max size limit for delta tracking
  private readonly MAX_DELTA_SIZE = 1000;

  private constructor(options: DeltaSyncOptions = {}) {
    this.options = {
      maxChangesPerEntity: options.maxChangesPerEntity ?? 50,
      storagePrefix: options.storagePrefix ?? 'nilin_delta',
      enableCompression: options.enableCompression ?? true,
      fieldMetadata: options.fieldMetadata ?? {},
    };
    this.STORAGE_KEY = `${this.options.storagePrefix}_deltas`;
    this.loadFromStorage();
  }

  // FIX #8: Enforce max size limit and cleanup oldest entries
  private enforceMaxSize(): void {
    if (this.deltas.size > this.MAX_DELTA_SIZE) {
      // Sort by timestamp (oldest first) and remove oldest entries
      const sortedEntries = Array.from(this.deltas.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);

      const entriesToRemove = this.deltas.size - this.MAX_DELTA_SIZE;
      for (let i = 0; i < entriesToRemove; i++) {
        const [key] = sortedEntries[i];
        this.deltas.delete(key);
        // Also cleanup local and server state for this entity
        const delta = sortedEntries[i][1];
        const entityKey = `${delta.entityType}:${delta.entityId}`;
        this.localState.delete(entityKey);
        this.serverState.delete(entityKey);
      }

      console.log(`[DeltaSync] Enforced max size limit: removed ${entriesToRemove} oldest entries`);
      this.saveToStorage();
    }
  }

  static getInstance(options?: DeltaSyncOptions): DeltaSyncEngine {
    if (!DeltaSyncEngine.instance) {
      DeltaSyncEngine.instance = new DeltaSyncEngine(options);
    }
    return DeltaSyncEngine.instance;
  }

  // ==========================================================================
  // Core Delta Operations
  // ==========================================================================

  /**
   * Generate a unique key for entity tracking
   */
  private getEntityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  /**
   * Track changes for an entity
   * Compares new values against local state and records deltas
   */
  trackChanges(
    entityType: string,
    entityId: string,
    newState: Record<string, unknown>,
    forceTrackAll: boolean = false
  ): EntityChange[] {
    const key = this.getEntityKey(entityType, entityId);
    const existingDelta = this.deltas.get(key);

    // Update local state
    this.localState.set(key, { ...newState });

    // Get current state (server state if exists, otherwise local)
    const currentState = this.serverState.get(key) || this.localState.get(key) || {};
    const currentFlat = flattenObject(currentState as Record<string, unknown>);
    const newFlat = flattenObject(newState);

    const changes: EntityChange[] = [];
    const allFields = new Set([...Object.keys(currentFlat), ...Object.keys(newFlat)]);

    for (const field of allFields) {
      const oldValue = currentFlat[field];
      const newValue = newFlat[field];

      if (!areValuesEqual(oldValue, newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
          timestamp: Date.now(),
        });
      }
    }

    // If no changes, return early
    if (changes.length === 0) {
      return [];
    }

    // Get or create delta record
    let delta = existingDelta || {
      entityType,
      entityId,
      changes: [],
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Merge changes based on strategy
    if (forceTrackAll || !existingDelta) {
      delta.changes = changes;
    } else {
      // Update existing changes for same fields, append new ones
      const existingChangesMap = new Map(delta.changes.map(c => [c.field, c]));
      for (const change of changes) {
        existingChangesMap.set(change.field, change);
      }
      delta.changes = Array.from(existingChangesMap.values());

      // Trim to max changes
      if (delta.changes.length > this.options.maxChangesPerEntity) {
        delta.changes = delta.changes.slice(-this.options.maxChangesPerEntity);
      }
    }

    delta.version++;
    delta.updatedAt = Date.now();

    this.deltas.set(key, delta);

    // FIX #8: Enforce max size limit after adding new delta
    this.enforceMaxSize();

    this.saveToStorage();
    this.notifyListeners(delta);

    console.log(`[DeltaSync] Tracked ${changes.length} changes for ${entityType}:${entityId}`);
    return changes;
  }

  /**
   * Get all pending deltas for an entity
   */
  getDelta(entityType: string, entityId: string): DeltaRecord | null {
    const key = this.getEntityKey(entityType, entityId);
    return this.deltas.get(key) || null;
  }

  /**
   * Get all pending deltas for an entity type
   */
  getDeltasForType(entityType: string): DeltaRecord[] {
    const result: DeltaRecord[] = [];
    for (const delta of this.deltas.values()) {
      if (delta.entityType === entityType) {
        result.push(delta);
      }
    }
    return result;
  }

  /**
   * Get all pending deltas
   */
  getAllDeltas(): DeltaRecord[] {
    return Array.from(this.deltas.values());
  }

  /**
   * Get sync-ready delta payload for transmission
   */
  getSyncDelta(entityType: string, entityId: string): SyncDelta | null {
    const delta = this.getDelta(entityType, entityId);
    if (!delta || delta.changes.length === 0) {
      return null;
    }

    return {
      entityType: delta.entityType,
      entityId: delta.entityId,
      changes: delta.changes,
      version: delta.version,
      timestamp: delta.updatedAt,
    };
  }

  /**
   * Apply a delta from the server
   */
  applyDelta(
    entityType: string,
    entityId: string,
    serverState: Record<string, unknown>,
    baseVersion?: number
  ): ApplyDeltaResult {
    const key = this.getEntityKey(entityType, entityId);

    try {
      // Update server state
      this.serverState.set(key, { ...serverState });

      // Get local delta
      const localDelta = this.deltas.get(key);

      if (!localDelta || localDelta.changes.length === 0) {
        // No local changes, just accept server state
        return {
          success: true,
          mergedData: serverState,
        };
      }

      // Check for conflicts if base version provided
      if (baseVersion !== undefined && localDelta.version > baseVersion) {
        // Potential conflict - server was based on older version
        const conflicts = this.detectConflicts(localDelta.changes, serverState);
        if (conflicts.length > 0) {
          return {
            success: false,
            conflicts,
            error: 'Conflicts detected between local and server changes',
          };
        }
      }

      // Apply local changes to server state (merge)
      const mergedData = this.mergeChanges(serverState, localDelta.changes);

      // Clear local delta since it's now synced
      this.deltas.delete(key);
      localDelta.syncedAt = Date.now();
      this.deltas.set(key, localDelta);

      this.saveToStorage();

      return {
        success: true,
        mergedData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Apply changes from server response with conflict resolution
   */
  applyServerChanges(
    entityType: string,
    entityId: string,
    serverState: Record<string, unknown>,
    resolution: 'server_wins' | 'client_wins' | 'merge'
  ): ApplyDeltaResult {
    const key = this.getEntityKey(entityType, entityId);
    const localDelta = this.deltas.get(key);

    switch (resolution) {
      case 'server_wins':
        // Clear local changes, accept server state
        this.deltas.delete(key);
        this.serverState.set(key, serverState);
        this.saveToStorage();
        return { success: true, mergedData: serverState };

      case 'client_wins':
        // Keep local changes, server will need to apply them
        this.serverState.set(key, serverState);
        return {
          success: true,
          mergedData: this.getLocalState(entityType, entityId) || serverState,
        };

      case 'merge':
        // Merge both changes
        return this.applyDelta(entityType, entityId, serverState);
    }
  }

  /**
   * Clear changes for an entity
   */
  clearChanges(entityType: string, entityId: string): void {
    const key = this.getEntityKey(entityType, entityId);
    this.deltas.delete(key);
    this.saveToStorage();
    console.log(`[DeltaSync] Cleared changes for ${entityType}:${entityId}`);
  }

  /**
   * Clear all tracked changes
   */
  clearAllChanges(): void {
    this.deltas.clear();
    this.saveToStorage();
    console.log('[DeltaSync] Cleared all tracked changes');
  }

  /**
   * Get local state for an entity
   */
  getLocalState(entityType: string, entityId: string): Record<string, unknown> | null {
    const key = this.getEntityKey(entityType, entityId);
    return this.localState.get(key) || null;
  }

  /**
   * Get server state for an entity
   */
  getServerState(entityType: string, entityId: string): Record<string, unknown> | null {
    const key = this.getEntityKey(entityType, entityId);
    return this.serverState.get(key) || null;
  }

  /**
   * Initialize local state for an entity
   */
  initializeEntity(
    entityType: string,
    entityId: string,
    state: Record<string, unknown>,
    isServerState: boolean = true
  ): void {
    const key = this.getEntityKey(entityType, entityId);
    if (isServerState) {
      this.serverState.set(key, { ...state });
    } else {
      this.localState.set(key, { ...state });
    }
  }

  // ==========================================================================
  // Conflict Detection
  // ==========================================================================

  /**
   * Detect conflicts between local changes and server state
   */
  private detectConflicts(
    localChanges: EntityChange[],
    serverState: Record<string, unknown>
  ): EntityChange[] {
    const conflicts: EntityChange[] = [];
    const serverFlat = flattenObject(serverState);

    for (const change of localChanges) {
      const serverValue = serverFlat[change.field];

      // If server has changed the same field to a different value than our old value,
      // there's a conflict
      if (!areValuesEqual(serverValue, change.oldValue)) {
        conflicts.push({
          ...change,
          oldValue: serverValue, // What server has now
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if there are conflicts without returning details
   */
  hasConflicts(entityType: string, entityId: string, serverState: Record<string, unknown>): boolean {
    const delta = this.getDelta(entityType, entityId);
    if (!delta) return false;
    return this.detectConflicts(delta.changes, serverState).length > 0;
  }

  // ==========================================================================
  // Change Merging
  // ==========================================================================

  /**
   * Merge local changes into a base state
   */
  private mergeChanges(
    baseState: Record<string, unknown>,
    changes: EntityChange[]
  ): Record<string, unknown> {
    const merged = { ...baseState };
    const mergedFlat = flattenObject(merged);

    for (const change of changes) {
      mergedFlat[change.field] = change.newValue;
    }

    return unflattenObject(mergedFlat);
  }

  /**
   * Merge two states non-destructively (for three-way merge)
   */
  mergeStates(
    base: Record<string, unknown>,
    local: Record<string, unknown>,
    remote: Record<string, unknown>
  ): { merged: Record<string, unknown>; conflicts: string[] } {
    const baseFlat = flattenObject(base);
    const localFlat = flattenObject(local);
    const remoteFlat = flattenObject(remote);
    const mergedFlat: Record<string, unknown> = {};
    const conflicts: string[] = [];

    const allFields = new Set([
      ...Object.keys(baseFlat),
      ...Object.keys(localFlat),
      ...Object.keys(remoteFlat),
    ]);

    for (const field of allFields) {
      const baseValue = baseFlat[field];
      const localValue = localFlat[field];
      const remoteValue = remoteFlat[field];

      if (areValuesEqual(localValue, remoteValue)) {
        // Both made same change or no change
        mergedFlat[field] = localValue;
      } else if (areValuesEqual(localValue, baseValue)) {
        // Only remote changed
        mergedFlat[field] = remoteValue;
      } else if (areValuesEqual(remoteValue, baseValue)) {
        // Only local changed
        mergedFlat[field] = localValue;
      } else {
        // Both changed differently - conflict
        mergedFlat[field] = remoteValue; // Default to remote, manual resolution needed
        conflicts.push(field);
      }
    }

    return {
      merged: unflattenObject(mergedFlat),
      conflicts,
    };
  }

  // ==========================================================================
  // Subscription
  // ==========================================================================

  /**
   * Subscribe to delta changes
   */
  subscribe(callback: (delta: DeltaRecord) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(delta: DeltaRecord): void {
    this.listeners.forEach(cb => {
      try {
        cb(delta);
      } catch (error) {
        console.error('[DeltaSync] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  private async saveToStorage(): Promise<void> {
    try {
      const data = Array.from(this.deltas.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DeltaSync] Failed to save to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: [string, DeltaRecord][] = JSON.parse(stored);
        this.deltas = new Map(data);

        // Clean up old deltas (older than 7 days)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const [key, delta] of this.deltas.entries()) {
          if (delta.updatedAt < sevenDaysAgo) {
            this.deltas.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('[DeltaSync] Failed to load from storage:', error);
      this.deltas = new Map();
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get statistics about tracked changes
   */
  getStats(): {
    totalEntities: number;
    totalChanges: number;
    changesByType: Record<string, number>;
  } {
    const changesByType: Record<string, number> = {};
    let totalChanges = 0;

    for (const delta of this.deltas.values()) {
      totalChanges += delta.changes.length;
      changesByType[delta.entityType] = (changesByType[delta.entityType] || 0) + delta.changes.length;
    }

    return {
      totalEntities: this.deltas.size,
      totalChanges,
      changesByType,
    };
  }

  /**
   * Calculate and log sync efficiency
   * Returns SyncResult with bytes saved from delta sync
   */
  calculateSyncEfficiency(fullPayloadSize: number): SyncResult {
    const stats = this.getStats();
    const estimatedBytesSaved = fullPayloadSize - (stats.totalChanges * 50); // ~50 bytes per change

    const result: SyncResult = {
      timestamp: Date.now(),
      itemsChanged: stats.totalChanges,
      bytesSaved: Math.max(0, estimatedBytesSaved),
    };

    logSyncEfficiency(result);
    return result;
  }

  /**
   * Force cleanup of old deltas
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    for (const [key, delta] of this.deltas.entries()) {
      if (delta.updatedAt < cutoff) {
        this.deltas.delete(key);
      }
    }
    this.saveToStorage();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const deltaSyncEngine = DeltaSyncEngine.getInstance();

export default deltaSyncEngine;
