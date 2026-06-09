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
}

export interface Profile {
  id: string
  name: string
  resumeId?: string | null
  snippetIds: string[]
  title?: string
  about?: string
  skills?: string[]
  experiences?: Experience[]
  education?: Education[]
}

export type ProfileSection = 'title' | 'about' | 'skills' | 'experience' | 'education'
