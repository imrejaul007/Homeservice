import jwt from 'jsonwebtoken';
import { ApiError } from './ApiError';
import { IUser } from '../models/user.model';

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
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_change_in_production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_change_in_production';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '30d'; // ✅ Changed from 7d to 30d
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'home-service-platform',
      audience: 'home-service-users'
    } as jwt.SignOptions);
  }

  generateRefreshToken(payload: Omit<TokenPayload, 'isEmailVerified'>): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
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
      const decoded = jwt.verify(token, this.accessTokenSecret, {
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
      throw new ApiError(401, 'Token verification failed');
    }
  }

  verifyRefreshToken(token: string): Omit<TokenPayload, 'isEmailVerified'> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
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
      throw new ApiError(401, 'Token verification failed');
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
    return jwt.sign(
      { email, purpose: 'email_verification' },
      this.accessTokenSecret,
      {
        expiresIn: '24h',
        issuer: 'home-service-platform',
        audience: 'email-verification'
      } as jwt.SignOptions
    );
  }

  verifyEmailVerificationToken(token: string): { email: string } {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
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
      throw new ApiError(400, 'Email verification token validation failed');
    }
  }

  generatePasswordResetToken(email: string): string {
    return jwt.sign(
      { email, purpose: 'password_reset' },
      this.refreshTokenSecret,
      {
        expiresIn: '1h',
        issuer: 'home-service-platform',
        audience: 'password-reset'
      } as jwt.SignOptions
    );
  }

  verifyPasswordResetToken(token: string): { email: string } {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
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
      throw new ApiError(400, 'Password reset token validation failed');
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