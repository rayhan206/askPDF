import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../session";
import { BrandLogo } from "./brand-logo";
import { ThemeButton } from "./theme-button";

const navigation = [
  { to: "/documents", label: "Documents", index: "01" },
  { to: "/ask", label: "Conversations", index: "02" },
] as const;

export function AppShell() {
  const { profile, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  if (!profile) return null;

  const initials = profile.user.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <BrandLogo />
          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span>{item.index}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-principle">
          <span>Verification rule</span>
          <p>Factual answers are shown only when page evidence can be cited.</p>
        </div>
        <button className="profile-button" onClick={() => void signOut()}>
          <span className="avatar">{initials}</span>
          <span className="profile-copy">
            <strong>{profile.user.displayName}</strong>
            <small>{profile.user.email ?? profile.user.phone}</small>
          </span>
          <LogOut size={16} aria-hidden="true" />
          <span className="sr-only">Sign out</span>
        </button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <span className="topbar-context">Private workspace</span>
          <ThemeButton />
        </header>
        <main>
          <Outlet />
        </main>
        <nav className="mobile-navigation" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span>{item.index}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {open ? (
        <button
          className="scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation overlay"
        />
      ) : null}
    </div>
  );
}
