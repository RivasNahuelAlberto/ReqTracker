import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.googleId; } }, // Password required only if not Google user
  googleId: { type: String, sparse: true }, // Google OAuth ID
  googleProfile: { type: mongoose.Schema.Types.Mixed }, // Store Google profile data
  role: { type: String, enum: ['invitado', 'usuario', 'admin', 'super_admin'], default: 'invitado' },
  projectRoles: [{
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    role: { type: String, enum: ['invitado', 'usuario', 'admin'], default: 'invitado' }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Skip if password not modified or is null/undefined (Google OAuth users)
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false; // No password for Google users
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);