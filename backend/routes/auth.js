import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth, authorizeRoles } from '../middleware/auth.js';

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
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({ username, email, password, role: 'invitado', projectRoles: [] });
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

// Assign role (super_admin only)
router.put('/assign-role', requireAuth, authorizeRoles('super_admin'), async (req, res) => {
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
      user.role = role;
    }

    await user.save();

    res.json({
      message: 'Role assigned successfully',
      user: { id: user._id, username: user.username, email: user.email, role: user.role, projectRoles: user.projectRoles }
    });
  } catch (error) {
    console.error('Role assignment error:', error);
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

export default router;