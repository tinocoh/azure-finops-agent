import { useState } from 'react';

// A password-style input for the client secret. It is NEVER persisted to
// localStorage/sessionStorage/cookies; it only lives in React state until the
// form is submitted to the backend over HTTP(S).
export default function SecureTextInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label>
        {label} {required && <span style={{ color: 'var(--err)' }}>*</span>}
      </label>
      <div className="row">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn secondary" onClick={() => setShow((s) => !s)}>
          {show ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      <div className="hint">El secreto se cifra en el backend y no se vuelve a mostrar.</div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
