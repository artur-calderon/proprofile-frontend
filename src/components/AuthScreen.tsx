import React, { useState } from 'react'
import { ApiError } from '../services/apiClient'
import './AuthScreen.css'

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>
}

export default function AuthScreen({ onLogin }: AuthScreenProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await onLogin(email.trim(), password)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erro ao autenticar. Verifique se o backend está rodando.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <header className="auth-header">
        <span className="auth-brand">ProProfile</span>
        <p className="auth-subtitle">Entre para sincronizar seus perfis</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="auth-email">E-mail</label>
          <input
            id="auth-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Senha</label>
          <input
            id="auth-password"
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="auth-error">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Aguarde…' : 'Entrar'}
        </button>
      </form>

      <p className="auth-signup-hint">Não tem conta? Cadastre-se em nosso site.</p>

      <p className="auth-plan-hint">
        Plano Gratuito: 1 perfil e 1 anexo de currículo.
      </p>
    </div>
  )
}
