import api from './apiClient'
import storageService from './storageService'
import type { AuthResponse, PlanName, UserMeResponse } from '../shared/types/api'

const TOKEN_KEY = 'auth_token_v1'
const USER_KEY = 'auth_user_v1'

export interface AuthUser {
  id: string
  name: string
  email: string
  plan: PlanName
}

async function persistSession(token: string, user: AuthUser): Promise<void> {
  api.setToken(token)
  await storageService.set(TOKEN_KEY, token)
  await storageService.set(USER_KEY, user)
}

export async function initAuth(): Promise<AuthUser | null> {
  const token = await storageService.get<string>(TOKEN_KEY)
  if (!token) {
    api.setToken(null)
    return null
  }

  api.setToken(token)
  try {
    const me = await api.me()
    const user: AuthUser = {
      id: me.id,
      name: me.name,
      email: me.email,
      plan: me.plan
    }
    await storageService.set(USER_KEY, user)
    return user
  } catch {
    await clearSession()
    return null
  }
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const res = await api.register({ name, email, password })
  return applyAuthResponse(res)
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.login({ email, password })
  return applyAuthResponse(res)
}

async function applyAuthResponse(res: AuthResponse): Promise<AuthUser> {
  const user: AuthUser = {
    id: res.user.id,
    name: res.user.name,
    email: res.user.email,
    plan: res.user.plan
  }
  await persistSession(res.token, user)
  return user
}

export async function refreshUser(): Promise<AuthUser | null> {
  const token = await storageService.get<string>(TOKEN_KEY)
  if (!token) return null

  api.setToken(token)
  const me: UserMeResponse = await api.me()
  const user: AuthUser = {
    id: me.id,
    name: me.name,
    email: me.email,
    plan: me.plan
  }
  await storageService.set(USER_KEY, user)
  return user
}

export async function getStoredUser(): Promise<AuthUser | null> {
  return (await storageService.get<AuthUser>(USER_KEY)) ?? null
}

export async function clearSession(): Promise<void> {
  api.setToken(null)
  await storageService.set(TOKEN_KEY, null)
  await storageService.set(USER_KEY, null)
}

export async function logout(): Promise<void> {
  await clearSession()
}
