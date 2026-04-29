import { Router, Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { bus, TaskEvent } from './events';

export const api = Router();

// ---------- helpers ----------

function emitPlanUpdated(planId: number) {
  const evt: TaskEvent = {
    type: 'plan.updated',
    planId,
    at: new Date().toISOString(),
  };
  bus.emit('event', evt);
}

/**
 * Cycle detection over the plan's prereq DAG.
 * Edge t -> p means "t depends on p". A cycle here means task A is
 * (transitively) a prereq of itself — which would deadlock execution.
 *
 * `override` lets us check the proposed graph state inside a transaction
 * without committing first.
 */
async function planHasCycle(
  client: PoolClient,
  planId: number,
  override?: { taskId: number; prereqs: number[] }
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT id, prereqs FROM tasks WHERE plan_id = $1`,
    [planId]
  );
  const adj = new Map<number, number[]>();
  for (const r of rows) adj.set(r.id, r.prereqs as number[]);
  if (override) adj.set(override.taskId, override.prereqs);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  for (const id of adj.keys()) color.set(id, WHITE);

  const dfs = (n: number): boolean => {
    color.set(n, GRAY);
    for (const next of adj.get(n) ?? []) {
      if (!adj.has(next)) continue;
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(n, BLACK);
    return false;
  };

  for (const id of adj.keys()) {
    if (color.get(id) === WHITE && dfs(id)) return true;
  }
  return false;
}

async function validatePrereqsBelongToPlan(
  client: PoolClient,
  planId: number,
  prereqs: number[]
): Promise<{ ok: true } | { ok: false; bad: number[] }> {
  if (prereqs.length === 0) return { ok: true };
  const { rows } = await client.query(
    `SELECT id FROM tasks WHERE plan_id = $1 AND id = ANY($2::int[])`,
    [planId, prereqs]
  );
  const found = new Set(rows.map((r) => r.id));
  const bad = prereqs.filter((id) => !found.has(id));
  return bad.length === 0 ? { ok: true } : { ok: false, bad };
}

function uniqueInts(arr: unknown): number[] | null {
  if (!Array.isArray(arr)) return null;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isInteger(n)) return null;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// ---------- system ----------

api.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ---------- plans: list / get ----------

api.get('/plans', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      p.id, p.name, p.created_at, p.started_at,
      COUNT(t.id)::int                                                     AS task_count,
      COUNT(*) FILTER (WHERE t.status = 'pending')::int                    AS pending,
      COUNT(*) FILTER (WHERE t.status = 'running')::int                    AS running,
      COUNT(*) FILTER (WHERE t.status = 'completed')::int                  AS completed,
      COUNT(*) FILTER (WHERE t.status = 'failed')::int                     AS failed
    FROM plans p
    LEFT JOIN tasks t ON t.plan_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
  `);
  res.json(rows);
});

api.get('/plans/:id', async (req, res) => {
  const id = Number(req.params.id);
  const planQ = pool.query(
    'SELECT id, name, created_at, started_at FROM plans WHERE id = $1',
    [id]
  );
  const tasksQ = pool.query(
    `SELECT id, plan_id, name, phase, status, prereqs, started_at, completed_at
       FROM tasks WHERE plan_id = $1 ORDER BY phase, id`,
    [id]
  );
  const [plan, tasks] = await Promise.all([planQ, tasksQ]);
  if (plan.rowCount === 0) return res.status(404).json({ error: 'plan not found' });
  res.json({ ...plan.rows[0], tasks: tasks.rows });
});

// ---------- plans: create / rename / delete / reset ----------

api.post('/plans', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rows } = await pool.query(
    `INSERT INTO plans (name) VALUES ($1) RETURNING id, name, created_at, started_at`,
    [name]
  );
  const plan = rows[0];
  emitPlanUpdated(plan.id);
  res.status(201).json({ ...plan, tasks: [] });
});

