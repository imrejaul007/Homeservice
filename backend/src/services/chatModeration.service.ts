import logger from '../utils/logger';

// =============================================================================
// Content Moderation Types
// =============================================================================

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high';
  detectedPatterns?: string[];
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  score: number;
}

// =============================================================================
// Profanity Filter Configuration
// =============================================================================

// Basic profanity list (expand as needed)
const PROFANITY_LIST = [
  // Add common profanity here - keeping it minimal for demo
  'badword1',
  'badword2',
  // Note: In production, use a comprehensive library like 'bad-words' or ' censorious'
];

// Patterns that indicate aggressive intent
const AGGRESSIVE_PATTERNS = [
  /threat|attack|hurt|kill|die/i,
  /i will|i'm going to|going to make/i,
  /stupid|idiot|moron|dumb/i,
];

// Suspicious patterns that might indicate harassment
const HARASSMENT_PATTERNS = [
  /shut up|闭嘴/i,
  /go away|get lost/i,
  /hate you|die/i,
  /no one asked/i,
];

// =============================================================================
// Spam Detection Configuration
// =============================================================================

const SPAM_INDICATORS = [
  // Excessive caps
  { pattern: /^[A-Z\s]{10,}$/, weight: 0.3, reason: 'Excessive use of capital letters' },
  // Repeated characters
  { pattern: /(.)\1{4,}/, weight: 0.2, reason: 'Excessive repeated characters' },
  // Common spam keywords
  { pattern: /\b(buy now|click here|free money|win prize|congratulations|act now)\b/i, weight: 0.5, reason: 'Common spam keywords' },
  // URL patterns (suspicious links)
  { pattern: /https?:\/\/[^\s]+\.(ru|cn|tk|ml|ga|cf|gq)\b/i, weight: 0.7, reason: 'Suspicious domain extension' },
  // Phone numbers (potential spam)
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, weight: 0.3, reason: 'Contains phone number' },
  // Email addresses (potential spam)
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, weight: 0.2, reason: 'Contains email address' },
];

// Maximum message length before considered spam
const MAX_REASONABLE_LENGTH = 1000;

// Minimum time between similar messages (in ms)
const MIN_MESSAGE_INTERVAL = 2000;

// =============================================================================
// Link Scanning Configuration
// =============================================================================

const SUSPICIOUS_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  // Add more as needed
];

const DANGEROUS_PATTERNS = [
  /phishing/i,
  /login|signin|account/i,
  /password|credential/i,
  /verify|suspended/i,
];

// =============================================================================
// Profanity Filter
// =============================================================================

/**
 * Check content for profanity
 */
export function checkProfanity(content: string): {
  hasProfanity: boolean;
  foundWords: string[];
  severity: 'low' | 'medium' | 'high';
} {
  if (!content) {
    return { hasProfanity: false, foundWords: [], severity: 'low' };
  }

  const normalizedContent = content.toLowerCase();
  const foundWords: string[] = [];

  for (const word of PROFANITY_LIST) {
    // Check for whole word match
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalizedContent)) {
      foundWords.push(word);
    }
  }

  if (foundWords.length === 0) {
    return { hasProfanity: false, foundWords: [], severity: 'low' };
  }

  // Determine severity based on count
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (foundWords.length >= 3) {
    severity = 'high';
  } else if (foundWords.length >= 2) {
    severity = 'medium';
  }

  return { hasProfanity: true, foundWords, severity };
}

/**
 * Check for aggressive language patterns
 */
export function checkAggressivePatterns(content: string): {
  hasAggression: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high';
} {
  if (!content) {
    return { hasAggression: false, patterns: [], severity: 'low' };
  }

  const detectedPatterns: string[] = [];

  for (const pattern of AGGRESSIVE_PATTERNS) {
    if (pattern.test(content)) {
      detectedPatterns.push(pattern.source);
    }
  }

  if (detectedPatterns.length === 0) {
    return { hasAggression: false, patterns: [], severity: 'low' };
  }

  // Aggression is generally higher severity
  const severity: 'low' | 'medium' | 'high' =
    detectedPatterns.length >= 2 ? 'high' :
    detectedPatterns.length >= 1 ? 'medium' : 'low';

  return { hasAggression: true, patterns: detectedPatterns, severity };
}

