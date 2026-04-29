'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plan, Task } from '@/lib/types';

interface Props {
  plan: Plan;
  onCreateTask: (data: { name: string; phase: number; prereqs: number[] }) => Promise<void>;
  onPatchTask: (taskId: number, patch: Partial<Pick<Task, 'name' | 'phase' | 'prereqs'>>) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  notify: (msg: string, kind?: 'info' | 'error') => void;
}

export function BuildView({ plan, onCreateTask, onPatchTask, onDeleteTask, notify }: Props) {
  const phases = useMemo(() => {
    const groups = new Map<number, Task[]>();
    plan.tasks.forEach((t) => {
      const list = groups.get(t.phase) ?? [];
      list.push(t);
      groups.set(t.phase, list);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([phase, tasks]) => [phase, [...tasks].sort((a, b) => a.id - b.id)] as const);
  }, [plan.tasks]);

  const taskById = useMemo(() => {
    const m = new Map<number, Task>();
    plan.tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [plan.tasks]);

  const maxPhase = phases.length > 0 ? Math.max(...phases.map(([p]) => p)) : 0;
  const [extraPhases, setExtraPhases] = useState<number[]>([]);

  const allPhases: number[] = useMemo(() => {
    const set = new Set<number>(phases.map(([p]) => p));
    extraPhases.forEach((p) => set.add(p));
    return [...set].sort((a, b) => a - b);
  }, [phases, extraPhases]);

  const tasksByPhase = useMemo(() => {
    const m = new Map<number, Task[]>();
    phases.forEach(([p, ts]) => m.set(p, ts));
    return m;
  }, [phases]);

  return (
    <div className="space-y-5">
      {allPhases.length === 0 && (
        <div className="bg-white border border-[var(--line)] rounded-xl shadow-card p-12 text-center">
          <div className="text-[15px] font-medium text-[var(--fg)]">No tasks yet</div>
          <div className="text-[13px] text-[var(--fg-dim)] mt-1.5">
            Add your first phase to get started.
          </div>
          <button
            onClick={() => setExtraPhases([1])}
            className="mt-4 text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          >
            Add phase 1
          </button>
        </div>
      )}

      {allPhases.map((phase) => (
        <PhaseSection
          key={phase}
          phase={phase}
          tasks={tasksByPhase.get(phase) ?? []}
          allTasks={plan.tasks}
          taskById={taskById}
          onCreateTask={onCreateTask}
          onPatchTask={onPatchTask}
          onDeleteTask={onDeleteTask}
          notify={notify}
        />
      ))}

      <div className="flex justify-center pt-2">
        <button
          onClick={() => setExtraPhases((xs) => [...xs, Math.max(maxPhase, ...xs, 0) + 1])}
          className="text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-white border border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--line-hi)] hover:text-[var(--fg)] transition-colors"
        >
          + Add phase
        </button>
      </div>
    </div>
  );
}

function PhaseSection({
  phase,
  tasks,
  allTasks,
  taskById,
  onCreateTask,
  onPatchTask,
  onDeleteTask,
  notify,
}: {
  phase: number;
  tasks: Task[];
  allTasks: Task[];
  taskById: Map<number, Task>;
  onCreateTask: Props['onCreateTask'];
  onPatchTask: Props['onPatchTask'];
  onDeleteTask: Props['onDeleteTask'];
  notify: Props['notify'];
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  async function commitNew() {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      setNewName('');
      return;
    }
    try {
      await onCreateTask({ name, phase, prereqs: [] });
      setAdding(false);
      setNewName('');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  return (
    <section className="bg-white border border-[var(--line)] rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--line)] bg-[var(--bg-subtle)] flex items-center justify-between">
        <div className="mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--fg-dim)] font-semibold">
          Phase {phase}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          + Add task
        </button>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            allTasks={allTasks}
            taskById={taskById}
            onPatchTask={onPatchTask}
            onDeleteTask={onDeleteTask}
            notify={notify}
          />
        ))}
        {tasks.length === 0 && !adding && (
          <div className="px-5 py-4 text-[12.5px] text-[var(--fg-mute)]">
            No tasks in this phase yet.
          </div>
        )}
        {adding && (
          <div className="px-5 py-3 flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitNew}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNew();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewName('');
                }
              }}
              placeholder="Task name…"
              className="flex-1 text-[13.5px] px-3 py-1.5 rounded-md border border-[var(--line-hi)] bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={commitNew}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  allTasks,
  taskById,
  onPatchTask,
  onDeleteTask,
  notify,
}: {
  task: Task;
  allTasks: Task[];
  taskById: Map<number, Task>;
  onPatchTask: Props['onPatchTask'];
  onDeleteTask: Props['onDeleteTask'];
  notify: Props['notify'];
}) {
  const editable = task.status === 'pending';

  const [name, setName] = useState(task.name);
  const [phase, setPhase] = useState(String(task.phase));

  // Keep local state in sync if the task changes from elsewhere (SSE refetch).
  useEffect(() => {
    setName(task.name);
    setPhase(String(task.phase));
  }, [task.name, task.phase]);

  async function commitName() {
    const v = name.trim();
    if (!v || v === task.name) {
      setName(task.name);
      return;
    }
    try {
      await onPatchTask(task.id, { name: v });
    } catch (err) {
      notify((err as Error).message, 'error');
      setName(task.name);
    }
  }

  async function commitPhase() {
    const n = Number(phase);
    if (!Number.isInteger(n) || n < 1 || n === task.phase) {
      setPhase(String(task.phase));
      return;
    }
    try {
      await onPatchTask(task.id, { phase: n });
    } catch (err) {
      notify((err as Error).message, 'error');
      setPhase(String(task.phase));
    }
  }

  const availableForPrereq = allTasks.filter(
    (t) => t.id !== task.id && !task.prereqs.includes(t.id)
  );

  async function addPrereq(pid: number) {
    if (!pid) return;
    try {
      await onPatchTask(task.id, { prereqs: [...task.prereqs, pid] });
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function removePrereq(pid: number) {
    try {
      await onPatchTask(task.id, { prereqs: task.prereqs.filter((p) => p !== pid) });
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  async function del() {
    if (!editable) {
      notify(`Can't delete a task in status ${task.status}`, 'error');
      return;
    }
    try {
      await onDeleteTask(task.id);
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  const statusColor = {
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    running: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
  }[task.status];

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <input
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setName(task.name);
          }}
          className="flex-1 text-[13.5px] font-medium px-2.5 py-1.5 rounded-md border border-transparent hover:border-[var(--line)] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white disabled:bg-transparent disabled:text-[var(--fg-dim)]"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-[10.5px] tracking-[0.16em] uppercase text-[var(--fg-mute)] font-semibold">
            Phase
          </label>
          <input
            type="number"
            min={1}
            value={phase}
            disabled={!editable}
            onChange={(e) => setPhase(e.target.value)}
            onBlur={commitPhase}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-14 text-[13px] px-2 py-1 rounded-md border border-[var(--line)] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-[var(--bg-subtle)] disabled:text-[var(--fg-dim)]"
          />
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${statusColor}`}>
          {task.status}
        </span>
        <button
          onClick={del}
          disabled={!editable}
          title={editable ? 'Delete task' : `Can't delete a ${task.status} task`}
          className="shrink-0 text-[12px] font-medium px-2.5 py-1 rounded-md bg-white border border-[var(--line)] text-[var(--fg-dim)] hover:border-red-200 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[var(--fg-dim)] disabled:hover:border-[var(--line)] transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="mt-2.5 pl-2.5 flex items-center flex-wrap gap-2">
        <span className="text-[10.5px] tracking-[0.16em] uppercase text-[var(--fg-mute)] font-semibold">
          Prereqs
        </span>
        {task.prereqs.length === 0 && (
          <span className="text-[12px] text-[var(--fg-mute)]">none</span>
        )}
        {task.prereqs.map((pid) => {
          const p = taskById.get(pid);
          return (
            <span
              key={pid}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11.5px]"
            >
              <span className="mono text-[10.5px] text-blue-500">#{pid}</span>
              <span className="max-w-[180px] truncate">{p?.name ?? 'unknown'}</span>
              {editable && (
                <button
                  onClick={() => removePrereq(pid)}
                  className="ml-0.5 text-blue-400 hover:text-blue-700 leading-none text-[14px]"
                  aria-label="Remove prereq"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {editable && availableForPrereq.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              addPrereq(Number(e.target.value));
              e.target.value = '';
            }}
            className="text-[11.5px] px-2 py-0.5 rounded-md border border-[var(--line)] bg-white text-[var(--fg-dim)] hover:border-[var(--line-hi)] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">+ Add prereq…</option>
            {availableForPrereq.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} · {t.name} (phase {t.phase})
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
