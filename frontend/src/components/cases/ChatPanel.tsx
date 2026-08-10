import React, { useState, useRef, useEffect } from "react";
import { Send, Zap, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { chatWithEvidence } from "../../api/endpoints";
import { useUIStore } from "../../state/uiStore";
import { useTransliterate } from "../ui/Transliterate";

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatPanelProps {
  caseId?: string;
  messages?: ChatMessage[];
  inputValue?: string;
  isLoading?: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
  onSendMessage?: () => void;
  onInputChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function ChatPanel({
  caseId = "",
  messages,
  inputValue,
  isLoading,
  messagesEndRef,
  onSendMessage,
  onInputChange,
  onKeyPress,
  textareaRef,
}: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const transliterate = useTransliterate();
  const { showToast } = useUIStore();
  const isControlled = inputValue !== undefined;

  // Internal state for uncontrolled usage (e.g. CaseWindow)
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>(
    () => [
      {
        id: "welcome",
        content: t(
          "chat.welcome",
          "Hello! I'm your AI assistant for the e-Rakshak OSINT platform. I can help you analyze your case evidence by answering questions about linked entities, discovered findings, breach data, and more. What would you like to know about your case?",
        ),
        isUser: false,
        timestamp: new Date().toISOString(),
      },
    ],
  );
  const [internalInputValue, setInternalInputValue] = useState("");
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const internalMessagesEndRef = useRef<HTMLDivElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const activeMessages = isControlled ? messages! : internalMessages;
  const activeInputValue = isControlled ? inputValue! : internalInputValue;
  const activeIsLoading = isControlled ? isLoading! : internalIsLoading;
  const activeMessagesEndRef = isControlled
    ? messagesEndRef!
    : internalMessagesEndRef;
  const activeTextareaRef = isControlled ? textareaRef! : internalTextareaRef;

  // Internal scroll
  useEffect(() => {
    if (!isControlled) {
      internalMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [internalMessages, isControlled, internalIsLoading]);

  const handleSendMessage = async () => {
    if (isControlled && onSendMessage) {
      return onSendMessage();
    }

    // Internal send logic
    if (!activeInputValue.trim() || activeIsLoading || !caseId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: activeInputValue,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setInternalMessages((prev) => [...prev, userMessage]);
    setInternalInputValue("");
    setInternalIsLoading(true);

    // Format history for the backend (excluding the welcome message)
    const history = activeMessages
      .filter((msg) => msg.id !== "welcome")
      .map((msg) => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.content,
      }));

    try {
      const response = await chatWithEvidence(
        caseId,
        activeInputValue,
        history,
        i18n.language
      );
      const botMessage: ChatMessage = {
        id: Date.now().toString() + "b",
        content: response.answer,
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setInternalMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      showToast(t("chat.error", "Failed to get AI response"), "error");
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + "e",
        content: t(
          "chat.fallback_error",
          "I'm sorry, I encountered an error while processing your question. Please try again.",
        ),
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setInternalMessages((prev) => [...prev, errorMessage]);
    } finally {
      setInternalIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isControlled && onInputChange) {
      onInputChange(e);
    } else {
      setInternalInputValue(e.target.value);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isControlled && onKeyPress) {
      onKeyPress(e);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid var(--struct-line)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <MessageCircle
            className="w-4 h-4"
            style={{ color: "var(--accent-primary)" }}
          />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "calc(10px * var(--font-scale))",
              fontWeight: 700,
              color: "var(--accent-primary)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            {t("chat.title", "AI INVESTIGATION ASSISTANT")}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "calc(8px * var(--font-scale))",
            color: "var(--text-muted)",
          }}
        >
          {/* {t("chat.model_label", "MODEL: LOCAL RAG")} */}
        </div>
      </div>

      {/* Messages Container */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {(activeMessages || []).filter(Boolean).map((msg, index) => (
          <div
            key={msg?.id || index.toString()}
            style={{
              display: "flex",
              flexDirection: msg?.isUser ? "row-reverse" : "row",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: msg?.isUser
                  ? "rgba(0,255,194,0.1)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${msg?.isUser ? "var(--accent-primary)" : "rgba(0,255,194,0.2)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {msg?.isUser ? (
                <Send
                  className="w-3 h-3"
                  style={{ color: "var(--accent-primary)" }}
                />
              ) : (
                <Zap
                  className="w-3 h-3"
                  style={{ color: "var(--accent-primary)" }}
                />
              )}
            </div>

            <div style={{ maxWidth: "75%", wordWrap: "break-word" }}>
              <div
                style={{
                  background: msg?.isUser
                    ? "rgba(0,255,194,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${msg?.isUser ? "var(--accent-primary)" : "rgba(0,255,194,0.15)"}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "calc(9px * var(--font-scale))",
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                  position: "relative",
                }}
              >
                {parseMessageContent(msg?.content || "", transliterate)}
                <div
                  style={{
                    fontSize: "calc(7px * var(--font-scale))",
                    color: "var(--text-muted)",
                    marginTop: 4,
                    textAlign: msg?.isUser ? "right" : "left",
                  }}
                >
                  {new Date(
                    msg?.timestamp || "2026-07-24T00:00:00Z",
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {activeIsLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(0,255,194,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap
                className="w-3 h-3"
                style={{ color: "var(--accent-primary)" }}
              />
            </div>
            <div style={{ maxWidth: "75%", wordWrap: "break-word" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,255,194,0.15)",
                  borderRadius: 6,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  height: 31,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    animation: "pulse 1.5s infinite 0.2s",
                  }}
                />
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    animation: "pulse 1.5s infinite 0.4s",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={activeMessagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--struct-line)",
        }}
      >
        <textarea
          ref={activeTextareaRef}
          value={activeInputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={t(
            "chat.placeholder",
            "Ask about linked entities, breach data, connections, or investigation details...",
          )}
          disabled={activeIsLoading}
          style={{
            flex: 1,
            minHeight: 48,
            maxHeight: 120,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${activeIsLoading ? "rgba(0,255,194,0.3)" : "var(--struct-line)"}`,
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: "calc(9px * var(--font-scale))",
            color: "var(--text-primary)",
            resize: "vertical",
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={activeIsLoading || !activeInputValue.trim()}
          style={{
            background: "none",
            border: `1px solid ${activeIsLoading ? "rgba(0,255,194,0.3)" : "var(--accent-primary)"}`,
            color: activeIsLoading
              ? "rgba(0,255,194,0.5)"
              : "var(--accent-primary)",
            fontFamily: "var(--font-heading)",
            fontSize: "calc(8px * var(--font-scale))",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "6px 10px",
            cursor: activeIsLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "all 0.2s",
          }}
        >
          {activeIsLoading ? (
            <div
              className="w-3 h-3"
              style={{
                border: "2px solid transparent",
                borderTopColor: "var(--accent-primary)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : (
            <Send
              className="w-3 h-3"
              style={{ color: "var(--accent-primary)" }}
            />
          )}
          <span>
            {activeIsLoading
              ? t("chat.processing", "PROCESSING...")
              : t("chat.send", "SEND")}
          </span>
        </button>
      </div>
    </div>
  );
}

function parseMessageContent(text: string, transliterate: (t: string) => string = (t) => t) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul
          key={`ul-${listKey++}`}
          style={{ paddingLeft: 12, margin: "6px 0", listStyleType: "none" }}
        >
          {listItems}
        </ul>,
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (line: string, i: number) => {
    // Basic bold parsing: **text**
    let parts = line.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong
            key={idx}
            style={{
              fontWeight: 700,
              color: "var(--accent-primary)",
              background: "rgba(0,255,194,0.1)",
              padding: "1px 3px",
            }}
          >
            {transliterate(part.slice(2, -2))}
          </strong>
        );
      }

      // Parse links inside normal text parts
      if (part.includes("[") && part.includes("](")) {
        const linkParts = part.split(/(\[.*?\]\(.*?\))/g);
        return (
          <React.Fragment key={idx}>
            {linkParts.map((lPart, lIdx) => {
              const linkMatch = lPart.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                return (
                  <a
                    key={lIdx}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--accent-primary)",
                      textDecoration: "underline",
                    }}
                  >
                    {transliterate(linkMatch[1])}
                  </a>
                );
              }
              return transliterate(lPart);
            })}
          </React.Fragment>
        );
      }

      return transliterate(part);
    });
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      flushList();
      const content = parseInline(trimmed.replace(/^#+\s*/, ""), i);
      elements.push(
        <div
          key={i}
          style={{
            fontWeight: 700,
            color: "var(--accent-primary)",
            marginTop: 8,
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          {content}
        </div>,
      );
    } else if (trimmed.startsWith(">")) {
      flushList();
      const content = parseInline(trimmed.replace(/^>\s*/, ""), i);
      elements.push(
        <blockquote
          key={i}
          style={{
            borderLeft: "2px solid var(--accent-primary)",
            background: "rgba(0,255,194,0.05)",
            padding: "4px 8px",
            margin: "8px 0",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {content}
        </blockquote>,
      );
    } else if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("+ ")
    ) {
      inList = true;
      const content = parseInline(trimmed.substring(2), i);
      listItems.push(
        <li
          key={i}
          style={{
            position: "relative",
            paddingLeft: 10,
            paddingBottom: 4,
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--accent-primary)",
            }}
          />
          {content}
        </li>,
      );
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      const content = parseInline(trimmed, i);
      elements.push(
        <div key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>
          {content}
        </div>,
      );
    }
  });

  flushList();
  return elements;
}
