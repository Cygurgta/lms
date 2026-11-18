import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function BackButton({ to = '/', label = 'Back' }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  const state = window.history.state as { idx?: number } | null;
  return <button type="button" onClick={() => state && typeof state.idx === 'number' && state.idx > 0 ? navigate(-1) : navigate(to)} className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-forest hover:bg-mint focus-ring" aria-label={label}><ArrowLeft size={17}/>{label}</button>;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink/55">{items.map((item, index) => <span key={`${item.label}-${index}`} className="flex items-center gap-2">{index > 0 && <span aria-hidden="true">/</span>}{item.href ? <Link className="hover:text-forest" to={item.href}>{item.label}</Link> : <span aria-current="page" className="font-semibold text-ink">{item.label}</span>}</span>)}</nav>;
}
