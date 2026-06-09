import { Experience, Profile } from './types'

export function formatExperiencePeriod(exp: Experience): string {
  const end = exp.endDate ?? 'Presente'
  return `${exp.startDate} — ${end}`
}

export function formatExperienceRole(exp: Experience): string {
  return exp.role
}

export function formatExperienceCompany(exp: Experience): string {
  return exp.company
}

export function formatExperienceResponsibilities(exp: Experience): string {
  return exp.responsibilities
}

export function formatExperienceFull(exp: Experience): string {
  const lines = [exp.role, exp.company, exp.responsibilities, formatExperiencePeriod(exp)].filter(Boolean)
  return lines.join('\n')
}

export function formatSkillsList(skills: string[], separator = ', '): string {
  return skills.join(separator)
}

export function createEmptyProfile(id: string, name: string): Profile {
  return {
    id,
    name,
    resumeId: null,
    snippetIds: [],
    title: '',
    about: '',
    skills: [],
    experiences: [],
    education: []
  }
}

export function getProfileCompletion(profile: Profile): number {
  let filled = 0
  const total = 5
  if (profile.title?.trim()) filled++
  if (profile.about?.trim()) filled++
  if (profile.skills?.length) filled++
  if (profile.experiences?.length) filled++
  if (profile.education?.length) filled++
  return Math.round((filled / total) * 100)
}
