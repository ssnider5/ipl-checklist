import { EventEmitter } from 'node:events';

export type TaskEvent = {
  type: 'task.updated' | 'plan.updated';
  planId: number;
  taskId?: number;
  status?: string;
  at: string;
};

class Bus extends EventEmitter {}
export const bus = new Bus();
bus.setMaxListeners(0); // many SSE subscribers OK
