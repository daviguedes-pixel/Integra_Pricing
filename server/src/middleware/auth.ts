import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

// Extend Request interface
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    app_metadata?: any;
    user_metadata?: any;
    aud: string;
    created_at: string;
  };
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  // Also check cookie if not in header
  const cookieToken = req.cookies?.accessToken;
  const accessToken = token || cookieToken;

  if (!accessToken) {
    return res.status(401).json({ message: 'Authentication required: No token provided' });
  }

  try {
    // Validate token using Supabase
    // This validates the JWT signature and checks if it's not expired/revoked
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      console.error('❌ Supabase Auth Error:', error?.message);
      console.log('Token prefix:', accessToken.substring(0, 10) + '...');
      return res.status(403).json({
        message: 'Invalid or expired token',
        error: error?.message,
        hint: 'Check if the backend SUPABASE_URL matches the frontend one'
      });
    }

    console.log('✅ Auth success for user:', user.email);

    // Attach user to request
    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      aud: user.aud,
      created_at: user.created_at
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Exception:', error);
    return res.status(500).json({ message: 'Internal authentication error' });
  }
}
