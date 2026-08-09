# 製品要求仕様

## PRD-001 統合運用

本基盤は、PrjOps、DevOps、AIOps、会議・知識、AI開発を、System of Recordの責務を維持したまま一つの操作・監査モデルで扱う。

## PRD-002 人間判断・AI実行

AIは分析、提案、下書き、branch/PR作成までを実行できる。正式発行、merge、production deploy、権限変更、削除は定義済みの人間承認を必須とする。

## PRD-003 交換可能性

LLM provider、MCP server、AI coding agent、Teams adapter、Web UIはControl APIとversioned contractを介し、業務workflowと正本を直接依存させない。

## PRD-004 根拠一貫性

経営層、管理者、開発者、運用者は異なる画面・粒度を使っても、同じcanonical ID、commit、version、source URL、policy stateへ到達できる。

## PRD-005 監査可能性

全外部読取・書込、LLM、tool、approval、workflow、AI PRは、主体、根拠、対象、policy version、source references、結果を相関可能にする。

## PRD-006 会議から実行まで

Wispr/Teams/Outlookの会議を、決定、action、risk、unresolved questionへ構造化し、人間確認後にPlane、GitHub、Confluence、SharePointへ責務別に発行する。

## PRD-007 安全なM365活用

Work IQによりユーザー権限を維持してM365情報を検索・推論し、Graphによりイベント・background処理・formal writeを決定論的に行う。M365データの外部LLM送信はpolicyで最小化・制限する。

## PRD-008 安全なAI開発

Claude CodeとDroidは隔離Runnerで実行し、1 Writer、path scope、branch、PR、CI、人間reviewを強制する。モデルはLiteLLMの論理aliasを利用する。

## PRD-009 AIOps

OTelとdeployment/PR/incident情報を相関し、AIは原因分析と修正PR作成を支援する。本番直接変更はしない。

## PRD-010 段階移行

現行14エージェントと既存運用を維持しながら、dual-run、shadow、canary、feature flag、rollbackを通じて移行する。
