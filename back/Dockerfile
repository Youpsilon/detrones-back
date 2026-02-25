FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache openssl

FROM base AS build
WORKDIR /app

# Copy workspace
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
WORKDIR /app/back
RUN npx prisma generate

# Build shared packages and back
WORKDIR /app
RUN pnpm --filter @president/shared build
RUN pnpm --filter @president/back build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

# Copy the standalone output from Nuxt
COPY --from=build /app/back/.output ./.output

# Copy Prisma engines and schema if needed by Nitro
# COPY --from=build /app/back/node_modules/.prisma ./node_modules/.prisma
# COPY --from=build /app/back/prisma ./prisma

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
