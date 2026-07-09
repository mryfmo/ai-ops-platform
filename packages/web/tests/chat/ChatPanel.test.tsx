/**
 * @vitest-environment jsdom
 *
 * packages/web/tests/chat/ChatPanel.test.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   ChatPanelはuseChat（@ai-sdk/react）に依存する状態を持つクライアントコンポーネントのため、
 *   既存ui.test.tsx/views.test.tsxの「要素を直接呼ぶ」方式ではhooksが動作しない
 *   （Reactのレンダーフェーズ外でのフック呼び出しはエラーになる）。そのため本テストのみ
 *   @vitest-environment jsdomを指定し、useChatをvi.mockして最小限のDOMレンダリング
 *   （react-dom/client + act）で検証する。
 *
 *   検証観点: tool結果（ViewSpec）を含むメッセージパートを受け取ったら
 *   onViewSpecReceivedを呼び出すこと（実データ自体は扱わないことの確認を兼ねる）。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { UIMessage } from "ai";

// react-dom/testUtils の act() 警告抑止（jsdom環境でのReact 19 act()サポートフラグ）
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUseChat = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: (...args: unknown[]) => mockUseChat(...args),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    DefaultChatTransport: class {
      constructor(public opts: unknown) {}
    },
  };
});

const { ChatPanel } = await import("../../src/components/chat/ChatPanel");

function setupContainer(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

beforeEach(() => {
  mockUseChat.mockReset();
});

describe("ChatPanel（ADR-0005: tool結果受信でonViewSpecReceivedを呼ぶ）", () => {
  it("メッセージが0件のとき案内文を表示する", () => {
    mockUseChat.mockReturnValue({ messages: [], sendMessage: vi.fn(), status: "ready" });
    const { container, root } = setupContainer();
    act(() => {
      root.render(<ChatPanel onViewSpecReceived={vi.fn()} />);
    });
    expect(container.textContent).toContain("経営サマリーを見せて");
    act(() => root.unmount());
  });

  it("assistantのテキストパートを本文として表示する", () => {
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "経営サマリーを見せて" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "セブンキーに切り替えました。" }] },
    ];
    mockUseChat.mockReturnValue({ messages, sendMessage: vi.fn(), status: "ready" });
    const { container, root } = setupContainer();
    act(() => {
      root.render(<ChatPanel onViewSpecReceived={vi.fn()} />);
    });
    expect(container.textContent).toContain("セブンキーに切り替えました。");
    act(() => root.unmount());
  });

  it("onFinishでtool-showExecutiveSummaryのoutput-availableパートを受け取るとonViewSpecReceivedにViewSpecを渡す", () => {
    mockUseChat.mockReturnValue({ messages: [], sendMessage: vi.fn(), status: "ready" });
    const onViewSpecReceived = vi.fn();
    const { root } = setupContainer();
    act(() => {
      root.render(<ChatPanel onViewSpecReceived={onViewSpecReceived} />);
    });

    // useChatに渡されたonFinishコールバックを取り出して直接呼び出す
    const options = mockUseChat.mock.calls[0]?.[0] as { onFinish: (arg: unknown) => void };
    expect(typeof options.onFinish).toBe("function");

    act(() => {
      options.onFinish({
        message: {
          id: "a2",
          role: "assistant",
          parts: [
            {
              type: "tool-showExecutiveSummary",
              toolCallId: "call_1",
              state: "output-available",
              input: {},
              output: { kind: "executiveSummary" },
            },
          ],
        },
      });
    });

    expect(onViewSpecReceived).toHaveBeenCalledWith({ kind: "executiveSummary" });
    act(() => root.unmount());
  });

  it("state不明（input-streaming等）のtoolパートはonViewSpecReceivedを呼ばない", () => {
    mockUseChat.mockReturnValue({ messages: [], sendMessage: vi.fn(), status: "ready" });
    const onViewSpecReceived = vi.fn();
    const { root } = setupContainer();
    act(() => {
      root.render(<ChatPanel onViewSpecReceived={onViewSpecReceived} />);
    });
    const options = mockUseChat.mock.calls[0]?.[0] as { onFinish: (arg: unknown) => void };

    act(() => {
      options.onFinish({
        message: {
          id: "a3",
          role: "assistant",
          parts: [
            {
              type: "tool-showExecutiveSummary",
              toolCallId: "call_2",
              state: "input-streaming",
              input: undefined,
            },
          ],
        },
      });
    });

    expect(onViewSpecReceived).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("入力欄が空のとき送信ボタンが無効化される", () => {
    mockUseChat.mockReturnValue({ messages: [], sendMessage: vi.fn(), status: "ready" });
    const { container, root } = setupContainer();
    act(() => {
      root.render(<ChatPanel onViewSpecReceived={vi.fn()} />);
    });
    const button = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    act(() => root.unmount());
  });
});
