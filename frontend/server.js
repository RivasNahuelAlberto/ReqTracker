import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;
const distPath = path.join(__dirname, 'dist');

// Serve static files from dist/ with caching for assets
app.use(express.static(distPath, {
  etag: false,
  maxAge: '1h',
  index: false  // Prevent Express from serving index.html automatically for /
}));

// Middleware to log requests (debugging)
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.path}`);
  next();
});

// SPA fallback: serve index.html for all other routes
// This handles all routes that aren't found above (non-static files)
app.get('*', (req, res) => {
  console.log(`[SPA Fallback] Serving index.html for route: ${req.path}`);
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      console.error(`[Error] Failed to serve index.html:`, err);
      res.status(500).send('Internal Server Error');
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`[Frontend] Server running on port ${PORT}`);
  console.log(`[Frontend] Serving files from: ${distPath}`);
  console.log(`[Frontend] SPA routing enabled - all routes fallback to index.html`);
});
