/**
 * Content Moderation Service
 * Automatically detects profanity, spam patterns, and inappropriate content in reviews
 */

// Basic profanity word list (common inappropriate words)
const PROFANITY_LIST = [
  // Generic inappropriate terms - kept minimal and non-exhaustive
  'damn', 'hell', 'crap', 'suck', 'sucks', 'stupid', 'idiot', 'moron',
  'loser', 'jerk', 'fool', 'dumb', 'hate', 'worst', 'terrible', 'awful',
  'horrible', 'pathetic', 'useless', 'garbage', 'trash', 'junk',
  // Offensive language patterns
  'shut up', 'go away', 'get lost', 'fire this', 'never again',
];

// Suspicious spam patterns
const SPAM_INDICATORS = [
  'click here', 'visit my', 'check out my', 'contact me at',
  'call me at', 'whatsapp', 'telegram', 'instagram', 'facebook.com',
  'promotion', 'special offer', 'limited time', 'act now',
  'buy now', 'order now', 'discount code', 'referral link',
];

// Score thresholds
const SCORE_THRESHOLDS = {
  APPROVE: 0,    // Score 0-24: Safe to approve
  FLAG: 25,      // Score 25-49: Flag for review
  REJECT: 50,    // Score 50+: Auto-reject
};

export interface ModerationResult {
  score: number;
  action: 'approve' | 'flag' | 'reject';
  issues: ModerationIssue[];
  details: {
    hasProfanity: boolean;
    hasExcessiveCaps: boolean;
    hasExcessivePunctuation: boolean;
    hasUrls: boolean;
    hasPhoneNumbers: boolean;
    hasEmails: boolean;
    hasRepeatedChars: boolean;
    hasSuspiciousPatterns: boolean;
  };
}

export interface ModerationIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  matched?: string;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if text contains profanity
 */
function checkProfanity(text: string): { found: boolean; words: string[] } {
  const lowerText = text.toLowerCase();
  const foundWords: string[] = [];

  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    if (regex.test(lowerText)) {
      foundWords.push(word);
    }
  }

  return { found: foundWords.length > 0, words: foundWords };
}

/**
 * Check for excessive capitalization (>50% uppercase)
 */
function checkExcessiveCaps(text: string): { has: boolean; percentage: number } {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 10) return { has: false, percentage: 0 };

  const uppercase = letters.replace(/[^A-Z]/g, '').length;
  const percentage = (uppercase / letters.length) * 100;

  return { has: percentage > 50, percentage };
}

/**
 * Check for excessive punctuation (!!!, ???, etc.)
 */
function checkExcessivePunctuation(text: string): { has: boolean; count: number } {
  // Look for repeated punctuation patterns
  const patterns = [
    /[!?]{3,}/g,           // !!! or ??? or !!!
    /[\.]{5,}/g,           // .....
    /[,]{5,}/g,            // ,,,,,
    /\s{3,}/g,             // Multiple spaces
  ];

  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return { has: count >= 2, count };
}

/**
 * Check for URLs/links
 */
function checkUrls(text: string): { has: boolean; urls: string[] } {
  const urlPattern = /(?:https?:\/\/|www\.)[^\s]+/gi;
  const matches = text.match(urlPattern) || [];
  return { has: matches.length > 0, urls: matches };
}

/**
 * Check for phone numbers
 */
function checkPhoneNumbers(text: string): { has: boolean; numbers: string[] } {
  const phonePatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,     // US format
    /\b\d{10,11}\b/g,                           // 10-11 digit numbers
    /\+\d{1,3}[-.\s]?\d{6,14}\b/g,              // International
    /\b\d{4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,  // Various formats
    /\b\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, // Local formats
  ];

  const found: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      found.push(...matches);
    }
  }

  return { has: found.length > 0, numbers: [...new Set(found)] };
}

/**
 * Check for email addresses
 */
function checkEmails(text: string): { has: boolean; emails: string[] } {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = text.match(emailPattern) || [];
  return { has: matches.length > 0, emails: [...new Set(matches)] };
}

/**
 * Check for repeated character patterns (aaaaaaa, !!!!!)
 */
function checkRepeatedChars(text: string): { has: boolean; count: number } {
  const repeatedPattern = /(.)\1{4,}/g;  // Same character 5+ times
  const matches = text.match(repeatedPattern) || [];
  return { has: matches.length > 0, count: matches.length };
}

/**
 * Check for suspicious spam patterns
 */
function checkSuspiciousPatterns(text: string): { has: boolean; patterns: string[] } {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const pattern of SPAM_INDICATORS) {
    if (lowerText.includes(pattern.toLowerCase())) {
      found.push(pattern);
    }
  }

  return { has: found.length > 0, patterns: found };
}

/**
 * Detect spam patterns in text
 */
export function detectSpamPatterns(text: string): {
  isSpam: boolean;
  confidence: number;
  patterns: string[];
} {
  const patterns: string[] = [];
  let confidence = 0;

  // Check URL presence
  const urls = checkUrls(text);
  if (urls.has) {
    patterns.push(`Contains ${urls.urls.length} URL(s)`);
    confidence += 25;
  }

  // Check phone numbers
  const phones = checkPhoneNumbers(text);
  if (phones.has) {
    patterns.push(`Contains ${phones.numbers.length} phone number(s)`);
    confidence += 20;
  }

  // Check email addresses
  const emails = checkEmails(text);
  if (emails.has) {
    patterns.push(`Contains ${emails.emails.length} email(s)`);
    confidence += 20;
  }

  // Check suspicious phrases
  const suspicious = checkSuspiciousPatterns(text);
  if (suspicious.has) {
    patterns.push(...suspicious.patterns.map(p => `Suspicious phrase: "${p}"`));
    confidence += 15 * suspicious.patterns.length;
  }

  // Check repeated characters
  const repeated = checkRepeatedChars(text);
  if (repeated.has) {
    patterns.push(`${repeated.count} instance(s) of repeated characters`);
    confidence += 10;
  }

  // Check excessive caps
  const caps = checkExcessiveCaps(text);
  if (caps.has) {
    patterns.push(`${Math.round(caps.percentage)}% uppercase`);
    confidence += 10;
  }

  return {
    isSpam: confidence >= 25,
    confidence: Math.min(confidence, 100),
    patterns,
  };
}

