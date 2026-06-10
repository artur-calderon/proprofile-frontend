import api, { ApiError } from './apiClient'
import storageService from './storageService'
import type { ApiProfile } from '../shared/types/api'
import { educationDisplayName } from '../shared/profileFormatters'
import { Education, Experience, Profile } from '../shared/types'

const LOCAL_ID_PREFIX = 'local_'

function isLocalId(id: string): boolean {
  return (
    id.startsWith(LOCAL_ID_PREFIX) ||
    id.startsWith('profile_') ||
    id.startsWith('exp_') ||
    id.startsWith('edu_')
  )
}

export function apiProfileToLocal(apiProfile: ApiProfile): Profile {
  return {
    id: apiProfile.id,
    name: apiProfile.name,
    title: apiProfile.title ?? '',
    about: apiProfile.about ?? '',
    resumeId: apiProfile.resumeFileKey,
    resumeFileName: apiProfile.resumeFileName,
    snippetIds: [],
    skills: apiProfile.skills.map((s) => s.name),
    experiences: apiProfile.experiences.map((e) => ({
      id: e.id,
      role: e.role,
      company: e.company,
      responsibilities: e.description ?? '',
      startDate: e.startDate,
      endDate: e.isCurrent ? null : e.endDate
    })),
    education: apiProfile.educations.map((e) => ({
      id: e.id,
      name: educationDisplayName(e.title, e.institution),
      title: e.title,
      institution: e.institution,
      completionDate: e.completionDate
    })),
    completionPercentage: apiProfile.completionPercentage,
    updatedAt: apiProfile.updatedAt,
    synced: true
  }
}

function localId(prefix: string): string {
  return `${LOCAL_ID_PREFIX}${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyProfile(name: string): Profile {
  return {
    id: localId('profile_'),
    name,
    resumeId: null,
    snippetIds: [],
    title: '',
    about: '',
    skills: [],
    experiences: [],
    education: [],
    synced: false
  }
}

export async function fetchAndCacheProfiles(): Promise<Profile[]> {
  const apiProfiles = await api.listProfiles()
  const profiles = apiProfiles.map(apiProfileToLocal)
  await storageService.saveProfiles(profiles)
  return profiles
}

export async function createProfileOnServer(name: string): Promise<Profile> {
  try {
    const created = await api.createProfile({ name })
    const local = apiProfileToLocal(created)
    await storageService.addProfile(local)
    return local
  } catch (err) {
    if (err instanceof ApiError && err.code === 'FORBIDDEN') {
      throw new Error(err.message)
    }
    throw err
  }
}

async function syncSkills(profileId: string, localSkills: string[], serverProfile: ApiProfile): Promise<void> {
  const serverSkills = serverProfile.skills
  const serverByName = new Map(serverSkills.map((s) => [s.name.toLowerCase(), s]))

  for (const serverSkill of serverSkills) {
    if (!localSkills.some((s) => s.toLowerCase() === serverSkill.name.toLowerCase())) {
      await api.deleteSkill(profileId, serverSkill.id)
    }
  }

  for (const skillName of localSkills) {
    if (!serverByName.has(skillName.toLowerCase())) {
      await api.createSkill(profileId, { name: skillName })
    }
  }
}

async function syncExperiences(
  profileId: string,
  localExperiences: Experience[],
  serverProfile: ApiProfile
): Promise<void> {
  const serverMap = new Map(serverProfile.experiences.map((e) => [e.id, e]))
  const localIds = new Set(localExperiences.map((e) => e.id))

  for (const serverExp of serverProfile.experiences) {
    if (!localIds.has(serverExp.id)) {
      await api.deleteExperience(profileId, serverExp.id)
    }
  }

  for (const localExp of localExperiences) {
    const body = {
      company: localExp.company,
      role: localExp.role,
      description: localExp.responsibilities || undefined,
      startDate: localExp.startDate,
      endDate: localExp.endDate,
      isCurrent: localExp.endDate === null
    }

    if (isLocalId(localExp.id) || !serverMap.has(localExp.id)) {
      await api.createExperience(profileId, body)
    } else {
      await api.updateExperience(profileId, localExp.id, body)
    }
  }
}

async function syncEducations(
  profileId: string,
  localEducations: Education[],
  serverProfile: ApiProfile
): Promise<void> {
  const serverMap = new Map(serverProfile.educations.map((e) => [e.id, e]))
  const localIds = new Set(localEducations.map((e) => e.id))

  for (const serverEdu of serverProfile.educations) {
    if (!localIds.has(serverEdu.id)) {
      await api.deleteEducation(profileId, serverEdu.id)
    }
  }

  for (const localEdu of localEducations) {
    const body = {
      title: localEdu.title ?? localEdu.name,
      institution: localEdu.institution ?? '',
      completionDate: localEdu.completionDate ?? null
    }

    if (isLocalId(localEdu.id) || !serverMap.has(localEdu.id)) {
      await api.createEducation(profileId, body)
    } else {
      await api.updateEducation(profileId, localEdu.id, body)
    }
  }
}

export async function saveProfileToServer(profile: Profile): Promise<Profile> {
  let profileId = profile.id

  if (isLocalId(profile.id) || !profile.synced) {
    const created = await api.createProfile({
      name: profile.name,
      title: profile.title || undefined,
      about: profile.about || undefined,
      resumeFileName: profile.resumeFileName ?? undefined,
      resumeFileKey: profile.resumeId ?? undefined
    })
    profileId = created.id
  } else {
    await api.updateProfile(profileId, {
      name: profile.name,
      title: profile.title || undefined,
      about: profile.about || undefined,
      resumeFileName: profile.resumeFileName ?? undefined,
      resumeFileKey: profile.resumeId ?? undefined
    })
  }

  const serverProfile = await api.getProfile(profileId)

  await syncSkills(profileId, profile.skills ?? [], serverProfile)
  await syncExperiences(profileId, profile.experiences ?? [], serverProfile)
  await syncEducations(profileId, profile.education ?? [], serverProfile)

  const updated = await api.getProfile(profileId)
  const local = apiProfileToLocal(updated)
  await storageService.updateProfile(local)
  return local
}

export async function deleteProfileOnServer(id: string): Promise<void> {
  if (!isLocalId(id)) {
    await api.deleteProfile(id)
  }
  await storageService.deleteProfile(id)
}

export async function updateProfileResumeMeta(
  profile: Profile,
  fileName: string,
  fileKey: string
): Promise<Profile> {
  const updated: Profile = {
    ...profile,
    resumeId: fileKey,
    resumeFileName: fileName
  }

  if (profile.synced && !isLocalId(profile.id)) {
    await api.updateProfile(profile.id, {
      resumeFileName: fileName,
      resumeFileKey: fileKey
    })
    updated.updatedAt = new Date().toISOString()
  }

  await storageService.updateProfile(updated)
  return updated
}

export async function removeProfileResumeMeta(profile: Profile): Promise<Profile> {
  const updated: Profile = {
    ...profile,
    resumeId: null,
    resumeFileName: null
  }

  if (profile.synced && !isLocalId(profile.id)) {
    await api.updateProfile(profile.id, {
      resumeFileName: undefined,
      resumeFileKey: undefined
    })
  }

  await storageService.updateProfile(updated)
  return updated
}
