'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plan, Task, TaskEvent, TaskStatus } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { RunView } from '@/app/components/RunView';
import { BuildView } from '@/app/components/BuildView';

type Tab = 'build' | 'run';
type Toast = { id: number; msg: string; kind: 'info' | 'error' };

interface Props {
  initial: Plan;
}

export function PlanDetail({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'build' ? 'build' : 'run';

  const [plan, setPlan] = useState<Plan>(initial);
  const [streamState, setStreamState] = useState<'connecting' | 'open' | 'closed'>('connecting');

  // ---- Toasts ----
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  function notify(msg: string, kind: 'info' | 'error' = 'info') {
    const id = ++toastIdRef.current;
    setToasts((ts) => [...ts, { id, msg, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4000);
  }

  // ---- Refetch the full plan on plan.updated events ----
  async function refetch() {
    try {
      const res = await apiFetch(`/api/plans/${plan.id}`);
      if (res.status === 404) {
        router.push('/');
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as Plan;
      setPlan(next);
    } catch {
      /* ignore — SSE will retry */
    }
  }

  // ---- SSE ----
  useEffect(() => {
    const es = new EventSource(`/api/plans/${plan.id}/stream`);
    es.addEventListener('hello', () => setStreamState('open'));
    es.addEventListener('task.updated', (e) => {
      const evt = JSON.parse((e as MessageEvent).data) as TaskEvent;
      if (!evt.taskId || !evt.status) return;
      setPlan((p) => ({
        ...p,
        tasks: p.tasks.map((t) =>
          t.id === evt.taskId ? { ...t, status: evt.status as TaskStatus } : t
        ),
      }));
    });
    es.addEventListener('plan.updated', () => {
      refetch();
    });
    es.onerror = () => setStreamState('closed');
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  // ---- Action helpers ----
  async function jsonRequest(path: string, init: RequestInit) {
    const res = await apiFetch(path, init);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `request failed: ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  async function transition(taskId: number, action: 'start' | 'complete' | 'fail') {
    try {
      await jsonRequest(`/api/plans/${plan.id}/tasks/${taskId}/${action}`, { method: 'POST' });
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function reset() {
    if (!confirm('Reset all tasks to pending? This clears start/complete timestamps.')) return;
    try {
      await jsonRequest(`/api/plans/${plan.id}/reset`, { method: 'POST' });
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function deletePlan() {
    if (!confirm(`Delete plan "${plan.name}"? This removes all its tasks.`)) return;
    try {
      await jsonRequest(`/api/plans/${plan.id}`, { method: 'DELETE' });
      router.push('/');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function renamePlan(name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === plan.name) return;
    try {
      await jsonRequest(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function createTask(data: { name: string; phase: number; prereqs: number[] }) {
    await jsonRequest(`/api/plans/${plan.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async function patchTask(taskId: number, patch: Partial<Pick<Task, 'name' | 'phase' | 'prereqs'>>) {
    await jsonRequest(`/api/plans/${plan.id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  async function deleteTask(taskId: number) {
    await jsonRequest(`/api/plans/${plan.id}/tasks/${taskId}`, { method: 'DELETE' });
  }

  function setTab(next: Tab) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    if (next === 'run') sp.delete('tab');
    else sp.set('tab', next);
    const qs = sp.toString();
    router.replace(`/plans/${plan.id}${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <Header
          plan={plan}
          tab={tab}
          onTabChange={setTab}
          onRename={renamePlan}
          onDelete={deletePlan}
          onReset={reset}
        />

        {tab === 'run' ? (
          <RunView
            plan={plan}
            streamState={streamState}
            onTransition={transition}
            onReset={reset}
          />
        ) : (
          <BuildView
            plan={plan}
            onCreateTask={createTask}
            onPatchTask={patchTask}
            onDeleteTask={deleteTask}
            notify={notify}
          />
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3.5 py-2.5 rounded-lg shadow-card-hover border text-[12.5px] font-medium max-w-[320px] ${
              t.kind === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-white border-[var(--line)] text-[var(--fg)]'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({
  plan,
  tab,
  onTabChange,
  onRename,
  onDelete,
  onReset,
}: {
  plan: Plan;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(plan.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftName(plan.name);
  }, [plan.name]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function commitName() {
    setEditingName(false);
    if (draftName.trim() && draftName.trim() !== plan.name) {
      await onRename(draftName);
    } else {
      setDraftName(plan.name);
    }
  }

  return (
    <header className="bg-white border border-[var(--line)] rounded-xl shadow-card mb-6 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500" />
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <Link href="/" className="mono text-[10.5px] tracking-[0.2em] uppercase text-[var(--fg-mute)] hover:text-[var(--fg-dim)] transition-colors">
            ← All plans
          </Link>
          <div className="mt-1 flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setDraftName(plan.name);
                    setEditingName(false);
                  }
                }}
                className="text-[22px] font-semibold tracking-tight px-1.5 py-0.5 -ml-1.5 rounded-md border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-[22px] font-semibold tracking-tight text-[var(--fg)] px-1.5 py-0.5 -ml-1.5 rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
                title="Click to rename"
              >
                {plan.name}
              </button>
            )}
            <span className="mono text-[11px] text-[var(--fg-mute)]">#{plan.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tabs tab={tab} onChange={onTabChange} />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="px-2.5 py-1.5 rounded-md bg-white border border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--line-hi)] hover:text-[var(--fg)] transition-colors"
              aria-label="More actions"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white border border-[var(--line)] rounded-lg shadow-card-hover py-1 z-10">
                <button
                  onClick={() => { setMenuOpen(false); onReset(); }}
                  className="w-full text-left px-3 py-2 text-[12.5px] text-[var(--fg)] hover:bg-[var(--bg-subtle)]"
                >
                  Reset plan
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full text-left px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50"
                >
                  Delete plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--line)]">
      {(['build', 'run'] as Tab[]).map((t) => {
        const active = tab === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`px-3.5 py-1 text-[12.5px] font-medium rounded-md capitalize transition-colors ${
              active
                ? 'bg-white text-blue-700 shadow-card'
                : 'text-[var(--fg-dim)] hover:text-[var(--fg)]'
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