api.patch('/plans/:id', async (req, res) => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rowCount, rows } = await pool.query(
    `UPDATE plans SET name = $2 WHERE id = $1
       RETURNING id, name, created_at, started_at`,
    [id, name]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'plan not found' });

  emitPlanUpdated(id);
  res.json(rows[0]);
});

api.delete('/plans/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query(`DELETE FROM plans WHERE id = $1`, [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'plan not found' });

  emitPlanUpdated(id);
  res.json({ ok: true });
});

api.post('/plans/:id/reset', async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planQ = await client.query(`SELECT id FROM plans WHERE id = $1 FOR UPDATE`, [id]);
    if (planQ.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'plan not found' });
    }
    await client.query(
      `UPDATE tasks
          SET status = 'pending', started_at = NULL, completed_at = NULL
        WHERE plan_id = $1`,
      [id]
    );
    await client.query(`UPDATE plans SET started_at = NULL WHERE id = $1`, [id]);
    await client.query('COMMIT');

    emitPlanUpdated(id);
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// ---------- tasks: create / edit / delete ----------

api.post('/plans/:id/tasks', async (req, res) => {
  const planId = Number(req.params.id);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phase = Number(req.body?.phase);
  const prereqs = uniqueInts(req.body?.prereqs ?? []);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isInteger(phase) || phase < 1)
    return res.status(400).json({ error: 'phase must be a positive integer' });
  if (prereqs === null) return res.status(400).json({ error: 'prereqs must be int[]' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planQ = await client.query(`SELECT id FROM plans WHERE id = $1`, [planId]);
    if (planQ.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'plan not found' });
    }

    const v = await validatePrereqsBelongToPlan(client, planId, prereqs);
    if (!v.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'prereqs reference foreign tasks', bad: v.bad });
    }

    const ins = await client.query(
      `INSERT INTO tasks (plan_id, name, phase, prereqs)
       VALUES ($1, $2, $3, $4)
       RETURNING id, plan_id, name, phase, status, prereqs, started_at, completed_at`,
      [planId, name, phase, prereqs]
    );
    const task = ins.rows[0];

    if (await planHasCycle(client, planId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'prereqs would form a cycle' });
    }

    await client.query('COMMIT');
    emitPlanUpdated(planId);
    res.status(201).json(task);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

