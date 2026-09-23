import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppProvider, useApp } from "./appContext";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Observe from "./pages/Observe";
import History from "./pages/History";
import Patterns from "./pages/Patterns";
import Report from "./pages/Report";
import SettingsPage from "./pages/Settings";
import RedFlags from "./pages/RedFlags";
import ChildForm from "./pages/ChildForm";
import LockScreen from "./pages/LockScreen";
import { getSetting } from "./db";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/", icon: "⌂", label: "nav.home" },
  { to: "/observe", icon: "✚", label: "nav.observe" },
  { to: "/history", icon: "≣", label: "nav.history" },
  { to: "/patterns", icon: "◔", label: "nav.patterns" },
  { to: "/report", icon: "⎙", label: "nav.report" },
  { to: "/settings", icon: "⚙", label: "nav.settings" },
];

function Shell() {
  const { t } = useTranslation();
  const { children, active, loading } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  useEffect(() => {
    void getSetting<string>("passcode").then((p) => {
      setLocked(!!p);
      setLockChecked(true);
    });
  }, []);

  if (loading || !lockChecked) {
    return (
      <div className="min-h-dvh grid place-items-center text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  const needsOnboarding = children.length === 0;
  const onOnboarding = loc.pathname.startsWith("/welcome") || loc.pathname === "/child/new";

  if (needsOnboarding && !onOnboarding) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  if (!active && loc.pathname !== "/child/new" && !loc.pathname.startsWith("/welcome")) {
    // children exist but none active — pick happens automatically via context fallback
    return null;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pb-28 pt-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/observe" element={<Observe />} />
          <Route path="/history" element={<History />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/redflags" element={<RedFlags />} />
          <Route path="/child/new" element={<ChildForm />} />
          <Route path="/child/:id/edit" element={<ChildForm />} />
        </Routes>
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-slate-950/95 border-t border-slate-800 backdrop-blur z-40">
        <div className="mx-auto max-w-lg grid grid-cols-6">
          {NAV.map((n) => {
            const selected = loc.pathname === n.to;
            return (
              <button
                key={n.to}
                onClick={() => void nav(n.to)}
                aria-current={selected ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] touch-target
                  ${selected ? "text-teal-400" : "text-slate-500 hover:text-slate-300"}`}
              >
                <span aria-hidden className="text-lg leading-none">{n.icon}</span>
                {t(n.label)}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
