const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('app import does not require MongoDB or start listening', () => {
  delete process.env.MONGO_URI;
  const app = require('../src/app');
  assert.equal(typeof app.listen, 'function');
});

test('CORS preflight allows the local frontend', async () => {
  const app = require('../src/app');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  try {
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      const request = http.request({ port, path: '/api/audio-submissions', method: 'OPTIONS', headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      } }, result => { result.resume(); result.on('end', () => resolve(result)); });
      request.on('error', reject);
      request.end();
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.match(response.headers['access-control-allow-methods'], /POST/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
