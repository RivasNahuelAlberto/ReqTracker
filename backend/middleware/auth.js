import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      const user = await User.findById(payload.userId).select('-password').populate('projectRoles.project', '_id name').lean();
      if (!user) {
        return res.status(401).json({ error: 'User no longer exists' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('Error loading user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'User role not found' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function authorizeProjectRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    const projectId = req.project?._id?.toString() || req.params.projectId?.toString();
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required for authorization' });
    }

    const projectRole = Array.isArray(req.user.projectRoles)
      ? req.user.projectRoles.find((pr) => pr.project && pr.project.toString() === projectId)
      : null;

    if (!projectRole || !allowedRoles.includes(projectRole.role)) {
      return res.status(403).json({ error: 'Insufficient project permissions' });
    }

    next();
  };
}

export function requireAuth(req, res, next) {
  authenticateToken(req, res, next);
}