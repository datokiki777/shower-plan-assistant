import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import "./fields.css";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref
) {
  return <input ref={ref} className={`ui-field ${className}`.trim()} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", ...rest },
  ref
) {
  return <textarea ref={ref} className={`ui-field ${className}`.trim()} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", ...rest },
  ref
) {
  return <select ref={ref} className={`ui-field ${className}`.trim()} {...rest} />;
});

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <label className="ui-form-field" htmlFor={htmlFor}>
      <span className="ui-form-field__label">{label}</span>
      {children}
      {hint && !error && <span className="ui-form-field__hint">{hint}</span>}
      {error && (
        <span className="ui-form-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
