import React, { useCallback, useEffect, useState } from 'react'
import { Experience, Profile } from '../shared/types'
import {
  formatExperienceCompany,
  formatExperienceFull,
  formatExperiencePeriod,
  formatExperienceResponsibilities,
  formatExperienceRole,
  formatSkillsList,
  getProfileCompletion
} from '../shared/profileFormatters'
import { canCreateProfile, profileLimitMessage } from '../shared/planLimits'
import storageService from '../services/storageService'
import { fetchAndCacheProfiles } from '../services/profileSyncService'
import downloadProfileResume from '../services/resumeFileService'
import insertTextIntoPage from '../services/insertService'
import { useAuth } from '../hooks/useAuth'
import AuthScreen from '../components/AuthScreen'
import AccountPanel, { PlanBadge } from '../components/AccountPanel'
import ApplicationsPanel from '../components/ApplicationsPanel'
import OptionsApp from '../options/App'
import './popup.css'

function Loading() {
  return <p className="loading-text">Carregando…</p>
}

type ExpandedSection = 'skills' | 'experience' | 'education' | null

export default function App(): JSX.Element {
  const { user, loading: authLoading, login, logout, refreshUser } = useAuth()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [dashboardMode, setDashboardMode] = useState<'edit' | 'create'>('edit')
  const [expanded, setExpanded] = useState<ExpandedSection>(null)
  const [expandedExperienceId, setExpandedExperienceId] = useState<string | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [showApplications, setShowApplications] = useState(false)

  const activeProfile = profiles?.find((p) => p.id === activeProfileId) ?? null
  const allowCreateProfile = user ? canCreateProfile(user.plan, profiles?.length ?? 0) : false

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true)
    try {
      const [p, a] = await Promise.all([
        fetchAndCacheProfiles(),
        storageService.getActiveProfileId()
      ])
      setProfiles(p)
      if (a && p.some((x) => x.id === a)) setActiveProfileId(a)
      else setActiveProfileId(p[0]?.id ?? null)
    } catch {
      const [p, a] = await Promise.all([
        storageService.getAllProfiles(),
        storageService.getActiveProfileId()
      ])
      setProfiles(p)
      if (a && p.some((x) => x.id === a)) setActiveProfileId(a)
      else setActiveProfileId(p[0]?.id ?? null)
      setMessage('Erro ao sincronizar. Usando dados locais.')
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setProfilesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadProfiles()
  }, [user, loadProfiles])

  async function handleSelectProfile(id: string) {
    const nextId = id || null
    setActiveProfileId(nextId)
    setExpanded(null)
    setExpandedExperienceId(null)
    await storageService.setActiveProfileId(nextId)
  }

  async function handleInsert(text: string) {
    const result = await insertTextIntoPage(text)
    setMessage(result.message)
    setTimeout(() => setMessage(null), 2000)
  }

  async function handleDownloadResume() {
    if (!activeProfile) {
      setMessage('Selecione um perfil')
      setTimeout(() => setMessage(null), 2000)
      return
    }
    const result = await downloadProfileResume(activeProfile)
    setMessage(result.message)
    setTimeout(() => setMessage(null), 2000)
  }

  function openDashboard(mode: 'edit' | 'create' = 'edit') {
    if (mode === 'create' && !allowCreateProfile) {
      setMessage(profileLimitMessage(user!.plan))
      setTimeout(() => setMessage(null), 3000)
      return
    }
    setDashboardMode(mode)
    setShowDashboard(true)
  }

  async function closeDashboard() {
    setShowDashboard(false)
    setDashboardMode('edit')
    await loadProfiles()
  }

  function toggleSection(section: ExpandedSection) {
    setExpanded((current) => (current === section ? null : section))
  }

  function toggleExperience(id: string) {
    setExpandedExperienceId((current) => (current === id ? null : id))
  }

  if (authLoading) {
    return (
      <div className="popup-shell">
        <Loading />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="popup-shell">
        <AuthScreen onLogin={login} />
      </div>
    )
  }

  const skills = activeProfile?.skills ?? []
  const experiences = activeProfile?.experiences ?? []
  const education = activeProfile?.education ?? []
  const completion = activeProfile ? getProfileCompletion(activeProfile) : 0

  return (
    <div className="popup-shell">
      {showDashboard ? (
        <OptionsApp
          embedded
          user={user}
          onBack={closeDashboard}
          startInCreateMode={dashboardMode === 'create'}
          onProfilesChange={loadProfiles}
        />
      ) : (
        <>
          <header className="popup-header">
            <div className="popup-header-brand">
              <span className="popup-brand">ProProfile</span>
              <PlanBadge plan={user.plan} />
            </div>
            <div className="header-actions">
              <button type="button" className="icon-btn" title="Conta" onClick={() => setShowAccount(true)}>
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </div>
          </header>

          <main className="popup-main custom-scrollbar">
            <div className="profile-selector-row">
              {profiles === null || profilesLoading ? (
                <Loading />
              ) : (
                <div className="select-wrap">
                  <select
                    className="profile-select"
                    value={activeProfileId ?? ''}
                    onChange={(e) => handleSelectProfile(e.target.value)}
                  >
                    <option value="">— Selecione um perfil —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-chevron">expand_more</span>
                </div>
              )}
              <div className="profile-actions">
                {activeProfile && (
                  <button type="button" className="btn-profile-action btn-profile-action--edit" onClick={() => openDashboard('edit')}>
                    <span className="material-symbols-outlined">edit</span>
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-profile-action btn-profile-action--create${activeProfile ? ' btn-profile-action--secondary' : ''}`}
                  onClick={() => openDashboard('create')}
                  disabled={!allowCreateProfile}
                  title={!allowCreateProfile ? profileLimitMessage(user.plan) : undefined}
                >
                  <span className="material-symbols-outlined">add</span>
                  Criar
                </button>
              </div>
            </div>

            {!profiles?.length && profiles !== null && !profilesLoading && (
              <p className="empty-text">
                Nenhum perfil criado. Clique em <strong>Criar</strong> para abrir o dashboard.
              </p>
            )}

            {activeProfile && (
              <>
                <div className="profile-card card-elevation">
                  <div className="profile-card-header">
                    <div className="profile-avatar-placeholder">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                      <h2 className="profile-title">{activeProfile.title?.trim() || 'Sem título'}</h2>
                      <p className="profile-subtitle">{activeProfile.name}</p>
                    </div>
                  </div>

                  {activeProfile.about?.trim() && (
                    <div className="about-section">
                      <h3 className="section-label">About me</h3>
                      <p className="about-text">{activeProfile.about}</p>
                    </div>
                  )}

                  {skills.length > 0 && (
                    <div className="skill-tags">
                      {skills.map((tag) => (
                        <span key={tag} className="skill-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="quick-edit-section">
                  <h3 className="quick-edit-title">Inserir no formulário</h3>

                  <button
                    type="button"
                    className="quick-row card-elevation"
                    disabled={!activeProfile.title?.trim()}
                    onClick={() => handleInsert(activeProfile.title || '')}
                  >
                    <div className="quick-row-left">
                      <div className="quick-row-icon quick-row-icon--title">
                        <span className="material-symbols-outlined">badge</span>
                      </div>
                      <div className="quick-row-text">
                        <span className="quick-row-label">Título (Posição)</span>
                        <span className="quick-row-preview">
                          {activeProfile.title?.trim() || 'Preencha no dashboard'}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined insert-icon">content_paste</span>
                  </button>

                  <button
                    type="button"
                    className="quick-row card-elevation"
                    disabled={!activeProfile.about?.trim()}
                    onClick={() => handleInsert(activeProfile.about || '')}
                  >
                    <div className="quick-row-left">
                      <div className="quick-row-icon quick-row-icon--about">
                        <span className="material-symbols-outlined">description</span>
                      </div>
                      <div className="quick-row-text">
                        <span className="quick-row-label">Sobre mim</span>
                        <span className="quick-row-preview">
                          {activeProfile.about?.trim()
                            ? `${activeProfile.about.slice(0, 60)}${activeProfile.about.length > 60 ? '…' : ''}`
                            : 'Preencha no dashboard'}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined insert-icon">content_paste</span>
                  </button>

                  <div className="insert-section">
                    <button
                      type="button"
                      className="quick-row card-elevation"
                      onClick={() => toggleSection('skills')}
                    >
                      <div className="quick-row-left">
                        <div className="quick-row-icon quick-row-icon--skills">
                          <span className="material-symbols-outlined">psychology</span>
                        </div>
                        <div className="quick-row-text">
                          <span className="quick-row-label">Skills</span>
                          <span className="quick-row-preview">
                            {skills.length ? `${skills.length} habilidade(s)` : 'Nenhuma skill cadastrada'}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined quick-row-chevron">
                        {expanded === 'skills' ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {expanded === 'skills' && (
                      <div className="insert-panel">
                        {skills.length === 0 ? (
                          <p className="insert-panel-empty">Adicione skills no dashboard.</p>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="insert-action-btn insert-action-btn--primary"
                              onClick={() => handleInsert(formatSkillsList(skills))}
                            >
                              <span className="material-symbols-outlined">playlist_add</span>
                              Inserir todas ({formatSkillsList(skills)})
                            </button>
                            <div className="insert-chip-list">
                              {skills.map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  className="insert-chip-btn"
                                  onClick={() => handleInsert(skill)}
                                >
                                  {skill}
                                  <span className="material-symbols-outlined">content_paste</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="insert-section">
                    <button
                      type="button"
                      className="quick-row card-elevation"
                      onClick={() => toggleSection('experience')}
                    >
                      <div className="quick-row-left">
                        <div className="quick-row-icon quick-row-icon--experience">
                          <span className="material-symbols-outlined">work</span>
                        </div>
                        <div className="quick-row-text">
                          <span className="quick-row-label">Experiência</span>
                          <span className="quick-row-preview">
                            {experiences.length
                              ? `${experiences.length} experiência(s)`
                              : 'Nenhuma experiência cadastrada'}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined quick-row-chevron">
                        {expanded === 'experience' ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {expanded === 'experience' && (
                      <div className="insert-panel">
                        {experiences.length === 0 ? (
                          <p className="insert-panel-empty">Adicione experiências no dashboard.</p>
                        ) : (
                          experiences.map((exp) => (
                            <ExperienceInsertPanel
                              key={exp.id}
                              exp={exp}
                              expanded={expandedExperienceId === exp.id}
                              onToggle={() => toggleExperience(exp.id)}
                              onInsert={handleInsert}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="insert-section">
                    <button
                      type="button"
                      className="quick-row card-elevation"
                      onClick={() => toggleSection('education')}
                    >
                      <div className="quick-row-left">
                        <div className="quick-row-icon quick-row-icon--education">
                          <span className="material-symbols-outlined">school</span>
                        </div>
                        <div className="quick-row-text">
                          <span className="quick-row-label">Formação</span>
                          <span className="quick-row-preview">
                            {education.length
                              ? `${education.length} curso(s)`
                              : 'Nenhum curso cadastrado'}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined quick-row-chevron">
                        {expanded === 'education' ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {expanded === 'education' && (
                      <div className="insert-panel">
                        {education.length === 0 ? (
                          <p className="insert-panel-empty">Adicione cursos no dashboard.</p>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="insert-action-btn insert-action-btn--primary"
                              onClick={() => handleInsert(formatSkillsList(education.map((e) => e.name), ', '))}
                            >
                              <span className="material-symbols-outlined">playlist_add</span>
                              Inserir todos
                            </button>
                            <div className="insert-chip-list">
                              {education.map((edu) => (
                                <button
                                  key={edu.id}
                                  type="button"
                                  className="insert-chip-btn"
                                  onClick={() => handleInsert(edu.name)}
                                >
                                  {edu.name}
                                  <span className="material-symbols-outlined">content_paste</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="tip-box">
                  <span className="material-symbols-outlined">info</span>
                  <p>
                    Seu perfil está {completion}% completo.
                    {completion < 100 ? ' Complete as seções no dashboard.' : ' Pronto para usar!'}
                  </p>
                </div>
              </>
            )}
          </main>

          <footer className="popup-footer">
            <button
              type="button"
              className="btn-footer-secondary"
              onClick={handleDownloadResume}
              disabled={!activeProfile?.resumeId}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              Baixar PDF
            </button>
            <button type="button" className="btn-footer-primary" onClick={() => openDashboard(activeProfile ? 'edit' : 'create')}>
              <span className="material-symbols-outlined">dashboard</span>
              Abrir Dashboard
            </button>
          </footer>
        </>
      )}

      {showAccount && (
        <AccountPanel
          user={user}
          onClose={() => setShowAccount(false)}
          onLogout={logout}
          onPlanUpdated={refreshUser}
          onOpenApplications={() => setShowApplications(true)}
        />
      )}

      {showApplications && user.plan === 'Premium' && (
        <ApplicationsPanel onClose={() => setShowApplications(false)} />
      )}

      {message && <div className="toast-message">{message}</div>}
    </div>
  )
}

function ExperienceInsertPanel({
  exp,
  expanded,
  onToggle,
  onInsert
}: {
  exp: Experience
  expanded: boolean
  onToggle: () => void
  onInsert: (text: string) => void
}) {
  const fields = [
    { label: 'Cargo', value: formatExperienceRole(exp), key: 'role' },
    { label: 'Empresa', value: formatExperienceCompany(exp), key: 'company' },
    { label: 'Funções', value: formatExperienceResponsibilities(exp), key: 'resp' },
    { label: 'Período', value: formatExperiencePeriod(exp), key: 'period' }
  ]

  return (
    <div className="experience-insert-item">
      <button type="button" className="experience-insert-head" onClick={onToggle}>
        <div>
          <span className="experience-insert-title">{exp.role || 'Sem cargo'}</span>
          <span className="experience-insert-sub">{exp.company}</span>
        </div>
        <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {expanded && (
        <div className="experience-insert-body">
          <button
            type="button"
            className="insert-action-btn insert-action-btn--primary"
            onClick={() => onInsert(formatExperienceFull(exp))}
          >
            <span className="material-symbols-outlined">content_paste</span>
            Inserir experiência completa
          </button>
          {fields.map((field) => (
            <button
              key={field.key}
              type="button"
              className="insert-field-btn"
              disabled={!field.value.trim()}
              onClick={() => onInsert(field.value)}
            >
              <span className="insert-field-label">{field.label}</span>
              <span className="insert-field-value">{field.value || '—'}</span>
              <span className="material-symbols-outlined">content_paste</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
