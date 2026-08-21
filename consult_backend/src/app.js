const express = require('express');
const cors = require('cors');
const path = require('node:path');
const makeRouter = require('./routes/audioSubmissions');

function createApp({ uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads'), Submission, submissionModel, metadataExtractor, extractMetadata } = {}) {
  const app = express();
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range'],
  }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/audio-submissions', makeRouter({ uploadDir, Submission: Submission || submissionModel, extractMetadata: extractMetadata || metadataExtractor }));

  app.use((error, _req, res, _next) => {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.status || 400);
    res.status(status).json({ error: error.message });
  });

  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
