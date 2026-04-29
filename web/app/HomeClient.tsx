'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plan, PlanSummary } from '@/lib/types';

interface Props {
  initial: PlanSummary[];
}

export function HomeClient({ initial }: Props) {
  const router = useRouter();
  const [plans] = useState<PlanSummary[]>(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createPlan() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `failed: ${res.status}`);
      }
      const plan = (await res.json()) as Plan;
      router.push(`/plans/${plan.id}?tab=build`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="mono text-[10.5px] tracking-[0.2em] uppercase text-[var(--fg-mute)]">
              IPL Checklist
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[var(--fg)] mt-1">
              Plans
            </h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="text-[13px] font-medium px-3.5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            + New plan
          </button>
        </header>

        {plans.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <NewPlanModal
          name={name}
          setName={setName}
          submitting={submitting}
          error={error}
          onCancel={() => {
            setCreating(false);
            setName('');
            setError(null);
          }}
          onSubmit={createPlan}
        />
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  const created = new Date(plan.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const elapsed = useElapsed(plan.started_at);

  const status = (() => {
    if (plan.task_count === 0) return { label: 'Empty', tone: 'gray' as const };
    if (plan.running > 0) return { label: 'Running', tone: 'blue' as const };
    if (plan.failed > 0) return { label: 'Has failures', tone: 'red' as const };
    if (plan.completed === plan.task_count) return { label: 'Complete', tone: 'green' as const };
    if (plan.started_at) return { label: 'In progress', tone: 'blue' as const };
    return { label: 'Not started', tone: 'gray' as const };
  })();

  const toneCls =
    status.tone === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-700'
    : status.tone === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : status.tone === 'red' ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-slate-50 border-slate-200 text-slate-600';

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="group block bg-white border border-[var(--line)] rounded-xl shadow-card hover:shadow-card-hover hover:border-[var(--line-hi)] transition-all duration-150 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-[var(--fg)] tracking-tight truncate group-hover:text-blue-700 transition-colors">
            {plan.name}
          </h3>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${toneCls}`}>
            {status.label}
          </span>
        </div>
        <div className="mono text-[11px] text-[var(--fg-mute)] mt-1">#{plan.id}</div>

        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px]">
          <SummaryDot color="bg-slate-300" label={`${plan.pending} pending`} />
          {plan.running > 0 && <SummaryDot color="bg-blue-500" label={`${plan.running} running`} />}
          {plan.completed > 0 && <SummaryDot color="bg-emerald-500" label={`${plan.completed} completed`} />}
          {plan.failed > 0 && <SummaryDot color="bg-red-500" label={`${plan.failed} failed`} />}
        </div>
      </div>
      <div className="px-5 py-2.5 border-t border-[var(--line)] bg-[var(--bg-subtle)] flex items-center justify-between text-[11.5px] text-[var(--fg-dim)]">
        <span>{plan.task_count} task{plan.task_count === 1 ? '' : 's'} · {created}</span>
        {elapsed && <span className="mono text-blue-600">{elapsed}</span>}
      </div>
    </Link>
  );
}

function SummaryDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--fg-dim)]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl shadow-card py-16 px-8 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      </div>
      <h2 className="text-[16px] font-semibold text-[var(--fg)]">No plans yet</h2>
      <p className="text-[13px] text-[var(--fg-dim)] mt-1.5 max-w-md mx-auto">
        Plans hold a topological set of tasks with prereqs. Create one to start building a checklist.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 text-[13px] font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
      >
        Create your first plan
      </button>
    </div>
  );
}

function NewPlanModal({
  name, setName, submitting, error, onCancel, onSubmit,
}: {
  name: string;
  setName: (s: string) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onCancel} />
      <div className="relative bg-white border border-[var(--line)] rounded-xl shadow-card-hover w-full max-w-md p-5">
        <h3 className="text-[16px] font-semibold tracking-tight">Create plan</h3>
        <p className="text-[12.5px] text-[var(--fg-dim)] mt-1">Give your plan a descriptive name. You can rename it later.</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !submitting) onSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="e.g. Region A IPL · Q2"
          className="mt-4 w-full text-[14px] px-3 py-2 rounded-md border border-[var(--line-hi)] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-white border border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--line-hi)] hover:text-[var(--fg)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!name.trim() || submitting}
            className="text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating…' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [startedAt]);
  if (!startedAt) return null;
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