/**
 * Check for harassment patterns
 */
export function checkHarassmentPatterns(content: string): {
  hasHarassment: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high';
} {
  if (!content) {
    return { hasHarassment: false, patterns: [], severity: 'low' };
  }

  const detectedPatterns: string[] = [];

  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(content)) {
      detectedPatterns.push(pattern.source);
    }
  }

  if (detectedPatterns.length === 0) {
    return { hasHarassment: false, patterns: [], severity: 'low' };
  }

  const severity: 'low' | 'medium' | 'high' =
    detectedPatterns.length >= 2 ? 'high' :
    detectedPatterns.length >= 1 ? 'medium' : 'low';

  return { hasHarassment: true, patterns: detectedPatterns, severity };
}

// =============================================================================
// Spam Detection
// =============================================================================

/**
 * Check content for spam indicators
 */
export function checkSpamIndicators(content: string): SpamCheckResult {
  if (!content) {
    return { isSpam: false, score: 0 };
  }

  let totalScore = 0;
  const reasons: string[] = [];

  for (const indicator of SPAM_INDICATORS) {
    if (indicator.pattern.test(content)) {
      totalScore += indicator.weight;
      reasons.push(indicator.reason);
    }
  }

  // Check message length
  if (content.length > MAX_REASONABLE_LENGTH) {
    totalScore += 0.3;
    reasons.push('Unusually long message');
  }

  // Check for excessive repetition
  const words = content.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniquenessRatio = uniqueWords.size / words.length;

  if (uniquenessRatio < 0.3 && words.length > 5) {
    totalScore += 0.4;
    reasons.push('High repetition of words');
  }

  // Check for all caps words
  const capsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length / words.length > 0.5) {
    totalScore += 0.2;
    reasons.push('Excessive capital letters');
  }

  const isSpam = totalScore >= 0.5;
  const reason = reasons.length > 0 ? reasons.join('; ') : undefined;

  return {
    isSpam,
    reason,
    score: Math.min(totalScore, 1)
  };
}

/**
 * Check for message similarity (to detect copy-paste spam)
 */
const recentMessagesCache = new Map<string, { content: string; timestamp: number }>();

export function checkMessageSimilarity(
  senderId: string,
  content: string,
  chatRoomId: string
): { isDuplicate: boolean; similarity: number } {
  const cacheKey = `${chatRoomId}:${senderId}`;
  const now = Date.now();

  // Clean old entries (older than 1 hour)
  for (const [key, value] of recentMessagesCache.entries()) {
    if (now - value.timestamp > 3600000) {
      recentMessagesCache.delete(key);
    }
  }

  const lastMessage = recentMessagesCache.get(cacheKey);

  if (!lastMessage) {
    recentMessagesCache.set(cacheKey, { content, timestamp: now });
    return { isDuplicate: false, similarity: 0 };
  }

  // Check time interval
  if (now - lastMessage.timestamp < MIN_MESSAGE_INTERVAL) {
    recentMessagesCache.set(cacheKey, { content, timestamp: now });
    return { isDuplicate: true, similarity: 1 };
  }

  // Calculate similarity
  const similarity = calculateStringSimilarity(lastMessage.content, content);

  recentMessagesCache.set(cacheKey, { content, timestamp: now });

  // Consider duplicate if > 90% similar
  return {
    isDuplicate: similarity > 0.9,
    similarity
  };
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const len1 = s1.length;
  const len2 = s2.length;

  // Create distance matrix
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  return 1 - distance / maxLen;
}

// =============================================================================
// Link Scanning
// =============================================================================

/**
 * Check content for suspicious links
 */
