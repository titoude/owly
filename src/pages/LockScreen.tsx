import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getSetting } from "../db";
import { hashPin } from "../pin";

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function tryUnlock(value: string) {
    const stored = await getSetting<string>("passcode");
    if ((await hashPin(value)) === stored) onUnlock();
    else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="space-y-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-20 rounded-3xl" />
        <p className="text-slate-400">{t("settings.unlock")}</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
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
