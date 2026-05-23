import prisma from '../utils/prisma'

export default defineEventHandler(async (event) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            mmr: true,
            avatarUrl: true,
        },
        orderBy: {
            mmr: 'desc',
        },
        take: 50,
    })

    return users
})
