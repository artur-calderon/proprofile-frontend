export type PlanName = 'Free' | 'Pro' | 'Premium'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING'
export type ApplicationStatus = 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'

export interface ApiError {
  error: {
    message: string
    code: string
  }
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    name: string
    email: string
    plan: PlanName
  }
}

export interface UserMeResponse {
  id: string
  name: string
  email: string
  plan: PlanName
  createdAt: string
}

export interface ApiSkill {
  id: string
  profileId: string
  name: string
}

export interface ApiExperience {
  id: string
  profileId: string
  company: string
  role: string
  description: string | null
  startDate: string
  endDate: string | null
  isCurrent: boolean
}

export interface ApiEducation {
  id: string
  profileId: string
  title: string
  institution: string
  completionDate: string | null
}

export interface ApiProfile {
  id: string
  userId: string
  name: string
  title: string | null
  about: string | null
  resumeFileName: string | null
  resumeFileKey: string | null
  completionPercentage: number
  createdAt: string
  updatedAt: string
  skills: ApiSkill[]
  experiences: ApiExperience[]
  educations: ApiEducation[]
}

export interface CreateProfileRequest {
  name: string
  title?: string
  about?: string
  resumeFileName?: string
  resumeFileKey?: string
}

export type UpdateProfileRequest = Partial<CreateProfileRequest>

export interface CreateSkillRequest {
  name: string
}

export type UpdateSkillRequest = Partial<CreateSkillRequest>

export interface CreateExperienceRequest {
  company: string
  role: string
  description?: string
  startDate: string
  endDate?: string | null
  isCurrent?: boolean
}

export type UpdateExperienceRequest = Partial<CreateExperienceRequest>

export interface CreateEducationRequest {
  title: string
  institution: string
  completionDate?: string | null
}

export type UpdateEducationRequest = Partial<CreateEducationRequest>

export interface ApiApplication {
  id: string
  userId: string
  company: string
  position: string
  jobUrl: string | null
  status: ApplicationStatus
  appliedAt: string
}

export interface CreateApplicationRequest {
  company: string
  position: string
  jobUrl?: string
  status?: ApplicationStatus
  appliedAt?: string
}

export type UpdateApplicationRequest = Partial<CreateApplicationRequest>

export type SavedJobStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'ARCHIVED'

export interface ApiSavedJob {
  id: string
  userId: string
  title: string
  description: string | null
  jobUrl: string
  status: SavedJobStatus
  savedAt: string
  updatedAt: string
}

export interface CreateSavedJobRequest {
  title: string
  description?: string
  jobUrl: string
  status?: SavedJobStatus
}

export type UpdateSavedJobRequest = Partial<CreateSavedJobRequest>

export interface Plan {
  id: string
  name: PlanName
  monthlyPrice: string
  description: string | null
}

export interface SubscriptionResponse {
  id?: string
  plan: Plan | null
  status: SubscriptionStatus
  startsAt: string | null
  expiresAt: string | null
  mercadoPagoSubscriptionId?: string | null
}

export interface CheckoutResponse {
  subscriptionId: string
  preferenceId: string
  initPoint: string
  sandboxInitPoint: string
}
