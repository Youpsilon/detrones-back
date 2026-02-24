import jwt from 'jsonwebtoken'

export const getUserFromEvent = (event: any) => {
    const authHeader = getRequestHeader(event, 'Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const token = authHeader.split(' ')[1]
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
        return decoded
    } catch (error) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid token',
        })
    }
}
