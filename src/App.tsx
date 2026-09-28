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

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconHome = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V20a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V9.5" />
    <path d="M9.5 20.5v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5" />
  </svg>
);
const IconObserve = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const IconHistory = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <path d="M8 6.5h12M8 12h12M8 17.5h12" />
    <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" strokeWidth={2.6} />
  </svg>
);
const IconPatterns = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <path d="M4 19.5V10M9.5 19.5V4.5M15 19.5v-8M20.5 19.5V8" />
  </svg>
);
const IconReport = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <path d="M6.5 3.5h7L19 8.5v11a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
    <path d="M13.5 3.5V9H19M9 13h6.5M9 16.5h4" />
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.8v2.2M12 18v2.2M3.8 12H6M18 12h2.2M6.2 6.2l1.5 1.5M16.3 16.3l1.5 1.5M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5" />
  </svg>
);

const NAV = [
  { to: "/", Icon: IconHome, label: "nav.home" },
  { to: "/observe", Icon: IconObserve, label: "nav.observe" },
  { to: "/history", Icon: IconHistory, label: "nav.history" },
  { to: "/patterns", Icon: IconPatterns, label: "nav.patterns" },
  { to: "/settings", Icon: IconSettings, label: "nav.settings" },
];

// Report is a destination, not a daily tab — reachable in the desktop rail
// and from Dashboard/Patterns entry points on mobile.
const REPORT_NAV = { to: "/report", Icon: IconReport, label: "nav.report" };

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
    const arm = () => setLocked(true);
    window.addEventListener("owly:lock", arm);
    return () => window.removeEventListener("owly:lock", arm);
  }, []);

  if (loading || !lockChecked) {
    return (
      <div className="min-h-dvh grid place-items-center text-neutral-600">
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
    // children exist but none active yet — context fallback picks one shortly
    return (
      <div className="min-h-dvh grid place-items-center text-neutral-600">
        {t("common.loading")}
      </div>
    );
  }

  const railItems = [...NAV.slice(0, 4), REPORT_NAV, NAV[4]];

  return (
    <div className="min-h-dvh">
      {/* Desktop / tablet: left rail */}
      <aside className="hidden md:flex md:flex-col fixed inset-y-0 left-0 w-56 z-40 border-r border-neutral-200 bg-white/75 backdrop-blur-xl px-3 py-6">
        <div className="px-2 pb-5">
          <span className="text-lg font-bold tracking-tight">Owly</span>
          <p className="text-xs text-neutral-600">{t("app.tagline")}</p>
          {active?.isDemo && (
            <span className="badge bg-amber-100 text-amber-800 border border-amber-200 mt-2">
              {t("app.demoBadge")}
            </span>
          )}
        </div>
        <nav className="flex-1 space-y-0.5" aria-label={t("app.navLabel")}>
          {railItems.map((n) => {
            const selected = loc.pathname === n.to;
            return (
              <button
                key={n.to}
                onClick={() => void nav(n.to)}
                aria-current={selected ? "page" : undefined}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors duration-150 min-h-11
                  ${selected ? "bg-teal-50 text-teal-700 font-semibold" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
              >
                <span aria-hidden className="leading-none shrink-0"><n.Icon /></span>
                {t(n.label)}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-neutral-200 pt-3">
          <button
            onClick={() => void nav("/redflags")}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors min-h-11"
          >
            ⚠ {t("nav.redflags")}
          </button>
        </div>
      </aside>

      <div className="md:pl-56 flex flex-col min-h-dvh">
        {active?.isDemo && (
          <div className="md:hidden px-4 pt-3">
            <span className="badge bg-amber-100 text-amber-800 border border-amber-200">
              {t("app.demoBadge")}
            </span>
          </div>
        )}
        <main className="flex-1 mx-auto w-full max-w-lg md:max-w-2xl px-4 pb-28 md:pb-14 pt-6 md:pt-10">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/observe" element={<Observe />} />
            <Route path="/observe/:id/edit" element={<Observe />} />
            <Route path="/history" element={<History />} />
            <Route path="/patterns" element={<Patterns />} />
            <Route path="/report" element={<Report />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/redflags" element={<RedFlags />} />
            <Route path="/child/new" element={<ChildForm />} />
            <Route path="/child/:id/edit" element={<ChildForm />} />
          </Routes>
        </main>
      </div>

      {/* Mobile: 5 calm tabs — flat bottom bar, no floating pill */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label={t("app.navLabel")}>
        <div className="mx-auto max-w-lg grid grid-cols-5">
          {NAV.map((n) => {
            const selected = loc.pathname === n.to;
            return (
              <button
                key={n.to}
                onClick={() => void nav(n.to)}
                aria-current={selected ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-[13px] font-medium touch-target transition-colors duration-150 border-t-2 -mt-px
                  ${selected ? "text-teal-700 border-teal-700" : "text-neutral-600 border-transparent hover:text-neutral-900"}`}
              >
                <span aria-hidden className="leading-none"><n.Icon /></span>
                {/* Wrapping + hyphenation keep long native labels (e.g. de
                    "Einstellungen") fully visible at 320px instead of clipped. */}
                <span className="w-full text-center leading-tight break-words hyphens-auto">{t(n.label)}</span>
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
