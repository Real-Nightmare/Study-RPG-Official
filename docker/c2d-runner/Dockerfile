# c2d-runner — hardened local compute-to-data environment (Study RPG)
#
# PURPOSE (owner policy): the data marketplace is COMPUTE-TO-DATA ONLY, and
# researchers must be able to test that system in isolation. This image runs
# untrusted algorithms against sanitized aggregate payloads with:
#   - no outbound network (compose attaches it to an `internal: true` network)
#   - read-only root filesystem, tmpfs /tmp
#   - non-root user, dropped capabilities, no-new-privileges
#   - hard memory / CPU / PIDs limits (set in docker-compose.yml)
#
# The SAME container doubles as the Problem Solver code-execution sandbox
# (`POST /execute`), so the environment researchers validate is exactly the
# one shipped. Zero runtime dependencies — Node's stdlib only.
#
# Build:  docker build -t study-rpg/c2d-runner .
# Run:    managed by docker-compose.yml (service `c2d-runner`)

FROM node:24-alpine

# python3 keeps the default research language available; tini reaps zombies
# from killed jobs; su-exec is NOT used (we drop to node via USER below).
RUN apk add --no-cache python3 tini \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Server code only — no npm install step, zero third-party packages.
COPY c2d-runner-server.js /app/c2d-runner-server.js

# Run as the unprivileged `node` user baked into the base image.
USER node

# Jobs execute in child processes spawned from this server; SIGTERM gives a
# short grace period before the wall-clock kill.
ENV RUNNER_PORT=9000 \
    RUNNER_MAX_OUTPUT_BYTES=1000000 \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

EXPOSE 9000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/app/c2d-runner-server.js"]
