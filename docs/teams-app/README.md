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
7. **対象チームへ手動インストールして同意**: `ChannelMessage.Send.Group` は manifest に含まれる
   team-scoped RSC 権限だが、インストールと同意だけでapp-only通常送信の成功は確認できない。
   Teams app installation自動化は未実装であり、このリポジトリ作業でもインストールや同意操作は実施していない。

## 権限モデル（なぜRSCか）

- RSCによりアクセス対象を**本アプリをインストールしたチーム**へ限定する。app-only通常送信の可否は後述のとおり未確認
- manifestは実装で使うapplication RSCだけを宣言する:
  - `ChannelMessage.Read.Group`: change notification後のメッセージ取得とpolling/backfill
  - `ChannelMessage.Send.Group`: `GraphClient.sendAdaptiveCard`によるreport delivery/AGT-CHG/AGT-INC/AGT-DEPの通常root投稿と、`GraphClient.replyToMessage`による会話返信
- チャネル送信の実装は Graph v1.0 のroot投稿 `POST /teams/{team-id}/channels/{channel-id}/messages` と返信 `POST /teams/{team-id}/channels/{channel-id}/messages/{message-id}/replies` を使用する
- 「本基盤が作成したプロジェクト専用チーム/チャネルのみ取得」という要件が、
  アプリ側のフィルタではなく**プラットフォームレベルで強制**される
- `teamsAppInstallation` APIによる自動インストールは将来要件で、現時点の本基盤には存在しない。
  導入時は人間が対象チームへのインストール・同意とproject_channels登録を行う

## app-only通常投稿の未解決な公式資料競合

2026-07-11確認時点で、Microsoft公式資料同士のapplication permission表記が一致していない。

- [Teams RSC permission reference](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent) はapplication RSCとして `ChannelMessage.Read.Group` と `ChannelMessage.Send.Group` を列挙する。
- [channel post method](https://learn.microsoft.com/en-us/graph/api/channel-post-messages?view=graph-rest-1.0) と [reply method](https://learn.microsoft.com/en-us/graph/api/chatmessage-post-replies?view=graph-rest-1.0) のapplication欄は、migration-onlyの `Teamwork.Migrate.All` だけを掲載する。

したがって、app-onlyの通常root投稿・返信は適合済みと扱わず、通常送信の成功も断言しない。
installed sandbox teamでroot/replyが `201 Created`、同アプリ未導入teamで拒否（例: `403 Forbidden`）となるredacted evidence、またはMicrosoft supportの回答を得るまで未確認とする。`Teamwork.Migrate.All`、tenant-wide権限、未使用RSCをこの不一致の回避策として追加しない。

## manifest検証の境界

現行テストが確認するのは、manifestのJSON parse、`$schema` URLと`manifestVersion`の固定、application RSC 2件の完全一致、および文書化した実装用途である。これはMicrosoft Teams schema本体による実schema validationではない。

manifestにはGUID、client ID、FQDN、アイコンのdeployment placeholderが残るため、置換・パッケージ化した成果物の実schema validationはPlan008へ繰り延べる。T06のローカルテスト結果を、配置可能なTeams app packageのschema適合証明として扱わない。
