const { execFile } = require('node:child_process');

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`${command} failed: ${error.message}`));
      resolve({ stdout, stderr });
    });
  });
}

async function extractAudioMetadata(filePath) {
  // Step 1: ask ffprobe for the basic stream info
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate:stream=sample_rate,codec_type',
    '-of', 'json',
    filePath,
  ]);

  const probe = JSON.parse(stdout);
  const audioStream = (probe.streams || []).find(s => s.codec_type === 'audio');

  if (!audioStream) {
    throw new Error('No audio stream found in this file');
  }

  const durationSeconds = Number(probe.format.duration);
  const sampleRateHz = Number(audioStream.sample_rate);
  const bitrateBps = probe.format.bit_rate ? Number(probe.format.bit_rate) : null;

  // Step 2: ask ffmpeg to actually decode the audio and measure loudness.
  // volumedetect prints its result to stderr (not stdout) - that's just
  // how this ffmpeg filter works.
  const { stderr } = await run('ffmpeg', [
    '-i', filePath,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ]);

  const match = stderr.match(/mean_volume:\s*(-?(?:\d+(\.\d+)?|inf))\s*dB/);
  if (!match) {
    throw new Error('Could not measure loudness for this file');
  }
  // True digital silence occasionally reports "-inf" instead of a number
  const loudnessDb = match[1] === 'inf' ? -100 : Number(match[1]);

  return { durationSeconds, sampleRateHz, bitrateBps, loudnessDb };
}

module.exports = { extractAudioMetadata };