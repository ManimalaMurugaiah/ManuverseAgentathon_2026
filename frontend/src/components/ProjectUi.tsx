const slug = (value: string) => value.toLowerCase().replace(/\s+/g, "-");

export function StatusPill({ status }: Readonly<{ status: string }>): JSX.Element {
  return <span className={`status-pill status-${slug(status)}`}>{status}</span>;
}

export function barTone(status: string): string {
  switch (status) {
    case "On track":
    case "Completed":
      return "is-green";
    case "At risk":
    case "At Risk":
    case "In Progress":
      return "is-amber";
    case "Delayed":
      return "is-red";
    default:
      return "";
  }
}

export function ProgressBar({ value, tone }: Readonly<{ value: number; tone?: string }>): JSX.Element {
  return (
    <div className="pj-progress">
      <div className={`pj-bar ${tone ?? ""}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${value}%` }} />
      </div>
      <span className="pj-pct">{value}%</span>
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
