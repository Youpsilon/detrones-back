FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache openssl libc6-compat python3 alpine-sdk g++ make

FROM base AS build
WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy packages package.json files to allow pnpm to resolve structure
COPY packages/shared/package.json ./packages/shared/
COPY game-server/package.json ./game-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the code
COPY . .

# Build shared package
RUN pnpm --filter @president/shared build

# Build game-server
RUN pnpm --filter @president/game-server build

# Deploy only the game-server package
RUN pnpm --filter @president/game-server --prod deploy /app/pruned

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=build /app/pruned ./

ENV NODE_ENV=production
EXPOSE 2567

CMD ["node", "dist/index.js"]
