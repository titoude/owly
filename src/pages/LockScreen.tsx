import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, setSetting } from "../db";
import { deleteAll } from "../export";
import { verifyPin } from "../pin";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    void getSetting<number>("pinCooldownUntil").then((v) => {
      if (v && v > Date.now()) setCooldownUntil(v);
    });
    void getSetting<number>("pinAttempts").then((v) => {
      attempts.current = v ?? 0;
    });
  }, []);

  // Keep the cooldown honest across reloads: re-check until expiry instead
  // of relying on a setTimeout that dies with the mount.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const iv = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(0);
        void setSetting("pinCooldownUntil", 0);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [cooldownUntil]);

  async function tryUnlock(value: string) {
    const stored = await getSetting<string>("passcode");
    if (!stored) return onUnlock();
    const upgraded = await verifyPin(value, stored);
    if (upgraded) {
      if (upgraded !== stored) await setSetting("passcode", upgraded); // legacy → salted
      // A correct PIN clears any accumulated strikes — old typos must not
      // carry toward a future lockout.
      attempts.current = 0;
      void setSetting("pinAttempts", 0);
      onUnlock();
    } else {
      attempts.current += 1;
      void setSetting("pinAttempts", attempts.current);
      setError(true);
      setPin("");
      if (attempts.current >= MAX_ATTEMPTS) {
        attempts.current = 0;
        void setSetting("pinAttempts", 0);
        const until = Date.now() + LOCKOUT_MS;
        setCooldownUntil(until);
        void setSetting("pinCooldownUntil", until);
        setTimeout(() => setCooldownUntil(0), LOCKOUT_MS);
      }
    }
  }

  const coolingDown = cooldownUntil > Date.now();

  async function wipe() {
    setWiping(true);
    await deleteAll();
    location.reload();
  }

  return (
    <main className="min-h-dvh grid place-items-center" aria-labelledby="lock-heading">
      <div className="space-y-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-20 rounded-3xl" />
        <h1 id="lock-heading" className="text-xl font-semibold text-neutral-800">
          {coolingDown ? t("settings.unlockWait") : t("settings.unlock")}
        </h1>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
          disabled={coolingDown}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setPin(v);
            setError(false);
            if (v.length === 4) void tryUnlock(v);
          }}
          className={`input text-center text-2xl tracking-[0.5em] !w-40 ${error ? "border-red-500" : ""}`}
          aria-label={t("settings.unlock")}
        />
        {error && <p className="text-[13px] text-red-700" role="alert">{t("settings.wrongPin")}</p>}
        {!confirmWipe ? (
          <button type="button" className="inline-flex min-h-11 items-center text-[13px] text-neutral-700 underline underline-offset-2" onClick={() => setConfirmWipe(true)}>
            {t("settings.forgotPin")}
          </button>
        ) : (
          <div className="card p-4 space-y-2 text-start">
            <p className="text-[13px] text-neutral-600">{t("settings.forgotPinWarning")}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => setConfirmWipe(false)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={wiping}
                onClick={() => void wipe()}
              >
                {wiping ? t("common.loading") : t("settings.wipeAll")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
