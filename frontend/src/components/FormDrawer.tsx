import { useEffect, useId } from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, required, hint, children }: Readonly<FieldProps>): JSX.Element {
  return (
    <label className="wiz-field">
      <span className="wiz-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      {children}
      {hint ? <small className="wiz-hint">{hint}</small> : null}
    </label>
  );
}

interface FormDrawerProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

/** Side drawer with the same look as the Create / Edit Project form. */
export function FormDrawer({ title, subtitle, submitLabel, saving, error, onClose, onSubmit, children }: Readonly<FormDrawerProps>): JSX.Element {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="wiz-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="wiz-drawer wiz-drawer--narrow" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="wiz-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="wiz-close" aria-label="Close form" onClick={onClose}>×</button>
        </header>
        <div className="wiz-body wiz-body--single">
          <form className="wiz-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            <div className="wiz-form-heading">
              <h3>{subtitle}</h3>
            </div>
            {children}
            {error ? <p className="wiz-error wiz-save-error" role="alert">{error}</p> : null}
            <footer className="wiz-footer">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  );
}
