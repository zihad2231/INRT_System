import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
