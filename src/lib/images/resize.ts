// Shrinks photos in the browser before upload. A 12-megapixel phone photo
// is ~4 MB; at 2000 px on the long side it's ~400 KB and still easy to read.

export const MAX_SIDE = 2000;

/** The size that fits inside max × max, keeping the shape. Never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Browser only. Returns a JPEG, rotated the right way up. */
export async function shrinkImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("This browser can't open that image. Try a JPG or PNG photo.");
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the photo.'))), 'image/jpeg', 0.85),
  );
}
