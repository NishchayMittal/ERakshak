import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatWithEvidence } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

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
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const isControlled = inputValue !== undefined;

  // Internal state for uncontrolled usage (e.g. CaseWindow)
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const [internalInputValue, setInternalInputValue] = useState('');
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const internalMessagesEndRef = useRef<HTMLDivElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine active state based on whether component is controlled
  const activeMessages = isControlled ? messages! : internalMessages;
  const activeInputValue = isControlled ? inputValue! : internalInputValue;
  const activeIsLoading = isControlled ? isLoading! : internalIsLoading;
  const activeMessagesEndRef = isControlled ? messagesEndRef! : internalMessagesEndRef;
  const activeTextareaRef = isControlled ? textareaRef! : internalTextareaRef;

  // Internal welcome message
  useEffect(() => {
    if (!isControlled && internalMessages.length === 0) {
      setInternalMessages([{
        id: 'welcome',
        content: t('chat.welcome', "Hello! I'm your AI assistant for the e-Rakshak OSINT platform. I can help you analyze your case evidence by answering questions about linked entities, discovered findings, breach data, and more. What would you like to know about your case?"),
        isUser: false,
        timestamp: new Date().toISOString()
      }]);
    }
  }, [isControlled, internalMessages.length, t]);

  // Internal scroll
  useEffect(() => {
    if (!isControlled) {
      internalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [internalMessages, isControlled]);

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
      timestamp: new Date().toISOString()
    };

    setInternalMessages(prev => [...prev, userMessage]);
    setInternalInputValue('');
    setInternalIsLoading(true);

    try {
      const response = await chatWithEvidence(caseId, activeInputValue);
      const botMessage: ChatMessage = {
        id: Date.now().toString() + 'b',
        content: response.answer,
        isUser: false,
        timestamp: new Date().toISOString()
      };
      setInternalMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      showToast(t('chat.error', 'Failed to get AI response'), 'error');
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + 'e',
        content: t('chat.fallback_error', "I'm sorry, I encountered an error while processing your question. Please try again."),
        isUser: false,
        timestamp: new Date().toISOString()
      };
      setInternalMessages(prev => [...prev, errorMessage]);
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
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
            {t('chat.title', 'AI INVESTIGATION ASSISTANT')}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'var(--text-muted)'
        }}>
          {t('chat.model_label', 'MODEL: LLAMA-3.3-70B-VERSATILE')}
        </div>
      </div>

      {/* Messages Container */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {(activeMessages || [])
          .filter(Boolean)
          .map((msg, index) => (
            <div
              key={msg?.id || index.toString()}
              style={{
                display: "flex",
                flexDirection: msg?.isUser ? "row-reverse" : "row",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 12
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: msg?.isUser ? "rgba(0,255,194,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${msg?.isUser ? "var(--accent-primary)" : "rgba(0,255,194,0.2)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {msg?.isUser ? (
                  <Send className="w-3 h-3" style={{ color: "var(--accent-primary)" }} />
                ) : (
                  <Zap className="w-3 h-3" style={{ color: "var(--accent-primary)" }} />
                )}
              </div>

              <div style={{ maxWidth: "75%", wordWrap: "break-word" }}>
                <div
                  style={{
                    background: msg?.isUser ? "rgba(0,255,194,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${msg?.isUser ? "var(--accent-primary)" : "rgba(0,255,194,0.15)"}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    position: "relative",
                  }}
                >
                  {parseMessageContent(msg?.content || "")}
                  <div
                    style={{
                      fontSize: 7,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      textAlign: msg?.isUser ? "right" : "left",
                    }}
                  >
                    {new Date(msg?.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        <div ref={activeMessagesEndRef as any} />
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
          ref={activeTextareaRef as any}
          value={activeInputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={t('chat.placeholder', 'Ask about linked entities, breach data, connections, or investigation details...')}
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
            fontSize: 9,
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
            color: activeIsLoading ? "rgba(0,255,194,0.5)" : "var(--accent-primary)",
            fontFamily: "var(--font-heading)",
            fontSize: 8,
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
            <Send className="w-3 h-3" style={{ color: "var(--accent-primary)" }} />
          )}
          <span>{activeIsLoading ? t('chat.processing', 'PROCESSING...') : t('chat.send', 'SEND')}</span>
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
