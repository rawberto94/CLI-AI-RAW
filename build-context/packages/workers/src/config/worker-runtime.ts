function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getWorkerConcurrency(envName: string, fallback: number): number {
  return envInt(envName, fallback);
}

export function getWorkerLimiter(envMaxName: string, envDurationName: string, fallback: { max: number; duration: number }): { max: number; duration: number } {
  return {
    max: envInt(envMaxName, fallback.max),
    duration: envInt(envDurationName, fallback.duration),
  };
}
