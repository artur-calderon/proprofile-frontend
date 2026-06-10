import type { PlanName } from '../shared/types/api'

export interface PlanLimits {
  maxProfiles: number | null
  canCreateApplications: boolean
  canAccessSavedJobs: boolean
  maxResumeAttachments: number
}

const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  Free: {
    maxProfiles: 1,
    canCreateApplications: false,
    canAccessSavedJobs: false,
    maxResumeAttachments: 1
  },
  Pro: {
    maxProfiles: null,
    canCreateApplications: false,
    canAccessSavedJobs: false,
    maxResumeAttachments: null
  },
  Premium: {
    maxProfiles: null,
    canCreateApplications: true,
    canAccessSavedJobs: true,
    maxResumeAttachments: null
  }
}

export function getPlanLimits(plan: PlanName): PlanLimits {
  return PLAN_LIMITS[plan]
}

export function canCreateProfile(plan: PlanName, currentCount: number): boolean {
  const { maxProfiles } = getPlanLimits(plan)
  if (maxProfiles === null) return true
  return currentCount < maxProfiles
}

export function canAttachResume(plan: PlanName, currentAttachmentCount: number): boolean {
  const { maxResumeAttachments } = getPlanLimits(plan)
  if (maxResumeAttachments === null) return true
  return currentAttachmentCount < maxResumeAttachments
}

export function planLabel(plan: PlanName): string {
  const labels: Record<PlanName, string> = {
    Free: 'Gratuito',
    Pro: 'Pro',
    Premium: 'Premium'
  }
  return labels[plan]
}

export function profileLimitMessage(plan: PlanName): string {
  if (plan === 'Free') {
    return 'O plano Gratuito permite apenas 1 perfil. Faça upgrade para criar mais.'
  }
  return 'Limite de perfis atingido.'
}

export function resumeLimitMessage(plan: PlanName): string {
  if (plan === 'Free') {
    return 'O plano Gratuito permite apenas 1 anexo de currículo.'
  }
  return 'Limite de anexos atingido.'
}

export function canAccessSavedJobs(plan: PlanName): boolean {
  return getPlanLimits(plan).canAccessSavedJobs
}

export function savedJobsLimitMessage(): string {
  return 'Histórico de vagas disponível apenas no plano Premium.'
}
