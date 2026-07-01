import { storage } from '../firebase/config'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

const MAX_SIZE_BYTES = 400 * 1024   // 400 KB target after compression
const MAX_DIMENSION = 1400          // max width or height in pixels

/**
 * Compress an image File to under MAX_SIZE_BYTES using Canvas.
 * Returns a Blob ready for upload.
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      // Scale down if dimensions are too large
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // Try JPEG compression at decreasing quality until under MAX_SIZE_BYTES
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(
          blob => {
            if (!blob) { reject(new Error('Canvas toBlob failed')); return }
            if (blob.size <= MAX_SIZE_BYTES || quality <= 0.3) {
              resolve(blob)
            } else {
              quality -= 0.1
              tryCompress()
            }
          },
          'image/jpeg',
          quality
        )
      }
      tryCompress()
    }
    img.onerror = reject
    img.src = url
  })
}

/**
 * Upload a File to Firebase Storage under the given folder.
 * Compresses the image first, then streams upload with progress.
 *
 * @param {File} file - original file
 * @param {string} folder - e.g. 'news' | 'gallery'
 * @param {(pct: number) => void} onProgress - callback 0-100
 * @returns {Promise<string>} download URL
 */
export async function uploadImage(file, folder = 'images', onProgress) {
  // Compress
  const blob = await compressImage(file)
  const ext = 'jpg'
  const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const storageRef = ref(storage, name)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' })
    task.on(
      'state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        onProgress?.(pct)
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}
