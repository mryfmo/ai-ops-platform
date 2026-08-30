# packages/server/Dockerfile
#
# 根拠: ADR-0003（DevOps常駐コンテナ）/ ADR-0005（Hono:8080公開 + Next.js standalone:3100内部の
#   2プロセスを単一コンテナで稼働。公開エンドポイントを1つに保つ）。
#   ビルドコンテキストはリポジトリルート: docker build -f packages/server/Dockerfile .

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter '@aiops/composition...' run build
RUN pnpm --filter @aiops/web run build
RUN pnpm --filter @aiops/composition deploy --prod --legacy /out/composition
# deploy の workspace symlink は依存解決に使い、各 package の実行不要ファイルだけを落とす
RUN for package in shared policy integrations prjops devops control-plane server; do \
      test -f "/out/composition/node_modules/@aiops/$package/package.json"; \
      test -d "/out/composition/node_modules/@aiops/$package/dist"; \
      rm -rf "/out/composition/node_modules/@aiops/$package/src" \
        "/out/composition/node_modules/@aiops/$package/tests" \
        "/out/composition/node_modules/@aiops/$package/scripts" \
        "/out/composition/node_modules/@aiops/$package/coverage"; \
    done
RUN ! find -L /out/composition/node_modules -path '*/@aiops/*' -type d \( -name src -o -name tests \) -print -quit | grep -q .
RUN ! find /out/composition/node_modules/.pnpm -mindepth 1 -maxdepth 1 -type d \
      \( -name 'vitest@*' -o -name 'typescript@*' -o -name 'tsx@*' \) -print -quit | grep -q .
# server が読む休日マスタは source tree 外へ移し、deployed package の相対パスだけを合わせる
RUN mkdir -p /out/composition/node_modules/@aiops/shared/calendar \
    && cp packages/shared/src/calendar/jp_holidays.yaml /out/composition/node_modules/@aiops/shared/calendar/ \
    && sed -i 's#../../shared/src/calendar/#../../shared/calendar/#' \
      /out/composition/node_modules/@aiops/server/dist/index.js \
    && ! grep -q '../../shared/src/' /out/composition/node_modules/@aiops/server/dist/index.js

# ---- runtime stage ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Hono composition entry（ビルド成果物 + server/control-plane/Temporal 本番依存）
COPY --from=build --chown=node:node /repo/packages/composition/package.json ./packages/composition/package.json
COPY --from=build --chown=node:node /repo/packages/composition/dist ./packages/composition/dist
COPY --from=build --chown=node:node /out/composition/node_modules ./packages/composition/node_modules

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
