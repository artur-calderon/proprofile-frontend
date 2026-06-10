import pdfService from './pdfService'
import storageService from './storageService'
import { updateProfileResumeMeta, removeProfileResumeMeta } from './profileSyncService'
import { resumeLimitMessage } from '../shared/planLimits'
import type { PlanName } from '../shared/types/api'
import { Profile, ResumePDF } from '../shared/types'

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function guessMime(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return 'application/octet-stream'
}

function isAllowedResumeFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  const validExt = lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx')
  return validExt || ALLOWED_MIME.includes(file.type)
}

export async function getResumeMeta(resumeId: string): Promise<ResumePDF | null> {
  const resumes = await storageService.getAllResumes()
  return resumes.find((r) => r.id === resumeId) ?? null
}

async function removeResumeFile(resumeId: string): Promise<void> {
  await pdfService.deletePdf(resumeId)
  const resumes = await storageService.getAllResumes()
  await storageService.saveResumes(resumes.filter((r) => r.id !== resumeId))
}

export async function attachResumeToProfile(
  profile: Profile,
  file: File,
  plan?: PlanName,
  allProfiles?: Profile[]
): Promise<Profile> {
  if (!isAllowedResumeFile(file)) {
    throw new Error('Use um arquivo PDF, DOC ou DOCX.')
  }

  if (plan && allProfiles && !profile.resumeId) {
    const attachmentCount = allProfiles.filter((p) => p.resumeId).length
    if (attachmentCount >= 1 && plan === 'Free') {
      throw new Error(resumeLimitMessage(plan))
    }
  }

  if (profile.resumeId) {
    await removeResumeFile(profile.resumeId)
  }

  const id = uid('res_')
  await pdfService.savePdf(id, file)

  const meta: ResumePDF = {
    id,
    name: file.name,
    size: file.size,
    mimeType: file.type || guessMime(file.name),
    createdAt: new Date().toISOString()
  }

  const resumes = await storageService.getAllResumes()
  resumes.push(meta)
  await storageService.saveResumes(resumes)

  const updated: Profile = { ...profile, resumeId: id, resumeFileName: file.name }
  await updateProfileResumeMeta(updated, file.name, id)
  return updated
}

export async function removeResumeFromProfile(profile: Profile): Promise<Profile> {
  if (!profile.resumeId) return profile
  await removeResumeFile(profile.resumeId)
  return removeProfileResumeMeta(profile)
}

export async function downloadProfileResume(
  profile: Profile
): Promise<{ success: boolean; message: string }> {
  if (!profile.resumeId) {
    return { success: false, message: 'Nenhum currículo anexado a este perfil' }
  }

  const meta = await getResumeMeta(profile.resumeId)
  const blob = await pdfService.getPdf(profile.resumeId)
  if (!blob) {
    return { success: false, message: 'Arquivo do currículo não encontrado' }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = meta?.name || 'curriculo.pdf'
  a.click()
  URL.revokeObjectURL(url)

  return { success: true, message: 'Download iniciado' }
}

export default downloadProfileResume
