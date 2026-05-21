import { z } from 'zod'
import prisma from '../../utils/prisma'
import { getUserFromEvent } from '../../utils/auth'

const UpdateUserSchema = z.object({
    username: z.string().min(3).max(20).optional(),
    avatarUrl: z.string().url().max(500).optional().or(z.literal('')),
})

export default defineEventHandler(async (event) => {
    const { userId } = getUserFromEvent(event)
    const body = await readBody(event)
    const result = UpdateUserSchema.safeParse(body)

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: result.error.issues,
        })
    }

    const { username, avatarUrl } = result.data

    if (username) {
        const existing = await prisma.user.findUnique({ where: { username } })
        if (existing && existing.id !== userId) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Username already taken'
            })
        }
    }

    const updateData: any = {}
    if (username !== undefined) updateData.username = username
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl === '' ? null : avatarUrl

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            username: true,
            email: true,
            mmr: true,
            avatarUrl: true,
        },
    })

    return user
})
