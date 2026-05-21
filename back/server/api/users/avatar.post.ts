import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import prisma from '../../utils/prisma'
import { getUserFromEvent } from '../../utils/auth'

const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
}
const MAX_SIZE_BYTES = 3 * 1024 * 1024 // 3 MB

export default defineEventHandler(async (event) => {
    const { userId } = getUserFromEvent(event)

    const formData = await readMultipartFormData(event)
    const file = formData?.find(f => f.name === 'avatar')

    if (!file || !file.data || file.data.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'No file provided' })
    }

    const mimeType = file.type || ''
    const ext = ALLOWED_TYPES[mimeType]
    if (!ext) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' })
    }

    if (file.data.length > MAX_SIZE_BYTES) {
        throw createError({ statusCode: 400, statusMessage: 'File too large (max 3 MB)' })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = resolve(process.cwd(), 'uploads', 'avatars')
    await mkdir(uploadsDir, { recursive: true })

    // Delete old avatar if it was a local upload
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
    if (currentUser?.avatarUrl?.startsWith('/api/uploads/')) {
        const oldPath = resolve(process.cwd(), 'uploads', currentUser.avatarUrl.replace('/api/uploads/', ''))
        if (existsSync(oldPath)) {
            await unlink(oldPath).catch(() => {}) // Best effort
        }
    }

    // Save new file
    const filename = `${userId}-${randomUUID()}.${ext}`
    const filePath = join(uploadsDir, filename)
    await writeFile(filePath, file.data)

    // Store relative URL in DB
    const avatarUrl = `/api/uploads/avatars/${filename}`

    await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
    })

    return { avatarUrl }
})
