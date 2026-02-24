import { z } from 'zod'
import jwt from 'jsonwebtoken'
import prisma from '../../utils/prisma'

const RefreshSchema = z.object({
    refreshToken: z.string(),
})

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const result = RefreshSchema.safeParse(body)

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
        })
    }

    const { refreshToken } = result.data

    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as { userId: string }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId }
        })

        if (!user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'User not found'
            })
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '15m',
        })

        return {
            token,
        }
    } catch (error) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid refresh token',
        })
    }
})
