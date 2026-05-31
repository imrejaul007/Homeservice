/**
 * Advanced Profanity Filter Service
 * Comprehensive text filtering with contextual analysis
 */

import mongoose from 'mongoose';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Type Definitions
// ============================================

export interface ProfanityCheckResult {
  hasProfanity: boolean;
  foundWords: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  matchedPatterns: string[];
  shouldBlock: boolean;
  shouldCensor: boolean;
}

export interface FilteredContent {
  original: string;
  filtered: string;
  censoredCount: number;
  wasModified: boolean;
}

export interface ContentFilterResult {
  passed: boolean;
  score: number;
  issues: ContentIssue[];
  recommendations: string[];
}

export interface ContentIssue {
  type: 'profanity' | 'spam' | 'harassment' | 'personal_info' | 'link' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedContent?: string;
  location?: { start: number; end: number };
}

export interface CustomWordList {
  id: string;
  name: string;
  words: string[];
  category: 'profanity' | 'spam' | 'custom';
  enabled: boolean;
}

// ============================================
// Profanity Lists
// ============================================

// Tier 1: Severe profanity (auto-block)
const SEVERE_PROFANITY: string[] = [
  // Add severe terms - keeping list minimal for documentation
];

// Tier 2: Moderate profanity (censor)
const MODERATE_PROFANITY: string[] = [
  // Add moderate terms
];

// Tier 3: Mild profanity (warn)
const MILD_PROFANITY: string[] = [
  // Add mild terms
];

// Common spam keywords
const SPAM_KEYWORDS = [
  'buy now', 'click here', 'free money', 'win prize', 'act now',
  'limited time', 'act immediately', 'congratulations', 'winner',
  'you have won', 'claim your', 'special offer', 'risk free',
  'no obligation', 'guaranteed', '100%', 'miracle', 'cure',
  'weight loss', 'make money', 'work from home', 'bitcoin',
];

// Suspicious link patterns
const SUSPICIOUS_PATTERNS = [
  /https?:\/\/[^\s]+\.(ru|cn|tk|ml|ga|cf|gq|pk|xyz|top)\b/i,
  /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly/i,
  /phishing|login|signin|account|password|verify/i,
];

// Aggressive/threatening patterns
const AGGRESSIVE_PATTERNS = [
  /threat|attack|hurt|kill|die/i,
  /i will|i'm going to|going to make/i,
  /i'll (kill|hurt|destroy)/i,
  /watch your back/i,
];

