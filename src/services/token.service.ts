import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}

export class JwtTokenService implements TokenService {
  sign(payload: TokenPayload): string {
    const expiresIn = env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>;
    return jwt.sign(
      { sub: payload.userId, email: payload.email },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn },
    );
  }

  verify(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
        throw new UnauthorizedError('Invalid token');
      }
      return { userId: decoded.sub, email: decoded.email };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
