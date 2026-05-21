export default defineEventHandler(async (event) => {
    const user = getUserFromEvent(event)
    const body = await readBody(event)

    if (!body.friendId) {
        throw createError({ statusCode: 400, statusMessage: 'friendId is required' })
    }

    if (user.userId === body.friendId) {
        throw createError({ statusCode: 400, statusMessage: 'Cannot add yourself' })
    }

    try {
        const friend = await prisma.friend.create({
            data: {
                userId: user.userId,
                friendId: body.friendId
            }
        })
        return { success: true, friend }
    } catch (e) {
        throw createError({ statusCode: 400, statusMessage: 'Already friends or invalid ID' })
    }
})
