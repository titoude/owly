import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting, setSetting } from "../db";
import { verifyPin } from "../pin";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const attempts = useRef(0);

  async function tryUnlock(value: string) {
    const stored = await getSetting<string>("passcode");
    if (!stored) return onUnlock();
    const upgraded = await verifyPin(value, stored);
    if (upgraded) {
      if (upgraded !== stored) await setSetting("passcode", upgraded); // legacy → salted
      onUnlock();
    } else {
      attempts.current += 1;
      setError(true);
      setPin("");
      if (attempts.current >= MAX_ATTEMPTS) {
        attempts.current = 0;
        setCooldownUntil(Date.now() + LOCKOUT_MS);
        setTimeout(() => setCooldownUntil(0), LOCKOUT_MS);
      }
    }
  }

  const coolingDown = cooldownUntil > Date.now();

  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="space-y-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-20 rounded-3xl" />
        <p className="text-neutral-600">
          {coolingDown ? t("settings.unlockWait") : t("settings.unlock")}
        </p>
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
          className={`input text-center text-2xl tracking-[0.5em] w-40 ${error ? "border-red-500" : ""}`}
          aria-label={t("settings.unlock")}
        />
      </div>
    </div>
  );
}
