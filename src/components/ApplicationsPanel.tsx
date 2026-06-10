import React, { useCallback, useEffect, useState } from 'react'
import api, { ApiError } from '../services/apiClient'
import type { ApiApplication, ApplicationStatus } from '../shared/types/api'
import './ApplicationsPanel.css'

interface ApplicationsPanelProps {
  onClose: () => void
}

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'APPLIED', label: 'Candidatado' },
  { value: 'INTERVIEW', label: 'Entrevista' },
  { value: 'OFFER', label: 'Proposta' },
  { value: 'REJECTED', label: 'Rejeitado' },
  { value: 'WITHDRAWN', label: 'Desistiu' }
]

function statusLabel(status: ApplicationStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export default function ApplicationsPanel({ onClose }: ApplicationsPanelProps): JSX.Element {
  const [applications, setApplications] = useState<ApiApplication[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [jobUrl, setJobUrl] = useState('')

  const loadApplications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.listApplications()
      setApplications(list)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao carregar candidaturas.')
      }
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim() || !position.trim()) return

    setSaving(true)
    setError(null)
    try {
      await api.createApplication({
        company: company.trim(),
        position: position.trim(),
        jobUrl: jobUrl.trim() || undefined,
        status: 'APPLIED'
      })
      setCompany('')
      setPosition('')
      setJobUrl('')
      setShowForm(false)
      await loadApplications()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao registrar candidatura.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir esta candidatura?')) return
    try {
      await api.deleteApplication(id)
      await loadApplications()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao excluir candidatura.')
      }
    }
  }

  return (
    <div className="applications-panel-overlay" onClick={onClose}>
      <div className="applications-panel" onClick={(e) => e.stopPropagation()}>
        <header className="applications-panel-header">
          <h2>Candidaturas</h2>
          <button type="button" className="applications-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <p className="applications-hint">Registre vagas às quais você se candidatou (plano Premium).</p>

        {error && <p className="applications-error">{error}</p>}

        {loading ? (
          <p className="applications-loading">Carregando…</p>
        ) : (
          <>
            {applications?.length === 0 && !showForm && (
              <p className="applications-empty">Nenhuma candidatura registrada.</p>
            )}

            <ul className="applications-list">
              {applications?.map((app) => (
                <li key={app.id} className="applications-item">
                  <div className="applications-item-main">
                    <span className="applications-item-position">{app.position}</span>
                    <span className="applications-item-company">{app.company}</span>
                    <span className="applications-item-meta">
                      {statusLabel(app.status)} · {formatDate(app.appliedAt)}
                    </span>
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="applications-item-link"
                      >
                        Ver vaga
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="applications-delete-btn"
                    title="Excluir"
                    onClick={() => handleDelete(app.id)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {showForm ? (
          <form className="applications-form" onSubmit={handleCreate}>
            <label className="applications-label">
              Empresa
              <input
                className="applications-input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </label>
            <label className="applications-label">
              Cargo
              <input
                className="applications-input"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                required
              />
            </label>
            <label className="applications-label">
              URL da vaga (opcional)
              <input
                className="applications-input"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="applications-form-actions">
              <button
                type="button"
                className="applications-btn applications-btn--secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="applications-btn applications-btn--primary"
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Registrar'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="applications-add-btn"
            onClick={() => setShowForm(true)}
          >
            <span className="material-symbols-outlined">add</span>
            Nova candidatura
          </button>
        )}
      </div>
    </div>
  )
}
