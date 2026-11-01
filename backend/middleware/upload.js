const multer = require('multer');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DRONE_BYTES = 50 * 1024 * 1024;

// Memory storage: the file is only written to disk after its real content is validated.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});
const droneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DRONE_BYTES, files: 1 },
});

/** Detect the real image type from magic bytes (never trust filename or MIME header). */
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) return 'png';
  return null;
}

function sniffDroneImageType(buf) {
  const standardType = sniffImageType(buf);
  if (standardType) return standardType;
  if (buf && buf.length >= 4) {
    const littleEndian = buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00;
    const bigEndian = buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a;
    const littleBigTiff = buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2b && buf[3] === 0x00;
    const bigTiff = buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2b;
    if (littleEndian || bigEndian || littleBigTiff || bigTiff) return 'tiff';
  }
  return null;
}

function handleUploadWith(parser, typeDetector, sizeLimit, nextText) {
  return (req, res, next) => parser.single('image')(req, res, (err) => {
    if (err) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({ error: tooBig ? `Image too large (max ${sizeLimit})` : err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Image file is required (field name "image")' });
    const type = typeDetector(req.file.buffer);
    if (!type) return res.status(400).json({ error: nextText });
    req.file.detectedType = type;
    next();
  });
}

const handleUpload = handleUploadWith(upload, sniffImageType, '8 MB', 'Only valid JPG or PNG images are accepted');
const handleDroneUpload = handleUploadWith(
  droneUpload,
  sniffDroneImageType,
  '50 MB',
  'Only valid JPG, JPEG, PNG, or TIFF images are accepted',
);

module.exports = { handleUpload, handleDroneUpload, sniffImageType, sniffDroneImageType };
