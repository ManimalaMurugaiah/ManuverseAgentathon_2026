import { useEffect, useState } from "react";

import { initialsOf } from "../utils/format";

const slug = (value: string) => value.toLowerCase().replace(/\s+/g, "-");

export function Pill({ value, kind = "status" }: Readonly<{ value: string; kind?: string }>): JSX.Element {
  return <span className={`pl-pill pl-${kind}--${slug(value)}`}>{value}</span>;
}

export function ProgressBar({ value, tone }: Readonly<{ value: number; tone?: string }>): JSX.Element {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <span className="pl-progress">
      <span className="pl-bar" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100} aria-label={`${safe}% complete`}>
        <span className={tone ? `is-${tone}` : ""} style={{ width: `${safe}%` }} />
      </span>
      <strong>{safe}%</strong>
    </span>
  );
}

export function scheduleTone(status: string): string {
  if (status === "Delayed") return "red";
  if (status === "At risk" || status === "At Risk") return "amber";
  if (status === "Completed" || status === "On track") return "green";
  return "blue";
}

const AVATAR_TONES = 6;

export function Avatar({ name }: Readonly<{ name: string | null | undefined }>): JSX.Element {
  const text = name ?? "";
  const tone = [...text].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES;
  return <span className={`pl-avatar pl-avatar--${tone}`} aria-hidden="true">{initialsOf(text)}</span>;
}

export function LoadingState({ label = "Loading…" }: Readonly<{ label?: string }>): JSX.Element {
  return <p className="pl-state" role="status">{label}</p>;
}

export function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry?: () => void }>): JSX.Element {
  return (
    <div className="pl-state pl-state--error" role="alert">
      <span>{message}</span>
      {onRetry ? <button type="button" className="secondary-button" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function Notice({ message, tone = "ok" }: Readonly<{ message: string; tone?: "ok" | "error" }>): JSX.Element | null {
  if (!message) return null;
  return <p className={`pl-notice pl-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>{message}</p>;
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const WRITE_PROJECT_ROLES = ["admin", "manager"];
export const canWriteProjects = (role: string | undefined): boolean => WRITE_PROJECT_ROLES.includes(role ?? "");
