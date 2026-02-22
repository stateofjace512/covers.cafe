/**
 * Perceptual hashing (average hash) for duplicate image detection.
 * Produces a 16-character hex string (64 bits).
 */
export async function computePhash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const SIZE = 8;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        URL.revokeObjectURL(url);

        // Convert to grayscale
        const gray: number[] = [];
        for (let i = 0; i < SIZE * SIZE; i++) {
          gray.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
        }

        // Average
        const avg = gray.reduce((a, b) => a + b, 0) / gray.length;

        // Bits: 1 if above average, 0 if not
        const bits = gray.map((v) => (v >= avg ? '1' : '0')).join('');

        // Convert bits to hex
        let hex = '';
        for (let i = 0; i < bits.length; i += 4) {
          hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
        }
        resolve(hex);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/** Hamming distance between two hex hashes (lower = more similar). */
export function hammingDistance(h1: string, h2: string): number {
  let dist = 0;
  for (let i = 0; i < Math.min(h1.length, h2.length); i++) {
    const b1 = parseInt(h1[i], 16).toString(2).padStart(4, '0');
    const b2 = parseInt(h2[i], 16).toString(2).padStart(4, '0');
    for (let j = 0; j < 4; j++) {
      if (b1[j] !== b2[j]) dist++;
    }
  }
  return dist;
}

/**
 * Check if a phash already exists in the DB (exact match).
 * Near-duplicate detection (hamming < 5) requires fetching all hashes client-side,
 * so we do an exact match here and accept occasional misses on very similar images.
 */
export async function isDuplicate(phash: string, supabase: import('@supabase/supabase-js').SupabaseClient): Promise<boolean> {
  if (!phash) return false;
  const { data } = await supabase
    .from('covers_cafe_covers')
    .select('id')
    .eq('phash', phash)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
