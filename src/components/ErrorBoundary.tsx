import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

function Fallback() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="card p-6 space-y-3 text-center" role="alert">
        <h1 className="text-lg font-semibold">{t("app.crashTitle")}</h1>
        <p className="text-sm text-neutral-600">{t("app.crashBody")}</p>
        <button type="button" className="btn-primary px-6" onClick={() => window.location.reload()}>
          {t("app.crashReload")}
        </button>
      </div>
    </div>
  );
}

// A render crash inside a route used to unmount the whole tree into a
// white screen. Degrade to a recoverable card instead; the Shell keys the
// boundary by pathname so navigating away clears the crashed subtree.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("route crash", err);
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