api.patch('/plans/:id/tasks/:taskId', async (req, res) => {
  const planId = Number(req.params.id);
  const taskId = Number(req.params.taskId);

  const body = req.body ?? {};
  const wantsName = 'name' in body;
  const wantsPhase = 'phase' in body;
  const wantsPrereqs = 'prereqs' in body;

  if (!wantsName && !wantsPhase && !wantsPrereqs)
    return res.status(400).json({ error: 'no fields to update' });

  let name: string | undefined;
  let phase: number | undefined;
  let prereqs: number[] | undefined;

  if (wantsName) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  if (wantsPhase) {
    phase = Number(body.phase);
    if (!Number.isInteger(phase) || phase < 1)
      return res.status(400).json({ error: 'phase must be a positive integer' });
  }
  if (wantsPrereqs) {
    const p = uniqueInts(body.prereqs);
    if (p === null) return res.status(400).json({ error: 'prereqs must be int[]' });
    if (p.includes(taskId))
      return res.status(400).json({ error: 'task cannot list itself as a prereq' });
    prereqs = p;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT id, status FROM tasks WHERE id = $1 AND plan_id = $2 FOR UPDATE`,
      [taskId, planId]
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'task not found' });
    }
    if (cur.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res
        .status(409)
        .json({ error: `cannot edit task in status ${cur.rows[0].status}` });
    }

    if (prereqs) {
      const v = await validatePrereqsBelongToPlan(client, planId, prereqs);
      if (!v.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'prereqs reference foreign tasks', bad: v.bad });
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [taskId];
    if (name !== undefined) {
      vals.push(name);
      sets.push(`name = $${vals.length}`);
    }
    if (phase !== undefined) {
      vals.push(phase);
      sets.push(`phase = $${vals.length}`);
    }
    if (prereqs !== undefined) {
      vals.push(prereqs);
      sets.push(`prereqs = $${vals.length}`);
    }

    const upd = await client.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $1
         RETURNING id, plan_id, name, phase, status, prereqs, started_at, completed_at`,
      vals
    );

    if (prereqs && (await planHasCycle(client, planId))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'prereqs would form a cycle' });
    }

    await client.query('COMMIT');
    emitPlanUpdated(planId);
    res.json(upd.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

api.delete('/plans/:id/tasks/:taskId', async (req, res) => {
  const planId = Number(req.params.id);
  const taskId = Number(req.params.taskId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT id, status FROM tasks WHERE id = $1 AND plan_id = $2 FOR UPDATE`,
      [taskId, planId]
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'task not found' });
    }
    if (cur.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res
        .status(409)
        .json({ error: `cannot delete task in status ${cur.rows[0].status}` });
    }

    await client.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
    // Strip this id from any other task's prereqs in the same plan.
    await client.query(
      `UPDATE tasks SET prereqs = array_remove(prereqs, $1) WHERE plan_id = $2`,
      [taskId, planId]
    );

    await client.query('COMMIT');
    emitPlanUpdated(planId);
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// ---------- task transitions ----------

async function transition(
  res: Response,
  planId: number,
  taskId: number,
  next: 'running' | 'completed' | 'failed'
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      `SELECT id, status, prereqs FROM tasks
        WHERE id = $1 AND plan_id = $2 FOR UPDATE`,
      [taskId, planId]
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'task not found' });
    }
    const task = cur.rows[0];

    if (next === 'running') {
      if (task.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `cannot start task in status ${task.status}` });
      }
      if (task.prereqs.length > 0) {
        const prereqs = await client.query(
          `SELECT id, status FROM tasks WHERE id = ANY($1::int[])`,
          [task.prereqs]
        );
        const blocking = prereqs.rows.filter((r) => r.status !== 'completed');
        if (blocking.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'prerequisites not satisfied',
            blocking: blocking.map((r) => r.id),
          });
        }
      }
      await client.query(
        `UPDATE tasks SET status = 'running', started_at = NOW() WHERE id = $1`,
        [taskId]
      );
      await client.query(
        `UPDATE plans SET started_at = COALESCE(started_at, NOW()) WHERE id = $1`,
        [planId]
      );
    } else {
      if (task.status !== 'running') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `cannot ${next} task in status ${task.status}` });
      }
      await client.query(
        `UPDATE tasks SET status = $2, completed_at = NOW() WHERE id = $1`,
        [taskId, next]
      );
    }

    await client.query('COMMIT');

    const evt: TaskEvent = {
      type: 'task.updated',
      planId,
      taskId,
      status: next,
      at: new Date().toISOString(),
    };
    bus.emit('event', evt);
    res.json({ ok: true, status: next });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
}

api.post('/plans/:id/tasks/:taskId/start', (req, res) =>
  transition(res, Number(req.params.id), Number(req.params.taskId), 'running')
);
api.post('/plans/:id/tasks/:taskId/complete', (req, res) =>
  transition(res, Number(req.params.id), Number(req.params.taskId), 'completed')
);
api.post('/plans/:id/tasks/:taskId/fail', (req, res) =>
  transition(res, Number(req.params.id), Number(req.params.taskId), 'failed')
);

// ---------- SSE ----------

api.get('/plans/:id/stream', (req: Request, res: Response) => {
  const planId = Number(req.params.id);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  res.write(`event: hello\ndata: ${JSON.stringify({ planId })}\n\n`);

  const onEvent = (evt: TaskEvent) => {
    if (evt.planId !== planId) return;
    res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
  };
  bus.on('event', onEvent);

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('event', onEvent);
  });
});
