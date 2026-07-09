/**
 * packages/web/src/components/chat/ChatPanel.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   @ai-sdk/react の useChat を使った、メッセージ一覧・入力欄・送信ボタンのみのシンプルなUI。
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
import type { ViewSpec } from "../../server/viewSpec";

const KNOWN_VIEW_TOOL_NAMES = ["showExecutiveSummary", "showManagerSummary", "listProjects"] as const;
type ViewToolName = (typeof KNOWN_VIEW_TOOL_NAMES)[number];

function isViewToolName(name: string): name is ViewToolName {
  return (KNOWN_VIEW_TOOL_NAMES as readonly string[]).includes(name);
}

/** tool呼び出し名からViewSpecへ変換する（execute側の戻り値をそのままViewSpecとして採用する）。 */
function toViewSpec(toolName: ViewToolName, output: unknown): ViewSpec | null {
  if (toolName === "showExecutiveSummary" || toolName === "showManagerSummary" || toolName === "listProjects") {
    if (output && typeof output === "object" && "kind" in output) {
      return output as ViewSpec;
    }
  }
  return null;
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export interface ChatPanelProps {
  /** tool結果（ViewSpec）を受け取ったときに呼ばれるコールバック */
  onViewSpecReceived: (spec: ViewSpec) => void;
  /** /api/chat のパス（basePath込み）。既定値は "/app/api/chat"。テスト容易性のためprops化。 */
  apiPath?: string;
}

export function ChatPanel({ onViewSpecReceived, apiPath = "/app/api/chat" }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: apiPath }),
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
    <Card title="チャットで表示を切り替える" className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto" style={{ minHeight: "12rem", maxHeight: "24rem" }}>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            「経営サマリーを見せて」「マネージャーサマリーを14日間で」のように話しかけてください。
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {extractText(message) || (message.role === "assistant" ? "（表示を更新しました）" : "")}
              </span>
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </Card>
  );
}
