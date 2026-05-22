export default defineEventHandler(async (event) => {
    const user = getUserFromEvent(event)

    const friends = await prisma.friend.findMany({
        where: { userId: user.userId },
        include: {
            friend: {
                select: {
                    id: true,
                    username: true,
                    mmr: true
                }
            }
        }
    })

    return friends.map(f => f.friend)
})
