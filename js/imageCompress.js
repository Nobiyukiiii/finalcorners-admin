// ============================================================
// imageCompress.js — Client-side image compression via Canvas
// ============================================================

/**
 * Compress an image File before upload.
 *
 * @param {File}   file        - Original File object (must be image/*)
 * @param {object} [opts]
 * @param {number} [opts.maxWidth=1920]   - Max output width in px
 * @param {number} [opts.maxHeight=1920]  - Max output height in px
 * @param {number} [opts.quality=0.82]    - JPEG/WebP quality (0–1)
 * @param {string} [opts.outputType]      - MIME type; defaults to 'image/webp' if supported, else 'image/jpeg'
 * @param {number} [opts.skipIfSmaller]   - Skip compression if file is smaller than this (bytes). Default 150KB.
 * @returns {Promise<File>}               - Compressed File (or original if already small / not an image)
 */
export async function compressImage(file, opts = {}) {
  const {
    maxWidth  = 1920,
    maxHeight = 1920,
    quality   = 0.82,
    skipIfSmaller = 150 * 1024, // 150 KB
  } = opts;

  // Only handle images
  if (!file.type.startsWith('image/')) return file;
  // Skip SVG — canvas can't losslessly re-encode it
  if (file.type === 'image/svg+xml') return file;
  // Skip GIF (canvas strips animation)
  if (file.type === 'image/gif') return file;

  // If already small enough, skip
  if (file.size <= skipIfSmaller) return file;

  // Choose output format: prefer webp if browser supports it
  const outputType = opts.outputType ?? (canEncodeWebP() ? 'image/webp' : 'image/jpeg');

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate scaled dimensions, preserving aspect ratio
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Canvas.toBlob failed — return original
            return resolve(file);
          }

          // If compressed output is larger than original (rare but possible with PNG→JPEG),
          // return the original file instead
          if (blob.size >= file.size) {
            return resolve(file);
          }

          const ext       = outputType === 'image/webp' ? 'webp' : 'jpg';
          const baseName  = file.name.replace(/\.[^.]+$/, '');
          const newFile   = new File([blob], `${baseName}.${ext}`, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve(newFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If image can't be decoded, return original
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Compress multiple files at once.
 * Non-image files are passed through unchanged.
 */
export async function compressImages(files, opts = {}) {
  return Promise.all(Array.from(files).map(f => compressImage(f, opts)));
}

/**
 * Check if the browser can encode WebP via canvas.toBlob.
 * Result is memoized after first call.
 */
let _canWebP = null;
function canEncodeWebP() {
  if (_canWebP !== null) return _canWebP;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  _canWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  return _canWebP;
}

/**
 * Return a human-readable file size string.
 * e.g. formatFileSize(1536000) → "1.5 MB"
 */
export function formatFileSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
