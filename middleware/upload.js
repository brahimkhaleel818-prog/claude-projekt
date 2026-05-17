const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
ensureDir(UPLOAD_ROOT);

const IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/avif'
]);

function buildStorage(subdir) {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      const clientDir = path.join(UPLOAD_ROOT, String(req.clientId || 'unscoped'), subdir);
      ensureDir(clientDir);
      cb(null, clientDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '';
      const rand = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}_${rand}${ext}`);
    }
  });
}

function imageFilter(_req, file, cb) {
  if (IMAGE_MIMES.has(file.mimetype)) cb(null, true);
  else cb(new Error(`Unsupported image type: ${file.mimetype}`));
}

function publicPathFor(file) {
  // Files live under uploads/<clientId>/<subdir>/<name>
  // Served at /uploads/<clientId>/<subdir>/<name>
  const rel = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

const logoUpload = multer({
  storage: buildStorage('logos'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

const assetUpload = multer({
  storage: buildStorage('assets'),
  fileFilter: imageFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

const templateUpload = multer({
  storage: buildStorage('templates'),
  fileFilter: imageFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});

module.exports = {
  UPLOAD_ROOT,
  publicPathFor,
  logoUpload,
  assetUpload,
  templateUpload
};