/**
 * Calculate content moderation score (0-100)
 * Higher score = more problematic content
 */
export function scoreContent(text: string): number {
  let score = 0;

  // Check profanity (0-35 points)
  const profanity = checkProfanity(text);
  if (profanity.found) {
    // Each profanity word adds 8 points, capped at 35
    score += Math.min(profanity.words.length * 8, 35);
  }

  // Check excessive caps (0-15 points)
  const caps = checkExcessiveCaps(text);
  if (caps.has) {
    score += Math.min(Math.round((caps.percentage - 50) / 2), 15);
  }

  // Check excessive punctuation (0-10 points)
  const punct = checkExcessivePunctuation(text);
  if (punct.has) {
    score += Math.min(punct.count * 4, 10);
  }

  // Check URLs (15 points each, max 30)
  const urls = checkUrls(text);
  if (urls.has) {
    score += Math.min(urls.urls.length * 15, 30);
  }

  // Check phone numbers (10 points each, max 20)
  const phones = checkPhoneNumbers(text);
  if (phones.has) {
    score += Math.min(phones.numbers.length * 10, 20);
  }

  // Check emails (10 points each, max 20)
  const emails = checkEmails(text);
  if (emails.has) {
    score += Math.min(emails.emails.length * 10, 20);
  }

  // Check repeated characters (0-10 points)
  const repeated = checkRepeatedChars(text);
  if (repeated.has) {
    score += Math.min(repeated.count * 4, 10);
  }

  // Check suspicious patterns (10 points each, max 30)
  const suspicious = checkSuspiciousPatterns(text);
  if (suspicious.has) {
    score += Math.min(suspicious.patterns.length * 10, 30);
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Suggest moderation action based on score
 */
export function suggestModerationAction(score: number): 'approve' | 'flag' | 'reject' {
  if (score < SCORE_THRESHOLDS.FLAG) {
    return 'approve';
  } else if (score < SCORE_THRESHOLDS.REJECT) {
    return 'flag';
  } else {
    return 'reject';
  }
}

/**
 * Main content check function - analyzes text for inappropriate content
 */
export function checkContent(content: string): ModerationResult {
  const issues: ModerationIssue[] = [];

  // Run all checks
  const profanity = checkProfanity(content);
  const caps = checkExcessiveCaps(content);
  const punct = checkExcessivePunctuation(content);
  const urls = checkUrls(content);
  const phones = checkPhoneNumbers(content);
  const emails = checkEmails(content);
  const repeated = checkRepeatedChars(content);
  const suspicious = checkSuspiciousPatterns(content);

  // Build issues list
  if (profanity.found) {
    issues.push({
      type: 'profanity',
      severity: profanity.words.length > 2 ? 'high' : 'medium',
      description: `Contains ${profanity.words.length} inappropriate word(s)`,
      matched: profanity.words.slice(0, 3).join(', ') + (profanity.words.length > 3 ? '...' : ''),
    });
  }

  if (caps.has) {
    issues.push({
      type: 'excessive_caps',
      severity: 'low',
      description: `${Math.round(caps.percentage)}% uppercase (threshold: 50%)`,
    });
  }

  if (punct.has) {
    issues.push({
      type: 'excessive_punctuation',
      severity: 'low',
      description: `${punct.count} instance(s) of excessive punctuation`,
    });
  }

  if (urls.has) {
    issues.push({
      type: 'urls',
      severity: 'high',
      description: `Contains ${urls.urls.length} URL(s) - potential spam`,
      matched: urls.urls.slice(0, 2).join(', ') + (urls.urls.length > 2 ? '...' : ''),
    });
  }

  if (phones.has) {
    issues.push({
      type: 'phone_numbers',
      severity: 'high',
      description: `Contains ${phones.numbers.length} phone number(s) - potential spam`,
      matched: phones.numbers.slice(0, 2).join(', '),
    });
  }

  if (emails.has) {
    issues.push({
      type: 'emails',
      severity: 'high',
      description: `Contains ${emails.emails.length} email address(es) - potential spam`,
      matched: emails.emails.slice(0, 2).join(', '),
    });
  }

  if (repeated.has) {
    issues.push({
      type: 'repeated_characters',
      severity: 'low',
      description: `${repeated.count} instance(s) of repeated characters`,
    });
  }

  if (suspicious.has) {
    issues.push({
      type: 'suspicious_patterns',
      severity: 'medium',
      description: `Contains ${suspicious.patterns.length} suspicious phrase(s)`,
      matched: suspicious.patterns.slice(0, 3).join(', '),
    });
  }

  // Calculate score and determine action
  const score = scoreContent(content);
  const action = suggestModerationAction(score);

  return {
    score,
    action,
    issues,
    details: {
      hasProfanity: profanity.found,
      hasExcessiveCaps: caps.has,
      hasExcessivePunctuation: punct.has,
      hasUrls: urls.has,
      hasPhoneNumbers: phones.has,
      hasEmails: emails.has,
      hasRepeatedChars: repeated.has,
      hasSuspiciousPatterns: suspicious.has,
    },
  };
}

export default {
  checkContent,
  detectSpamPatterns,
  scoreContent,
  suggestModerationAction,
};
