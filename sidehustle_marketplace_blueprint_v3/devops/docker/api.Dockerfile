# TEMPLATE for a standalone NestJS package in apps/api with package-lock.json,
# `npm run build`, and runtime entrypoint dist/main.js. Adapt to the real repo.
# Use a reviewed/pinned base image digest in CI/production builds.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build
# Keep runtime dependencies only. If build/runtime workspace layout differs,
# use the package manager's production deployment/pruning mechanism instead.
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOME=/tmp \
    TMPDIR=/tmp
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
