import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api";
import { BrandLogo } from "../components/brand-logo";
import { ThemeButton } from "../components/theme-button";

export function AuthPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identityMode, setIdentityMode] = useState<"email" | "phone">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const identifier = String(form.get("identifier") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const profile =
        mode === "login"
          ? await api.login(identifier, password)
          : await api.register({
              displayName: String(form.get("displayName") ?? "").trim(),
              ...(identityMode === "email" ? { email: identifier } : { phone: identifier }),
              password,
            });
      queryClient.setQueryData(["session"], profile);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <ThemeButton className="auth-theme" />
      <section className="auth-story">
        <BrandLogo />
        <div className="auth-copy">
          <h1>Ask a document. Check the page.</h1>
          <p>
            AskPDF processes uploaded PDFs outside the request path, retrieves only authorized
            document versions, and links factual answers to the pages that support them.
          </p>
          <ol className="auth-process">
            <li>
              <span>01</span>
              <p>
                <strong>Upload</strong>PDF files go directly to private object storage.
              </p>
            </li>
            <li>
              <span>02</span>
              <p>
                <strong>Process</strong>Background workers extract, chunk, and index each page.
              </p>
            </li>
            <li>
              <span>03</span>
              <p>
                <strong>Verify</strong>Answers cite the stored page evidence or abstain.
              </p>
            </li>
          </ol>
        </div>
        <p className="auth-footnote">Citation-first retrieval · workspace-isolated access</p>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <h2>{mode === "login" ? "Sign in" : "Create an account"}</h2>
          <p>
            {mode === "login"
              ? "Use the email or phone number linked to your account."
              : "No verification step—your private workspace is ready immediately."}
          </p>
          <div className="segmented" aria-label="Login identifier">
            <button
              className={identityMode === "email" ? "active" : ""}
              onClick={() => setIdentityMode("email")}
            >
              Email
            </button>
            <button
              className={identityMode === "phone" ? "active" : ""}
              onClick={() => setIdentityMode("phone")}
            >
              Phone
            </button>
          </div>
          <form onSubmit={(event) => void submit(event)}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  name="displayName"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              {identityMode === "email" ? "Email address" : "Phone number"}
              <input
                name="identifier"
                type={identityMode === "email" ? "email" : "tel"}
                autoComplete={identityMode === "email" ? "email" : "tel"}
                required
                placeholder={identityMode === "email" ? "you@example.com" : "+919876543210"}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="At least 12 characters"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button auth-submit" disabled={busy}>
              {busy ? "Submitting…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to AskPDF?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
