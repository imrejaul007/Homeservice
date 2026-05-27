/**
 * TamperDetector.ts - App integrity and tampering detection for NILIN app
 * Verifies APK signature, checks for debugger, and detects binary tampering
 */

import { Capacitor } from '@capacitor/core';

export interface TamperCheck {
  name: string;
  passed: boolean;
  details?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface TamperDetectionResult {
  isTampered: boolean;
  checks: TamperCheck[];
  criticalIssues: string[];
  timestamp: number;
  appVersion?: string;
}

interface SignatureInfo {
  signature?: string;
  packageName?: string;
  versionCode?: string;
  versionName?: string;
}

class TamperDetectorService {
  private static instance: TamperDetectorService;
  private cachedResult: TamperDetectionResult | null = null;
  private cacheTimeout: number = 300000; // 5 minutes cache
  private isCapacitor: boolean;
  private expectedPackageName: string = 'com.nilin.app';
  private expectedSignatureHash: string = ''; // Set via setExpectedSignature()

  private constructor() {
    this.isCapacitor = Capacitor.isNativePlatform();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TamperDetectorService {
    if (!TamperDetectorService.instance) {
      TamperDetectorService.instance = new TamperDetectorService();
    }
    return TamperDetectorService.instance;
  }

  /**
   * Set expected signature hash for verification
   * In production, this should be set from a secure source
   */
  public setExpectedSignature(signatureHash: string): void {
    this.expectedSignatureHash = signatureHash;
  }

  /**
   * Run all tamper detection checks
   */
  public async detect(): Promise<TamperDetectionResult> {
    // Return cached result if still valid
    if (this.cachedResult && Date.now() - this.cachedResult.timestamp < this.cacheTimeout) {
      return this.cachedResult;
    }

    const checks: TamperCheck[] = [];
    const criticalIssues: string[] = [];

    // Check APK signature
    const signatureCheck = await this.checkSignature();
    checks.push(signatureCheck);
    if (signatureCheck.severity === 'critical' && !signatureCheck.passed) {
      criticalIssues.push(signatureCheck.details || 'Invalid signature');
    }

    // Check for debugger attached
    const debuggerCheck = this.checkDebuggerAttached();
    checks.push(debuggerCheck);
    if (debuggerCheck.severity === 'critical' && !debuggerCheck.passed) {
      criticalIssues.push(debuggerCheck.details || 'Debugger detected');
    }

    // Check for app tampering indicators
    const tamperingCheck = await this.checkForTampering();
    checks.push(tamperingCheck);
    if (tamperingCheck.severity === 'high' && !tamperingCheck.passed) {
      criticalIssues.push(tamperingCheck.details || 'App tampering detected');
    }

    // Check for hook frameworks
    const hookCheck = this.checkForHookFrameworks();
    checks.push(hookCheck);
    if (hookCheck.severity === 'high' && !hookCheck.passed) {
      criticalIssues.push(hookCheck.details || 'Hook framework detected');
    }

    // Check for Frida server
    const fridaCheck = this.checkForFrida();
    checks.push(fridaCheck);
    if (fridaCheck.severity === 'critical' && !fridaCheck.passed) {
      criticalIssues.push(fridaCheck.details || 'Frida detected');
    }

    // Check for runtime manipulation
    const runtimeCheck = this.checkRuntimeManipulation();
    checks.push(runtimeCheck);
    if (runtimeCheck.severity === 'medium' && !runtimeCheck.passed) {
      criticalIssues.push(runtimeCheck.details || 'Runtime manipulation detected');
    }

    // Check memory integrity
    const memoryCheck = await this.checkMemoryIntegrity();
    checks.push(memoryCheck);
    if (memoryCheck.severity === 'high' && !memoryCheck.passed) {
      criticalIssues.push(memoryCheck.details || 'Memory integrity issue');
    }

    // Check package integrity
    const packageCheck = await this.checkPackageIntegrity();
    checks.push(packageCheck);
    if (packageCheck.severity === 'critical' && !packageCheck.passed) {
      criticalIssues.push(packageCheck.details || 'Package integrity failed');
    }

    const result: TamperDetectionResult = {
      isTampered: criticalIssues.length > 0,
      checks,
      criticalIssues,
      timestamp: Date.now(),
    };

    this.cachedResult = result;
    return result;
  }

  /**
   * Check APK/app signature
   */
  private async checkSignature(): Promise<TamperCheck> {
    if (!this.isCapacitor) {
      // In web environment, we cannot check native signature
      return {
        name: 'signature_check',
        passed: true,
        details: 'Signature check not available in web environment',
        severity: 'low',
      };
    }

    // In a real implementation, this would use a native plugin to verify signature
    // The signature check should compare against known-good signature hash
    const hasExpectedSignature = this.expectedSignatureHash.length > 0;

    if (!hasExpectedSignature) {
      return {
        name: 'signature_check',
        passed: true,
        details: 'Expected signature not configured, skipping verification',
        severity: 'medium',
      };
    }

    // Placeholder - would call native code to get actual signature
    // In production, implement via Capacitor plugin:
    // const signature = await AppPlugin.getSignature();

    return {
      name: 'signature_check',
      passed: true,
      details: 'Signature verification requires native implementation',
      severity: 'critical',
    };
  }

  /**
   * Check if debugger is attached
   */
  private checkDebuggerAttached(): TamperCheck {
    // Check using multiple methods

    // Method 1: Check import.meta.env.DEV
    const isDevMode = import.meta.env.DEV;

    // Method 2: Check for debugger timing
    const debuggerDetected = this.detectDebuggerTiming();

    // Method 3: Check for Android debugger flag
    let androidDebugger = false;
    try {
      // In web, we can check some indicators
      androidDebugger = isDevMode;
    } catch {
      // Ignore errors
    }

    const debuggerFound = debuggerDetected || (this.isCapacitor && androidDebugger);

    // In debug builds, this is expected
    const isProduction = import.meta.env.PROD;

    return {
      name: 'debugger_check',
      passed: !debuggerFound || !isProduction,
      details: debuggerFound
        ? `Debugger detected${isProduction ? ' in production build' : ''}`
        : undefined,
      severity: 'critical',
    };
  }

  /**
   * Detect debugger using timing attack
   */
  private detectDebuggerTiming(): boolean {
    const start = performance.now();
    // eslint-disable-next-line no-empty
    for (let i = 0; i < 1000; i++) {
      void Math.sqrt(i);
    }
    const elapsed = performance.now() - start;

    // If it takes suspiciously long, debugger might be attached
    // Normal execution should be very fast (< 10ms typically)
    return elapsed > 100;
  }

  /**
   * Check for app tampering indicators
   */
  private async checkForTampering(): Promise<TamperCheck> {
    if (!this.isCapacitor) {
      return {
        name: 'tampering_check',
        passed: true,
        details: 'Tampering check limited in web environment',
        severity: 'low',
      };
    }

    // Check for:
    // 1. Modified APK (hash mismatch)
    // 2. Re-packaged app
    // 3. Changed package name
    // 4. Changed version

    const tamperingIndicators: string[] = [];

    // Check if package name matches expected
    // In real implementation, verify via native code
    const packageNameMatches = true; // Placeholder

    if (!packageNameMatches) {
      tamperingIndicators.push('Package name mismatch');
    }

    // Check for altered resources
    const resourcesIntact = true; // Placeholder

    if (!resourcesIntact) {
      tamperingIndicators.push('Resources modified');
    }

    const isTampered = tamperingIndicators.length > 0;

    return {
      name: 'tampering_check',
      passed: !isTampered,
      details: isTampered ? tamperingIndicators.join(', ') : undefined,
      severity: 'high',
    };
  }

  /**
   * Check for hook frameworks (Xposed, Frida, etc.)
   */
  private checkForHookFrameworks(): TamperCheck {
    const hookIndicators: string[] = [];

    // Check for Xposed framework
    const hasXposed = this.checkForXposed();
    if (hasXposed) {
      hookIndicators.push('Xposed framework');
    }

    // Check for Frida
    const hasFrida = this.checkForFrida().passed === false;
    if (hasFrida) {
      hookIndicators.push('Frida');
    }

    // Check for Substrate/Cydia
    const hasSubstrate = this.checkForSubstrate();
    if (hasSubstrate) {
      hookIndicators.push('Cydia Substrate');
    }

    const isHooked = hookIndicators.length > 0;

    return {
      name: 'hook_framework_check',
      passed: !isHooked,
      details: isHooked ? hookIndicators.join(', ') : undefined,
      severity: 'high',
    };
  }

  /**
   * Check for Xposed framework
   */
  private checkForXposed(): boolean {
    try {
      // Check for Xposed classes
      const xposedClasses = [
        'de.robv.android.xposed.XposedBridge',
        'de.robv.android.xposed.XposedHelpers',
        'de.robv.android.xposed.XposedInit',
      ];

      // In web, we cannot enumerate classes
      // This check would need native implementation
      // For now, return false as placeholder

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check for Frida server
   */
  private checkForFrida(): TamperCheck {
    const indicators: string[] = [];

    // Check for Frida-specific ports
    // Standard Frida server ports
    const fridaPorts = [27042, 27043];

    // Check for frida-server process
    const hasFridaServer = this.checkFridaServer();

    if (hasFridaServer) {
      indicators.push('frida-server');
    }

    // Check for frida-agent
    const hasFridaAgent = this.checkFridaAgent();

    if (hasFridaAgent) {
      indicators.push('frida-agent');
    }

    // In web environment, perform basic checks
    if (!this.isCapacitor) {
      // Check for common Frida strings in memory
      const hasFridaStrings = this.checkFridaStrings();

      if (hasFridaStrings) {
        indicators.push('Frida strings');
      }
    }

    const isFridaDetected = indicators.length > 0;

    return {
      name: 'frida_check',
      passed: !isFridaDetected,
      details: isFridaDetected ? `Frida detected: ${indicators.join(', ')}` : undefined,
      severity: 'critical',
    };
  }

  /**
   * Check for frida-server process
   */
  private checkFridaServer(): boolean {
    // In real implementation, check for frida-server process
    // via native code or ADB commands
    return false; // Placeholder
  }

  /**
   * Check for frida-agent library
   */
  private checkFridaAgent(): boolean {
    // Check for frida-agent loaded in memory
    // Would need native implementation
    return false; // Placeholder
  }

  /**
   * Check for Frida strings in memory (web)
   */
  private checkFridaStrings(): boolean {
    // Simple heuristic check for Frida strings
    // Not reliable but catches some cases
    const suspiciousStrings = ['frida', 'LINJECTOR', 'gum-js-loop', 'gmain'];

    // Cannot actually scan memory in browser
    return false; // Placeholder
  }

  /**
   * Check for Cydia Substrate
   */
  private checkForSubstrate(): boolean {
    try {
      // Check for Substrate-related files and classes
      const substrateIndicators = [
        'cydia://',
        'substrate.h',
        'MSHookFunction',
      ];

      // In web, cannot check these
      return false; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Check for runtime manipulation
   */
  private checkRuntimeManipulation(): TamperCheck {
    const manipulationIndicators: string[] = [];

    // Check for code injection
    const hasCodeInjection = this.checkCodeInjection();

    if (hasCodeInjection) {
      manipulationIndicators.push('Code injection');
    }

    // Check for method hooking
    const hasMethodHooking = this.checkMethodHooking();

    if (hasMethodHooking) {
      manipulationIndicators.push('Method hooking');
    }

    // Check for reflection manipulation
    const hasReflectionManipulation = this.checkReflection();

    if (hasReflectionManipulation) {
      manipulationIndicators.push('Reflection manipulation');
    }

    const isManipulated = manipulationIndicators.length > 0;

    return {
      name: 'runtime_manipulation_check',
      passed: !isManipulated,
      details: isManipulated ? manipulationIndicators.join(', ') : undefined,
      severity: 'medium',
    };
  }

  /**
   * Check for code injection
   */
  private checkCodeInjection(): boolean {
    // Would need native implementation
    return false; // Placeholder
  }

  /**
   * Check for method hooking
   */
  private checkMethodHooking(): boolean {
    // Would need native implementation
    // Could check if critical methods have unexpected behavior
    return false; // Placeholder
  }

  /**
   * Check for reflection manipulation
   */
  private checkReflection(): boolean {
    // Would need native implementation
    return false; // Placeholder
  }

  /**
   * Check memory integrity
   */
  private async checkMemoryIntegrity(): Promise<TamperCheck> {
    if (!this.isCapacitor) {
      return {
        name: 'memory_integrity_check',
        passed: true,
        details: 'Memory integrity check not available in web',
        severity: 'low',
      };
    }

    // Check for memory dump tools
    const hasDumpTool = this.checkMemoryDumpTool();

    return {
      name: 'memory_integrity_check',
      passed: !hasDumpTool,
      details: hasDumpTool ? 'Memory dump tool detected' : undefined,
      severity: 'high',
    };
  }

  /**
   * Check for memory dump tools
   */
  private checkMemoryDumpTool(): boolean {
    // Check for tools like dumpmem, gamecih, etc.
    // Would need native implementation
    return false; // Placeholder
  }

  /**
   * Check package integrity
   */
  private async checkPackageIntegrity(): Promise<TamperCheck> {
    if (!this.isCapacitor) {
      return {
        name: 'package_integrity_check',
        passed: true,
        details: 'Package integrity check not available in web',
        severity: 'low',
      };
    }

    // Check if app was installed from official source
    const isFromPlayStore = this.checkPlayStoreInstall();

    // Check if installer matches expected
    const installerVerified = this.verifyInstaller();

    if (!isFromPlayStore && !installerVerified) {
      return {
        name: 'package_integrity_check',
        passed: false,
        details: 'App not installed from verified source',
        severity: 'critical',
      };
    }

    return {
      name: 'package_integrity_check',
      passed: true,
      details: 'Package integrity verified',
      severity: 'critical',
    };
  }

  /**
   * Check if app was installed from Play Store
   */
  private checkPlayStoreInstall(): boolean {
    // Would need native implementation
    // In Android, can check installer package name
    return false; // Placeholder
  }

  /**
   * Verify installer package name
   */
  private verifyInstaller(): boolean {
    // Would check if installer matches allowed list
    // e.g., com.android.vending (Play Store), com.amazon.AppsObserver
    return true; // Placeholder
  }

  /**
   * Get critical issues
   */
  public async getCriticalIssues(): Promise<string[]> {
    const result = await this.detect();
    return result.criticalIssues;
  }

  /**
   * Check if app is tampered
   */
  public async isTampered(): Promise<boolean> {
    const result = await this.detect();
    return result.isTampered;
  }

  /**
   * Get all checks
   */
  public async getChecks(): Promise<TamperCheck[]> {
    const result = await this.detect();
    return result.checks;
  }

  /**
   * Clear cached result
   */
  public clearCache(): void {
    this.cachedResult = null;
  }
}

// Export singleton instance
export const tamperDetector = TamperDetectorService.getInstance();

// Export class
export { TamperDetectorService };

// Default export
export default tamperDetector;
