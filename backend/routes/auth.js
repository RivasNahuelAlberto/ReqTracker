import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.js';
import { emitGlobalDataChanged, emitProjectDataChanged } from '../socket.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function ensureJwtSecret(req, res, next) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not configured in environment variables.');
    return res.status(500).json({ error: 'JWT_SECRET not configured. Set this variable in the backend environment.' });
  }
  next();
}

// Register
router.post('/register', ensureJwtSecret, async (req, res) => {
  try {
    const { username, email, password, projectHash } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({ username, email, password, role: 'invitado', projectRoles: [] });

    // If projectHash is provided, link user to the project
    if (projectHash) {
      const project = await Project.findOne({ projectHash });
      
      if (!project) {
        return res.status(400).json({ error: 'Project code is invalid or expired' });
      }

      // Add project role as 'invitado'
      user.projectRoles.push({
        project: project._id,
        role: 'invitado'
      });
    }

    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, projectRoles: user.projectRoles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role, projectRoles: user.projectRoles }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', ensureJwtSecret, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, projectRoles: user.projectRoles },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role, projectRoles: user.projectRoles }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token (middleware helper)
router.get('/verify', ensureJwtSecret, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    try {
      const user = await User.findById(payload.userId).select('-password').lean();
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      res.json({ user });
    } catch (error) {
      console.error('Verify token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Assign role (super_admin or project admin for project roles)
router.put('/assign-role', requireAuth, async (req, res) => {
  try {
    const { username, role, projectId } = req.body;
    if (!username || !role) {
      return res.status(400).json({ error: 'Username and role are required' });
    }

    const validGlobalRoles = ['invitado', 'usuario', 'admin', 'super_admin'];
    const validProjectRoles = ['invitado', 'usuario', 'admin'];

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (projectId) {
      if (!validProjectRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid project role' });
      }

      const projectIdStr = projectId?.toString?.();
      const currentProjectRole = req.user.projectRoles?.find((pr) => {
        const prProjectId = pr.project?._id?.toString() || pr.project?.toString();
        return prProjectId === projectIdStr;
      });
      const canAssignProjectRole = req.user.role === 'super_admin' || currentProjectRole?.role === 'admin';
      if (!canAssignProjectRole) {
        return res.status(403).json({ error: 'No tienes permisos para asignar roles en este proyecto.' });
      }

      const existingIndex = user.projectRoles.findIndex((pr) => pr.project?.toString() === projectId);
      if (existingIndex >= 0) {
        user.projectRoles[existingIndex].role = role;
      } else {
        user.projectRoles.push({ project: projectId, role });
      }
    } else {
      if (!validGlobalRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'No tienes permisos para asignar roles globales.' });
      }
      user.role = role;
    }

    await user.save();
    if (projectId) {
      emitProjectDataChanged(projectId, 'Se asignó un nuevo rol en el proyecto. Haz clic para recargar.');
    } else {
      emitGlobalDataChanged('Se realizaron cambios de permisos en el sistema. Haz clic para recargar.');
    }

    res.json({
      message: 'Role assigned successfully',
      user: { id: user._id, username: user.username, email: user.email, role: user.role, projectRoles: user.projectRoles }
    });
  } catch (error) {
    console.error('Role assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove project role assignment (super_admin or project admin)
router.delete('/project-role', requireAuth, async (req, res) => {
  try {
    const { username, projectId } = req.body;
    if (!username || !projectId) {
      return res.status(400).json({ error: 'Username and projectId are required' });
    }

    const projectIdStr = projectId?.toString?.();
    const currentProjectRole = req.user.projectRoles?.find((pr) => {
      const prProjectId = pr.project?._id?.toString() || pr.project?.toString();
      return prProjectId === projectIdStr;
    });
    const canRemoveProjectRole = req.user.role === 'super_admin' || currentProjectRole?.role === 'admin';
    if (!canRemoveProjectRole) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar roles en este proyecto.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingIndex = user.projectRoles.findIndex((pr) => pr.project?.toString() === projectId);
    if (existingIndex === -1) {
      return res.status(404).json({ error: 'Project role assignment not found' });
    }

    user.projectRoles.splice(existingIndex, 1);
    await user.save();
    emitProjectDataChanged(projectId, 'Se realizó un cambio en asignaciones de proyecto. Haz clic para recargar.');

    res.json({
      message: 'Project role removed successfully',
      user: { id: user._id, username: user.username, email: user.email, role: user.role, projectRoles: user.projectRoles }
    });
  } catch (error) {
    console.error('Remove project role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user in project (admin or super_admin in that project)
router.post('/create-user', requireAuth, async (req, res) => {
  try {
    const { username, email, password, role, projectId } = req.body;

    if (!username || !email || !password || !role || !projectId) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    const validRoles = ['invitado', 'usuario', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    // Check if current user can create in this project
    const projectRole = req.user.projectRoles?.find(pr => pr.project?.toString() === projectId?.toString());
    const canCreate = req.user.role === 'super_admin' || projectRole?.role === 'admin';

    if (!canCreate) {
      return res.status(403).json({ message: 'No tienes permisos para crear usuarios en este proyecto.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario o email ya existe.' });
    }

    const newUser = new User({
      username,
      email,
      password,
      role: 'invitado', // Global role
      projectRoles: [{ project: projectId, role }]
    });

    await newUser.save();
    emitProjectDataChanged(projectId, 'Se creó un nuevo usuario en el proyecto. Haz clic para recargar.');

    res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user: { id: newUser._id, username: newUser.username, email: newUser.email, role: newUser.role, projectRoles: newUser.projectRoles }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (super_admin only)
router.get('/users', requireAuth, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth Configuration
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || 'http://localhost:4000'}/api/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create user based on Google profile
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        // Check if user exists with same email
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.googleProfile = profile;
          await user.save();
        } else {
          // Create new user
          user = new User({
            username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.random().toString(36).substr(2, 5),
            email: profile.emails[0].value,
            googleId: profile.id,
            googleProfile: profile,
            role: 'invitado',
            projectRoles: []
          });
          await user.save();
        }
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Google OAuth routes
  router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
      try {
        const token = jwt.sign(
          {
            userId: req.user._id,
            username: req.user.username,
            role: req.user.role,
            projectRoles: req.user.projectRoles
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Redirect to frontend with token
        // Use the request origin or configured frontend URL
        const protocol = req.protocol;
        const host = req.get('host');
        const origin = `${protocol}://${host}`;
        
        // Determine frontend URL
        let frontendUrl = process.env.FRONTEND_URL;
        
        if (!frontendUrl) {
          // If FRONTEND_URL is not set, try to construct it
          if (origin.includes('onrender.com') && origin.includes('reqtracker') && origin.includes('backend-')) {
            // For Render deployments: reqtracker-backend.onrender.com -> reqtracker.onrender.com
            frontendUrl = origin.replace('backend-', '');
          } else {
            // Fallback to localhost for development
            frontendUrl = 'http://localhost:3000';
          }
        }
        
        console.log('Google OAuth redirecting to:', frontendUrl);
        res.redirect(`${frontendUrl}/login?token=${token}`);
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        const protocol = req.protocol;
        const host = req.get('host');
        const origin = `${protocol}://${host}`;
        
        // Determine frontend URL for error redirect
        let frontendUrl = process.env.FRONTEND_URL;
        
        if (!frontendUrl) {
          if (origin.includes('onrender.com') && origin.includes('reqtracker') && origin.includes('backend-')) {
            frontendUrl = origin.replace('backend-', '');
          } else {
            frontendUrl = 'http://localhost:3000';
          }
        }
        
        res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
    }
  );
}

export default router;