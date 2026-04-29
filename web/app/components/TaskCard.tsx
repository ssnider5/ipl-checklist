'use client';

import { Task, TaskStatus } from '@/lib/types';

const STATUS_META: Record<TaskStatus, { label: string; pill: string; dot: string }> = {
  pending: {
    label: 'Pending',
    pill: 'bg-slate-50 text-slate-500 border-slate-200',
    dot: 'bg-slate-300',
  },
  running: {
    label: 'Running',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500 pulse',
  },
  completed: {
    label: 'Completed',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    pill: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

interface Props {
  task: Task;
  blockingPrereqs: number[];
  onStart: () => void;
  onComplete: () => void;
  onFail: () => void;
}

export function TaskCard({ task, blockingPrereqs, onStart, onComplete, onFail }: Props) {
  const meta = STATUS_META[task.status];
  const blocked = blockingPrereqs.length > 0;

  return (
    <div className="bg-white border border-[var(--line)] rounded-lg shadow-card hover:shadow-card-hover hover:border-[var(--line-hi)] transition-all duration-150 h-full flex flex-col">
      <div className="px-4 pt-3.5 pb-2 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-[var(--fg)] leading-snug truncate">
            {task.name}
          </div>
          <div className="mono text-[11px] text-[var(--fg-mute)] mt-0.5">task #{task.id}</div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${meta.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="px-4 pb-3 mt-auto flex items-center gap-2">
        {task.status === 'pending' && (
          <button
            onClick={onStart}
            disabled={blocked}
            className={
              blocked
                ? 'text-[12px] font-medium px-3 py-1.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'text-[12px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-700 transition-colors shadow-sm'
            }
          >
            {blocked
              ? `Blocked · ${blockingPrereqs.length} prereq${blockingPrereqs.length > 1 ? 's' : ''}`
              : 'Start'}
          </button>
        )}
        {task.status === 'running' && (
          <>
            <button
              onClick={onComplete}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Complete
            </button>
            <button
              onClick={onFail}
              className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
            >
              Fail
            </button>
          </>
        )}
        {task.status === 'completed' && (
          <div className="mono text-[11px] text-emerald-600">done</div>
        )}
        {task.status === 'failed' && (
          <div className="mono text-[11px] text-red-600">failed</div>
        )}
      </div>
    </div>
  );
}
