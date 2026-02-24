export default defineEventHandler((event) => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
    }
})
