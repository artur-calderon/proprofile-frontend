import { Education, Experience, Profile } from './types'

export function educationDisplayName(title: string, institution: string): string {
  if (title && institution) return `${title} — ${institution}`
  return title || institution || 'Formação'
}

export function parseCompletionDateParts(value: string | null | undefined): {
  year: string
  month: string
  day: string
} {
  if (!value?.trim()) return { year: '', month: '', day: '' }

  const isoMatch = value.trim().match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/)
  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2] ? String(parseInt(isoMatch[2], 10)) : '',
      day: isoMatch[3] ? String(parseInt(isoMatch[3], 10)) : ''
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { year: '', month: '', day: '' }

  return {
    year: String(parsed.getFullYear()),
    month: String(parsed.getMonth() + 1),
    day: String(parsed.getDate())
  }
}

export function buildCompletionDate(year: string, month: string, day: string): string | null {
  if (!year.trim()) return null

  const y = year.trim()
  const m = month.trim().padStart(2, '0')
  const d = day.trim().padStart(2, '0')
  const candidate = `${y}-${m}-${d}`
  const parsed = new Date(candidate)

  if (Number.isNaN(parsed.getTime())) return null
  if (
    parsed.getFullYear() !== Number(y) ||
    parsed.getMonth() + 1 !== Number(m) ||
    parsed.getDate() !== Number(d)
  ) {
    return null
  }

  return candidate
}

export function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31
  return new Date(year, month, 0).getDate()
}

export function formatEducationCompletionDateDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return 'Em andamento'
  const parts = parseCompletionDateParts(value)
  if (!parts.year) return value

  if (parts.month && parts.day) {
    const date = new Date(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day)
    )
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  if (parts.month) return `${parts.month.padStart(2, '0')}/${parts.year}`
  return parts.year
}

export function formatEducationSubtitle(edu: Education): string {
  const parts = [
    edu.institution?.trim(),
    formatEducationCompletionDateDisplay(edu.completionDate)
  ].filter(Boolean)
  return parts.join(' • ')
}

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
  if (profile.completionPercentage !== undefined) {
    return profile.completionPercentage
  }
  let filled = 0
  const total = 5
  if (profile.title?.trim()) filled++
  if (profile.about?.trim()) filled++
  if (profile.skills?.length) filled++
  if (profile.experiences?.length) filled++
  if (profile.education?.length) filled++
  return Math.round((filled / total) * 100)
}
