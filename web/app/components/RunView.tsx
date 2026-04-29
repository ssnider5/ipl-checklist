'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plan, Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';

// ---- topological layout constants ----
const CARD_WIDTH = 264;
const CARD_HEIGHT = 104;
const H_GAP = 84;
const V_GAP = 28;
const COLUMN_WIDTH = CARD_WIDTH + H_GAP;
const ROW_HEIGHT = CARD_HEIGHT + V_GAP;
const PADDING_X = 24;
const PADDING_Y = 24;
const HEADER_BAND_H = 48;

interface Props {
  plan: Plan;
  streamState: 'connecting' | 'open' | 'closed';
  onTransition: (taskId: number, action: 'start' | 'complete' | 'fail') => Promise<void>;
  onReset: () => Promise<void>;
}

export function RunView({ plan, streamState, onTransition, onReset }: Props) {
  // ---- derived: status lookup + blocking helper ----
  const statusById = useMemo(() => {
    const m = new Map<number, TaskStatus>();
    plan.tasks.forEach((t) => m.set(t.id, t.status));
    return m;
  }, [plan.tasks]);

  const blockingFor = (t: Task) =>
    t.prereqs.filter((id) => statusById.get(id) !== 'completed');

  // ---- phase grouping ----
  const phaseList = useMemo(() => {
    const groups = new Map<number, Task[]>();
    plan.tasks.forEach((t) => {
      const list = groups.get(t.phase) ?? [];
      list.push(t);
      groups.set(t.phase, list);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        ([phase, tasks]) =>
          [phase, [...tasks].sort((a, b) => a.id - b.id)] as const
      );
  }, [plan.tasks]);

  // ---- topological layout ----
  const layout = useMemo(() => {
    const m = new Map<number, { x: number; y: number }>();
    phaseList.forEach(([, tasks], col) => {
      tasks.forEach((t, row) => {
        m.set(t.id, {
          x: PADDING_X + col * COLUMN_WIDTH,
          y: PADDING_Y + row * ROW_HEIGHT,
        });
      });
    });
    return m;
  }, [phaseList]);

  const numCols = phaseList.length;
  const maxRows = phaseList.reduce((acc, [, tasks]) => Math.max(acc, tasks.length), 0);
  const canvasWidth = numCols > 0 ? PADDING_X * 2 + numCols * COLUMN_WIDTH - H_GAP : 0;
  const canvasHeight = maxRows > 0 ? PADDING_Y * 2 + maxRows * ROW_HEIGHT - V_GAP : 0;

  // ---- prereq edges ----
  type Edge = {
    key: string;
    fromX: number; fromY: number;
    toX: number; toY: number;
    satisfied: boolean;
  };
  const edges: Edge[] = [];
  plan.tasks.forEach((t) => {
    const tPos = layout.get(t.id);
    if (!tPos) return;
    t.prereqs.forEach((pid) => {
      const pPos = layout.get(pid);
      if (!pPos) return;
      edges.push({
        key: `${pid}->${t.id}`,
        fromX: pPos.x + CARD_WIDTH,
        fromY: pPos.y + CARD_HEIGHT / 2,
        toX: tPos.x,
        toY: tPos.y + CARD_HEIGHT / 2,
        satisfied: statusById.get(pid) === 'completed',
      });
    });
  });

  // ---- elapsed timer ----
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const startedAt = plan.started_at ? new Date(plan.started_at).getTime() : null;
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
  const elapsedFmt =
    elapsed !== null
      ? `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
      : '—';

  const counts = plan.tasks.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }),
    {} as Record<TaskStatus, number>
  );

  const empty = plan.tasks.length === 0;

  return (
    <div>
      {/* Stat row */}
      <div className="bg-white border border-[var(--line)] rounded-xl shadow-card mb-6 px-5 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-2">
          <StatTile label="Elapsed" value={elapsedFmt} mono accent />
          <StatTile label="Pending" value={String(counts.pending ?? 0)} />
          <StatTile label="Running" value={String(counts.running ?? 0)} tone="blue" />
          <StatTile label="Completed" value={String(counts.completed ?? 0)} tone="green" />
          <StatTile label="Failed" value={String(counts.failed ?? 0)} tone="red" />
          <StatTile
            label="Stream"
            value={streamState === 'open' ? 'Live' : streamState === 'connecting' ? 'Connecting' : 'Closed'}
            tone={streamState === 'open' ? 'green' : streamState === 'closed' ? 'red' : 'blue'}
            small
          />
        </div>
        <button
          onClick={onReset}
          className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-white border border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--line-hi)] hover:text-[var(--fg)] transition-colors"
        >
          Reset plan
        </button>
      </div>

      {/* Topological diagram */}
      {empty ? (
        <div className="bg-white border border-[var(--line)] rounded-xl shadow-card p-12 text-center">
          <div className="text-[15px] font-medium text-[var(--fg)]">No tasks yet</div>
          <div className="text-[13px] text-[var(--fg-dim)] mt-1.5">
            Switch to the Build tab to add some.
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[var(--line)] rounded-xl shadow-card overflow-x-auto">
          <div
            className="relative"
            style={{
              width: Math.max(canvasWidth, 0),
              height: HEADER_BAND_H + canvasHeight,
              minWidth: '100%',
            }}
          >
            <div
              className="absolute left-0 right-0 top-0 border-b border-[var(--line)] bg-[var(--bg-subtle)]"
              style={{ height: HEADER_BAND_H }}
            >
              {phaseList.map(([phase], i) => (
                <div
                  key={phase}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: PADDING_X + i * COLUMN_WIDTH, width: CARD_WIDTH }}
                >
                  <div className="mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--fg-dim)] font-medium">
                    Phase {phase}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="absolute left-0"
              style={{ top: HEADER_BAND_H, width: canvasWidth, height: canvasHeight }}
            >
              <svg
                width={canvasWidth}
                height={canvasHeight}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 0 }}
              >
                <defs>
                  <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                  </marker>
                  <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
                  </marker>
                </defs>
                {edges.map((e) => {
                  const dx = Math.max(40, (e.toX - e.fromX) / 2);
                  const c1x = e.fromX + dx;
                  const c2x = e.toX - dx;
                  const d = `M ${e.fromX} ${e.fromY} C ${c1x} ${e.fromY}, ${c2x} ${e.toY}, ${e.toX} ${e.toY}`;
                  const stroke = e.satisfied ? '#3b82f6' : '#cbd5e1';
                  return (
                    <path
                      key={e.key}
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={e.satisfied ? 2 : 1.5}
                      strokeDasharray={e.satisfied ? undefined : '5 4'}
                      markerEnd={`url(#${e.satisfied ? 'arrow-blue' : 'arrow-gray'})`}
                      style={{ transition: 'stroke 220ms ease, stroke-width 220ms ease' }}
                    />
                  );
                })}
              </svg>

              {phaseList.flatMap(([, tasks]) =>
                tasks.map((t) => {
                  const pos = layout.get(t.id)!;
                  return (
                    <div
                      key={t.id}
                      className="absolute"
                      style={{ left: pos.x, top: pos.y, width: CARD_WIDTH, height: CARD_HEIGHT, zIndex: 1 }}
                    >
                      <TaskCard
                        task={t}
                        blockingPrereqs={blockingFor(t)}
                        onStart={() => onTransition(t.id, 'start')}
                        onComplete={() => onTransition(t.id, 'complete')}
                        onFail={() => onTransition(t.id, 'fail')}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label, value, tone, mono, accent, small,
}: {
  label: string; value: string;
  tone?: 'blue' | 'green' | 'red';
  mono?: boolean; accent?: boolean; small?: boolean;
}) {
  const valueCls =
    tone === 'blue' ? 'text-blue-600'
    : tone === 'green' ? 'text-emerald-600'
    : tone === 'red' ? 'text-red-600'
    : accent ? 'text-blue-600'
    : 'text-[var(--fg)]';
  return (
    <div className="border border-[var(--line)] rounded-lg px-3 py-2 min-w-[82px] bg-white shadow-card">
      <div className="text-[9.5px] tracking-[0.16em] uppercase text-[var(--fg-mute)] font-semibold">{label}</div>
      <div className={`${small ? 'text-[12.5px] mt-1' : 'text-[18px] mt-0.5'} font-semibold ${mono ? 'mono' : ''} ${valueCls}`}>
        {value}
      </div>
    </div>
  );
}
