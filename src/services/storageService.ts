// Abstraction over chrome.storage.local
// TODO: implement get/set/remove helpers returning Promises

import { Profile, Snippet, ResumePDF } from '../shared/types'

const PROFILES_KEY = 'profiles_v1'
const SNIPPETS_KEY = 'snippets_v1'
const RESUMES_KEY = 'resumes_v1'
const ACTIVE_PROFILE_KEY = 'active_profile_v1'

function chromeGet<T = any>(keys: string | string[] | null): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res as unknown as T))
  })
}

function chromeSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve())
  })
}

function chromeRemove(keys: string | string[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve())
  })
}

export const storageService = {
  async get<T>(key: string): Promise<T | undefined> {
    const res = await chromeGet<Record<string, T>>([key])
    return res[key]
  },
  async set<T>(key: string, value: T): Promise<void> {
    await chromeSet({ [key]: value })
  },

  // Profiles
  async getAllProfiles(): Promise<Profile[]> {
    const res = await this.get<Record<string, Profile[]>>(PROFILES_KEY)
    return (res as unknown as Profile[]) || []
  },
  async saveProfiles(profiles: Profile[]): Promise<void> {
    await this.set(PROFILES_KEY, profiles)
  },

  // Snippets
  async getAllSnippets(): Promise<Snippet[]> {
    const res = await this.get<Record<string, Snippet[]>>(SNIPPETS_KEY)
    return (res as unknown as Snippet[]) || []
  },
  async saveSnippets(snippets: Snippet[]): Promise<void> {
    await this.set(SNIPPETS_KEY, snippets)
  },

  // Resumes metadata
  async getAllResumes(): Promise<ResumePDF[]> {
    const res = await this.get<Record<string, ResumePDF[]>>(RESUMES_KEY)
    return (res as unknown as ResumePDF[]) || []
  },
  async saveResumes(resumes: ResumePDF[]): Promise<void> {
    await this.set(RESUMES_KEY, resumes)
  },

  // Active profile id
  async getActiveProfileId(): Promise<string | null> {
    const res = await this.get<Record<string, string | null>>(ACTIVE_PROFILE_KEY)
    return (res as unknown as string) || null
  },
  async setActiveProfileId(id: string | null): Promise<void> {
    await this.set(ACTIVE_PROFILE_KEY, id)
  },

  // Convenience CRUD helpers
  async addProfile(profile: Profile) {
    const profiles = await this.getAllProfiles()
    profiles.push(profile)
    await this.saveProfiles(profiles)
  },
  async updateProfile(profile: Profile) {
    const profiles = await this.getAllProfiles()
    const idx = profiles.findIndex((p) => p.id === profile.id)
    if (idx >= 0) profiles[idx] = profile
    else profiles.push(profile)
    await this.saveProfiles(profiles)
  },
  async deleteProfile(id: string) {
    const profiles = (await this.getAllProfiles()).filter((p) => p.id !== id)
    await this.saveProfiles(profiles)
  }
}

export default storageService
