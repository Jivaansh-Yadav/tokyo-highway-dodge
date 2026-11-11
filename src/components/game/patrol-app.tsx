"use client";

import { motion } from "framer-motion";
import { Camera, Globe, Grip, MoveHorizontal, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { changeLocale, getLocalePreference, type LocalePreference } from "@/i18n";
import { HighwayGame } from "@/components/game/highway-game";
import { useMounted } from "@/lib/hooks";
import {
  getBestScoreServerSnapshot,
  getBestScoreSnapshot,
  getTopRunsServerSnapshot,
  getTopRunsSnapshot,
  subscribeScores,
} from "@/lib/scores";

function PatrolLanguageControl() {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<LocalePreference>(getLocalePreference);
  const mounted = useMounted();

  const handleChange = (value: LocalePreference) => {
    setPreference(value);
    void changeLocale(value);
  };

  if (!mounted) {
    return (
      <div className="h-9 w-[116px] rounded-[0.5rem] border border-[var(--color-border)] bg-black/40" />
    );
  }

  return (
    <label className="flex h-9 items-center gap-2 rounded-[0.5rem] border border-[var(--color-border)] bg-black/55 px-3 text-[0.75rem] font-medium text-[var(--color-text-secondary)] shadow-[0_0_18px_rgba(255,204,0,0.08)]">
      <Globe className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={preference}
        onChange={(event) => handleChange(event.target.value as LocalePreference)}
        className="min-h-8 bg-transparent font-[family:var(--font-heading)] text-[0.75rem] uppercase tracking-[0.05em] text-[var(--color-text-primary)] outline-none"
        aria-label={t("language.label")}
      >
        <option value="system">{t("language.followSystem")}</option>
        <option value="en-US">{t("language.enUS")}</option>
        <option value="zh-CN">{t("language.zhCN")}</option>
      </select>
    </label>
  );
}

export function PatrolApp() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<"intro" | "game">("intro");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const bestScore = useSyncExternalStore(
    subscribeScores,
    getBestScoreSnapshot,
    getBestScoreServerSnapshot,
  );
  const topRuns = useSyncExternalStore(
    subscribeScores,
    getTopRunsSnapshot,
    getTopRunsServerSnapshot,
  );

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const skyline = useMemo(() => ["h-36 w-12", "h-56 w-20", "h-28 w-16", "h-48 w-24", "h-40 w-14"], []);

  const startGame = async () => {
    setStartError(null);
    if (shellRef.current?.requestFullscreen && !document.fullscreenElement) {
      try {
        await shellRef.current.requestFullscreen();
      } catch {
        // Fullscreen is optional; camera permission is requested directly below.
      }
    }
    try {
      if (!cameraStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 320, max: 480 },
            height: { ideal: 240, max: 360 },
            frameRate: { ideal: 15, max: 20 },
          },
          audio: false,
        });
        setCameraStream(stream);
      }
    } catch {
      setStartError(t("calibration.permissionDenied"));
    }
    setScreen("game");
  };

  const backToMenu = () => {
    setScreen("intro");
  };

  return (
    <main ref={shellRef} className="relative min-h-svh overflow-hidden bg-[var(--color-accent)] text-[var(--color-text-primary)]">
      {screen === "game" ? (
        <HighwayGame
          soundEnabled={soundEnabled}
          initialCameraStream={cameraStream}
          initialCameraError={startError}
          onBackToMenu={backToMenu}
        />
      ) : (
        <section className="patrol-scanlines relative flex min-h-svh flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_110%,rgba(255,204,0,0.16),transparent_32%),linear-gradient(180deg,rgba(13,14,18,0.25),rgba(0,0,0,0.8))]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[46%] bg-[linear-gradient(90deg,transparent_0_18%,rgba(255,204,0,0.22)_18.4%,transparent_18.8%_48%,rgba(255,255,255,0.16)_49%,rgba(255,255,255,0.16)_51%,transparent_52%_81%,rgba(255,51,51,0.2)_81.2%,transparent_82%)] opacity-70" />
          <div className="pointer-events-none absolute top-[20%] left-0 z-0 flex h-[25%] w-full items-end justify-around opacity-10">
            {skyline.map((shape, index) => (
              <div
                key={shape}
                className={`${shape} rounded-t bg-[var(--color-text-muted)] ${index === 1 ? "bg-[var(--color-border)]" : ""} ${index === 2 ? "bg-[var(--color-primary)]" : ""}`}
              />
            ))}
          </div>

          <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
              <span className="font-[family:var(--font-heading)] text-[0.75rem] uppercase tracking-[0.05em] text-[var(--color-text-secondary)]">
                {t("intro.status.sector")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden font-[family:var(--font-heading)] text-[0.75rem] text-[var(--color-text-muted)] sm:inline">
                {t("intro.status.version")}
              </span>
              <PatrolLanguageControl />
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                whileHover={{ y: -1 }}
                onClick={() => setSoundEnabled((value) => !value)}
                aria-label={t("intro.audio.toggle")}
                className="grid h-9 w-9 place-items-center rounded-[0.5rem] border border-[var(--color-border)] bg-black/40 text-[var(--color-primary)] hover:bg-white/5"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </motion.button>
            </div>
          </header>

          <div className="relative z-20 mx-auto my-auto flex w-full max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative mb-3"
            >
              <h1 className="select-none bg-gradient-to-b from-white via-[var(--color-text-secondary)] to-[var(--color-text-muted)] bg-clip-text text-[3.75rem] font-black leading-[0.95] tracking-[-0.02em] text-transparent md:text-[6rem]">
                {t("intro.title.main")}
              </h1>
              <h2 className="mt-[-8px] font-[family:var(--font-heading)] text-[2rem] font-extrabold uppercase tracking-[0.14em] text-[var(--color-primary)] drop-shadow-[0_0_15px_rgba(255,204,0,0.5)] md:text-[3rem]">
                {t("intro.title.sub")}
              </h2>
            </motion.div>

            <p className="mb-8 max-w-md text-base leading-6 text-[var(--color-text-secondary)]">
              {t("intro.description")}
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="relative mb-8 w-full max-w-sm overflow-hidden rounded-[1rem] border border-[var(--color-border)] bg-black/80 p-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
            >
              <span className="mb-3 block font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {t("intro.tutorial.badge")}
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center rounded-[0.5rem] border border-[var(--color-border)] bg-[#0b0c10] p-3 text-center">
                  <div className="mb-2 grid h-10 w-10 place-items-center rounded-full border border-[rgba(255,204,0,0.4)] bg-[rgba(255,204,0,0.1)]">
                    <Grip className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <span className="mb-1 text-[0.75rem] font-bold text-[var(--color-text-primary)]">{t("intro.tutorial.step1.title")}</span>
                  <span className="text-[0.75rem] leading-4 text-[var(--color-text-secondary)]">{t("intro.tutorial.step1.desc")}</span>
                </div>
                <div className="flex flex-col items-center rounded-[0.5rem] border border-[var(--color-border)] bg-[#0b0c10] p-3 text-center">
                  <div className="mb-2 grid h-10 w-10 place-items-center rounded-full border border-[rgba(148,163,184,0.4)] bg-white/5">
                    <MoveHorizontal className="h-5 w-5 text-[var(--color-text-primary)]" />
                  </div>
                  <span className="mb-1 text-[0.75rem] font-bold text-[var(--color-text-primary)]">{t("intro.tutorial.step2.title")}</span>
                  <span className="text-[0.75rem] leading-4 text-[var(--color-text-secondary)]">{t("intro.tutorial.step2.desc")}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-[0.75rem] text-[var(--color-text-secondary)]">
                <span>{t("intro.tutorial.privacy")}</span>
                <span className="font-semibold text-[var(--color-states-success)]">{t("intro.tutorial.security")}</span>
              </div>
            </motion.div>

            <div className="mb-8 grid w-full max-w-2xl gap-3 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1rem] border border-[var(--color-border)] bg-black/65 p-4 text-left shadow-[0_14px_46px_rgba(0,0,0,0.34)]">
                <div className="mb-3 font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">{t("intro.perks.title")}</div>
                <div className="grid gap-2 text-[0.78rem] text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-primary)] font-bold text-black">+</span>{t("intro.perks.coin")}</div>
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400 font-bold text-black">S</span>{t("intro.perks.shield")}</div>
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-secondary)] font-bold text-black">X</span>{t("intro.perks.swap")}</div>
                </div>
              </div>
              <div className="rounded-[1rem] border border-[var(--color-border)] bg-black/65 p-4 text-left shadow-[0_14px_46px_rgba(0,0,0,0.34)]">
                <div className="mb-3 font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">{t("intro.leaderboard.title")}</div>
                {topRuns.length ? (
                  <div className="space-y-2">
                    {topRuns.map((score, index) => (
                      <div key={`${score}-${index}`} className="flex items-center justify-between rounded-[0.45rem] bg-white/[0.04] px-2.5 py-2 text-[0.78rem] text-[var(--color-text-secondary)]">
                        <span className="font-[family:var(--font-heading)] text-[var(--color-text-primary)]">#{index + 1}</span>
                        <span>{score.toLocaleString()} m</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[0.78rem] leading-5 text-[var(--color-text-secondary)]">{t("intro.leaderboard.empty")}</p>
                )}
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={startGame}
              className="flex w-full items-center justify-center gap-3 rounded-[0.5rem] bg-[var(--color-primary)] px-8 py-4 font-[family:var(--font-heading)] text-base font-extrabold uppercase tracking-[0.14em] text-black shadow-[0_0_32px_rgba(255,204,0,0.24)] sm:w-auto"
            >
              <Play className="h-5 w-5 fill-current" />
              {t("intro.action.start")}
            </motion.button>
          </div>

          <footer className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] px-6 py-6 text-[0.75rem] text-[var(--color-text-secondary)] sm:flex-row">
            <div className="flex flex-wrap justify-center gap-4">
              <span>{t("intro.specs.display")}</span>
              <span>{t("intro.specs.engine")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-[var(--color-primary)]" />
              <span>{t("intro.specs.bestLabel")}</span>
              <strong className="font-[family:var(--font-heading)] text-sm font-semibold text-[var(--color-primary)]">
                {t("intro.specs.best", { score: bestScore.toLocaleString() })}
              </strong>
            </div>
          </footer>
        </section>
      )}
    </main>
  );
}
