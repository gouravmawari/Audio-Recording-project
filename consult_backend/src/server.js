require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { createApp } = require('./app');

function configFromEnv(env = process.env) {
  if (!env.MONGO_URI) throw new Error('MONGO_URI is required in .env');
  return {
    port: Number(env.PORT || 3000),
    uploadDir: path.resolve(env.UPLOAD_DIR || './uploads'),
    mongoUri: env.MONGO_URI,
  };
}

async function start() {
  const config = configFromEnv();
  const { port, uploadDir, mongoUri } = config;

  await fs.promises.mkdir(uploadDir, { recursive: true });
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const app = createApp({ uploadDir });
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

if (require.main === module) {
  start().catch(error => {
    console.error('Startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { configFromEnv, start };
