/**
 * packages/web/src/components/views/ExecutiveSevenKeysView.tsx
 *
 * 根拠: REQ-038 / SPEC-INT-065 / AC-038-1 / ADR-0010。
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

export interface ExecutiveSevenKeysData {
  projects: ExecutiveSevenKeysProject[];
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

function ragBadge(rag: SevenKeysRag) {
  const variant: BadgeVariant = rag === "grey" ? "default" : rag;
  return <Badge variant={variant}>{RAG_LABEL[rag]}</Badge>;
}

export function ExecutiveSevenKeysView({ data }: ExecutiveSevenKeysViewProps) {
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
            <span className="text-xs text-gray-500">{key.basis}</span>
          </span>
        ) : (
          "-"
        );
      },
    })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経営ダッシュボード（Seven Keys）</h1>
      <Card title="Seven Keys RAGマトリクス">
        <DataTable columns={columns} rows={data.projects} rowKey={(row) => row.projectId} />
      </Card>
    </div>
  );
}
