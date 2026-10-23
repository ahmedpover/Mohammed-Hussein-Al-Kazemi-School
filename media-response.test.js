import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { sendMedia } from '../media-response.js';

test('media supports playback, seeks, suffix ranges and HEAD', async () => {
  const app = express();
  const content = Buffer.from(Array.from({ length: 1024 }, (_, i) => i % 256));
  app.get('/audio', (req, res) => { res.type('audio/mpeg'); sendMedia(req, res, content); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/audio`;
  try {
    for (const [range, status, start, end] of [
      [null, 200, 0, 1023], ['bytes=600-799', 206, 600, 799],
      ['bytes=600-', 206, 600, 1023], ['bytes=-100', 206, 924, 1023],
      ['bytes=0-9999', 206, 0, 1023], ['bytes=0-10,11-20', 206, 0, 20],
      ['bytes=0-10,100-110', 200, 0, 1023], ['invalid', 200, 0, 1023], ['items=2000-', 200, 0, 1023], ['Bytes=600-799', 206, 600, 799]
    ]) {
      const response = await fetch(url, { headers: range ? { Range: range } : {} });
      assert.equal(response.status, status, range);
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
      assert.equal(response.headers.get('content-type'), 'audio/mpeg');
      assert.equal(response.headers.get('content-length'), String(end - start + 1));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), content.subarray(start, end + 1));
      assert.equal(response.headers.get('content-range'), status === 206 ? `bytes ${start}-${end}/1024` : null);
    }
    const invalid = await fetch(url, { headers: { Range: 'bytes=2000-' } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), 'bytes */1024');
    const head = await fetch(url, { method: 'HEAD', headers: { Range: 'bytes=600-' } });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), '1024');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const ifRange = await fetch(url, { headers: { Range: 'bytes=600-', 'If-Range': '"old-file"' } });
    assert.equal(ifRange.status, 200);
    assert.deepEqual(Buffer.from(await ifRange.arrayBuffer()), content);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
