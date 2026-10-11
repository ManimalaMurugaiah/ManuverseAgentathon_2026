import { useEffect, useMemo, useState } from "react";

import api from "../api/client";
import { getApiErrorMessage } from "../api/errors";
import type { HealthRating, Lifecycle, Lookups, Project, ProjectDetail, ProjectInput } from "../types";
import { formatMoney } from "../utils/format";

const STEPS = [
  "Basic Information",
  "Scope & Timeline",
  "Budget & Resources",
  "Team & Ownership",
  "Settings & Integration",
  "Review & Confirm",
] as const;

const HEALTH_OPTIONS: HealthRating[] = ["Good", "Watch", "Poor"];
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,50}$/;

interface FormState {
  code: string;
  name: string;
  projectType: string;
  plant: string;
  description: string;
  objective: string;
  status: Lifecycle;
  health: HealthRating;
  scope: string;
  country: string;
  startDate: string;
  endDate: string;
  forecastDate: string;
  budget: string;
  spent: string;
  resources: string;
  owner: string;
  sponsor: string;
  business: string;
  riskLevel: string;
  agents: boolean;
  templateId: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

// Older rows used colour names; map them onto the current risk scale.
const LEGACY_RISK: Record<string, string> = { Red: "High", Amber: "Medium", Yellow: "Medium", Green: "Low" };

function normalizeRisk(value: string | null | undefined, levels: string[]): string {
  if (!value) return "";
  if (levels.includes(value)) return value;
  const mapped = LEGACY_RISK[value];
  return mapped && levels.includes(mapped) ? mapped : "";
}

function initialState(project: ProjectDetail | null | undefined, defaultOwner: string, riskLevels: string[]): FormState {
  return {
    code: project?.code ?? "",
    name: project?.name ?? "",
    projectType: project?.project_type ?? "",
    plant: project?.plant ?? "",
    description: project?.description ?? "",
    objective: project?.business_objective ?? "",
    status: (project?.status as Lifecycle | null) ?? "Planning",
    health: project?.health ?? "Good",
    scope: project?.scope ?? "",
    country: project?.country ?? "",
    startDate: project?.start_date ?? "",
    endDate: project?.end_date ?? "",
    forecastDate: project?.forecast_date ?? "",
    budget: project?.budget ?? "",
    spent: project ? String(Number(project.budget_spent)) : "0",
    resources: project?.resources ?? "",
    owner: project?.owner ?? defaultOwner,
    sponsor: project?.sponsor ?? "",
    business: project?.business ?? "",
    riskLevel: normalizeRisk(project?.risk_level, riskLevels),
    agents: project?.ai_agents_enabled ?? true,
    templateId: "",
  };
}

function validate(step: number, form: FormState, project: ProjectDetail | null | undefined): Errors {
  const errors: Errors = {};
  const editing = Boolean(project);
  // Legacy projects may lack these fields; only insist on them when creating or when already filled.
  const needs = (existing: string | null | undefined) => !editing || Boolean(existing);
  if (step === 0) {
    if (form.name.trim().length < 2) errors.name = "Enter a project name of at least 2 characters.";
    if (!editing && !CODE_PATTERN.test(form.code.trim())) errors.code = "Use 2–50 letters, numbers, dashes or underscores.";
    if (needs(project?.project_type) && !form.projectType) errors.projectType = "Select a project type.";
    if (needs(project?.plant) && !form.plant.trim()) errors.plant = "Enter the plant or location.";
    if (needs(project?.description) && !form.description.trim()) errors.description = "Add a short description.";
  }
  if (step === 1) {
    if (!form.startDate) errors.startDate = "Choose a start date.";
    if (!form.endDate) errors.endDate = "Choose an end date.";
    else if (form.startDate && form.endDate < form.startDate) errors.endDate = "End date must not be before the start date.";
  }
  if (step === 2) {
    const budget = form.budget === "" ? null : Number(form.budget);
    const spent = form.spent === "" ? 0 : Number(form.spent);
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) errors.budget = "Enter a budget of 0 or more.";
    if (!Number.isFinite(spent) || spent < 0) errors.spent = "Enter an amount of 0 or more.";
    else if (budget !== null && Number.isFinite(budget) && spent > budget) errors.spent = "Spent amount cannot exceed the budget.";
  }
  if (step === 3 && !form.owner.trim()) errors.owner = "Choose the project manager.";
  return errors;
}

