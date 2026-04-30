const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const projectRoutes = require('./routes/projects');
const symbolRoutes = require('./routes/symbols');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reqtracker';

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectRoutes);
app.use('/api/projects', symbolRoutes);

mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
  });
