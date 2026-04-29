export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: number;
  plan_id: number;
  name: string;
  phase: number;
  status: TaskStatus;
  prereqs: number[];
  started_at: string | null;
  completed_at: string | null;
}

export interface Plan {
  id: number;
  name: string;
  created_at: string;
  started_at: string | null;
  tasks: Task[];
}

export interface PlanSummary {
  id: number;
  name: string;
  created_at: string;
  started_at: string | null;
  task_count: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface TaskEvent {
  type: 'task.updated' | 'plan.updated';
  planId: number;
  taskId?: number;
  status?: TaskStatus;
  at: string;
}
