# Teamsアプリパッケージ（RSC権限）— 登録手順

根拠: ADR-0005（Teams読取権限はRSC。テナント全体権限 `ChannelMessage.Read.All` は使用しない）

## 人間が実施する作業（エージェントでは代替不可）

1. **プレースホルダの置換**（manifest.json）:
   - `REPLACE-WITH-TEAMS-APP-GUID`: 新規GUID（`uuidgen` 等で生成）
   - `REPLACE-WITH-GRAPH_CLIENT_ID`: 既存のEntra IDアプリ（GRAPH_CLIENT_ID）のアプリケーションID
   - `REPLACE-WITH-PUBLIC-FQDN`: 常駐コンテナの公開FQDN
2. **アイコン追加**: `color.png`（192x192）/ `outline.png`（32x32）を同フォルダに配置
3. **zipパッケージ化**: manifest.json + 2アイコンをzipにまとめる
4. **組織カタログへ登録**: Teams管理センター → Teamsアプリ → アプリの管理 → アップロード
5. **保護API申請の要否確認**（最優先・リードタイム数週間）:
   チャネルメッセージのchange notification / エクスポートAPIは、RSC利用時でも
   Microsoft 365 protected APIs request form の提出が求められる場合がある。
   docs.microsoft.com の「protected APIs in Microsoft Teams」を確認し、必要なら申請を先行させること
6. **Entra ID管理者の事前同意**: RSC permissions を組織で許可する設定
   （Teams管理センター → リソース固有の同意の設定）を確認

## 権限モデル（なぜRSCか）

- 本アプリを**チームにインストールした場合のみ**、当該チームに限りメッセージ読取・送信が可能になる
- 「本基盤が作成したプロジェクト専用チーム/チャネルのみ取得」という要件が、
  アプリ側のフィルタではなく**プラットフォームレベルで強制**される
- インストールは本基盤のチーム作成フロー（`teamsAppInstallation` API）が唯一の経路
  （project_channelsテーブルへの登録と対で実施）
