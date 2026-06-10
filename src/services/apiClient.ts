import { API_BASE } from '../config/api'
import type {
  ApiApplication,
  ApiEducation,
  ApiExperience,
  ApiProfile,
  ApiSkill,
  AuthResponse,
  CheckoutResponse,
  ApiSavedJob,
  CreateApplicationRequest,
  CreateEducationRequest,
  CreateSavedJobRequest,
  CreateExperienceRequest,
  CreateProfileRequest,
  CreateSkillRequest,
  LoginRequest,
  RegisterRequest,
  SubscriptionResponse,
  UpdateApplicationRequest,
  UpdateEducationRequest,
  UpdateSavedJobRequest,
  UpdateExperienceRequest,
  UpdateProfileRequest,
  UpdateSkillRequest,
  UserMeResponse
} from '../shared/types/api'

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

class ProProfileApi {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  getToken(): string | null {
    return this.token
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })

    if (res.status === 204) return undefined as T

    const data = await res.json()
    if (!res.ok) {
      throw new ApiError(
        data.error?.message ?? 'Erro na API',
        data.error?.code ?? 'UNKNOWN',
        res.status
      )
    }
    return data as T
  }

  register = (body: RegisterRequest) => this.request<AuthResponse>('POST', '/auth/register', body)
  login = (body: LoginRequest) => this.request<AuthResponse>('POST', '/auth/login', body)
  me = () => this.request<UserMeResponse>('GET', '/auth/me')

  listProfiles = () => this.request<ApiProfile[]>('GET', '/profiles')
  getProfile = (id: string) => this.request<ApiProfile>('GET', `/profiles/${id}`)
  createProfile = (body: CreateProfileRequest) => this.request<ApiProfile>('POST', '/profiles', body)
  updateProfile = (id: string, body: UpdateProfileRequest) =>
    this.request<ApiProfile>('PUT', `/profiles/${id}`, body)
  deleteProfile = (id: string) => this.request<void>('DELETE', `/profiles/${id}`)

  listSkills = (profileId: string) =>
    this.request<ApiSkill[]>('GET', `/profiles/${profileId}/skills`)
  getSkill = (profileId: string, id: string) =>
    this.request<ApiSkill>('GET', `/profiles/${profileId}/skills/${id}`)
  createSkill = (profileId: string, body: CreateSkillRequest) =>
    this.request<ApiSkill>('POST', `/profiles/${profileId}/skills`, body)
  updateSkill = (profileId: string, id: string, body: UpdateSkillRequest) =>
    this.request<ApiSkill>('PUT', `/profiles/${profileId}/skills/${id}`, body)
  deleteSkill = (profileId: string, id: string) =>
    this.request<void>('DELETE', `/profiles/${profileId}/skills/${id}`)

  listExperiences = (profileId: string) =>
    this.request<ApiExperience[]>('GET', `/profiles/${profileId}/experiences`)
  createExperience = (profileId: string, body: CreateExperienceRequest) =>
    this.request<ApiExperience>('POST', `/profiles/${profileId}/experiences`, body)
  updateExperience = (profileId: string, id: string, body: UpdateExperienceRequest) =>
    this.request<ApiExperience>('PUT', `/profiles/${profileId}/experiences/${id}`, body)
  deleteExperience = (profileId: string, id: string) =>
    this.request<void>('DELETE', `/profiles/${profileId}/experiences/${id}`)

  listEducations = (profileId: string) =>
    this.request<ApiEducation[]>('GET', `/profiles/${profileId}/educations`)
  createEducation = (profileId: string, body: CreateEducationRequest) =>
    this.request<ApiEducation>('POST', `/profiles/${profileId}/educations`, body)
  updateEducation = (profileId: string, id: string, body: UpdateEducationRequest) =>
    this.request<ApiEducation>('PUT', `/profiles/${profileId}/educations/${id}`, body)
  deleteEducation = (profileId: string, id: string) =>
    this.request<void>('DELETE', `/profiles/${profileId}/educations/${id}`)

  listApplications = () => this.request<ApiApplication[]>('GET', '/applications')
  createApplication = (body: CreateApplicationRequest) =>
    this.request<ApiApplication>('POST', '/applications', body)
  updateApplication = (id: string, body: UpdateApplicationRequest) =>
    this.request<ApiApplication>('PUT', `/applications/${id}`, body)
  deleteApplication = (id: string) => this.request<void>('DELETE', `/applications/${id}`)

  listSavedJobs = () => this.request<ApiSavedJob[]>('GET', '/saved-jobs')
  getSavedJob = (id: string) => this.request<ApiSavedJob>('GET', `/saved-jobs/${id}`)
  createSavedJob = (body: CreateSavedJobRequest) =>
    this.request<ApiSavedJob>('POST', '/saved-jobs', body)
  updateSavedJob = (id: string, body: UpdateSavedJobRequest) =>
    this.request<ApiSavedJob>('PUT', `/saved-jobs/${id}`, body)
  deleteSavedJob = (id: string) => this.request<void>('DELETE', `/saved-jobs/${id}`)

  getSubscription = () => this.request<SubscriptionResponse>('GET', '/subscription')
  checkout = (planName: 'Pro' | 'Premium') =>
    this.request<CheckoutResponse>('POST', '/subscription/checkout', { planName })
}

export const api = new ProProfileApi()
export default api