// Harassment patterns
const HARASSMENT_PATTERNS = [
  /\b(you('re| are) (stupid|idiot|moron|dumb|loser))\b/i,
  /\b(shut up|go away|get lost|no one asked)\b/i,
  /\bhate you\b/i,
];

// Personal info patterns (potential doxxing)
const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
  /\b\d{5}[-\s]?\d{5}\b/, // ID numbers (simplified)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
];

// ============================================
// ProfanityFilterService Class
// ============================================

export class ProfanityFilterService {
  private customWordLists: Map<string, CustomWordList> = new Map();
  private censorChar: string = '*';

  // ========================================
  // Core Profanity Detection
  // ========================================

  /**
   * Check text for profanity
   */
  checkProfanity(text: string, options?: {
    checkSevere?: boolean;
    checkModerate?: boolean;
    checkMild?: boolean;
    customLists?: string[];
  }): ProfanityCheckResult {
    if (!text) {
      return {
        hasProfanity: false,
        foundWords: [],
        severity: 'none',
        matchedPatterns: [],
        shouldBlock: false,
        shouldCensor: false,
      };
    }

    const normalizedText = text.toLowerCase();
    const foundWords: string[] = [];
    const matchedPatterns: string[] = [];
    let maxSeverity: ProfanityCheckResult['severity'] = 'none';

    const checkSevere = options?.checkSevere !== false;
    const checkModerate = options?.checkModerate !== false;
    const checkMild = options?.checkMild !== false;

    // Check severe profanity
    if (checkSevere) {
      for (const word of SEVERE_PROFANITY) {
        if (this.containsWord(normalizedText, word)) {
          foundWords.push(word);
          matchedPatterns.push('severe_profanity');
          maxSeverity = 'high';
        }
      }
    }

    // Check moderate profanity
    if (checkModerate) {
      for (const word of MODERATE_PROFANITY) {
        if (this.containsWord(normalizedText, word)) {
          foundWords.push(word);
          matchedPatterns.push('moderate_profanity');
          if (maxSeverity !== 'high') maxSeverity = 'medium';
        }
      }
    }

    // Check mild profanity
    if (checkMild) {
      for (const word of MILD_PROFANITY) {
        if (this.containsWord(normalizedText, word)) {
          foundWords.push(word);
          matchedPatterns.push('mild_profanity');
          if (maxSeverity === 'none') maxSeverity = 'low';
        }
      }
    }

    // Check custom word lists
    if (options?.customLists) {
      for (const listId of options.customLists) {
        const list = this.customWordLists.get(listId);
        if (list?.enabled) {
          for (const word of list.words) {
            if (this.containsWord(normalizedText, word)) {
              foundWords.push(word);
              matchedPatterns.push(`custom:${listId}`);
            }
          }
        }
      }
    }

    const hasProfanity = foundWords.length > 0;

    return {
      hasProfanity,
      foundWords: [...new Set(foundWords)], // Deduplicate
      severity: maxSeverity,
      matchedPatterns: [...new Set(matchedPatterns)],
      shouldBlock: maxSeverity === 'high',
      shouldCensor: maxSeverity === 'medium' || maxSeverity === 'high',
    };
  }

  /**
   * Check if text contains a word (whole word match)
   */
  private containsWord(text: string, word: string): boolean {
    const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return regex.test(text);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ========================================
  // Content Analysis
  // ========================================

  /**
   * Comprehensive content filtering
   */
  analyzeContent(text: string, context?: {
    type: 'chat' | 'review' | 'bio' | 'message' | 'description';
    userId?: string;
  }): ContentFilterResult {
    const issues: ContentIssue[] = [];

    // 1. Check for profanity
    const profanityResult = this.checkProfanity(text);
    if (profanityResult.hasProfanity) {
      issues.push({
        type: 'profanity',
        severity: profanityResult.severity === 'none' ? 'low' : profanityResult.severity,
        description: `Profanity detected: ${profanityResult.foundWords.join(', ')}`,
        matchedContent: profanityResult.foundWords.join(', '),
      });
    }

    // 2. Check for spam keywords
    const spamKeywords = this.checkSpamKeywords(text);
    if (spamKeywords.length > 0) {
      issues.push({
        type: 'spam',
        severity: spamKeywords.length > 2 ? 'medium' : 'low',
        description: 'Spam-like content detected',
        matchedContent: spamKeywords.join(', '),
      });
    }

    // 3. Check for aggressive content
    const aggressiveContent = this.checkAggressiveContent(text);
    if (aggressiveContent.length > 0) {
      issues.push({
        type: 'harassment',
        severity: 'high',
        description: 'Aggressive or threatening content detected',
        matchedContent: aggressiveContent.join(', '),
      });
    }

    // 4. Check for harassment
    const harassment = this.checkHarassment(text);
    if (harassment.length > 0) {
      issues.push({
        type: 'harassment',
        severity: 'medium',
        description: 'Harassment or personal attacks detected',
        matchedContent: harassment.join(', '),
      });
    }

    // 5. Check for personal info
    const personalInfo = this.checkPersonalInfo(text);
    if (personalInfo.length > 0) {
      issues.push({
        type: 'personal_info',
        severity: 'medium',
        description: 'Personal information detected - sharing personal info is discouraged',
        matchedContent: personalInfo.join(', '),
      });
    }

    // 6. Check for suspicious links
    const suspiciousLinks = this.checkSuspiciousLinks(text);
    if (suspiciousLinks.length > 0) {
      issues.push({
        type: 'link',
        severity: 'medium',
        description: 'Suspicious links detected',
        matchedContent: suspiciousLinks.join(', '),
      });
    }

    // Calculate overall score (0-100, higher = worse)
    let score = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
        case 'high':
          score += 40;
          break;
        case 'medium':
          score += 20;
          break;
        case 'low':
          score += 5;
          break;
      }
    }

    // Determine if passed
    const passed = score < 40;

    // Generate recommendations
    const recommendations: string[] = [];
    if (issues.some((i) => i.type === 'profanity')) {
      recommendations.push('Remove profanity and offensive language');
    }
    if (issues.some((i) => i.type === 'spam')) {
      recommendations.push('Avoid promotional or spam-like content');
    }
    if (issues.some((i) => i.type === 'harassment')) {
      recommendations.push('Be respectful and avoid personal attacks');
    }
    if (issues.some((i) => i.type === 'personal_info')) {
      recommendations.push('Avoid sharing personal contact information');
    }
    if (issues.some((i) => i.type === 'link')) {
      recommendations.push('Suspicious links are not allowed');
    }

    return {
      passed,
      score: Math.min(100, score),
      issues,
      recommendations,
    };
  }

  /**
   * Check for spam keywords
   */
  private checkSpamKeywords(text: string): string[] {
    const normalized = text.toLowerCase();
    const found: string[] = [];

    for (const keyword of SPAM_KEYWORDS) {
      if (normalized.includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    }

    return found;
  }

  /**
   * Check for aggressive content
   */
  private checkAggressiveContent(text: string): string[] {
    const found: string[] = [];

    for (const pattern of AGGRESSIVE_PATTERNS) {
      if (pattern.test(text)) {
        found.push(pattern.source);
      }
    }

    return found;
  }

  /**
   * Check for harassment
   */
  private checkHarassment(text: string): string[] {
    const found: string[] = [];

    for (const pattern of HARASSMENT_PATTERNS) {
      if (pattern.test(text)) {
        found.push(pattern.source);
      }
    }

    return found;
  }

  /**
   * Check for personal information
   */
  private checkPersonalInfo(text: string): string[] {
    const found: string[] = [];

    for (const pattern of PERSONAL_INFO_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        found.push(match[0]);
      }
    }

    return found;
  }

  /**
   * Check for suspicious links
   */
  private checkSuspiciousLinks(text: string): string[] {
    const found: string[] = [];

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        found.push(pattern.source);
      }
    }

    return found;
  }

  // ========================================
  // Content Censoring
  // ========================================

  /**
   * Censor profanity in text
   */
  censorProfanity(text: string): FilteredContent {
    if (!text) {
      return {
        original: text,
        filtered: text,
        censoredCount: 0,
        wasModified: false,
      };
    }

    let filtered = text;
    let censoredCount = 0;

    // Get all words to censor
    const allProfanity = [...SEVERE_PROFANITY, ...MODERATE_PROFANITY, ...MILD_PROFANITY];

    for (const word of allProfanity) {
      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
      const matches = filtered.match(regex);

      if (matches) {
        censoredCount += matches.length;
        filtered = filtered.replace(regex, this.censorChar.repeat(word.length));
      }
    }

    // Also censor custom words
    for (const [, list] of this.customWordLists) {
      if (!list.enabled) continue;

      for (const word of list.words) {
        const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
        const matches = filtered.match(regex);

        if (matches) {
          censoredCount += matches.length;
          filtered = filtered.replace(regex, this.censorChar.repeat(word.length));
        }
      }
    }

    return {
      original: text,
      filtered,
      censoredCount,
      wasModified: censoredCount > 0,
    };
  }

  /**
   * Full content filtering with censorship
   */
  filterContent(text: string): FilteredContent {
    // First censor profanity
    const profanityResult = this.censorProfanity(text);

    // Then check for other issues and apply additional filtering
    // (links, personal info, etc. are typically removed rather than censored)

    let filtered = profanityResult.filtered;

    // Remove suspicious links
    for (const pattern of SUSPICIOUS_PATTERNS) {
      filtered = filtered.replace(pattern, '[removed]');
    }

    // Mask personal info
    for (const pattern of PERSONAL_INFO_PATTERNS) {
      filtered = filtered.replace(pattern, '[masked]');
    }

    const totalChanges = profanityResult.censoredCount +
      (profanityResult.filtered !== filtered ? 1 : 0);

    return {
      original: text,
      filtered,
      censoredCount: totalChanges,
      wasModified: totalChanges > 0,
    };
  }

  // ========================================
  // Custom Word Lists
  // ========================================

  /**
   * Add custom word list
   */
  addCustomWordList(list: CustomWordList): void {
    this.customWordLists.set(list.id, list);
    logger.info('Custom word list added', { id: list.id, name: list.name, wordCount: list.words.length });
  }

  /**
   * Update custom word list
   */
  updateCustomWordList(id: string, updates: Partial<CustomWordList>): void {
    const existing = this.customWordLists.get(id);
    if (existing) {
      this.customWordLists.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Remove custom word list
   */
  removeCustomWordList(id: string): boolean {
    return this.customWordLists.delete(id);
  }

  /**
   * Get all custom word lists
   */
  getCustomWordLists(): CustomWordList[] {
    return Array.from(this.customWordLists.values());
  }

  /**
   * Enable/disable custom word list
   */
  toggleCustomWordList(id: string, enabled: boolean): void {
    const list = this.customWordLists.get(id);
    if (list) {
      list.enabled = enabled;
      this.customWordLists.set(id, list);
    }
  }

  // ========================================
  // Context-Specific Filtering
  // ========================================

  /**
   * Filter chat message
   */
  filterChatMessage(text: string, userId?: string): ContentFilterResult {
    const result = this.analyzeContent(text, { type: 'chat', userId });

    // Chat-specific adjustments
    // More lenient for casual conversation
    return result;
  }

  /**
   * Filter review content
   */
  filterReview(text: string, userId?: string): ContentFilterResult {
    const result = this.analyzeContent(text, { type: 'review', userId });

    // Reviews should be stricter
    if (result.issues.some((i) => i.type === 'harassment')) {
      result.score += 20;
    }

    return result;
  }

  /**
   * Filter provider bio
   */
  filterBio(text: string, userId?: string): ContentFilterResult {
    const result = this.analyzeContent(text, { type: 'bio', userId });

    // Bios should be professional
    if (result.issues.some((i) => i.type === 'profanity' && i.severity !== 'low')) {
      result.score += 15;
    }

    return result;
  }

  // ========================================
  // Logging and Audit
  // ========================================

  /**
   * Log content violation
   */
  async logViolation(
    userId: string,
    content: string,
    result: ContentFilterResult,
    context?: string
  ): Promise<void> {
    if (!result.issues.length) return;

    // Create audit log
    await createAuditLog({
      userId,
      action: 'CONTENT_VIOLATION',
      resource: 'content_filter',
      resourceId: userId,
      details: {
        context,
        score: result.score,
        issues: result.issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          description: i.description,
        })),
      },
      status: 'success',
    });

    logger.warn('Content violation detected', {
      userId,
      context,
      score: result.score,
      issueCount: result.issues.length,
    });
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get filter statistics
   */
  getStats(): {
    severeWordCount: number;
    moderateWordCount: number;
    mildWordCount: number;
    customListCount: number;
    spamKeywordCount: number;
  } {
    let customWordCount = 0;
    for (const list of this.customWordLists.values()) {
      if (list.enabled) {
        customWordCount += list.words.length;
      }
    }

    return {
      severeWordCount: SEVERE_PROFANITY.length,
      moderateWordCount: MODERATE_PROFANITY.length,
      mildWordCount: MILD_PROFANITY.length,
      customListCount: customWordCount,
      spamKeywordCount: SPAM_KEYWORDS.length,
    };
  }
}

// Export singleton instance
export const profanityFilterService = new ProfanityFilterService();
export default profanityFilterService;
