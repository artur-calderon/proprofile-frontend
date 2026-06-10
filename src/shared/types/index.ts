// Domain types and interfaces

export interface Snippet {
  id: string
  title: string
  category: string
  content: string
  tags?: string[]
}

export interface ResumePDF {
  id: string
  name: string
  size?: number
  mimeType?: string
  createdAt?: string
}

export interface Experience {
  id: string
  role: string
  company: string
  responsibilities: string
  startDate: string
  endDate: string | null
}

export interface Education {
  id: string
  name: string
  title?: string
  institution?: string
  completionDate?: string | null
}

export interface Profile {
  id: string
  name: string
  resumeId?: string | null
  resumeFileName?: string | null
  snippetIds: string[]
  title?: string
  about?: string
  skills?: string[]
  experiences?: Experience[]
  education?: Education[]
  completionPercentage?: number
  updatedAt?: string
  synced?: boolean
}

export type { PlanName, ApplicationStatus, SavedJobStatus } from './api'

export type ProfileSection = 'title' | 'about' | 'skills' | 'experience' | 'education'
