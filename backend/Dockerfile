# ==========================================
# STAGE 1: Build & Compile TypeScript
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code
COPY tsconfig*.json ./
COPY src ./src

# Generate Prisma Client & compile TypeScript to dist/
RUN npx prisma generate
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Security: Run as unprivileged node user instead of root
USER node

# Copy compiled JavaScript from builder stage
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

COPY --chown=node:node --from=builder /app/dist ./dist

# Expose API port
EXPOSE 4000

# Start Fastify server
CMD ["node", "dist/server.js"]
