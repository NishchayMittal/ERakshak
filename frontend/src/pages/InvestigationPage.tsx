import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { MessageCircle, Activity, BookOpen, FileText } from "lucide-react";
import GraphView from "../components/graph/GraphView";
import GraphFilterBar from "../components/graph/GraphFilterBar";
import GraphLegend from "../components/graph/GraphLegend";
import TimelineView from "../components/timeline/TimelineView";
import NotesPanel from "../components/cases/NotesPanel";
import ReportPanel from "../components/cases/ReportPanel";
import ExportMenu from "../components/export/ExportMenu";
import DossierPanel from "../components/dossier/DossierPanel";
import ChatPanel from "../components/cases/ChatPanel";
import { useGraphStore } from "../state/graphStore";
import { useUIStore } from "../state/uiStore";
import { useCaseStore } from "../state/caseStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { chatWithEvidence } from "../api/endpoints";

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

const TABS = ["DOSSIER", "TIMELINE", "NOTES", "REPORT", "CHAT"] as const;
type Tab = (typeof TABS)[number];

interface InvestigationPageProps {
  caseId?: string;
  entityId?: string;
  onSelectNode?: (entityId: string) => void;
}

export default function InvestigationPage({
  caseId: propCaseId,
  entityId: propEntityId,
  onSelectNode,
}: InvestigationPageProps = {}) {
  const params = useParams<{ caseId: string; entityId: string }>();
  const caseId = propCaseId || params.caseId;

  const [prevPropEntityId, setPrevPropEntityId] = React.useState<string | undefined>(propEntityId);
  const [localEntityId, setLocalEntityId] = React.useState<string | undefined>(propEntityId);

  if (propEntityId !== prevPropEntityId) {
    setPrevPropEntityId(propEntityId);
    setLocalEntityId(propEntityId);
  }

  // Chat state lifted up to persist across tab switches
  const [prevCaseId, setPrevCaseId] = useState(caseId);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [{
    id: "welcome",
    content: "Hello! I'm your AI assistant for the e-Rakshak OSINT platform. I can help you analyze your case evidence by answering questions about linked entities, discovered findings, breach data, and more. What would you like to know about your case?",
    isUser: false,
    timestamp: new Date().toISOString()
  }]);

  if (caseId !== prevCaseId) {
    setPrevCaseId(caseId);
    setChatMessages([{
      id: "welcome",
      content: "Hello! I'm your AI assistant for the e-Rakshak OSINT platform. I can help you analyze your case evidence by answering questions about linked entities, discovered findings, breach data, and more. What would you like to know about your case?",
      isUser: false,
      timestamp: new Date().toISOString()
    }]);
  }
  const [chatInputValue, setChatInputValue] = useState("");
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { loadEntityGraph, clearGraph, setSelectedEntityId } = useGraphStore();
  const { activeTab, setActiveTab } = useUIStore();
  const { selectCase } = useCaseStore();

  // Map uiStore tab keys to display tabs — moved above all effects/JSX that read it,
  // since `const` bindings are in the temporal dead zone until this line runs.
  const tabMap: Record<string, Tab> = {
    graph: "DOSSIER",
    timeline: "TIMELINE",
    notes: "NOTES",
    report: "REPORT",
    chat: "CHAT",
  };
  const activeDisplay = tabMap[activeTab] ?? "DOSSIER";
  const reverseTabMap: Record<Tab, string> = {
    DOSSIER: "graph",
    TIMELINE: "timeline",
    NOTES: "notes",
    REPORT: "report",
    CHAT: "chat",
  };

  // Synchronized propEntityId changes directly in render

  const entityId = localEntityId || params.entityId;

  // Connect to websocket for live updates
  useWebSocket(caseId);

  useEffect(() => {
    if (caseId && entityId) {
      selectCase(caseId);
      loadEntityGraph(caseId, entityId);
    }
  }, [caseId, entityId, loadEntityGraph, selectCase]);

  // Clear graph only when leaving the page (unmount)
  useEffect(() => {
    return () => {
      clearGraph();
    };
  }, [clearGraph]);

  const handleSelectNode = (selectedNodeId: string) => {
    // Update the store directly — no URL navigation needed.
    // Navigating would unmount/remount this page, wiping the evidencePack
    // from the store before it can be re-fetched, causing the node to appear
    // "unclicked" while loading. Directly setting selectedEntityId keeps the
    // component mounted and DossierPanel shows instantly.
    setSelectedEntityId(selectedNodeId);
    if (onSelectNode) {
      onSelectNode(selectedNodeId);
    }
  };

  // Chat handler functions
  const handleChatSend = async () => {
    if (!chatInputValue.trim() || chatIsLoading || !caseId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: chatInputValue,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInputValue("");
    setChatIsLoading(true);

    try {
      const response = await chatWithEvidence(caseId, chatInputValue);
      const botMessage: ChatMessage = {
        id: Date.now().toString() + "b",
        content: response.answer,
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      // Use toast from uiStore if available, otherwise console error only
      const showToast = (useUIStore.getState() as { showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void }).showToast;
      if (showToast) {
        showToast("Failed to get AI response", "error");
      }

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + "e",
        content:
          "I'm sorry, I encountered an error while processing your question. Please try again.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatIsLoading(false);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // Auto-scroll to bottom when new chat messages arrive
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Scroll chat messages when updated

  // Focus textarea when chat tab is active
  useEffect(() => {
    if (activeDisplay === "CHAT" && caseId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeDisplay, caseId, textareaRef]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        gap: 12,
        overflow: "hidden",
      }}
    >
      {/* ── Action header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#080c10",
          border: "1px solid var(--struct-line)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent-primary)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            DOSSIER VISUAL ANALYSIS
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-muted)",
              marginTop: 2,
              letterSpacing: "0.05em",
            }}
          >
            Interactive correlation graph — select any node to trace timelines
            and attributes
          </div>
        </div>
        {caseId && <ExportMenu caseId={caseId} />}
      </div>

      {/* ── Filter bar ── */}
      <GraphFilterBar />

      {/* ── Main Workspace ── */}
      <div className="hud-grid-main">
        {/* ── Graph canvas ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <GraphView onSelectNode={handleSelectNode} />
          <GraphLegend />
        </div>

        {/* ── Right dossier panel ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#080c10",
            border: "1px solid var(--accent-primary)",
            boxShadow: "0 0 6px rgba(0,255,194,0.15)",
            minHeight: 0,
            overflow: "hidden",
            animation: "slide-in-right 0.12s linear",
          }}
        >
          {/* Tab header */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--struct-line)",
              background: "#030609",
              flexShrink: 0,
            }}
          >
            {TABS.map((tab) => {
              // Define icons for each tab
              const tabIcons: Record<
                Tab,
                React.FC<React.SVGProps<SVGSVGElement>> & { size?: number }
              > = {
                DOSSIER: MessageCircle,
                TIMELINE: Activity, // Using Activity for timeline
                NOTES: BookOpen,
                REPORT: FileText,
                CHAT: MessageCircle, // Using MessageCircle for chat
              };

              const IconComponent = tabIcons[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(reverseTabMap[tab] as 'graph' | 'timeline' | 'notes' | 'report' | 'chat')}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    flex: 1,
                    padding: "9px 0",
                    fontFamily: "var(--font-heading)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    background: "none",
                    border: "none",
                    borderBottom:
                      activeDisplay === tab
                        ? "2px solid var(--accent-primary)"
                        : "2px solid transparent",
                    color:
                      activeDisplay === tab
                        ? "var(--accent-primary)"
                        : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "color 0.1s, border-color 0.1s",
                  }}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{tab}</span>
                </button>
              );
            })}
          </div>

          {/* Panel content - always render all panels but conditionally show via CSS */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              position: "relative",
            }}
          >
            {/* Dossier Panel */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: activeDisplay === "DOSSIER" ? "block" : "none",
              }}
            >
              <DossierPanel />
            </div>

            {/* Timeline Panel */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: activeDisplay === "TIMELINE" ? "block" : "none",
              }}
            >
              <TimelineView />
            </div>

            {/* Notes Panel */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: activeDisplay === "NOTES" && caseId ? "block" : "none",
              }}
            >
              {caseId && <NotesPanel caseId={caseId} />}
            </div>

            {/* Report Panel */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display:
                  activeDisplay === "REPORT" && caseId ? "block" : "none",
              }}
            >
              {caseId && <ReportPanel caseId={caseId} />}
            </div>

            {/* Chat Panel - now with lifted state */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: activeDisplay === "CHAT" && caseId ? "block" : "none",
              }}
            >
              {caseId && (
                <ChatPanel
                  caseId={caseId}
                  messages={chatMessages}
                  inputValue={chatInputValue}
                  isLoading={chatIsLoading}
                  messagesEndRef={chatMessagesEndRef}
                  onSendMessage={handleChatSend}
                  onInputChange={(e) => setChatInputValue(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  textareaRef={textareaRef}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
