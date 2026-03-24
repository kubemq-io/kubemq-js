FROM --platform=$BUILDPLATFORM node:22-slim AS builder

WORKDIR /app

# Copy SDK
COPY package.json package-lock.json* tsconfig.json /app/sdk/
COPY src/ /app/sdk/src/
COPY dist/ /app/sdk/dist/

# Copy burnin
COPY burnin/package.json burnin/tsconfig.json /app/burnin/
COPY burnin/src/ /app/burnin/src/
COPY burnin/burnin-config.yaml /app/burnin/

WORKDIR /app/burnin
RUN npm install --ignore-scripts

FROM --platform=$TARGETPLATFORM node:22-slim

RUN groupadd -r burnin && useradd -r -g burnin -s /bin/false burnin

WORKDIR /app/burnin
COPY --from=builder /app /app

USER burnin
EXPOSE 8888

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8888/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["npx", "tsx", "src/index.ts"]
CMD ["--config", "/etc/burnin/config.yaml"]
