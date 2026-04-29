-- Schema for IPL checklist demo

CREATE TABLE IF NOT EXISTS plans (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  plan_id      INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phase        INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','failed')),
  prereqs      INTEGER[] NOT NULL DEFAULT '{}',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tasks_plan_idx ON tasks(plan_id);
