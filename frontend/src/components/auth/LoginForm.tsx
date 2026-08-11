import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useUIStore } from "../../state/uiStore";
import { signupRequest, fetchNextBadgeId } from "../../api/endpoints";
import { CyberCard } from "../ui/CyberCard";
import { CyberButton } from "../ui/CyberButton";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSciFiSounds } from "../../hooks/useSciFiSounds";

const BOOT_KEYS = [
  "login.boot_enclave",
  "login.boot_tls",
  "login.boot_identity",
  "login.boot_awaiting",
];

export function LoginForm({ onGoHome }: { onGoHome?: () => void } = {}) {
  const [username, setUsername] = useState("INV-001");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast, toast, clearToast } = useUIStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playHover, playClick } = useSciFiSounds();

  // Cycle boot lines
  useEffect(() => {
    const id = setInterval(() => {
      setBootLine((i) => (i + 1) % BOOT_KEYS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isSignUp) {
      fetchNextBadgeId()
        .then((nextId) => setUsername(nextId))
        .catch(() => setUsername("INV-002"));
    } else {
      setUsername("INV-001");
    }
  }, [isSignUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!username.trim()) {
      showToast(t("login.badge_required"), "error");
      return;
    }
    if (!password.trim()) {
      showToast(t("login.passphrase_required"), "error");
      return;
    }

    if (isSignUp && !fullName.trim()) {
      showToast(t("login.name_required"), "error");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        try {
          await signupRequest(username.trim(), fullName.trim(), password);
          showToast(
            t("login.signup_submitted"),
            "success",
          );
          setIsSignUp(false);
          setPassword("");
        } catch (err) {
          const errorVal = err as {
            response?: {
              data?: {
                detail?: string | Array<{ msg: string }>;
              };
            };
          };
          let msg = t("login.signup_failed");
          if (errorVal.response?.data?.detail) {
            const detail = errorVal.response.data.detail;
            if (typeof detail === "string") {
              msg = detail;
            } else if (Array.isArray(detail)) {
              msg = detail.map((d) => d.msg).join(", ");
            } else {
              msg = JSON.stringify(detail);
            }
          }
          showToast(msg.toUpperCase(), "error");
        }
      } else {
        try {
          const success = await login(username.trim(), password);
          if (success) {
            showToast(
              t("login.access_granted", { username: username.toUpperCase() }),
              "success",
            );
            navigate("/cases");
          } else {
            showToast(t("login.invalid_credentials"), "error");
          }
        } catch (err) {
          const errorVal = err as {
            response?: {
              status?: number;
              data?: {
                detail?: string | Array<{ msg: string }>;
              };
            };
          };
          let msg = t("login.invalid_fallback");
          
          if (errorVal.response?.data?.detail) {
            const detail = errorVal.response.data.detail;
            if (typeof detail === "string") {
              msg = detail;
            } else if (Array.isArray(detail)) {
              msg = detail.map((d) => d.msg).join(", ");
            } else {
              msg = JSON.stringify(detail);
            }
          } else if (errorVal.response?.status && errorVal.response.status >= 500) {
            msg = t("login.server_error", "SERVER ERROR. PLEASE TRY AGAIN.");
          } else if (!errorVal.response) {
            msg = t("login.network_error", "NETWORK ERROR. SERVER MIGHT BE WAKING UP.");
          }
          showToast(msg.toUpperCase(), "error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "100%", maxWidth: 400, margin: "0 auto", position: "relative", zIndex: 50 }}
      >
        <CyberCard innerStyle={{ padding: 0 }}>
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
                  fontSize: "calc(22px * var(--font-scale))",
                  fontWeight: 700,
                  color: "#39ff14",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textShadow: "0 0 16px rgba(57,255,20,0.4)",
                }}
              >
                {t("login.brand")}
              </h1>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "calc(9px * var(--font-scale))",
                  color: "var(--text-muted)",
                  letterSpacing: "0.12em",
                  marginTop: 6,
                  textTransform: "uppercase",
                }}
              >
                {t("login.subtitle")}
              </div>
            </div>

            {/* Boot status line */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "calc(9px * var(--font-scale))",
                letterSpacing: "0.1em",
                color: "#39ff14",
                marginBottom: 20,
                textAlign: "center",
                opacity: 0.6,
              }}
              className="cursor-blink"
            >
              {t(BOOT_KEYS[bootLine])}
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
                    fontSize: "calc(9px * var(--font-scale))",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  {t("login.badge_id")}
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
                    fontSize: "calc(12px * var(--font-scale))",
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
                  placeholder={t("login.badge_placeholder")}
                />
              </div>

              {/* Conditionally show Full Name if SignUp */}
              {isSignUp && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-heading)",
                      fontSize: "calc(9px * var(--font-scale))",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: 6,
                    }}
                  >
                    {t("login.full_name")}
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
                      fontSize: "calc(12px * var(--font-scale))",
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
                    placeholder={t("login.name_placeholder")}
                  />
                </div>
              )}

              {/* Passphrase */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-heading)",
                    fontSize: "calc(9px * var(--font-scale))",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  {t("login.passphrase")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "black",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      fontFamily: "var(--font-mono)",
                      fontSize: "calc(12px * var(--font-scale))",
                      padding: "10px 40px 10px 12px",
                      outline: "none",
                      caretColor: "#39ff14",
                      letterSpacing: showPassword ? "0.1em" : "0.3em",
                      transition: "border-color 0.1s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#39ff14")}
                    onBlur={(e) =>
                      (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                    }
                    placeholder={t("login.passphrase_placeholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: showPassword ? "#39ff14" : "rgba(255, 255, 255, 0.4)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      outline: "none",
                      transition: "color 0.2s"
                    }}
                  >
                    {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                {isSignUp && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { label: t("login.req_chars", "8+ CHARS"), passed: password.length >= 8 },
                      { label: t("login.req_uppercase", "UPPERCASE"), passed: /[A-Z]/.test(password) },
                      { label: t("login.req_lowercase", "LOWERCASE"), passed: /[a-z]/.test(password) },
                      { label: t("login.req_number", "NUMBER"), passed: /[0-9]/.test(password) },
                      { label: t("login.req_special", "SPECIAL (!@#$)"), passed: /[!@#$%^&*()_+\-=]/.test(password) }
                    ].map((req, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "calc(9px * var(--font-scale))", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", color: req.passed ? "#39ff14" : "rgba(255,255,255,0.3)" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: req.passed ? "#39ff14" : "rgba(255,255,255,0.1)", border: `1px solid ${req.passed ? "#39ff14" : "rgba(255,255,255,0.3)"}`, transition: "all 0.2s" }} />
                        {req.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: "calc(8px * var(--font-scale))",
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
                  {t("login.secure_logging")}
                </span>
                <span style={{ color: "var(--struct-line)" }}>
                  {t("login.clearance")}
                </span>
              </div>

              {/* Submit */}
              <CyberButton
                type="submit"
                style={{ width: "100%" }}
                containerStyle={{ width: "100%", display: "flex", justifyContent: "center" }}
                disabled={loading}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t("login.processing")}</span>
                  </div>
                ) : (
                  isSignUp ? t("login.submit_signup") : t("login.authorize")
                )}
              </CyberButton>

              {/* Bottom links: Go To Home + Toggle switch */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                  width: "100%",
                }}
              >
                {onGoHome ? (
                  <button
                    type="button"
                    onMouseEnter={playHover}
                    onClick={() => {
                      playClick();
                      onGoHome();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#39ff14",
                      fontFamily: "var(--font-mono)",
                      fontSize: "calc(8px * var(--font-scale))",
                      letterSpacing: "0.08em",
                      textDecoration: "underline",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                    }}
                  >
                    {t("login.go_to_home")}
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onMouseEnter={playHover}
                  onClick={() => {
                    playClick();
                    setIsSignUp(!isSignUp);
                    setPassword("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#39ff14",
                    fontFamily: "var(--font-mono)",
                    fontSize: "calc(8px * var(--font-scale))",
                    letterSpacing: "0.08em",
                    textDecoration: "underline",
                    cursor: "pointer",
                    textAlign: "right",
                    padding: 0,
                  }}
                >
                  {isSignUp ? t("login.switch_to_login") : t("login.switch_to_signup")}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              padding: "12px 32px",
              fontFamily: "var(--font-mono)",
              fontSize: "calc(8px * var(--font-scale))",
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {t("login.footer_notice")}
          </div>
        </CyberCard>
      </motion.div>

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
            border: `1px solid ${toast.type === "error"
                ? "#ff3b30"
                : toast.type === "success"
                  ? "#39ff14"
                  : "#a855f7"
              }`,
            boxShadow: `0 0 16px ${toast.type === "error"
                ? "rgba(255,59,48,0.2)"
                : toast.type === "success"
                  ? "rgba(57,255,20,0.2)"
                  : "rgba(168,85,247,0.2)"
              }`,
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "calc(10px * var(--font-scale))",
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
              boxShadow: `0 0 6px ${toast.type === "error"
                  ? "#ff3b30"
                  : toast.type === "success"
                    ? "#39ff14"
                    : "#a855f7"
                }`,
            }}
          />
          {toast.message}
          <span style={{ marginLeft: 12, opacity: 0.5, fontSize: "calc(8px * var(--font-scale))" }}>✕</span>
        </div>
      )}
    </>
  );
}