export function checkSuspiciousLinks(content: string): {
  hasSuspiciousLinks: boolean;
  links: string[];
  reason?: string;
} {
  if (!content) {
    return { hasSuspiciousLinks: false, links: [] };
  }

  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = content.match(urlRegex) || [];

  if (urls.length === 0) {
    return { hasSuspiciousLinks: false, links: [] };
  }

  const suspiciousLinks: string[] = [];

  for (const url of urls) {
    // Check for URL shorteners
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (SUSPICIOUS_DOMAINS.some(domain => hostname.includes(domain))) {
        suspiciousLinks.push(url);
        continue;
      }

      // Check for suspicious patterns in URL
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(url)) {
          suspiciousLinks.push(url);
          break;
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  if (suspiciousLinks.length === 0) {
    return { hasSuspiciousLinks: false, links: [] };
  }

  return {
    hasSuspiciousLinks: true,
    links: suspiciousLinks,
    reason: 'Contains suspicious links'
  };
}

// =============================================================================
// Main Content Validation
// =============================================================================

/**
 * Validate message content for moderation
 */
export async function validateMessageContent(content: string): Promise<ModerationResult> {
  if (!content || !content.trim()) {
    return { flagged: false, severity: 'low' };
  }

  const results: Array<{ flagged: boolean; severity: 'low' | 'medium' | 'high'; reason: string }> = [];
  const detectedPatterns: string[] = [];

  // Check profanity
  const profanityResult = checkProfanity(content);
  if (profanityResult.hasProfanity) {
    results.push({
      flagged: true,
      severity: profanityResult.severity,
      reason: `Profanity detected: ${profanityResult.foundWords.join(', ')}`
    });
    detectedPatterns.push(...profanityResult.foundWords);
  }

  // Check aggressive patterns
  const aggressionResult = checkAggressivePatterns(content);
  if (aggressionResult.hasAggression) {
    results.push({
      flagged: true,
      severity: aggressionResult.severity,
      reason: 'Aggressive language detected'
    });
    detectedPatterns.push(...aggressionResult.patterns);
  }

  // Check harassment patterns
  const harassmentResult = checkHarassmentPatterns(content);
  if (harassmentResult.hasHarassment) {
    results.push({
      flagged: true,
      severity: harassmentResult.severity,
      reason: 'Harassment detected'
    });
    detectedPatterns.push(...harassmentResult.patterns);
  }

  // Check spam
  const spamResult = checkSpamIndicators(content);
  if (spamResult.isSpam) {
    results.push({
      flagged: true,
      severity: spamResult.score > 0.7 ? 'high' : 'medium',
      reason: spamResult.reason || 'Spam detected'
    });
  }

  // Check suspicious links
  const linkResult = checkSuspiciousLinks(content);
  if (linkResult.hasSuspiciousLinks) {
    results.push({
      flagged: true,
      severity: 'medium',
      reason: linkResult.reason || 'Suspicious links detected'
    });
  }

  // Determine overall result
  if (results.length === 0) {
    return { flagged: false, severity: 'low' };
  }

  // Determine highest severity
  let highestSeverity: 'low' | 'medium' | 'high' = 'low';
  for (const result of results) {
    if (result.severity === 'high') {
      highestSeverity = 'high';
      break;
    } else if (result.severity === 'medium') {
      highestSeverity = 'medium';
    }
  }

  // Combine reasons
  const reason = results.map(r => r.reason).join('; ');

  logger.debug('Message moderation result', {
    context: 'ChatModeration',
    action: 'MODERATION_CHECK',
    flagged: true,
    severity: highestSeverity,
    reason,
    detectedPatterns,
  });

  return {
    flagged: true,
    reason,
    severity: highestSeverity,
    detectedPatterns
  };
}

/**
 * Sanitize content by removing/replacing inappropriate words
 */
export function sanitizeContent(content: string): string {
  if (!content) return content;

  let sanitized = content;

  // Replace profanity with asterisks
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '*'.repeat(word.length));
  }

  return sanitized;
}

/**
 * Log moderation event for analytics
 */
export function logModerationEvent(
  eventType: 'profanity' | 'spam' | 'harassment' | 'aggression' | 'suspicious_link',
  senderId: string,
  chatRoomId: string,
  content: string,
  severity: 'low' | 'medium' | 'high'
): void {
  logger.warn('Content moderation event', {
    context: 'ChatModeration',
    action: 'MODERATION_EVENT',
    eventType,
    senderId,
    chatRoomId,
    severity,
    contentLength: content.length,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Export
// =============================================================================

export const chatModerationService = {
  checkProfanity,
  checkAggressivePatterns,
  checkHarassmentPatterns,
  checkSpamIndicators,
  checkSuspiciousLinks,
  checkMessageSimilarity,
  validateMessageContent,
  sanitizeContent,
  logModerationEvent,
};

export default chatModerationService;
