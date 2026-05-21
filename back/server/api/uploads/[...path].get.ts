import { createReadStream, existsSync, statSync } from 'fs'
import { join, resolve, normalize } from 'path'
import { sendStream } from 'h3'

const MIME_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
}

export default defineEventHandler(async (event) => {
    const pathParam = getRouterParam(event, 'path') || ''

    // Security: resolve and verify the path stays within uploads/
    const uploadsRoot = resolve(process.cwd(), 'uploads')
    const filePath = resolve(uploadsRoot, normalize(pathParam))

    if (!filePath.startsWith(uploadsRoot)) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }

    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

    return sendStream(event, createReadStream(filePath))
})
