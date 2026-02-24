export default defineEventHandler((event) => {
    // In a stateless JWT setup, logout is mostly client-side (clearing tokens).
    // If we had a blacklist or DB session, we would invalidate it here.
    return {
        statusCode: 204,
        statusMessage: 'Logged out',
    }
})
