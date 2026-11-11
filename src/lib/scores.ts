export const BEST_SCORE_KEY = "tokyo-highway-best-score";
export const RUNS_KEY = "tokyo-highway-runs";
export const MAX_SAVED_RUNS = 6;

const EMPTY_RUNS: number[] = [];

const listeners = new Set<() => void>();
let bestScoreCache: number | null = null;
let topRunsCache: number[] | null = null;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function invalidate() {
  bestScoreCache = null;
  topRunsCache = null;
}

export function subscribeScores(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readBestScore(): number {
  const store = storage();
  if (!store) return 0;
  return Number(store.getItem(BEST_SCORE_KEY) || "0") || 0;
}

export function readTopRuns(limit = MAX_SAVED_RUNS): number[] {
  const store = storage();
  if (!store) return EMPTY_RUNS;
  try {
    const parsed = JSON.parse(store.getItem(RUNS_KEY) || "[]");
    if (!Array.isArray(parsed)) return EMPTY_RUNS;
    return parsed
      .map((value) => Number(value) || 0)
      .filter((value) => value > 0)
      .sort((a, b) => b - a)
      .slice(0, limit);
  } catch {
    return EMPTY_RUNS;
  }
}

/** Persist a finished run locally and return the updated best score. */
export function recordRun(score: number): number {
  const store = storage();
  const best = Math.max(readBestScore(), score);
  if (store) {
    store.setItem(BEST_SCORE_KEY, String(best));
    if (score > 0) {
      const runs = [...readTopRuns(MAX_SAVED_RUNS), score]
        .sort((a, b) => b - a)
        .slice(0, MAX_SAVED_RUNS);
      store.setItem(RUNS_KEY, JSON.stringify(runs));
    }
  }
  invalidate();
  emit();
  return best;
}

export function getBestScoreSnapshot(): number {
  if (bestScoreCache === null) bestScoreCache = readBestScore();
  return bestScoreCache;
}

export function getTopRunsSnapshot(): number[] {
  if (topRunsCache === null) topRunsCache = readTopRuns(MAX_SAVED_RUNS);
  return topRunsCache;
}

export function getBestScoreServerSnapshot(): number {
  return 0;
}

export function getTopRunsServerSnapshot(): number[] {
  return EMPTY_RUNS;
}
