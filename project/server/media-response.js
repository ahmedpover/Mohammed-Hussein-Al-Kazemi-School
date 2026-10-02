// Byte ranges let the audio player seek without first receiving the whole file.
export function sendMedia(req, res, content) {
  const size = content.length;
  res.set('Accept-Ranges', 'bytes');
  // No stable validator is supplied for these private files. An If-Range
  // request must therefore receive the complete representation.
  const range = req.get('Range');
  const ranges = req.method === 'GET' && range && /^bytes=/i.test(range) && !req.get('If-Range')
    ? req.range(size, { combine: true }) : undefined;
  if (ranges === -1 || (size === 0 && ranges?.type?.toLowerCase() === 'bytes')) {
    res.set('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  if (Array.isArray(ranges) && ranges.type.toLowerCase() === 'bytes' && ranges.length === 1) {
    const { start, end } = ranges[0];
    res.set('Content-Range', `bytes ${start}-${end}/${size}`);
    res.set('Content-Length', String(end - start + 1));
    return res.status(206).send(content.subarray(start, end + 1));
  }
  // Malformed or unsupported multi-range requests can legally receive 200.
  res.set('Content-Length', String(size));
  return res.status(200).send(content);
}
