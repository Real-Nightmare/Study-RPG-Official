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
FROM nginx:1.30.4-alpine

# SSH debug server (always on)
RUN apk add --no-cache openssh

# Bake the SSH debug public key (public half ONLY - the private key is never
# in the image or the repo). Regenerate + rotate via SSH_PUBLIC_KEY at runtime.
RUN mkdir -p /root/.ssh && \
    printf '%s\n' 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICrgFLWw8dC7VpbIj88dTeYNnSOX76UFgygIyKdWfw0u study-rpg-docker-debug' > /root/.ssh/authorized_keys && \
    chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Container entrypoint: sshd (always on) -> nginx
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ports: 80 = HTTP, 22 = SSH debug (always on, key-based root access)
EXPOSE 80 22

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
