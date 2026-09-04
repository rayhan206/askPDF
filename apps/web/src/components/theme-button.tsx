import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeButton({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(() => localStorage.getItem("askpdf.theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("askpdf.theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      className={`theme-button ${className}`.trim()}
      onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
