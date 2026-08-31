# Study RPG — Local Code Runner
# Sandboxed code execution sidecar: Python + Node.js, no network, CPU/memory capped.
# Built into Docker Compose; no external API keys needed.

FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip bash curl \
    && pip3 install --break-system-packages numpy scipy sympy

WORKDIR /runner

# Minimal Express server that receives code via HTTP and executes it safely
COPY server.js ./

ENV RUNNER_PORT=9000

EXPOSE 9000

USER node

CMD ["node", "server.js"]
