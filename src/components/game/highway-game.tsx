"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Heart, Pause, Play, RotateCcw, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  getBestScoreServerSnapshot,
  getBestScoreSnapshot,
  recordRun,
  subscribeScores,
} from "@/lib/scores";

type HandStatus = "none" | "open" | "fist";
type GamePhase = "calibration" | "playing" | "gameover";
type Obstacle = { id: number; x: number; y: number; w: number; h: number; speed: number; passed: boolean; near: boolean };
type PrizeTokenKind = "coin" | "shield" | "swap";
type PrizeToken = { id: number; kind: PrizeTokenKind; x: number; y: number; r: number; speed: number; collected: boolean };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; life: number };

type Landmark = { x: number; y: number; z?: number };
type HandResults = { image?: HTMLVideoElement; multiHandLandmarks?: Landmark[][] };
type HandsInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: HandResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

declare global {
  interface Window {
    Hands?: new (config: { locateFile: (file: string) => string }) => HandsInstance;
    Camera?: new (
      video: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number },
    ) => { start: () => Promise<void>; stop?: () => void };
  }
}

const WIDTH = 900;
const HEIGHT = 1400;
const CAR_W = 86;
const CAR_H = 142;
const PLAYER_Y = HEIGHT - 150;
const LANES = [0.22, 0.39, 0.56, 0.73];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(src));
    document.head.appendChild(script);
  });
}

