/**
 * packages/web/src/components/chat/ChatPanel.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。
 *   @ai-sdk/react の useChat を使った、ページエージェントUI。
 *   数値はこのコンポーネントでは一切生成・表示しない（本文テキストはLLMの説明文のみを
 *   そのまま表示する。CLAUDE.md設計原則2）。
 *
 *   tool呼び出し結果（ViewSpec）を受け取ったら onViewSpecReceived を呼び出すのみで、
 *   実データの取得・表示切替は行わない（呼び出し元のDashboardClientの責務）。
 *
 * basePath: next.config.mjs の basePath "/app" 配下で配信されるため、fetch先は
 * apiPath prop で明示的に指定できるようにする（既定値 "/app/api/chat"）。
 */
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { safeParseViewSpec, type ViewSpec } from "../../server/viewSpec";

const KNOWN_VIEW_TOOL_NAMES = [
  "showExecutiveSummary",
  "showManagerSummary",
  "showAgentActivity",
  "showInvestorSummary",
  "listProjects",
  "show_timeseries",
  "show_project_board",
  "show_seven_keys",
  "show_dora",
  "show_investor_kpis",
  "show_burndown",
  "show_projects_table",
] as const;
type ViewToolName = (typeof KNOWN_VIEW_TOOL_NAMES)[number];

function isViewToolName(name: string): name is ViewToolName {
  return (KNOWN_VIEW_TOOL_NAMES as readonly string[]).includes(name);
}

/** tool呼び出し名からViewSpecへ変換する（execute側の戻り値をそのままViewSpecとして採用する）。 */
function toViewSpec(_toolName: ViewToolName, output: unknown): ViewSpec | null {
  const parsed = safeParseViewSpec(output);
  return parsed.success ? parsed.data : null;
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function viewLabel(spec: ViewSpec): string {
  if (spec.kind === "executiveSummary") return "Seven Keys";
  if (spec.kind === "managerSummary") return "Manager summary";
  if (spec.kind === "investorSummary") return "Investor KPIs";
  if (spec.kind === "agentActivity") return "Agent activity";
  if (spec.kind === "timeseries") return "Timeseries";
  if (spec.kind === "projectBoard") return "Project board";
  return "Projects";
}

type ToolPartLike = {
  type: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  output?: unknown;
  errorText?: string;
};

function ToolPartView({
  part,
  onViewSpecReceived,
}: {
  part: ToolPartLike;
  onViewSpecReceived: (spec: ViewSpec) => void;
}) {
  const toolName = part.type.slice("tool-".length);
  if (!isViewToolName(toolName)) return null;
  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="rounded-md border border-dashboard-border bg-dashboard-panel p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-16 w-full" />
      </div>
    );
  }
  if (part.state === "output-error") {
    return (
      <div className="rounded-md border border-status-red p-3 text-sm text-status-red">
        {part.errorText ?? "表示を生成できませんでした"}
      </div>
    );
  }
  if (part.state !== "output-available") return null;
  const spec = toViewSpec(toolName, part.output);
  if (!spec) return null;
  return (
    <div className="rounded-md border border-dashboard-border bg-dashboard-panel p-3 text-sm">
      <div className="font-semibold text-dashboard-ink">{viewLabel(spec)}</div>
      <button
        type="button"
        className="mt-2 rounded-md bg-dashboard-ink px-3 py-1 text-xs font-semibold text-dashboard-panel"
        onClick={() => onViewSpecReceived(spec)}
      >
        ページに固定
      </button>
    </div>
  );
}

function MessageParts({
  message,
  onViewSpecReceived,
}: {
  message: UIMessage;
  onViewSpecReceived: (spec: ViewSpec) => void;
}) {
  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === "text") return <span key={index}>{part.text}</span>;
        if (part.type === "reasoning") {
          return (
            <details key={index} open={part.state === "streaming"} className="mt-2 rounded-md bg-slate-50 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-dashboard-muted">推論</summary>
              <p className="mt-1 whitespace-pre-wrap text-xs text-dashboard-muted">{part.text}</p>
            </details>
          );
        }
        if (part.type === "step-start") {
          return (
            <div key={index} className="my-2 border-t border-dashboard-border pt-2 text-xs text-dashboard-muted">
              次のステップ
            </div>
          );
        }
        if (part.type.startsWith("tool-")) {
          return <ToolPartView key={index} part={part as ToolPartLike} onViewSpecReceived={onViewSpecReceived} />;
        }
        return null;
      })}
    </>
  );
}

export interface PageAgentContext {
  period: string;
  baseDate: string;
  view: ViewSpec;
}

export interface PageAgentPanelProps {
  /** tool結果（ViewSpec）を受け取ったときに呼ばれるコールバック */
  onViewSpecReceived: (spec: ViewSpec) => void;
  pageContext?: PageAgentContext;
  /** /api/chat のパス（basePath込み）。既定値は "/app/api/chat"。テスト容易性のためprops化。 */
  apiPath?: string;
}

export function PageAgentPanel({ onViewSpecReceived, pageContext, apiPath = "/app/api/chat" }: PageAgentPanelProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: apiPath, body: { pageContext } }),
    onFinish: ({ message }) => {
      for (const part of message.parts) {
        if (!part.type.startsWith("tool-")) continue;
        const toolName = part.type.slice("tool-".length);
        if (!isViewToolName(toolName)) continue;
        const invocation = part as unknown as { state?: string; output?: unknown };
        if (invocation.state !== "output-available") continue;
        const spec = toViewSpec(toolName, invocation.output);
        if (spec) onViewSpecReceived(spec);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <Card title="ページエージェント" className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto" style={{ minHeight: "12rem", maxHeight: "24rem" }}>
        {messages.length === 0 ? (
          <p className="text-sm text-dashboard-muted">
            「経営サマリーを見せて」「マネージャーサマリーを14日間で」のように話しかけてください。
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-dashboard-ink text-dashboard-panel" : "bg-slate-100 text-dashboard-ink"
                }`}
              >
                {message.role !== "assistant" || message.parts.length === 0 ? (
                  extractText(message) || (message.role === "assistant" ? "（表示を更新しました）" : "")
                ) : (
                  <MessageParts message={message} onViewSpecReceived={onViewSpecReceived} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力"
          className="flex-1 rounded-md border border-dashboard-border px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="rounded-md bg-dashboard-ink px-4 py-2 text-sm font-semibold text-dashboard-panel disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </Card>
  );
}

export function ChatPanel(props: PageAgentPanelProps) {
  return <PageAgentPanel {...props} />;
}
