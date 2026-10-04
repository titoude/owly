import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { ErrorBoundary } from "./components/ErrorBoundary";
import { db, getSetting } from "./db";
import { useEffect, useState } from "react";
import {
  IconHome, IconObserve, IconHistory, IconPatterns, IconReport, IconSettings, IconAlert,
} from "./components/icons";

const NAV = [
  { to: "/", Icon: IconHome, label: "nav.home" },
  { to: "/observe", Icon: IconObserve, label: "nav.observe" },
  { to: "/history", Icon: IconHistory, label: "nav.history" },
  { to: "/patterns", Icon: IconPatterns, label: "nav.patterns" },
  { to: "/settings", Icon: IconSettings, label: "nav.settings" },
];

// The wizard must remount on every identity change — same-component
// reconciliation otherwise carries fields/draft state between an edit and
// a fresh observation, or between two children.
function ObserveKeyed() {
  const { active } = useApp();
  const { id } = useParams();
  return <Observe key={`${active?.id ?? "none"}:${id ?? "new"}`} />;
}

// Report is a destination, not a daily tab — present in the desktop top nav
// and reachable from Dashboard/Patterns entry points on mobile.
const REPORT_NAV = { to: "/report", Icon: IconReport, label: "nav.report" };
const TOP_NAV = [...NAV.slice(0, 4), REPORT_NAV, NAV[4]];

function Shell() {
  const { t } = useTranslation();
  const { children, active, loading, error, refresh } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  useEffect(() => {
    getSetting<string>("passcode").then((p) => {
      setLocked(!!p);
      setLockChecked(true);
    }).catch(() => {
      // DB unreachable — the provider's error state takes over the screen.
      setLockChecked(true);
    });
    const arm = () => setLocked(true);
    window.addEventListener("owly:lock", arm);
    // The CustomEvent only reaches this window — other open tabs get the
    // localStorage `storage` event instead so the lock arms everywhere.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "owly-lock-signal" && e.newValue) setLocked(true);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("owly:lock", arm);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // HashRouter preserves scroll across route changes — every new page
  // should open at its top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [loc.pathname]);

  if (loading || !lockChecked) {
    return (
      <div className="min-h-dvh grid place-items-center text-neutral-600">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh grid place-items-center px-6">
        <div className="max-w-sm text-center space-y-4" role="alert">
          <h1 className="text-xl font-bold">{t("app.storageErrorTitle")}</h1>
          <p className="text-sm text-neutral-600">{t("app.storageErrorBody")}</p>
          <button type="button" className="btn-primary px-6" onClick={() => {
            // Dexie caches a rejected open — closing resets it so the next
            // access re-issues indexedDB.open. Without this, "Try again"
            // can never heal a restored permission.
            try { db.close(); } catch { /* already closed */ }
            void refresh();
          }}>
            {t("common.retry")}
          </button>
        </div>
      </main>
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

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        onClick={(e) => {
          // HashRouter owns location.hash — a native #main jump would replace
          // the route. Move focus programmatically instead.
          e.preventDefault();
          const m = document.getElementById("main");
          m?.focus();
          m?.scrollIntoView({ block: "start" });
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        {t("app.skipToContent")}
      </a>

      {/* Compact top bar — brand, destinations, child context, emergency. */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1">
            <img src="/icon.svg" alt="" className="size-7 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">Owly</span>
          </Link>

          {/* Full nav only once every destination + child + Emergency actually
              fits (long DE/AR labels overflow below lg) — compact bottom nav
              covers md. */}
          <nav className="mx-auto hidden items-center gap-0.5 lg:flex" aria-label={t("app.navLabel")}>
            {TOP_NAV.map((n) => {
              const selected = loc.pathname === n.to;
              return (
                <button
                  key={n.to}
                  onClick={() => void nav(n.to)}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150
                    ${selected ? "bg-white text-neutral-900 shadow-[inset_0_0_0_1px_var(--color-neutral-200)]" : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900"}`}
                >
                  <span aria-hidden className="leading-none"><n.Icon size={17} /></span>
                  {t(n.label)}
                </button>
              );
            })}
          </nav>

          <div className="ms-auto flex min-w-0 items-center gap-2 lg:ms-0">
            {active && (
              <Link
                to="/settings"
                title={t("app.changeChild")}
                className="flex min-w-0 max-w-40 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-white/70"
              >
                <span className="truncate" dir="auto">{active.name}</span>
                {active.isDemo && (
                  <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    {t("app.demoBadgeShort")}
                  </span>
                )}
              </Link>
            )}
            <Link
              to="/redflags"
              aria-label={t("nav.redflags")}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              <span aria-hidden className="leading-none"><IconAlert size={17} /></span>
              <span className="hidden sm:inline">{t("nav.redflags")}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-6 focus:outline-none md:max-w-5xl md:pt-8 lg:pb-14">
          {/* Route-level crash containment: a broken page degrades to a
              recoverable card keyed by pathname — the rest of the shell
              stays mounted and navigating away clears the failed subtree. */}
          <ErrorBoundary key={loc.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/observe" element={<ObserveKeyed />} />
            <Route path="/observe/:id/edit" element={<ObserveKeyed />} />
            <Route path="/history" element={<History />} />
            <Route path="/patterns" element={<Patterns />} />
            <Route path="/report" element={<Report />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/redflags" element={<RedFlags />} />
            {/* The emergency surface lives at /redflags; keep the intuitive
                path working instead of silently landing home. */}
            <Route path="/emergency" element={<Navigate to="/redflags" replace />} />
            <Route path="/child/new" element={<ChildForm />} />
            <Route path="/child/:id/edit" element={<ChildForm />} />
            {/* Unknown paths (incl. /observe/<id> without /edit) go home
                rather than rendering an empty main. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile: 5 calm tabs — flat bottom bar, no floating pill */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-neutral-200 bg-neutral-50 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label={t("app.navLabel")}>
        <div className="mx-auto max-w-lg grid grid-cols-5">
          {NAV.map((n) => {
            const selected = loc.pathname === n.to;
            return (
              <button
                key={n.to}
                onClick={() => void nav(n.to)}
                aria-current={selected ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-[12px] font-medium touch-target !min-w-0 transition-colors duration-150
                  ${selected ? "text-accent-700" : "text-neutral-600 hover:text-neutral-900"}`}
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
