export default defineEventHandler(async (event) => {
    const user = getUserFromEvent(event)
    const body = await readBody(event)

    if (!body.friendId) {
        throw createError({ statusCode: 400, statusMessage: 'friendId is required' })
    }

    try {
        await prisma.friend.deleteMany({
            where: {
                userId: user.userId,
                friendId: body.friendId
            }
        })
        return { success: true }
    } catch (e) {
        throw createError({ statusCode: 400, statusMessage: 'Failed to remove friend' })
    }
})
