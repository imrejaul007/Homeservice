import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Sanitize user input to prevent XSS attacks
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value
        // Safe non-greedy regex without nested quantifiers (prevents ReDoS)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/<iframe/gi, '&lt;iframe')
        .replace(/<object/gi, '&lt;object')
        .replace(/<embed/gi, '&lt;embed');
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body) as typeof req.body;
  }

  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(req.query)) {
      sanitizedQuery[key] = typeof val === 'string' ? sanitizeValue(val) : val;
    }
    req.query = sanitizedQuery as typeof req.query;
  }

  if (req.params && typeof req.params === 'object') {
    const sanitizedParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.params)) {
      sanitizedParams[key] = String(sanitizeValue(val));
    }
    req.params = sanitizedParams;
  }

  next();
};

/**
 * Validate request content type
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') {
      return next();
    }

    const contentType = req.headers['content-type'] || '';

    if (!allowedTypes.some(type => contentType.includes(type))) {
      logger.warn('Invalid content type', {
        ip: req.ip,
        path: req.path,
        contentType,
        action: 'INVALID_CONTENT_TYPE',
      });
      return next(new ApiError(415, `Content-Type must be one of: ${allowedTypes.join(', ')}`));
    }

    next();
  };
};

/**
 * Validate origin to prevent CSRF
 */
export const validateOrigin = (allowedOrigins: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const origin = req.headers.origin || req.headers.referer || '';

    // Reject requests with missing Origin/Referer header for state-changing operations
    if (!origin) {
      logger.warn('Missing origin header', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        action: 'MISSING_ORIGIN',
      });
      return next(new ApiError(403, 'Origin header required for this operation'));
    }

    if (!allowedOrigins.includes(origin as string)) {
      logger.warn('Invalid origin', {
        ip: req.ip,
        path: req.path,
        origin,
        action: 'INVALID_ORIGIN',
      });
      return next(new ApiError(403, 'Invalid request origin'));
    }

    next();
  };
};

/**
 * Block common attack patterns
 * NOTE: Primary defense against SQL injection is parameterized queries.
 * These patterns are defense-in-depth only.
 */
export const blockAttackPatterns = (req: Request, _res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    { pattern: /\.\.\//, name: 'Path traversal' },
    { pattern: /<script/i, name: 'XSS' },
    // SQL injection patterns - handles bypasses: UNION/**/SELECT, UNION%09SELECT, UNION%0aSELECT, etc.
    { pattern: /union[\s\S]*?select/i, name: 'SQL injection' },
    { pattern: /union[\s]*((\%09|\%0a|\%0b|\%0c|\%0d|\%20|\/\*|\-\-|\#)[\s\S]*?)*select/i, name: 'SQL injection' },
    // DROP TABLE with comment bypass: drop/**/table, drop%09table, etc.
    { pattern: /drop[\s]*((\%09|\%0a|\%0b|\%0c|\%0d|\%20|\/\*|\-\-|\#)[\s]*)*table/i, name: 'SQL injection' },
    { pattern: /delete[\s]*((\%09|\%0a|\%0b|\%0c|\%0d|\%20|\/\*|\-\-|\#)[\s]*)*from/i, name: 'SQL injection' },
    { pattern: /insert[\s]*((\%09|\%0a|\%0b|\%0c|\%0d|\%20|\/\*|\-\-|\#)[\s]*)*into/i, name: 'SQL injection' },
    { pattern: /update[\s\S]*?set/i, name: 'SQL injection' },
    { pattern: /exec\s*\(/i, name: 'Command injection' },
    { pattern: /eval\s*\(/i, name: 'Code injection' },
    { pattern: /\x00/, name: 'Null byte' },
    { pattern: /%00/, name: 'URL encoded null byte' },
    // Additional SQL keywords that are dangerous
    { pattern: /(select|insert|update|delete|drop|alter|create|truncate)[\s]*((\%09|\%0a|\%0b|\%0c|\%0d|\%20|\/\*|\-\-|\#)[\s\S]*?)*(from|into|table|database|where)/i, name: 'SQL injection' },
  ];

  const checkValue = (value: unknown, path: string): { detected: boolean; pattern?: string } => {
    if (typeof value === 'string') {
      for (const { pattern, name } of suspiciousPatterns) {
        if (pattern.test(value)) {
          return { detected: true, pattern: name };
        }
      }
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const result = checkValue(value[i], `${path}[${i}]`);
        if (result.detected) return result;
      }
    }

    if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value)) {
        const result = checkValue(v, `${path}.${k}`);
        if (result.detected) return result;
      }
    }

    return { detected: false };
  };

  const bodyResult = checkValue(req.body, 'body');
  if (bodyResult.detected) {
    logger.warn('Suspicious pattern in body', {
      ip: req.ip,
      path: req.path,
      pattern: bodyResult.pattern,
      action: 'SUSPICIOUS_PATTERN_BODY',
    });
    return next(new ApiError(400, 'Invalid input detected'));
  }

  const queryResult = checkValue(req.query, 'query');
  if (queryResult.detected) {
    logger.warn('Suspicious pattern in query', {
      ip: req.ip,
      path: req.path,
      pattern: queryResult.pattern,
      action: 'SUSPICIOUS_PATTERN_QUERY',
    });
    return next(new ApiError(400, 'Invalid input detected'));
  }

  const paramsResult = checkValue(req.params, 'params');
  if (paramsResult.detected) {
    logger.warn('Suspicious pattern in params', {
      ip: req.ip,
      path: req.path,
      pattern: paramsResult.pattern,
      action: 'SUSPICIOUS_PATTERN_PARAMS',
    });
    return next(new ApiError(400, 'Invalid input detected'));
  }

  next();
};

/**
 * Validate URL parameters (prevent URL manipulation)
 */
export const validateUrlParams = (allowedPatterns: Record<string, RegExp>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const [param, pattern] of Object.entries(allowedPatterns)) {
      const value = req.params[param];

      if (value && !pattern.test(value)) {
        logger.warn('Invalid URL parameter', {
          ip: req.ip,
          path: req.path,
          param,
          value,
          action: 'INVALID_URL_PARAM',
        });
        return next(new ApiError(400, `Invalid value for parameter: ${param}`));
      }
    }

    next();
  };
};

/**
 * Strict input validation for IDs
 */
export const validateObjectId = (paramName: string = 'id') => {
  const objectIdPattern = /^[a-fA-F0-9]{24}$/;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    if (id && !objectIdPattern.test(id)) {
      logger.warn('Invalid ObjectId', {
        ip: req.ip,
        path: req.path,
        param: paramName,
        value: id,
        action: 'INVALID_OBJECT_ID',
      });
      return next(new ApiError(400, `Invalid ${paramName}`));
    }

    next();
  };
};

export default {
  sanitizeInput,
  validateContentType,
  validateOrigin,
  blockAttackPatterns,
  validateUrlParams,
  validateObjectId,
};
