import type { PropsWithChildren } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { BrandLogo } from "./components/brand-logo";
import { SessionProvider, useSession } from "./session";
import { AuthPage } from "./pages/auth-page";
import { ChatPage } from "./pages/chat-page";
import { DocumentsPage } from "./pages/documents-page";

function BusyScreen() {
  return (
    <div className="busy-screen">
      <BrandLogo compact />
      <span className="spinner" />
      Loading your workspace…
    </div>
  );
}

function Protected({ children }: PropsWithChildren) {
  const session = useSession();
  if (session.loading) return <BusyScreen />;
  if (!session.profile) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }: PropsWithChildren) {
  const session = useSession();
  if (session.loading) return <BusyScreen />;
  return session.profile ? <Navigate to="/documents" replace /> : children;
}

export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <AuthPage />
            </PublicOnly>
          }
        />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/ask" element={<ChatPage />} />
          <Route path="/ask/:conversationId" element={<ChatPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
