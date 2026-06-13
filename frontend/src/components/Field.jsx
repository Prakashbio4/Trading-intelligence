import styles from './Field.module.css';

export function Field({ label, hint, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.req}>*</span>}
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function SelectField({ label, hint, required, value, onChange, options }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— select —</option>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function NumberField({ label, hint, required, value, onChange, placeholder, mono }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        style={mono ? { fontFamily: 'var(--font-mono)' } : {}}
        step="0.01"
      />
    </Field>
  );
}

export function TextField({ label, hint, required, value, onChange, placeholder }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
      />
    </Field>
  );
}

export function TextArea({ label, hint, required, value, onChange, placeholder, rows }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        rows={rows ?? 4}
        style={{ resize: 'vertical' }}
      />
    </Field>
  );
}
