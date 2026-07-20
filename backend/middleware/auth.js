import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.toString().trim()) {
    throw new Error('JWT_SECRET is not configured in the backend environment.');
  }
  return secret;
}

export function sanitizeAuthPayload(payload = {}) {
  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password.trim() : '';
  const projectHash = typeof payload.projectHash === 'string' ? payload.projectHash.trim() : '';

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  if (email && !email.includes('@')) {
    throw new Error('Email must be a valid address');
  }

  return { username, email, password, projectHash };
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  jwt.verify(token, secret, async (err, payload) => {
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

    const normalizeProjectId = (projectRef) => {
      if (!projectRef) return null;
      if (typeof projectRef === 'string') return projectRef;
      if (projectRef._id) return projectRef._id.toString();
      if (projectRef.toString) return projectRef.toString();
      return null;
    };

    const projectRole = Array.isArray(req.user.projectRoles)
      ? req.user.projectRoles.find((pr) => normalizeProjectId(pr.project) === projectId)
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