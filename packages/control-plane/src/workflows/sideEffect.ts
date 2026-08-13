// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// 非冪等外部書き込みの single-attempt + reconcile 契約（正典 component spec 01
// Acceptance「Activity timeout後に同一外部objectを二重作成しない」= TMP-003）。
// 実 I/O は持たず、注入された activity stub を決定的な制御フローで束ねるのみ。

/** 外部副作用 1 回分のポート。workflow からは proxyActivities の stub を渡す。 */
export interface ExternalSideEffectPorts<TInput, TResult> {
  /** 非冪等な外部書き込み。retry class は external-side-effect（single-attempt）であること。 */
  execute(input: TInput, idempotencyKey: string): Promise<TResult>;
  /** idempotency key で外部状態を照会する冪等 read。存在しなければ null。 */
  reconcile(idempotencyKey: string): Promise<TResult | null>;
}

export type ExternalSideEffectOutcome<TResult> =
  | { readonly outcome: "executed"; readonly result: TResult }
  | { readonly outcome: "reconciled"; readonly result: TResult };

/** execute の応答が失われ、reconcile でも外部 object を確認できなかった状態。 */
export class ExternalSideEffectUnresolvedError extends Error {
  override readonly name = "ExternalSideEffectUnresolvedError";
  constructor(
    readonly idempotencyKey: string,
    override readonly cause: unknown,
  ) {
    super(
      `external side effect unresolved for key ${JSON.stringify(idempotencyKey)}; manual/ledger reconcile required`,
    );
  }
}

/**
 * 非冪等外部書き込みを「1 回だけ実行し、失敗（応答喪失を含む）時は再実行ではなく
 * reconcile で外部状態を確認する」契約で走らせる。
 * - execute 成功 → executed
 * - execute 失敗 + reconcile が object を確認 → reconciled（二重作成しない）
 * - execute 失敗 + reconcile でも不在 → ExternalSideEffectUnresolvedError
 *   （盲目的な再実行はしない。復旧は上位の reconcile 手順が行う）
 */
export async function runExternalSideEffect<TInput, TResult>(
  ports: ExternalSideEffectPorts<TInput, TResult>,
  input: TInput,
  idempotencyKey: string,
): Promise<ExternalSideEffectOutcome<TResult>> {
  try {
    return { outcome: "executed", result: await ports.execute(input, idempotencyKey) };
  } catch (executeError) {
    const found = await ports.reconcile(idempotencyKey);
    if (found !== null) {
      return { outcome: "reconciled", result: found };
    }
    throw new ExternalSideEffectUnresolvedError(idempotencyKey, executeError);
  }
}
