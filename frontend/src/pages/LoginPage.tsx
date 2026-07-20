import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUIStore } from "../state/uiStore";
import { signupRequest } from "../api/endpoints";

const BOOT_LINES = [
  "SECURE ENCLAVE READY...",
  "VERIFYING TLS CERTIFICATE...",
  "LOADING IDENTITY MATRIX...",
  "AWAITING INVESTIGATOR AUTH...",
];

export default function LoginPage() {
  const [username, setUsername] = useState("INV-001");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const { login } = useAuth();
  const { showToast, toast, clearToast } = useUIStore();
  const navigate = useNavigate();

  // Cycle boot lines
  useEffect(() => {
    const id = setInterval(() => {
      setBootLine((i) => (i + 1) % BOOT_LINES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast("INVESTIGATOR BADGE ID REQUIRED", "error");
      return;
    }
    if (!password.trim()) {
      showToast("SECURITY PASSPHRASE REQUIRED", "error");
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        showToast("FULL NAME REQUIRED FOR REGISTRATION", "error");
        return;
      }
      try {
        await signupRequest(username.trim(), fullName.trim(), password);
        showToast(
          "REGISTRATION REQUEST SUBMITTED // PENDING APPROVAL",
          "success",
        );
        setIsSignUp(false);
        setPassword("");
      } catch (err: any) {
        let msg = "REGISTRATION REQUEST FAILED";
        if (err.response?.data?.detail) {
          if (typeof err.response.data.detail === "string") {
            msg = err.response.data.detail;
          } else if (Array.isArray(err.response.data.detail)) {
            msg = err.response.data.detail.map((d: any) => d.msg).join(", ");
          } else {
            msg = JSON.stringify(err.response.data.detail);
          }
        }
        showToast(msg.toUpperCase(), "error");
      }
    } else {
      try {
        const success = await login(username.trim(), password);
        if (success) {
          showToast(
            `ACCESS GRANTED // AGENT ${username.toUpperCase()}`,
            "success",
          );
          navigate("/cases");
        } else {
          showToast("INVALID BADGE ID OR SECURITY PASSPHRASE", "error");
        }
      } catch (err: any) {
        let msg = "INVALID CREDENTIALS";
        if (err.response?.data?.detail) {
          if (typeof err.response.data.detail === "string") {
            msg = err.response.data.detail;
          } else if (Array.isArray(err.response.data.detail)) {
            msg = err.response.data.detail.map((d: any) => d.msg).join(", ");
          } else {
            msg = JSON.stringify(err.response.data.detail);
          }
        }
        showToast(msg.toUpperCase(), "error");
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020408",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Background grid scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none animate-pulse [animation-duration:8s]"
        style={{
          backgroundImage: `linear-gradient(rgba(57,255,20,0.03) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(57,255,20,0.03) 1.5px, transparent 1.5px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full filter blur-[120px] pointer-events-none opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(57,255,20,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Corner HUD brackets */}
      {[
        [
          "top:16px;left:16px",
          "borderTop:1px solid #39ff14;borderLeft:1px solid #39ff14",
        ],
        [
          "top:16px;right:16px",
          "borderTop:1px solid #39ff14;borderRight:1px solid #39ff14",
        ],
        [
          "bottom:16px;left:16px",
          "borderBottom:1px solid #39ff14;borderLeft:1px solid #39ff14",
        ],
        [
          "bottom:16px;right:16px",
          "borderBottom:1px solid #39ff14;borderRight:1px solid #39ff14",
        ],
      ].map(([pos], i) => {
        const borders = [
          {
            borderTop: "1px solid rgba(57,255,20,0.4)",
            borderLeft: "1px solid rgba(57,255,20,0.4)",
          },
          {
            borderTop: "1px solid rgba(57,255,20,0.4)",
            borderRight: "1px solid rgba(57,255,20,0.4)",
          },
          {
            borderBottom: "1px solid rgba(57,255,20,0.4)",
            borderLeft: "1px solid rgba(57,255,20,0.4)",
          },
          {
            borderBottom: "1px solid rgba(57,255,20,0.4)",
            borderRight: "1px solid rgba(57,255,20,0.4)",
          },
        ];
        const posStyles = [
          { top: 24, left: 24 },
          { top: 24, right: 24 },
          { bottom: 24, left: 24 },
          { bottom: 24, right: 24 },
        ];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 24,
              height: 24,
              pointerEvents: "none",
              ...posStyles[i],
              ...borders[i],
            }}
          />
        );
      })}

      {/* Login card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "rgba(4, 8, 14, 0.95)",
          border: "1px solid #39ff14",
          boxShadow: "0 0 40px rgba(57,255,20,0.06)",
          padding: 0,
          position: "relative",
          backdropFilter: "blur(12px)",
        }}
        className="rounded-xl overflow-hidden"
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 2,
            background:
              "linear-gradient(90deg, transparent, #39ff14, transparent)",
          }}
        />

        <div style={{ padding: "32px 32px 24px" }}>
          {/* Logo + title */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {/* Shield icon */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                border: "1px solid #39ff14",
                color: "#39ff14",
                marginBottom: 14,
                position: "relative",
                boxShadow: "0 0 12px rgba(57,255,20,0.2)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontSize: 22,
                fontWeight: 700,
                color: "#39ff14",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                textShadow: "0 0 16px rgba(57,255,20,0.4)",
              }}
            >
              ORION
            </h1>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: "0.12em",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              OSINT // DIGITAL FORENSICS // LINK ANALYSIS
            </div>
          </div>

          {/* Boot status line */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              color: "#39ff14",
              marginBottom: 20,
              textAlign: "center",
              opacity: 0.6,
            }}
            className="cursor-blink"
          >
            {BOOT_LINES[bootLine]}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Investigator Badge ID */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--font-heading)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                INVESTIGATOR BADGE ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "black",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#39ff14",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  padding: "10px 12px",
                  outline: "none",
                  caretColor: "#39ff14",
                  letterSpacing: "0.05em",
                  transition: "border-color 0.1s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#39ff14")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
                placeholder="INV-000"
              />
            </div>

            {/* Conditionally show Full Name if SignUp */}
            {isSignUp && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  FULL NAME
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "black",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    padding: "10px 12px",
                    outline: "none",
                    caretColor: "#39ff14",
                    letterSpacing: "0.05em",
                    transition: "border-color 0.1s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#39ff14")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                  }
                  placeholder="AGENT_NAME"
                />
              </div>
            )}

            {/* Passphrase */}
            <div>
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--font-heading)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "black",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  padding: "10px 12px",
                  outline: "none",
                  caretColor: "#39ff14",
                  letterSpacing: "0.3em",
                  transition: "border-color 0.1s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#39ff14")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                }
                placeholder="••••••••"
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#39ff14",
                    display: "inline-block",
                    boxShadow: "0 0 4px #39ff14",
                  }}
                />
                SECURE AUDIT LOGGING ACTIVE
              </span>
              <span style={{ color: "var(--struct-line)" }}>
                LEVEL-5 CLEARANCE
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{
                padding: "12px",
                background: "#a855f7",
                border: "none",
                color: "#000000",
                fontFamily: "var(--font-heading)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(168,85,247,0.25)",
                transition: "background-color 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(168,85,247,0.85)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "#a855f7";
              }}
            >
              {isSignUp ? "SUBMIT SIGNUP REQUEST" : "AUTHORIZE SESSION"}
            </button>

            {/* Toggle switch */}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setPassword("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#39ff14",
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                letterSpacing: "0.08em",
                textDecoration: "underline",
                cursor: "pointer",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {isSignUp ? "OR SWITCH TO AUTH LOGIN" : "OR REQUEST SIGN UP"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "12px 32px",
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          STRICTLY AUTHORIZED PERSONNEL ONLY. ALL ACCESS AND INGESTION EVENTS
          ARE DIGITALLY LOGGED.
        </div>
      </div>

      {/* ── Global Toast ── */}
      {toast && (
        <div
          onClick={clearToast}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            background: "rgba(4, 8, 14, 0.95)",
            border: `1px solid ${
              toast.type === "error"
                ? "#ff3b30"
                : toast.type === "success"
                  ? "#39ff14"
                  : "#a855f7"
            }`,
            boxShadow: `0 0 16px ${
              toast.type === "error"
                ? "rgba(255,59,48,0.2)"
                : toast.type === "success"
                  ? "rgba(57,255,20,0.2)"
                  : "rgba(168,85,247,0.2)"
            }`,
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-primary)",
            letterSpacing: "0.08em",
            backdropFilter: "blur(12px)",
            borderRadius: "4px",
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background:
                toast.type === "error"
                  ? "#ff3b30"
                  : toast.type === "success"
                    ? "#39ff14"
                    : "#a855f7",
              boxShadow: `0 0 6px ${
                toast.type === "error"
                  ? "#ff3b30"
                  : toast.type === "success"
                    ? "#39ff14"
                    : "#a855f7"
              }`,
            }}
          />
          {toast.message}
          <span style={{ marginLeft: 12, opacity: 0.5, fontSize: 8 }}>✕</span>
        </div>
      )}
    </div>
  );
}