function blank(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function toInput(form: FormState, editing: boolean): ProjectInput {
  const input: ProjectInput = {
    name: form.name.trim(),
    project_type: blank(form.projectType),
    description: blank(form.description),
    business_objective: blank(form.objective),
    scope: blank(form.scope),
    plant: blank(form.plant),
    country: blank(form.country),
    business: blank(form.business),
    sponsor: blank(form.sponsor),
    owner: form.owner.trim(),
    budget: form.budget === "" ? null : Number(form.budget),
    budget_spent: form.spent === "" ? 0 : Number(form.spent),
    resources: blank(form.resources),
    start_date: form.startDate,
    end_date: form.endDate,
    status: form.status,
    health: form.health,
    risk_level: blank(form.riskLevel),
    ai_agents_enabled: form.agents,
  };
  if (editing) input.forecast_date = form.forecastDate || null;
  else {
    input.code = form.code.trim();
    input.template_id = form.templateId ? Number(form.templateId) : null;
  }
  return input;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, hint, className, children }: Readonly<FieldProps>): JSX.Element {
  return (
    <label className={`wiz-field${className ? ` ${className}` : ""}`}>
      <span className="wiz-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      {children}
      {hint ? <small className="wiz-hint">{hint}</small> : null}
      {error ? <small className="wiz-error" role="alert">{error}</small> : null}
    </label>
  );
}

interface WizardProps {
  project?: ProjectDetail | null;
  lookups: Lookups;
  defaultOwner: string;
  onClose: () => void;
  onSaved: (project: Project | ProjectDetail) => void;
}

