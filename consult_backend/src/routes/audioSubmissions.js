const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractAudioMetadata } = require('../services/audioMetadata');

// Accept common audio types by extension - simple check, good enough here.
// (We don't need to cross-validate container vs codec for a take-home demo.)
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.webm', '.flac', '.aac']);

function makeRouter({ uploadDir, Submission = require('../models/audioSubmission'), extractMetadata = extractAudioMetadata }) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, uniqueName);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype.toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext) || (ext === '.mp4' && !['audio/mp4', 'video/mp4'].includes(mime))) {
        return cb(new Error(`Unsupported file type: ${ext}`));
      }
      cb(null, true);
    },
  });

  const router = express.Router();

  // Submit: name + phone + audio file -> extract metadata -> save
  router.post('/', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'audio file is required' });
      }
      if (!req.body.name || !req.body.phone) {
        return res.status(400).json({ error: 'name and phone are required' });
      }

       const metadata = await extractMetadata(req.file.path);

      const submission = await Submission.create({
        name: req.body.name.trim(),
        phone: req.body.phone.trim(),
        storedFilename: req.file.filename,
        durationSeconds: metadata.durationSeconds,
        sampleRateHz: metadata.sampleRateHz,
        bitrateBps: metadata.bitrateBps,
        loudnessDb: metadata.loudnessDb,
      });

      res.status(201).json(submission);
    } catch (error) {
      console.error('Submission failed:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // List all submissions (for the "listing view" requirement)
  router.get('/', async (_req, res) => {
    const submissions = await Submission.find().sort({ submittedAt: -1 });
    res.json(submissions);
  });

  // Stream back a specific audio file for the play button
  router.get('/:id/audio', async (req, res) => {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'not found' });
    }
    const filePath = path.join(uploadDir, submission.storedFilename);
    res.sendFile(filePath);
  });

  return router;
}

module.exports = makeRouter;
