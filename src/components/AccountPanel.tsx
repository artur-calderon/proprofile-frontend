import React, { useState } from 'react'
import api from '../services/apiClient'
import { CHECKOUT_USE_SANDBOX } from '../config/api'
import type { AuthUser } from '../services/authService'
import { planLabel } from '../shared/planLimits'
import type { PlanName } from '../shared/types/api'
import { ApiError } from '../services/apiClient'
import './AccountPanel.css'

interface AccountPanelProps {
  user: AuthUser
  onClose: () => void
  onLogout: () => Promise<void>
  onPlanUpdated: () => Promise<void>
  onOpenApplications?: () => void
}

export default function AccountPanel({
  user,
  onClose,
  onLogout,
  onPlanUpdated,
  onOpenApplications
}: AccountPanelProps): JSX.Element {
  const [loading, setLoading] = useState<'Pro' | 'Premium' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout(planName: 'Pro' | 'Premium') {
    setLoading(planName)
    setError(null)
    try {
      const checkout = await api.checkout(planName)
      const url = CHECKOUT_USE_SANDBOX ? checkout.sandboxInitPoint : checkout.initPoint
      chrome.tabs.create({ url })
      await onPlanUpdated()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro ao iniciar checkout.')
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleLogout() {
    await onLogout()
    onClose()
  }

  const isFree = user.plan === 'Free'
  const isPro = user.plan === 'Pro'
  const isPremium = user.plan === 'Premium'

  return (
    <div className="account-panel-overlay" onClick={onClose}>
      <div className="account-panel" onClick={(e) => e.stopPropagation()}>
        <header className="account-panel-header">
          <h2>Minha conta</h2>
          <button type="button" className="account-close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="account-info">
          <div className="account-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <p className="account-name">{user.name}</p>
            <p className="account-email">{user.email}</p>
          </div>
        </div>

        <div className={`account-plan-badge account-plan-badge--${user.plan.toLowerCase()}`}>
          <span className="material-symbols-outlined">workspace_premium</span>
          Plano {planLabel(user.plan)}
        </div>

        {isFree && (
          <div className="account-limits">
            <p>Seu plano inclui:</p>
            <ul>
              <li>1 perfil</li>
              <li>1 anexo de currículo</li>
            </ul>
          </div>
        )}

        {(isFree || isPro) && (
          <div className="account-upgrade">
            <p className="account-upgrade-title">Fazer upgrade</p>
            {isFree && (
              <button
                type="button"
                className="account-upgrade-btn"
                disabled={loading !== null}
                onClick={() => handleCheckout('Pro')}
              >
                {loading === 'Pro' ? 'Abrindo…' : 'Assinar Pro — perfis ilimitados'}
              </button>
            )}
            <button
              type="button"
              className="account-upgrade-btn account-upgrade-btn--premium"
              disabled={loading !== null}
              onClick={() => handleCheckout('Premium')}
            >
              {loading === 'Premium' ? 'Abrindo…' : 'Assinar Premium — + candidaturas'}
            </button>
          </div>
        )}

        {error && <p className="account-error">{error}</p>}

        {isPremium && onOpenApplications && (
          <button
            type="button"
            className="account-applications-btn"
            onClick={() => {
              onClose()
              onOpenApplications()
            }}
          >
            <span className="material-symbols-outlined">work_history</span>
            Minhas candidaturas
          </button>
        )}

        <button type="button" className="account-logout-btn" onClick={handleLogout}>
          <span className="material-symbols-outlined">logout</span>
          Sair
        </button>
      </div>
    </div>
  )
}

export function PlanBadge({ plan }: { plan: PlanName }): JSX.Element {
  return (
    <span className={`plan-badge plan-badge--${plan.toLowerCase()}`}>{planLabel(plan)}</span>
  )
}