export function ProjectWizard({ project, lookups, defaultOwner, onClose, onSaved }: Readonly<WizardProps>): JSX.Element {
  const editing = Boolean(project);
  const [form, setForm] = useState<FormState>(() => initialState(project, defaultOwner, lookups.risk_levels));
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const loadCode = async () => {
    try {
      const { data } = await api.get<{ code: string }>("/projects/next-code");
      set("code", data.code);
    } catch {
      // The user can still type a code by hand.
    }
  };

  useEffect(() => {
    if (!editing) void loadCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const goTo = (target: number) => {
    if (target <= reached) setStep(target);
  };

  const next = () => {
    const found = validate(step, form, project);
    setErrors(found);
    if (Object.keys(found).length) return;
    const target = step + 1;
    setStep(target);
    setReached((current) => Math.max(current, target));
  };

  const submit = async () => {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const found = validate(index, form, project);
      if (Object.keys(found).length) {
        setErrors(found);
        setStep(index);
        return;
      }
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = toInput(form, editing);
      const { data } = project
        ? await api.patch<ProjectDetail>(`/projects/${project.id}`, payload)
        : await api.post<Project>("/projects", payload);
      onSaved(data);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Could not save the project."));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = useMemo(
    () => (form.projectType && !lookups.project_types.includes(form.projectType) ? [form.projectType, ...lookups.project_types] : lookups.project_types),
    [form.projectType, lookups.project_types],
  );
  const lifecycleOptions = lookups.lifecycle_statuses as Lifecycle[];

  const statusFields = (
    <div className="wiz-row">
      <Field label="Status" required hint="Lifecycle stage. Schedule status on the list is calculated from milestones.">
        <select value={form.status} onChange={(event) => set("status", event.target.value as Lifecycle)}>
          {lifecycleOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </Field>
      <Field label="Health" required>
        <select value={form.health} onChange={(event) => set("health", event.target.value as HealthRating)}>
          {HEALTH_OPTIONS.map((option) => <option key={option}>{option}</option>)}
        </select>
      </Field>
    </div>
  );

  const reviewRows: [string, string][] = [
    ["Project name", form.name.trim()],
    ["Project ID", editing ? (project?.code ?? "") : form.code.trim()],
    ["Project type", form.projectType],
    ["Plant / location", [form.plant.trim(), form.country.trim()].filter(Boolean).join(", ")],
    ["Description", form.description.trim()],
    ["Business objective", form.objective.trim()],
    ["Scope", form.scope.trim()],
    ["Timeline", `${form.startDate || "—"} → ${form.endDate || "—"}`],
    ["Budget", form.budget === "" ? "—" : `${formatMoney(form.budget)} (spent ${formatMoney(form.spent || 0)})`],
    ["Resources", form.resources.trim()],
    ["Project manager", form.owner.trim()],
    ["Sponsor", form.sponsor.trim()],
    ["Business unit", form.business.trim()],
    ["Status / health", `${form.status} / ${form.health}`],
    ["Risk level", form.riskLevel],
    ["AI agents", form.agents ? "Enabled" : "Off"],
    ...(editing ? [] : [["Process template", lookups.templates.find((t) => String(t.id) === form.templateId)?.name ?? "None"] as [string, string]]),
  ];

  const title = editing ? `Edit Project - ${project?.name ?? ""}` : "Create Project";

  return (
    <div className="wiz-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="wiz-drawer" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header className="wiz-header">
          <h2 id="wizard-title">{title}</h2>
          <button type="button" className="wiz-close" aria-label="Close project form" onClick={onClose}>×</button>
        </header>

        <div className="wiz-body">
          <nav className="wiz-steps" aria-label="Project steps">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`wiz-step${index === step ? " is-current" : ""}${index < step ? " is-done" : ""}`}
                aria-current={index === step ? "step" : undefined}
                disabled={index > reached}
                onClick={() => goTo(index)}
              >
                <span className="wiz-step-number">{index + 1}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <form
            className="wiz-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step === STEPS.length - 1) void submit();
              else next();
            }}
          >
            <div className="wiz-form-heading">
              <h3>{STEPS[step]}</h3>
              <p>{editing && step === 0 ? "Update the primary details for the project" : [
                "Provide the primary details for the project",
                "Define what is delivered and when",
                "Plan the budget and the resources needed",
                "Assign who leads and sponsors the project",
                "Configure risk, automation and the process template",
                "Check everything before you save",
              ][step]}</p>
            </div>

            {step === 0 ? (
              <>
                <div className="wiz-row">
                  <Field label="Project Name" required error={errors.name}>
                    <input value={form.name} maxLength={200} placeholder="e.g. New Manufacturing Line - Phase 2" onChange={(event) => set("name", event.target.value)} />
                  </Field>
                  <Field label="Project ID" required={!editing} error={errors.code} hint={editing ? "The project ID cannot be changed." : undefined}>
                    <span className="wiz-code">
                      <input
                        value={editing ? (project?.code ?? "") : form.code}
                        readOnly={editing}
                        maxLength={50}
                        onChange={(event) => set("code", event.target.value)}
                      />
                      {editing ? null : (
                        <button type="button" className="wiz-icon-button" aria-label="Generate project ID" onClick={() => void loadCode()}>↻</button>
                      )}
                    </span>
                  </Field>
                </div>
                <div className="wiz-row">
                  <Field label="Project Type" required={!editing || Boolean(project?.project_type)} error={errors.projectType}>
                    <select value={form.projectType} onChange={(event) => set("projectType", event.target.value)}>
                      <option value="">Select project type</option>
                      {typeOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Plant / Location" required={!editing || Boolean(project?.plant)} error={errors.plant}>
                    <input list="wiz-plants" value={form.plant} maxLength={100} placeholder="Select or type a plant / location" onChange={(event) => set("plant", event.target.value)} />
                    <datalist id="wiz-plants">{lookups.plants.map((plant) => <option key={plant} value={plant} />)}</datalist>
                  </Field>
                </div>
                <Field label="Description" required={!editing || Boolean(project?.description)} error={errors.description}>
                  <textarea rows={4} maxLength={500} value={form.description} placeholder="Brief description of the project objectives, scope and expected outcomes..." onChange={(event) => set("description", event.target.value)} />
                  <span className="wiz-count">{form.description.length}/500</span>
                </Field>
                <Field label="Business Objective" error={errors.objective}>
                  <textarea rows={4} maxLength={500} value={form.objective} placeholder="Describe the key business objectives and expected benefits..." onChange={(event) => set("objective", event.target.value)} />
                  <span className="wiz-count">{form.objective.length}/500</span>
                </Field>
                {editing ? statusFields : null}
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Field label="Scope" error={errors.scope}>
                  <textarea rows={4} maxLength={1000} value={form.scope} placeholder="What is included in this project, and what is not?" onChange={(event) => set("scope", event.target.value)} />
                  <span className="wiz-count">{form.scope.length}/1000</span>
                </Field>
                <div className="wiz-row">
                  <Field label="Start Date" required error={errors.startDate}>
                    <input type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
                  </Field>
                  <Field label="End Date" required error={errors.endDate}>
                    <input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
                  </Field>
                </div>
                <div className="wiz-row">
                  <Field label="Country">
                    <input list="wiz-countries" value={form.country} maxLength={100} placeholder="e.g. India" onChange={(event) => set("country", event.target.value)} />
                    <datalist id="wiz-countries">{lookups.countries.map((country) => <option key={country} value={country} />)}</datalist>
                  </Field>
                  {editing ? (
                    <Field label="Forecast Completion">
                      <input type="date" value={form.forecastDate} onChange={(event) => set("forecastDate", event.target.value)} />
                    </Field>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="wiz-row">
                  <Field label="Budget (USD)" error={errors.budget}>
                    <input type="number" min={0} step="any" inputMode="decimal" value={form.budget} placeholder="e.g. 15200000" onChange={(event) => set("budget", event.target.value)} />
                  </Field>
                  <Field label="Spent to date (USD)" error={errors.spent}>
                    <input type="number" min={0} step="any" inputMode="decimal" value={form.spent} onChange={(event) => set("spent", event.target.value)} />
                  </Field>
                </div>
                <Field label="Key Resources" error={errors.resources}>
                  <textarea rows={4} maxLength={500} value={form.resources} placeholder="Equipment, crews, vendors and other resources this project depends on" onChange={(event) => set("resources", event.target.value)} />
                  <span className="wiz-count">{form.resources.length}/500</span>
                </Field>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="wiz-row">
                  <Field label="Project Manager" required error={errors.owner}>
                    <input list="wiz-owners" value={form.owner} maxLength={100} placeholder="Select or type a name" onChange={(event) => set("owner", event.target.value)} />
                    <datalist id="wiz-owners">{lookups.owners.map((owner) => <option key={owner} value={owner} />)}</datalist>
                  </Field>
                  <Field label="Sponsor">
                    <input list="wiz-owners" value={form.sponsor} maxLength={100} placeholder="Executive sponsor" onChange={(event) => set("sponsor", event.target.value)} />
                  </Field>
                </div>
                <Field label="Business Unit" hint="Used by the Business filter across the app.">
                  <input list="wiz-businesses" value={form.business} maxLength={150} placeholder="Select or type a business" onChange={(event) => set("business", event.target.value)} />
                  <datalist id="wiz-businesses">{lookups.businesses.map((business) => <option key={business} value={business} />)}</datalist>
                </Field>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <div className="wiz-row">
                  <Field label="Risk Level">
                    <select value={form.riskLevel} onChange={(event) => set("riskLevel", event.target.value)}>
                      <option value="">Not assessed</option>
                      {lookups.risk_levels.map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </Field>
                  {editing ? <span /> : (
                    <Field label="Process Template" hint="Creates one milestone per stage, spread across the timeline.">
                      <select value={form.templateId} onChange={(event) => set("templateId", event.target.value)}>
                        <option value="">None - add milestones later</option>
                        {lookups.templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.stage_count} stages)</option>)}
                      </select>
                    </Field>
                  )}
                </div>
                {editing ? null : statusFields}
                <label className="wiz-check">
                  <input type="checkbox" checked={form.agents} onChange={(event) => set("agents", event.target.checked)} />
                  <span><strong>Enable AI agents</strong><small>Agents run tasks for this project and ask for approval when required.</small></span>
                </label>
              </>
            ) : null}

            {step === 5 ? (
              <dl className="wiz-review">
                {reviewRows.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
                ))}
              </dl>
            ) : null}

            {saveError ? <p className="wiz-error wiz-save-error" role="alert">{saveError}</p> : null}

            <footer className="wiz-footer">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              {step > 0 ? <button type="button" className="secondary-button" onClick={() => setStep(step - 1)}>Back</button> : null}
              {step < STEPS.length - 1
                ? <button type="submit" className="primary-button">Next →</button>
                : <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create project"}</button>}
            </footer>
          </form>
        </div>
      </section>
    </div>
  );
}
