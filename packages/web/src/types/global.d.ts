/**
 * packages/web/src/types/global.d.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）
 * next-env.d.ts（gitignore対象・next build時に自動生成）が存在しない状態でも
 * `tsc --noEmit` の型チェックが通るよう、CSS副作用importの型を宣言する。
 */
declare module "*.css";
