const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { UPLOAD_ROOT } = require('../middleware/upload');

// Downloads a remote (or local /uploads/) image and saves it under
//   uploads/<clientId>/<subdir>/<random>.<ext>
// Returns { absPath, publicPath, contentType, size }.
async function downloadImage({ url, clientId, subdir = 'saved' }) {
  if (!url) throw new Error('url is required');

  // Local copy: if url is already /uploads/..., just copy the file.
  if (url.startsWith('/uploads/')) {
    const src = path.resolve(path.join(UPLOAD_ROOT, '..', url.replace(/^\/+/, '')));
    if (!src.startsWith(path.resolve(UPLOAD_ROOT))) {
      throw new Error('refusing to copy outside uploads root');
    }
    const ext = path.extname(src) || '.png';
    const destDir = path.join(UPLOAD_ROOT, String(clientId || 'unscoped'), subdir);
    fs.mkdirSync(destDir, { recursive: true });
    const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const absPath = path.join(destDir, filename);
    await fs.promises.copyFile(src, absPath);
    const stat = await fs.promises.stat(absPath);
    const rel = path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
    return {
      absPath,
      publicPath: `/uploads/${rel}`,
      contentType: 'image/' + ext.slice(1).toLowerCase(),
      size: stat.size
    };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/png';
  const ext = (contentType.split('/')[1] || 'png').split(';')[0].toLowerCase().slice(0, 6);
  const buf = Buffer.from(await res.arrayBuffer());
  const destDir = path.join(UPLOAD_ROOT, String(clientId || 'unscoped'), subdir);
  fs.mkdirSync(destDir, { recursive: true });
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const absPath = path.join(destDir, filename);
  await fs.promises.writeFile(absPath, buf);
  const rel = path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
  return {
    absPath,
    publicPath: `/uploads/${rel}`,
    contentType,
    size: buf.length
  };
}

module.exports = { downloadImage };
