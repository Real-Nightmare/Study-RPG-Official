FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# SSH debug server (always on)
RUN apk add --no-cache openssh

# Bake the SSH debug public key (public half ONLY - the private key is never
# in the image or the repo). Regenerate + rotate via SSH_PUBLIC_KEY at runtime.
RUN mkdir -p /root/.ssh && \
    printf '%s\n' 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICrgFLWw8dC7VpbIj88dTeYNnSOX76UFgygIyKdWfw0u studyield-docker-debug' > /root/.ssh/authorized_keys && \
    chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys

# Container entrypoint: sshd (always on) -> migrations -> app start
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ports: 3010 = HTTP API, 22 = SSH debug (always on, key-based root access)
EXPOSE 3010 22

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
