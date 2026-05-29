import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {title && <h2 className="text-lg font-semibold mb-4 text-slate-800">{title}</h2>}
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${props.className || ''}`}
    />
  );
}

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return <button type="button" {...props} className={`${base} ${styles[variant]} ${props.className || ''}`} />;
}

export function Alert({ type, children }: { type: 'error' | 'success' | 'info'; children: ReactNode }) {
  const colors = {
    error: 'bg-red-50 text-red-800 border-red-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  return <div className={`rounded-md border px-4 py-3 text-sm mb-4 ${colors[type]}`}>{children}</div>;
}
