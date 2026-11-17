import type { PhotoFiles } from './model'

export type Crop = { left: number; top: number; right: number; bottom: number }
export const noCrop: Crop = { left: 0, top: 0, right: 0, bottom: 0 }
export type ProcessedPhoto = PhotoFiles & {
  width: number
  height: number
  mime: 'image/webp' | 'image/jpeg'
}

export function cropBounds(width: number, height: number, crop: Crop) {
  if (
    !Object.values(crop).every((n) => Number.isFinite(n) && n >= 0 && n <= 45)
  )
    throw new Error('Il ritaglio non è valido.')
  return {
    x: Math.floor((width * crop.left) / 100),
    y: Math.floor((height * crop.top) / 100),
    width: Math.max(
      1,
      Math.floor((width * (100 - crop.left - crop.right)) / 100),
    ),
    height: Math.max(
      1,
      Math.floor((height * (100 - crop.top - crop.bottom)) / 100),
    ),
  }
}
export function scaledSize(width: number, height: number, maximum: number) {
  const scale = Math.min(1, maximum / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function decodePhoto(file: File): Promise<HTMLImageElement> {
  if (!file.size || file.size > 30_000_000)
    throw new Error('Scegli una foto non vuota, fino a 30 MB.')
  if (
    !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) &&
    !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)
  )
    throw new Error('Scegli una foto JPEG, PNG, WebP o HEIC.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () =>
        reject(
          new Error(
            'Non riesco ad aprire questa foto. Per un file HEIC prova Safari aggiornato oppure scegli una copia JPEG.',
          ),
        )
      img.src = url
    })
    if (
      !img.naturalWidth ||
      !img.naturalHeight ||
      img.naturalWidth * img.naturalHeight > 50_000_000
    )
      throw new Error(
        'La foto è troppo grande da elaborare sul telefono. Scegline una fino a 50 megapixel.',
      )
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encode(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error(
                'Non riesco a preparare la foto. Prova una dimensione più leggera.',
              ),
            ),
      mime,
      quality,
    ),
  )
}

export async function processPhoto(
  source: HTMLImageElement,
  rotation: number,
  crop: Crop,
  maximum: 1280 | 1600,
): Promise<ProcessedPhoto> {
  // Work at a bounded resolution, even with 48 MP iPhone originals.
  const rotated = document.createElement('canvas')
  const output = document.createElement('canvas')
  const thumbnail = document.createElement('canvas')
  try {
    const size = scaledSize(source.naturalWidth, source.naturalHeight, 2000)
    const quarterTurn = rotation % 180 !== 0
    rotated.width = quarterTurn ? size.height : size.width
    rotated.height = quarterTurn ? size.width : size.height
    const ctx = rotated.getContext('2d')
    if (!ctx)
      throw new Error(
        'L’elaborazione delle foto non è disponibile in questo browser.',
      )
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rotated.width, rotated.height)
    ctx.translate(rotated.width / 2, rotated.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(
      source,
      -size.width / 2,
      -size.height / 2,
      size.width,
      size.height,
    )
    const bounds = cropBounds(rotated.width, rotated.height, crop)
    const draw = (canvas: HTMLCanvasElement, edge: number) => {
      const size = scaledSize(bounds.width, bounds.height, edge)
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')!
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        rotated,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        size.width,
        size.height,
      )
    }
    draw(output, maximum)
    let photo = await encode(output, 'image/webp', 0.82)
    // Safari may support WebP decoding but fall back to PNG when encoding.
    const mime = photo.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    if (photo.type !== mime) photo = await encode(output, mime, 0.82)
    for (const quality of [0.74, 0.65, 0.56]) {
      if (photo.size <= 400_000) break
      photo = await encode(output, mime, quality)
    }
    if (photo.size > 1_000_000 || photo.type !== mime)
      throw new Error(
        'La foto resta troppo pesante. Prova la dimensione Leggera o ritagliala.',
      )
    draw(thumbnail, 400)
    let thumb = await encode(thumbnail, mime, 0.72)
    if (thumb.size > 40_000) thumb = await encode(thumbnail, mime, 0.5)
    if (thumb.size > 100_000 || thumb.type !== mime)
      throw new Error(
        'Non riesco a preparare la miniatura. Prova un’altra foto.',
      )
    return {
      photo,
      thumbnail: thumb,
      width: output.width,
      height: output.height,
      mime,
    }
  } finally {
    rotated.width =
      rotated.height =
      output.width =
      output.height =
      thumbnail.width =
      thumbnail.height =
        0
  }
}
