import { z } from 'zod'
import prisma from '../../utils/prisma'
import * as argon2 from 'argon2'
import jwt from 'jsonwebtoken'

const RegisterSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3),
    password: z.string().min(6),
})

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const result = RegisterSchema.safeParse(body)

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: result.error.issues,
        })
    }

    const { email, username, password } = result.data

    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ email }, { username }],
        },
    })

    if (existingUser) {
        throw createError({
            statusCode: 409,
            statusMessage: 'User already exists',
        })
    }

    const hashedPassword = await argon2.hash(password)

    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword,
        },
    })

    // TODO: Move secret to env
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '15m',
    })

    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret', {
        expiresIn: '7d',
    })

    return {
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
        },
        token,
        refreshToken
    }
})
