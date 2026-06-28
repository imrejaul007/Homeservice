import jwt from 'jsonwebtoken';
import { ApiError, ERROR_CODES } from './ApiError';
import { IUser } from '../models/user.model';
import logger from './logger';

// Allowed algorithms for JWT signing - RS256 only for production security
// This prevents alg: "none" attacks and other algorithm confusion vulnerabilities
const ALLOWED_ALGORITHMS = ['RS256'] as const;

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    const env = process.env.NODE_ENV || 'development';
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    // In production, require secrets to be set
    if (env === 'production') {
      if (!accessSecret || !refreshSecret) {
        throw ApiError.internal(
          'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables are required in production'
        );
      }
      this.accessTokenSecret = accessSecret;
      this.refreshTokenSecret = refreshSecret;
    } else {
      // In development, use fallbacks with warnings
      if (!accessSecret) {
        logger.warn('Using insecure fallback JWT access secret. Set JWT_ACCESS_SECRET in production!', {
          context: 'JWTService',
        });
        this.accessTokenSecret = 'dev_access_secret_do_not_use_in_prod';
      } else {
        this.accessTokenSecret = accessSecret;
      }
      if (!refreshSecret) {
        logger.warn('Using insecure fallback JWT refresh secret. Set JWT_REFRESH_SECRET in production!', {
          context: 'JWTService',
        });
        this.refreshTokenSecret = 'dev_refresh_secret_do_not_use_in_prod';
      } else {
        this.refreshTokenSecret = refreshSecret;
      }
    }

    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '30d';
  }

  /**
   * Validate that the token header doesn't use "none" algorithm
   * This is a critical security check to prevent alg:none attacks
   */
  private validateAlgorithm(token: string): void {
    try {
      // Decode the token header WITHOUT verification to check the algorithm
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new ApiError(401, 'Invalid token format');
      }

      const header = decoded.header;
      if (!header) {
        throw new ApiError(401, 'Invalid token header');
      }

      // SECURITY FIX: Explicitly reject "none" algorithm
      if (header.alg === 'none' || header.alg === 'None' || header.alg === 'NONE') {
        throw new ApiError(401, 'Invalid token algorithm: "none" is not allowed');
      }

      // SECURITY FIX: Validate algorithm is in allowed list
      if (!ALLOWED_ALGORITHMS.includes(header.alg as any)) {
        throw new ApiError(401, `Invalid token algorithm: ${header.alg} is not allowed. Allowed: ${ALLOWED_ALGORITHMS.join(', ')}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, 'Token algorithm validation failed');
    }
  }

  generateAccessToken(payload: TokenPayload): string {
    // SECURITY FIX: Explicitly specify RS256 algorithm to prevent algorithm confusion attacks
    // SECURITY FIX: This service uses RS256. The user.model.ts also has legacy generateAuthToken()
    // that uses HS256 for backward compatibility. New code should use this jwtService instead.
    return jwt.sign(payload, this.accessTokenSecret, {
      algorithm: 'RS256', // SECURITY FIX: Explicitly set algorithm
      expiresIn: this.accessTokenExpiry,
      issuer: 'home-service-platform',
      audience: 'home-service-users'
    } as jwt.SignOptions);
  }

  generateRefreshToken(payload: Omit<TokenPayload, 'isEmailVerified'>): string {
    // SECURITY FIX: Explicitly specify RS256 algorithm to prevent algorithm confusion attacks
    return jwt.sign(payload, this.refreshTokenSecret, {
      algorithm: 'RS256', // SECURITY FIX: Explicitly set algorithm
      expiresIn: this.refreshTokenExpiry,
      issuer: 'home-service-platform',
      audience: 'home-service-users'
    } as jwt.SignOptions);
  }

  generateTokenPair(user: IUser): TokenPair {
    const payload: TokenPayload = {
      userId: (user._id as any).toString(),
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    const refreshPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(refreshPayload)
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      // SECURITY FIX: Validate algorithm before verification (prevents alg:none attack)
      this.validateAlgorithm(token);

      // SECURITY FIX: Explicitly specify RS256 algorithm in verify options
      // SECURITY FIX: Add explicit algorithm header check to prevent algorithm confusion attacks
      const decodedHeader = jwt.decode(token, { complete: true });
      if (decodedHeader && typeof decodedHeader !== 'string' && decodedHeader.header) {
        if (decodedHeader.header.alg !== 'RS256') {
          throw new ApiError(401, 'Invalid token algorithm: expected RS256');
        }
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: ['RS256'] as jwt.Algorithm[], // SECURITY FIX: Only allow RS256
        issuer: 'home-service-platform',
        audience: 'home-service-users'
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid access token');
      }
      throw error; // Re-throw ApiError as-is
    }
  }

  verifyRefreshToken(token: string): Omit<TokenPayload, 'isEmailVerified'> {
    try {
      // SECURITY FIX: Validate algorithm before verification (prevents alg:none attack)
      this.validateAlgorithm(token);

      // SECURITY FIX: Add explicit algorithm header check to prevent algorithm confusion attacks
      const decodedHeader = jwt.decode(token, { complete: true });
      if (decodedHeader && typeof decodedHeader !== 'string' && decodedHeader.header) {
        if (decodedHeader.header.alg !== 'RS256') {
          throw new ApiError(401, 'Invalid token algorithm: expected RS256');
        }
      }

      // SECURITY FIX: Explicitly specify RS256 algorithm in verify options
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: ['RS256'] as jwt.Algorithm[], // SECURITY FIX: Only allow RS256
        issuer: 'home-service-platform',
        audience: 'home-service-users'
      }) as Omit<TokenPayload, 'isEmailVerified'>;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid refresh token');
      }
      throw error; // Re-throw ApiError as-is
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new ApiError(401, 'Authorization header missing');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Invalid authorization header format');
    }

    const token = authHeader.substring(7);
    if (!token) {
      throw new ApiError(401, 'Token missing from authorization header');
    }

    return token;
  }

  generateEmailVerificationToken(email: string): string {
    // SECURITY FIX: Explicitly specify RS256 algorithm
    return jwt.sign(
      { email, purpose: 'email_verification' },
      this.accessTokenSecret,
      {
        algorithm: 'RS256', // SECURITY FIX: Explicitly set algorithm
        expiresIn: '24h',
        issuer: 'home-service-platform',
        audience: 'email-verification'
      } as jwt.SignOptions
    );
  }

  verifyEmailVerificationToken(token: string): { email: string } {
    try {
      // SECURITY FIX: Validate algorithm before verification
      this.validateAlgorithm(token);

      // SECURITY FIX: Add explicit algorithm header check to prevent algorithm confusion attacks
      const decodedHeader = jwt.decode(token, { complete: true });
      if (decodedHeader && typeof decodedHeader !== 'string' && decodedHeader.header) {
        if (decodedHeader.header.alg !== 'RS256') {
          throw new ApiError(400, 'Invalid token algorithm: expected RS256');
        }
      }

      // SECURITY FIX: Explicitly specify RS256 algorithm
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: ['RS256'] as jwt.Algorithm[], // SECURITY FIX: Only allow RS256
        issuer: 'home-service-platform',
        audience: 'email-verification'
      }) as { email: string; purpose: string };

      if (decoded.purpose !== 'email_verification') {
        throw new ApiError(400, 'Invalid token purpose');
      }

      return { email: decoded.email };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(400, 'Email verification token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(400, 'Invalid email verification token');
      }
      throw error; // Re-throw ApiError as-is
    }
  }

  generatePasswordResetToken(email: string): string {
    // SECURITY FIX: Explicitly specify RS256 algorithm
    return jwt.sign(
      { email, purpose: 'password_reset' },
      this.refreshTokenSecret,
      {
        algorithm: 'RS256', // SECURITY FIX: Explicitly set algorithm
        expiresIn: '1h',
        issuer: 'home-service-platform',
        audience: 'password-reset'
      } as jwt.SignOptions
    );
  }

  verifyPasswordResetToken(token: string): { email: string } {
    try {
      // SECURITY FIX: Validate algorithm before verification
      this.validateAlgorithm(token);

      // SECURITY FIX: Add explicit algorithm header check to prevent algorithm confusion attacks
      const decodedHeader = jwt.decode(token, { complete: true });
      if (decodedHeader && typeof decodedHeader !== 'string' && decodedHeader.header) {
        if (decodedHeader.header.alg !== 'RS256') {
          throw new ApiError(400, 'Invalid token algorithm: expected RS256');
        }
      }

      // SECURITY FIX: Explicitly specify RS256 algorithm
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: ['RS256'] as jwt.Algorithm[], // SECURITY FIX: Only allow RS256
        issuer: 'home-service-platform',
        audience: 'password-reset'
      }) as { email: string; purpose: string };

      if (decoded.purpose !== 'password_reset') {
        throw new ApiError(400, 'Invalid token purpose');
      }

      return { email: decoded.email };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(400, 'Password reset token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(400, 'Invalid password reset token');
      }
      throw error; // Re-throw ApiError as-is
    }
  }

  getTokenExpirationTime(token: string): Date {
    try {
      const decoded = jwt.decode(token) as { exp: number };
      return new Date(decoded.exp * 1000);
    } catch (error) {
      throw new ApiError(400, 'Unable to decode token expiration');
    }
  }

  isTokenExpiringSoon(token: string, minutesThreshold: number = 5): boolean {
    try {
      const expiration = this.getTokenExpirationTime(token);
      const now = new Date();
      const thresholdTime = new Date(now.getTime() + (minutesThreshold * 60 * 1000));
      
      return expiration <= thresholdTime;
    } catch (error) {
      return true;
    }
  }
}

export const jwtService = new JWTService();
export { TokenPayload, TokenPair };