function isFist(landmarks: Landmark[]) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let curled = 0;
  tips.forEach((tip, index) => {
    if (landmarks[tip] && landmarks[pips[index]] && landmarks[tip].y > landmarks[pips[index]].y) curled += 1;
  });
  return curled >= 3;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickPrizeTokenKind(): PrizeTokenKind {
  const roll = Math.random();
  if (roll < 0.035) return "swap";
  if (roll < 0.15) return "shield";
  return "coin";
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, blink: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (blink) ctx.globalAlpha = 0.42;
  ctx.shadowColor = "rgba(255,204,0,0.45)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#FFCC00";
  ctx.beginPath();
  ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 18);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#0d0e12";
  ctx.beginPath();
  ctx.roundRect(-28, -48, 56, 46, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillRect(-22, -42, 16, 28);
  ctx.fillRect(6, -42, 16, 28);

  ctx.fillStyle = "rgba(13,14,18,0.82)";
  ctx.fillRect(-5, -66, 10, 118);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-33, -20, 8, 42);
  ctx.fillRect(25, -20, 8, 42);

  ctx.fillStyle = "#0d0e12";
  ctx.fillRect(-50, -42, 12, 34);
  ctx.fillRect(38, -42, 12, 34);
  ctx.fillRect(-50, 20, 12, 34);
  ctx.fillRect(38, 20, 12, 34);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-30, -62, 20, 8);
  ctx.fillRect(10, -62, 20, 8);
  ctx.fillStyle = "#FF3333";
  ctx.fillRect(-34, 52, 18, 10);
  ctx.fillRect(16, 52, 18, 10);
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle) {
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.fillStyle = "#111318";
  ctx.strokeStyle = "#FF3333";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(255,51,51,0.32)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.roundRect(-obstacle.w / 2, -obstacle.h / 2, obstacle.w, obstacle.h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.roundRect(-obstacle.w / 2 + 14, -obstacle.h / 2 + 20, obstacle.w - 28, 26, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-obstacle.w / 2 + 22, -obstacle.h / 2 + 26, 18, 14);
  ctx.fillRect(obstacle.w / 2 - 40, -obstacle.h / 2 + 26, 18, 14);
  ctx.fillStyle = "rgba(255,204,0,0.22)";
  ctx.fillRect(-4, -obstacle.h / 2 + 12, 8, obstacle.h - 32);
  ctx.fillStyle = "#0d0e12";
  ctx.fillRect(-obstacle.w / 2 - 4, -40, 9, 30);
  ctx.fillRect(obstacle.w / 2 - 5, -40, 9, 30);
  ctx.fillRect(-obstacle.w / 2 - 4, 24, 9, 30);
  ctx.fillRect(obstacle.w / 2 - 5, 24, 9, 30);
  ctx.fillStyle = "#FF3333";
  ctx.fillRect(-obstacle.w / 2 + 12, obstacle.h / 2 - 20, 18, 8);
  ctx.fillRect(obstacle.w / 2 - 30, obstacle.h / 2 - 20, 18, 8);
  ctx.restore();
}

function drawPrizeToken(ctx: CanvasRenderingContext2D, token: PrizeToken, pulse: number) {
  ctx.save();
  ctx.translate(token.x, token.y);
  const scale = 1 + Math.sin(pulse * 0.18 + token.id) * 0.08;
  ctx.scale(scale, scale);

  const color = token.kind === "shield" ? "#10b981" : token.kind === "swap" ? "#FF3333" : "#FFCC00";
  const label = token.kind === "shield" ? "S" : token.kind === "swap" ? "X" : "+";
  ctx.shadowColor = token.kind === "swap" ? "rgba(255,51,51,0.75)" : token.kind === "shield" ? "rgba(16,185,129,0.7)" : "rgba(255,204,0,0.65)";
  ctx.shadowBlur = token.kind === "swap" ? 26 : 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, token.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(13,14,18,0.9)";
  ctx.lineWidth = token.kind === "coin" ? 5 : 4;
  ctx.beginPath();
  ctx.arc(0, 0, token.r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  if (token.kind !== "coin") {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, token.r + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#0d0e12";
  ctx.font = "700 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawRoad(ctx: CanvasRenderingContext2D, speed: number, offset: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#181b22");
  gradient.addColorStop(0.5, "#0d0e12");
  gradient.addColorStop(1, "#050609");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,204,0,0.12)";
  ctx.fillRect(86, 0, 10, HEIGHT);
  ctx.fillStyle = "rgba(255,51,51,0.16)";
  ctx.fillRect(WIDTH - 96, 0, 10, HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 8;
  ctx.setLineDash([58, 42]);
  ctx.lineDashOffset = -offset * (1 + speed * 0.02);
  [0.305, 0.475, 0.645].forEach((lane) => {
    ctx.beginPath();
    ctx.moveTo(WIDTH * lane, 0);
    ctx.lineTo(WIDTH * lane, HEIGHT);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const reflection = ctx.createRadialGradient(WIDTH / 2, HEIGHT, 40, WIDTH / 2, HEIGHT, HEIGHT * 0.75);
  reflection.addColorStop(0, "rgba(255,204,0,0.18)");
  reflection.addColorStop(1, "rgba(255,204,0,0)");
  ctx.fillStyle = reflection;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

export function HighwayGame({
  soundEnabled,
  initialCameraStream,
  initialCameraError,
  onBackToMenu,
}: {
  soundEnabled: boolean;
  initialCameraStream: MediaStream | null;
  initialCameraError: string | null;
  onBackToMenu: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const calibrationOverlayRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const phaseRef = useRef<GamePhase>("calibration");
  const carRef = useRef({ x: WIDTH / 2, targetX: WIDTH / 2, recoil: 0, invincible: 0, blink: 0 });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const prizeTokensRef = useRef<PrizeToken[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const handRef = useRef({ status: "none" as HandStatus, x: 0.5, smoothed: 0.5, landmarks: [] as Landmark[] });
  const statsRef = useRef({ score: 0, speed: 8, lives: 3, combo: 0, shake: 0, flash: 0, slow: 0, best: 0, shieldMs: 0, swapMs: 0, runTimeMs: 0, maxSpeed: 0 });
  const frameRef = useRef<number | null>(null);
  const nextObstacleRef = useRef(0);
  const nextPrizeTokenRef = useRef(38);
  const particleIdRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const prizeTokenIdRef = useRef(0);

  const [phase, setPhase] = useState<GamePhase>("calibration");
  const [countdown, setCountdown] = useState(3);
  const [cameraError, setCameraError] = useState<string | null>(initialCameraError);
  const [cameraStatus, setCameraStatus] = useState<"loading" | "camera" | "ready" | "error">(
    initialCameraError ? "error" : "loading",
  );
  const [handStatus, setHandStatus] = useState<HandStatus>("none");
  const [handX, setHandX] = useState(0.5);
  const [hud, setHud] = useState({ score: 0, speed: 8, lives: 3, combo: 0, near: false, shieldMs: 0, swapMs: 0 });
  const [finalScore, setFinalScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const bestScore = useSyncExternalStore(
    subscribeScores,
    getBestScoreSnapshot,
    getBestScoreServerSnapshot,
  );

  const statusLabel = handStatus === "fist" ? t("game.gripLocked") : handStatus === "open" ? t("game.handOpen") : t("game.noHand");
  const calibrationStatus = cameraStatus === "loading" ? t("calibration.statusLoading") : cameraStatus === "camera" ? t("calibration.statusCamera") : cameraStatus === "ready" ? t("calibration.statusReady") : t("calibration.statusError");

  const beep = useCallback((type: "score" | "impact" | "near") => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = audioRef.current ?? new AudioContextClass();
      audioRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type === "impact" ? "sawtooth" : "sine";
      oscillator.frequency.value = type === "impact" ? 90 : type === "near" ? 620 : 420;
      gain.gain.value = type === "impact" ? 0.08 : 0.035;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (type === "impact" ? 0.22 : 0.12));
      oscillator.stop(ctx.currentTime + (type === "impact" ? 0.24 : 0.14));
    } catch {}
  }, [soundEnabled]);

  const resetRun = useCallback(() => {
    carRef.current = { x: WIDTH / 2, targetX: WIDTH / 2, recoil: 0, invincible: 0, blink: 0 };
    obstaclesRef.current = [];
    prizeTokensRef.current = [];
    particlesRef.current = [];
    statsRef.current = { score: 0, speed: 6.5, lives: 3, combo: 0, shake: 0, flash: 0, slow: 0, best: bestScore, shieldMs: 0, swapMs: 0, runTimeMs: 0, maxSpeed: 0 };
    nextObstacleRef.current = 0;
    nextPrizeTokenRef.current = 42;
    setHud({ score: 0, speed: 6.5, lives: 3, combo: 0, near: false, shieldMs: 0, swapMs: 0 });
    setFinalScore(0);
    setPaused(false);
  }, [bestScore]);

  const finishGame = useCallback(() => {
    const score = Math.floor(statsRef.current.score);
    recordRun(score);
    setFinalScore(score);
    setPhase("gameover");
    phaseRef.current = "gameover";
  }, []);

  const startPlaying = useCallback(() => {
    resetRun();
    setPhase("playing");
    phaseRef.current = "playing";
  }, [resetRun]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let active = true;
    let camera: { start: () => Promise<void>; stop?: () => void } | null = null;
    let hands: HandsInstance | null = null;

    async function setup() {
      try {
        setCameraStatus("loading");
        await Promise.all([
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"),
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"),
        ]);
        if (!active || !window.Hands || !videoRef.current) throw new Error("mediapipe");
        hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });
        hands.onResults((results) => {
          const landmarks = results.multiHandLandmarks?.[0] ?? [];
          if (!landmarks.length) {
            handRef.current.status = "none";
            handRef.current.landmarks = [];
            setHandStatus("none");
            setHandX(0.5);
            return;
          }
          const fist = isFist(landmarks);
          const palmX = landmarks[0]?.x ?? 0.5;
          const mirroredX = 1 - palmX;
          const previous = handRef.current.smoothed;
          const smoothed = previous + (mirroredX - previous) * 0.18;
          handRef.current = { status: fist ? "fist" : "open", x: mirroredX, smoothed, landmarks };
          setHandStatus(fist ? "fist" : "open");
          setHandX(smoothed);
        });
        setCameraStatus("camera");
        if (initialCameraStream) {
          videoRef.current.srcObject = initialCameraStream;
          await videoRef.current.play();
          const detectFrame = async () => {
            if (!active || !videoRef.current || !hands) return;
            await hands.send({ image: videoRef.current });
            window.setTimeout(detectFrame, 33);
          };
          void detectFrame();
        } else {
          if (!window.Camera) throw new Error("mediapipe");
          camera = new window.Camera(videoRef.current, {
            width: 640,
            height: 480,
            onFrame: async () => {
              if (videoRef.current && hands) await hands.send({ image: videoRef.current });
            },
          });
          await camera.start();
        }
        setCameraStatus("ready");
      } catch (error) {
        setCameraStatus("error");
        setCameraError(error instanceof Error && error.message === "mediapipe" ? t("calibration.mediapipeFailed") : t("calibration.permissionDenied"));
      }
    }

    void setup();
    return () => {
      active = false;
      camera?.stop?.();
      hands?.close?.();
    };
  }, [initialCameraStream, t]);

  useEffect(() => {
    if (phase !== "calibration" || cameraStatus !== "ready") return;
    // Restart the pre-run countdown whenever calibration becomes ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(3);
    const ticks = [3, 2, 1];
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= ticks.length) {
        window.clearInterval(timer);
        startPlaying();
      } else {
        setCountdown(ticks[index]);
      }
    }, 850);
    return () => window.clearInterval(timer);
  }, [cameraStatus, phase, startPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let last = performance.now();
    let roadOffset = 0;

    const loop = (time: number) => {
      const rawDt = Math.min(32, time - last) / 16.67;
      last = time;
      const dt = statsRef.current.slow > 0 ? rawDt * 0.35 : rawDt;
      const stats = statsRef.current;
      if (stats.slow > 0) stats.slow -= rawDt;
      if (phaseRef.current === "playing" && !paused) {
        stats.runTimeMs += rawDt * 16.67;
        stats.score += dt * (0.8 + stats.speed * 0.018);
        stats.speed = Math.min(18, stats.speed + dt * 0.004);
        stats.maxSpeed = Math.max(stats.maxSpeed, stats.speed);
        stats.shieldMs = Math.max(0, stats.shieldMs - rawDt * 16.67);
        stats.swapMs = Math.max(0, stats.swapMs - rawDt * 16.67);
        roadOffset += dt * stats.speed * 5.5;
        if (handRef.current.status === "fist") {
          carRef.current.targetX = clamp(handRef.current.smoothed * WIDTH, 130, WIDTH - 130);
        }
        carRef.current.x += (carRef.current.targetX + carRef.current.recoil - carRef.current.x) * 0.1;
        carRef.current.recoil *= 0.86;
        carRef.current.invincible = Math.max(0, carRef.current.invincible - rawDt * 16.67);
        carRef.current.blink += rawDt;

        nextObstacleRef.current -= dt;
        if (nextObstacleRef.current <= 0) {
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          obstaclesRef.current.push({ id: obstacleIdRef.current++, x: WIDTH * lane, y: -110, w: 92, h: 144, speed: stats.speed + Math.random() * 2.2, passed: false, near: false });
          nextObstacleRef.current = Math.max(36, 84 - stats.speed * 1.5);
        }

        nextPrizeTokenRef.current -= dt;
        if (nextPrizeTokenRef.current <= 0) {
          const lane = LANES[Math.floor(Math.random() * LANES.length)];
          const kind = pickPrizeTokenKind();
          prizeTokensRef.current.push({ id: prizeTokenIdRef.current++, kind, x: WIDTH * lane, y: -80, r: kind === "coin" ? 25 : 30, speed: stats.speed + 1.4, collected: false });
          nextPrizeTokenRef.current = 54 + Math.random() * 34;
        }

        prizeTokensRef.current.forEach((token) => {
          token.y += token.speed * dt * 2;
          const dx = Math.abs(token.x - carRef.current.x);
          const dy = Math.abs(token.y - PLAYER_Y);
          if (!token.collected && dx < CAR_W * 0.58 && dy < CAR_H * 0.5) {
            token.collected = true;
            if (token.kind === "shield") {
              stats.shieldMs = 15000;
              stats.score += 50;
            } else if (token.kind === "swap") {
              stats.swapMs = 1600;
              stats.score += 200;
              obstaclesRef.current.forEach((obstacle) => {
                prizeTokensRef.current.push({
                  id: prizeTokenIdRef.current++,
                  kind: "coin",
                  x: obstacle.x,
                  y: obstacle.y,
                  r: 23,
                  speed: Math.max(5, obstacle.speed * 0.72),
                  collected: false,
                });
              });
              obstaclesRef.current = [];
            } else {
              stats.score += 125;
            }
            stats.combo += 1;
            beep("score");
            for (let i = 0; i < 12; i += 1) {
              particlesRef.current.push({ id: particleIdRef.current++, x: token.x, y: token.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 0.8 });
            }
          }
        });

        obstaclesRef.current.forEach((obstacle) => {
          obstacle.y += obstacle.speed * dt * 2.05;
          const dx = Math.abs(obstacle.x - carRef.current.x);
          const dy = Math.abs(obstacle.y - PLAYER_Y);
          const hit = dx < (obstacle.w + CAR_W) * 0.42 && dy < (obstacle.h + CAR_H) * 0.42;
          if (hit && carRef.current.invincible <= 0) {
            if (stats.shieldMs > 0) {
              stats.shieldMs = 0;
              obstacle.passed = true;
              stats.shake = 7;
              stats.flash = 0.35;
              carRef.current.invincible = 650;
              beep("near");
              for (let i = 0; i < 16; i += 1) {
                particlesRef.current.push({ id: particleIdRef.current++, x: obstacle.x, y: obstacle.y, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, life: 0.9 });
              }
            } else {
              stats.lives -= 1;
              stats.combo = 0;
              stats.shake = 18;
              stats.flash = 1;
              stats.slow = stats.lives <= 0 ? 32 : 0;
              carRef.current.invincible = 1050;
              carRef.current.recoil = carRef.current.x < obstacle.x ? -56 : 56;
              beep("impact");
              for (let i = 0; i < 18; i += 1) {
                particlesRef.current.push({ id: particleIdRef.current++, x: obstacle.x, y: obstacle.y, vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 18, life: 1 });
              }
              if (stats.lives <= 0) window.setTimeout(finishGame, 520);
            }
          }
          if (!obstacle.near && !hit && dy < 80 && dx < 130 && dx > 62) {
            obstacle.near = true;
            stats.combo += 1;
            stats.shake = 5;
            beep("near");
            setHud((prev) => ({ ...prev, near: true }));
            window.setTimeout(() => setHud((prev) => ({ ...prev, near: false })), 360);
          }
          if (!obstacle.passed && obstacle.y > HEIGHT - 120) {
            obstacle.passed = true;
            stats.score += 75 + stats.combo * 12;
            beep("score");
          }
        });
        obstaclesRef.current = obstaclesRef.current.filter((obstacle) => obstacle.y < HEIGHT + 180);
        prizeTokensRef.current = prizeTokensRef.current.filter((token) => !token.collected && token.y < HEIGHT + 90);
        particlesRef.current = particlesRef.current.map((particle) => ({ ...particle, x: particle.x + particle.vx * dt, y: particle.y + particle.vy * dt, life: particle.life - 0.035 * dt })).filter((particle) => particle.life > 0);
        stats.shake = Math.max(0, stats.shake - dt * 1.2);
        stats.flash = Math.max(0, stats.flash - dt * 0.06);
        setHud({
          score: Math.floor(stats.score),
          speed: Math.floor(stats.speed),
          lives: stats.lives,
          combo: stats.combo,
          near: hud.near,
          shieldMs: stats.shieldMs,
          swapMs: stats.swapMs,
        });
      }

      const shake = stats.shake > 0 ? (Math.random() - 0.5) * stats.shake : 0;
      ctx.save();
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.translate(shake, -shake * 0.4);
      drawRoad(ctx, stats.speed, roadOffset);
      prizeTokensRef.current.forEach((token) => drawPrizeToken(ctx, token, time / 16.67));
      obstaclesRef.current.forEach((obstacle) => drawObstacle(ctx, obstacle));
      particlesRef.current.forEach((particle) => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = "#FFCC00";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 5 * particle.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      if (stats.swapMs > 0) {
        ctx.fillStyle = `rgba(255,51,51,${0.06 + Math.sin(time * 0.02) * 0.025})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      if (stats.shieldMs > 0) {
        ctx.save();
        ctx.translate(carRef.current.x, PLAYER_Y);
        ctx.strokeStyle = "rgba(16,185,129,0.82)";
        ctx.lineWidth = 6;
        ctx.shadowColor = "rgba(16,185,129,0.75)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(0, 0, 88 + Math.sin(time * 0.02) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawCar(ctx, carRef.current.x, PLAYER_Y, carRef.current.invincible > 0 && Math.floor(carRef.current.blink) % 2 === 0);
      if (stats.flash > 0) {
        ctx.fillStyle = `rgba(255,51,51,${stats.flash * 0.22})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      ctx.restore();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [beep, finishGame, hud.near, paused]);

  useEffect(() => {
    const overlay = calibrationOverlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;
    const timer = window.setInterval(() => {
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (video.readyState >= 2) {
        ctx.save();
        ctx.translate(overlay.width, 0);
        ctx.scale(-1, 1);
        ctx.globalAlpha = 0.72;
        ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
        ctx.restore();
      }
      const landmarks = handRef.current.landmarks;
      if (landmarks.length) {
        ctx.fillStyle = handRef.current.status === "fist" ? "#FFCC00" : "#94a3b8";
        landmarks.forEach((point) => {
          ctx.beginPath();
          ctx.arc((1 - point.x) * overlay.width, point.y * overlay.height, 2.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }, 66);
    return () => window.clearInterval(timer);
  }, []);

  const restart = () => {
    setPhase("calibration");
    phaseRef.current = "calibration";
    setCountdown(3);
    if (cameraStatus === "ready") startPlaying();
  };

  const shareScore = async () => {
    const text = `Tokyo Highway Dodge score: ${finalScore} m. Best run: ${bestScore} m.`;
    const url = typeof window !== "undefined" ? window.location.href : undefined;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Tokyo Highway Dodge", text, url });
      } catch {
        // The player dismissed the share sheet.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url ?? ""}`.trim());
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 1800);
    }
  };

  return (
    <section className="relative min-h-svh overflow-hidden bg-[var(--color-accent)] text-[var(--color-text-primary)]">
      <video ref={videoRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-30 grayscale" muted playsInline />
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="absolute inset-0 h-full w-full object-cover" />

      {phase === "calibration" && (
        <div className="patrol-scanlines absolute inset-0 z-20 flex min-h-svh flex-col bg-black/60">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
            <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={onBackToMenu} className="flex items-center gap-2 font-[family:var(--font-heading)] text-[0.75rem] uppercase tracking-[0.05em] text-[var(--color-text-secondary)] hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              {t("game.exit")}
            </motion.button>
            <div className="font-[family:var(--font-heading)] text-[0.75rem] uppercase tracking-[0.14em] text-[var(--color-primary)]">{calibrationStatus}</div>
          </div>
          <div className="mx-auto my-auto flex w-full max-w-md flex-col items-center px-6 text-center">
            <div className="relative mb-8 h-56 w-72 overflow-hidden rounded-[1rem] border-2 border-[var(--color-primary)] bg-black shadow-[0_0_32px_rgba(255,204,0,0.28)]">
              <canvas ref={calibrationOverlayRef} width={288} height={224} className="h-full w-full" />
              <div className="absolute inset-0 bg-slate-900/20" />
              <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between rounded-[0.25rem] border border-[var(--color-border)] bg-black/90 px-2 py-1 font-[family:var(--font-heading)] text-[0.65rem]">
                <span className={handStatus === "fist" ? "text-[var(--color-states-success)]" : "text-[var(--color-text-secondary)]"}>{statusLabel}</span>
                <span className="text-[var(--color-text-secondary)]">X: {handX.toFixed(2)}</span>
              </div>
            </div>
            <span className="mb-1 block font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">{t("calibration.title")}</span>
            {cameraError ? (
              <div className="mb-6 rounded-[1rem] border border-[var(--color-secondary)] bg-black/80 p-4 text-sm text-[var(--color-text-secondary)]">
                <p>{cameraError}</p>
                <p className="mt-2">{t("game.fallbackBody")}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 font-[family:var(--font-heading)] text-[5rem] leading-none text-white drop-shadow-[0_0_20px_rgba(255,204,0,0.6)]">{t("calibration.countdown", { count: countdown })}</div>
                <p className="max-w-xs text-sm leading-6 text-[var(--color-text-secondary)]">{t("calibration.subtitle")}</p>
              </>
            )}
          </div>
          <div className="mx-auto w-full max-w-md px-6 pb-12">
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={startPlaying} className="w-full rounded-[0.5rem] bg-[var(--color-secondary)] py-4 font-[family:var(--font-heading)] text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_0_30px_rgba(255,51,51,0.22)]">
              {cameraError ? t("calibration.continueFallback") : t("calibration.continueFallback")}
            </motion.button>
          </div>
        </div>
      )}

      {phase === "playing" && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="absolute top-0 right-0 left-0 flex items-start justify-between px-5 pt-5 md:px-8">
            <div className="rounded-[1rem] border border-[var(--color-border)] bg-black/70 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <div className="font-[family:var(--font-heading)] text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">{t("game.score")}</div>
              <div className="font-[family:var(--font-heading)] text-3xl text-[var(--color-primary)]">{hud.score}</div>
            </div>
            <div className="flex items-center gap-3 rounded-[1rem] border border-[var(--color-border)] bg-black/70 px-4 py-3">
              <span className="font-[family:var(--font-heading)] text-sm text-[var(--color-text-secondary)]">{t("game.speed")} {hud.speed}</span>
              <div className="flex gap-1" aria-label={t("game.lives")}>{[0,1,2].map((life) => <Heart key={life} className={`h-5 w-5 ${life < hud.lives ? "fill-[var(--color-secondary)] text-[var(--color-secondary)]" : "text-[var(--color-text-muted)]"}`} />)}</div>
            </div>
          </div>

          {(hud.shieldMs > 0 || hud.swapMs > 0) && (
            <div className="absolute top-24 left-1/2 flex -translate-x-1/2 gap-2 px-4">
              {hud.shieldMs > 0 && <div className="rounded-[0.65rem] border border-emerald-400/60 bg-emerald-950/75 px-3 py-2 font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.1em] text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.35)]">{t("game.shieldActive", { seconds: Math.ceil(hud.shieldMs / 1000) })}</div>}
              {hud.swapMs > 0 && <div className="rounded-[0.65rem] border border-[var(--color-secondary)] bg-red-950/75 px-3 py-2 font-[family:var(--font-heading)] text-[0.75rem] font-bold uppercase tracking-[0.1em] text-red-100 shadow-[0_0_22px_rgba(255,51,51,0.35)]">{t("game.swapActive")}</div>}
            </div>
          )}

          {hud.near && <div className="absolute top-[30%] left-1/2 -translate-x-1/2 font-[family:var(--font-heading)] text-2xl text-[var(--color-primary)] drop-shadow-[0_0_18px_rgba(255,204,0,0.7)]">{t("game.nearMiss")}</div>}

          <div className="absolute bottom-5 left-5 rounded-[0.75rem] border border-[var(--color-border)] bg-black/70 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 font-[family:var(--font-heading)] text-[0.75rem] uppercase tracking-[0.08em]">
              <span className={`h-2.5 w-2.5 rounded-full ${handStatus === "fist" ? "bg-[var(--color-primary)] shadow-[0_0_14px_rgba(255,204,0,0.7)]" : "bg-[var(--color-text-muted)]"}`} />
              <span className={handStatus === "fist" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}>{statusLabel}</span>
            </div>
          </div>

          <div className="pointer-events-auto absolute right-5 bottom-5 flex gap-2">
            <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={() => setPaused((value) => !value)} className="grid h-11 w-11 place-items-center rounded-[0.5rem] border border-[var(--color-border)] bg-black/70 text-[var(--color-primary)]">
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={onBackToMenu} className="grid h-11 w-11 place-items-center rounded-[0.5rem] border border-[var(--color-border)] bg-black/70 text-[var(--color-text-secondary)]">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      )}

      {phase === "gameover" && (
        <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} className="patrol-scanlines absolute inset-0 z-40 flex min-h-svh flex-col items-center justify-center bg-black/82 px-6 text-center">
          <div className="mb-2 font-[family:var(--font-heading)] text-sm uppercase tracking-[0.18em] text-[var(--color-secondary)]">{finalScore >= bestScore ? t("gameover.newBest") : t("gameover.subtitle")}</div>
          <h1 className="mb-6 font-[family:var(--font-heading)] text-5xl uppercase tracking-[-0.01em] text-white md:text-7xl">{t("gameover.title")}</h1>
          <div className="mb-8 grid w-full max-w-md grid-cols-2 gap-4">
            <div className="rounded-[1rem] border border-[var(--color-border)] bg-black/70 p-5"><div className="text-xs text-[var(--color-text-secondary)]">{t("gameover.finalScore")}</div><div className="font-[family:var(--font-heading)] text-4xl text-[var(--color-primary)]">{finalScore}</div></div>
            <div className="rounded-[1rem] border border-[var(--color-border)] bg-black/70 p-5"><div className="text-xs text-[var(--color-text-secondary)]">{t("gameover.bestScore")}</div><div className="font-[family:var(--font-heading)] text-4xl text-white">{bestScore}</div></div>
          </div>
          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={restart} className="flex flex-1 items-center justify-center gap-2 rounded-[0.5rem] bg-[var(--color-primary)] px-5 py-4 font-[family:var(--font-heading)] font-bold uppercase tracking-[0.12em] text-black"><RotateCcw className="h-5 w-5" />{t("gameover.restart")}</motion.button>
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => void shareScore()} className="flex flex-1 items-center justify-center gap-2 rounded-[0.5rem] border border-[var(--color-border)] bg-black/70 px-5 py-4 font-[family:var(--font-heading)] font-bold uppercase tracking-[0.12em] text-white"><Share2 className="h-5 w-5" />{shareState === "copied" ? t("gameover.shareCopied") : shareState === "error" ? t("gameover.shareFailed") : t("gameover.share")}</motion.button>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={onBackToMenu} className="mt-4 font-[family:var(--font-heading)] text-sm uppercase tracking-[0.12em] text-[var(--color-text-secondary)] hover:text-white">{t("gameover.menu")}</motion.button>
        </motion.div>
      )}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_44%,rgba(255,51,51,0.08)_100%)]" />
    </section>
  );
}
