/**
 * packages/web/src/components/views/ExecutiveSevenKeysView.tsx
 *
 * 根拠: REQ-038 / SPEC-INT-065 / AC-038-1 / ADR-0010 / AC-010-3。
 * Seven Keys正典のプロジェクト x キーRAGマトリクスを表示する。
 */
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Card } from "../ui/Card";
import { DataTable, type DataTableColumn } from "../ui/DataTable";

export type SevenKeysRag = "green" | "yellow" | "red" | "grey";

export interface ExecutiveSevenKeyAssessment {
  keyId: string;
  title: string;
  rag: SevenKeysRag;
  basis: string;
}

export interface ExecutiveSevenKeysProject {
  projectId: string;
  name: string;
  keys: ExecutiveSevenKeyAssessment[];
}

export interface ExecutiveSevenKeysMonthlySnapshot extends ExecutiveSevenKeysProject {
  month: string;
  improvedKeys: string[];
  worsenedKeys: string[];
}

export interface ExecutiveSevenKeysData {
  projects: ExecutiveSevenKeysProject[];
  monthlySnapshots?: ExecutiveSevenKeysMonthlySnapshot[];
}

export interface ExecutiveSevenKeysViewProps {
  data: ExecutiveSevenKeysData;
}

const RAG_LABEL: Record<SevenKeysRag, string> = {
  green: "順調",
  yellow: "注意",
  red: "危険",
  grey: "未評価",
};

const RAG_SHAPE: Record<SevenKeysRag, string> = {
  green: "●",
  yellow: "▲",
  red: "■",
  grey: "◇",
};

function ragBadge(rag: SevenKeysRag) {
  const variant: BadgeVariant = rag === "grey" ? "grey" : rag;
  return (
    <Badge variant={variant}>
      <span aria-hidden="true" className="mr-1">
        {RAG_SHAPE[rag]}
      </span>
      {RAG_LABEL[rag]}
    </Badge>
  );
}

export function ExecutiveSevenKeysView({ data }: ExecutiveSevenKeysViewProps) {
  const latestMonth = data.monthlySnapshots
    ?.map((snapshot) => snapshot.month)
    .sort()
    .at(-1);
  const latestSnapshots = latestMonth
    ? data.monthlySnapshots?.filter((snapshot) => snapshot.month === latestMonth)
    : [];
  const columns: DataTableColumn<ExecutiveSevenKeysProject>[] = [
    { key: "project", header: "プロジェクト", render: (row) => `${row.projectId} ${row.name}` },
    ...(["K1", "K2", "K3", "K4", "K5", "K6", "K7"] as const).map((keyId) => ({
      key: keyId,
      header: keyId,
      render: (row: ExecutiveSevenKeysProject) => {
        const key = row.keys.find((item) => item.keyId === keyId);
        return key ? (
          <span className="inline-flex items-center gap-2">
            {ragBadge(key.rag)}
            <details className="text-xs text-dashboard-muted">
              <summary className="cursor-pointer">根拠</summary>
              <span>{key.basis}</span>
            </details>
          </span>
        ) : (
          "-"
        );
      },
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-dashboard-muted">Executive</p>
        <h1 className="text-2xl font-bold tracking-normal text-dashboard-ink">経営ダッシュボード（Seven Keys）</h1>
      </div>
      <Card title="Seven Keys RAGマトリクス" eyebrow="Portfolio health">
        <DataTable columns={columns} rows={data.projects} rowKey={(row) => row.projectId} />
      </Card>
      {latestSnapshots && latestSnapshots.length > 0 ? (
        <Card title="前月比" eyebrow={latestMonth}>
          <div className="grid gap-3 md:grid-cols-2">
            {latestSnapshots.map((snapshot) => (
              <div key={snapshot.projectId} className="rounded-md border border-dashboard-border p-3">
                <p className="text-sm font-semibold text-dashboard-ink">
                  {snapshot.projectId} {snapshot.name}
                </p>
                <p className="mt-2 text-sm text-dashboard-muted">
                  改善 {snapshot.improvedKeys.length}件 / 悪化 {snapshot.worsenedKeys.length}件
                </p>
                {snapshot.worsenedKeys.length > 0 ? (
                  <p className="mt-1 text-xs text-status-red">悪化: {snapshot.worsenedKeys.join(", ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
