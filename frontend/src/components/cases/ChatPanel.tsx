import React, { useEffect, useState, useRef } from 'react';
import { Send, Zap, MessageCircle } from 'lucide-react';
import { chatWithEvidence } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';
import { useTranslation } from 'react-i18next';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export default function ChatPanel({ caseId }: { caseId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUIStore();
  const { t } = useTranslation();

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithEvidence(caseId, inputValue);
      const botMessage: ChatMessage = {
        id: Date.now().toString() + 'b',
        content: response.answer,
        isUser: false,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      showToast(t('chat.error'), 'error');

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + 'e',
        content: t('chat.fallback_error'),
        isUser: false,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        content: t('chat.welcome'),
        isUser: false,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length, caseId]);

export default function ChatPanel({
  caseId = "",
  messages = [],
  inputValue = "",
  isLoading = false,
  messagesEndRef = { current: null },
  onSendMessage = () => {},
  onInputChange = () => {},
  onKeyPress = () => {},
  textareaRef = { current: null },
}: ChatPanelProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
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
              fontSize: 10,
              fontWeight: 700,
              color: "var(--accent-primary)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            AI INVESTIGATION ASSISTANT
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            color: "var(--text-muted)",
          }}
        >
          MODEL: LLAMA-3.3-70B-VERSATILE
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 8,
        borderBottom: '1px solid var(--struct-line)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <MessageCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-primary)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase'
          }}>
            {t('chat.title')}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'var(--text-muted)'
        }}>
          {t('chat.model_label')}
        </div>
      </div>

      {/* Messages Container */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {(messages || [])
          .filter(Boolean) // Filter out null/undefined/false values
          .map((msg, index) => (
            <div
              key={msg?.id || index.toString()} // Use index as fallback if id is missing
              style={{
                display: "flex",
                flexDirection: msg?.isUser ? "row-reverse" : "row",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: msg?.isUser
                    ? "rgba(0,255,194,0.1)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    msg?.isUser
                      ? "var(--accent-primary)"
                      : "rgba(0,255,194,0.2)"
                  }`,
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

              {/* Message Content */}
              <div
                style={{
                  maxWidth: "75%",
                  wordWrap: "break-word",
                }}
              >
                <div
                  style={{
                    background: msg?.isUser
                      ? "rgba(0,255,194,0.08)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      msg?.isUser
                        ? "var(--accent-primary)"
                        : "rgba(0,255,194,0.15)"
                    }`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    position: "relative",
                  }}
                >
                  {/* Parse simple markdown-like formatting */}
                  {parseMessageContent(msg?.content || "")}
                  <div
                    style={{
                      fontSize: 7,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      textAlign: msg?.isUser ? "right" : "left",
                    }}
                  >
                    {new Date(msg?.timestamp || Date.now()).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        {/* Ref for scrolling to bottom */}
        <div ref={messagesEndRef} />
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
          ref={textareaRef}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyPress}
          placeholder="Ask about linked entities, breach data, connections, or investigation details..."
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={t('chat.placeholder')}
          disabled={isLoading}
          style={{
            flex: 1,
            minHeight: 48,
            maxHeight: 120,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${
              isLoading ? "rgba(0,255,194,0.3)" : "var(--struct-line)"
            }`,
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-primary)",
            resize: "vertical",
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <button
          onClick={onSendMessage}
          disabled={isLoading || !inputValue.trim()}
          style={{
            background: "none",
            border: `1px solid ${
              isLoading ? "rgba(0,255,194,0.3)" : "var(--accent-primary)"
            }`,
            color: isLoading ? "rgba(0,255,194,0.5)" : "var(--accent-primary)",
            fontFamily: "var(--font-heading)",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "6px 10px",
            cursor: isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "all 0.2s",
          }}
        >
          {isLoading ? (
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
          <span>{isLoading ? "PROCESSING..." : "SEND"}</span>
          <span>{isLoading ? t('chat.processing') : t('chat.send')}</span>
        </button>
      </div>
    </div>
  );
}

function parseMessageContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => {
    const isLast = lineIndex === lines.length - 1;

    if (!line.trim()) {
      return <div key={lineIndex} style={{ height: 8 }} />;
    }

    const parts = line.split(/\*\*(.*?)\*\*/g);

    return (
      <React.Fragment key={lineIndex}>
        {parts.map((part, partIndex) =>
          partIndex % 2 === 1 ? (
            <strong
              key={partIndex}
              style={{
                color: "var(--accent-primary)",
                fontWeight: 700,
                background: "rgba(0,255,194,0.1)",
                padding: "1px 3px",
              }}
            >
              {part}
            </strong>
          ) : (
            part
          ),
        )}
        {!isLast && <br />}
      </React.Fragment>
    );
  });
}
