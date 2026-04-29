import { notFound } from 'next/navigation';
import { Plan } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { PlanDetail } from './PlanDetail';

async function fetchPlan(id: number): Promise<Plan | null> {
  const res = await apiFetch(`/api/plans/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`failed to load plan ${id}: ${res.status}`);
  return res.json();
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) notFound();

  const plan = await fetchPlan(planId);
  if (!plan) notFound();

  return <PlanDetail initial={plan} />;
}
