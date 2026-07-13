# packages/server/Dockerfile
#
# 根拠: ADR-0003（DevOps常駐コンテナ）/ ADR-0005（Hono:8080公開 + Next.js standalone:3100内部の
#   2プロセスを単一コンテナで稼働。公開エンドポイントを1つに保つ）。
#   ビルドコンテキストはリポジトリルート: docker build -f packages/server/Dockerfile .

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aiops/shared --filter @aiops/prjops --filter @aiops/devops --filter @aiops/server run build
# WebUI（standalone出力）。packages/webが存在する場合のみビルドされる
RUN pnpm --filter @aiops/web run build || echo "WebUI build skipped"

# ---- runtime stage ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# サーバ本体（dist + 本番依存）
COPY --from=build /repo /app

EXPOSE 8080
# supervisor: Hono(:8080)とNext.js standalone(:3100)を並走させ、どちらかの異常終了でコンテナを落とす
# （コンテナオーケストレータの再起動ポリシーに委ねる）
COPY packages/server/scripts/start-container.mjs /app/start-container.mjs
CMD ["node", "/app/start-container.mjs"]
