import React, { useCallback, useEffect, useState } from 'react'
import api, { ApiError } from '../services/apiClient'
import { CHECKOUT_USE_SANDBOX } from '../config/api'
import type { AuthUser } from '../services/authService'
import { canAccessSavedJobs, savedJobsLimitMessage } from '../shared/planLimits'
import type { ApiSavedJob, SavedJobStatus } from '../shared/types/api'
import './SavedJobsPanel.css'

interface SavedJobsPanelProps {
  user: AuthUser
}

const STATUS_OPTIONS: { value: SavedJobStatus; label: string }[] = [
  { value: 'SAVED', label: 'Salva' },
  { value: 'APPLIED', label: 'Candidatado' },
  { value: 'INTERVIEW', label: 'Entrevista' },
  { value: 'OFFER', label: 'Proposta' },
  { value: 'REJECTED', label: 'Rejeitado' },
  { value: 'ARCHIVED', label: 'Arquivada' }
]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export default function SavedJobsPanel({ user }: SavedJobsPanelProps): JSX.Element {
  const hasAccess = canAccessSavedJobs(user.plan)
  const [jobs, setJobs] = useState<ApiSavedJob[] | null>(null)
  const [loading, setLoading] = useState(hasAccess)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')

  const loadJobs = useCallback(async () => {
    if (!hasAccess) return
    setLoading(true)
    setError(null)
    try {
      const list = await api.listSavedJobs()
      setJobs(list)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao carregar histórico de vagas.')
      }
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [hasAccess])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  async function handleCheckout() {
    setCheckoutLoading(true)
    setError(null)
    try {
      const checkout = await api.checkout('Premium')
      const url = CHECKOUT_USE_SANDBOX ? checkout.sandboxInitPoint : checkout.initPoint
      chrome.tabs.create({ url })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao iniciar checkout.')
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !jobUrl.trim()) return

    setSaving(true)
    setError(null)
    try {
      await api.createSavedJob({
        title: title.trim(),
        description: description.trim() || undefined,
        jobUrl: jobUrl.trim(),
        status: 'SAVED'
      })
      setTitle('')
      setDescription('')
      setJobUrl('')
      setShowForm(false)
      await loadJobs()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao salvar vaga.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: SavedJobStatus) {
    setUpdatingId(id)
    setError(null)
    try {
      await api.updateSavedJob(id, { status })
      setJobs((current) =>
        current?.map((job) => (job.id === id ? { ...job, status } : job)) ?? null
      )
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao atualizar status.')
      }
      await loadJobs()
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover esta vaga do histórico?')) return
    try {
      await api.deleteSavedJob(id)
      await loadJobs()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao remover vaga.')
      }
    }
  }

  if (!hasAccess) {
    return (
      <div className="saved-jobs-panel">
        <div className="saved-jobs-locked">
          <span className="material-symbols-outlined saved-jobs-locked-icon">lock</span>
          <h3>Histórico de vagas</h3>
          <p>{savedJobsLimitMessage()}</p>
          <p className="saved-jobs-locked-hint">
            Salve links, títulos e descrições de vagas e acompanhe o status de cada uma.
          </p>
          <button
            type="button"
            className="saved-jobs-upgrade-btn"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? 'Abrindo…' : 'Assinar Premium'}
          </button>
          {error && <p className="saved-jobs-error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="saved-jobs-panel">
      <p className="saved-jobs-hint">
        Salve vagas de interesse e acompanhe o status da sua jornada.
      </p>

      {error && <p className="saved-jobs-error">{error}</p>}

      {loading ? (
        <p className="saved-jobs-loading">Carregando…</p>
      ) : (
        <>
          {jobs?.length === 0 && !showForm && (
            <p className="saved-jobs-empty">Nenhuma vaga salva ainda.</p>
          )}

          <ul className="saved-jobs-list">
            {jobs?.map((job) => (
              <li key={job.id} className="saved-jobs-item">
                <div className="saved-jobs-item-main">
                  <span className="saved-jobs-item-title">{job.title}</span>
                  {job.description && (
                    <p className="saved-jobs-item-description">{job.description}</p>
                  )}
                  <span className="saved-jobs-item-meta">Salva em {formatDate(job.savedAt)}</span>
                  <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="saved-jobs-item-link"
                  >
                    Abrir vaga
                  </a>
                  <label className="saved-jobs-status-label">
                    Status
                    <select
                      className="saved-jobs-status-select"
                      value={job.status}
                      disabled={updatingId === job.id}
                      onChange={(e) =>
                        handleStatusChange(job.id, e.target.value as SavedJobStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="saved-jobs-delete-btn"
                  title="Remover"
                  onClick={() => handleDelete(job.id)}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {showForm ? (
        <form className="saved-jobs-form" onSubmit={handleCreate}>
          <label className="saved-jobs-label">
            Título da vaga
            <input
              className="saved-jobs-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Desenvolvedor Backend"
              required
            />
          </label>
          <label className="saved-jobs-label">
            URL da vaga
            <input
              className="saved-jobs-input"
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </label>
          <label className="saved-jobs-label">
            Descrição (opcional)
            <textarea
              className="saved-jobs-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo da vaga, requisitos, benefícios..."
            />
          </label>
          <div className="saved-jobs-form-actions">
            <button
              type="button"
              className="saved-jobs-btn saved-jobs-btn--secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="saved-jobs-btn saved-jobs-btn--primary"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar vaga'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="saved-jobs-add-btn"
          onClick={() => setShowForm(true)}
        >
          <span className="material-symbols-outlined">add</span>
          Nova vaga
        </button>
      )}
    </div>
  )
}
