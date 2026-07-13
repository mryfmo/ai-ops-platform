# packages/server/Dockerfile
#
# 根拠: ADR-0003（DevOps常駐コンテナ）/ ADR-0005（Hono:8080公開 + Next.js standalone:3100内部の
#   2プロセスを単一コンテナで稼働。公開エンドポイントを1つに保つ）。
#   ビルドコンテキストはリポジトリルート: docker build -f packages/server/Dockerfile .

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aiops/shared --filter @aiops/prjops --filter @aiops/devops --filter @aiops/server run build
RUN pnpm --filter @aiops/web run build
RUN pnpm --filter @aiops/server deploy --prod --legacy /out/server
# deploy は workspace パッケージのソースも含めるため、実行用パッケージを作り直す
RUN rm -rf /out/server/node_modules/@aiops \
    && for package in shared prjops devops; do \
      mkdir -p "/out/server/node_modules/@aiops/$package"; \
      cp "packages/$package/package.json" "/out/server/node_modules/@aiops/$package/"; \
      cp -R "packages/$package/dist" "/out/server/node_modules/@aiops/$package/"; \
    done \
    && find /out/server/node_modules/.pnpm -mindepth 1 -maxdepth 1 -type d -name '@aiops+*' -exec rm -rf {} +
RUN ! find -L /out/server/node_modules -path '*/@aiops/*' -type d \( -name src -o -name tests \) -print -quit | grep -q .
RUN ! find /out/server/node_modules/.pnpm -mindepth 1 -maxdepth 1 -type d \
      \( -name 'vitest@*' -o -name 'typescript@*' -o -name 'tsx@*' \) -print -quit | grep -q .
# server が読む休日マスタは source tree 外へ移し、生成済み JS の相対パスだけを合わせる
RUN mkdir -p /out/runtime-shared/calendar \
    && cp packages/shared/src/calendar/jp_holidays.yaml /out/runtime-shared/calendar/ \
    && sed -i 's#../../shared/src/calendar/#../../shared/calendar/#' packages/server/dist/index.js \
    && ! grep -q '../../shared/src/' packages/server/dist/index.js

# ---- runtime stage ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Hono（ビルド成果物 + 本番依存）
COPY --from=build --chown=node:node /repo/packages/server/package.json ./packages/server/package.json
COPY --from=build --chown=node:node /repo/packages/server/dist ./packages/server/dist
COPY --from=build --chown=node:node /out/server/node_modules ./packages/server/node_modules
COPY --from=build --chown=node:node /out/runtime-shared ./packages/shared

# Next.js standalone（単一コンテナ内の兄弟プロセス）
COPY --from=build --chown=node:node /repo/packages/web/.next/standalone ./packages/web/.next/standalone
COPY --from=build --chown=node:node /repo/packages/web/.next/static ./packages/web/.next/standalone/packages/web/.next/static

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# supervisor: Hono(:8080)とNext.js standalone(:3100)を並走させ、どちらかの異常終了でコンテナを落とす
# （コンテナオーケストレータの再起動ポリシーに委ねる）
COPY --chown=node:node packages/server/scripts/start-container.mjs /app/start-container.mjs
USER node
CMD ["node", "/app/start-container.mjs"]
