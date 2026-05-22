FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache openssl

FROM base AS build
WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy packages package.json files to allow pnpm to resolve structure
COPY packages/shared/package.json ./packages/shared/
COPY back/package.json ./back/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

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

# Create uploads directory (will be overridden by Docker volume in prod)
RUN mkdir -p /app/uploads/avatars

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

VOLUME ["/app/uploads"]

CMD ["node", ".output/server/index.mjs"]
