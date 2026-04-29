import { PlanSummary } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { HomeClient } from './HomeClient';

async function fetchPlans(): Promise<PlanSummary[]> {
  const res = await apiFetch(`/api/plans`);
  if (!res.ok) throw new Error(`failed to load plans: ${res.status}`);
  return res.json();
}

export default async function Page() {
  const plans = await fetchPlans();
  return <HomeClient initial={plans} />;
}
