import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/apiClient'
import type { AuthUser } from '../services/authService'
import {
  createProfileOnServer,
  fetchAndCacheProfiles,
  saveProfileToServer
} from '../services/profileSyncService'
import storageService from '../services/storageService'
import {
  attachResumeToProfile,
  downloadProfileResume,
  getResumeMeta,
  removeResumeFromProfile
} from '../services/resumeFileService'
import {
  buildCompletionDate,
  daysInMonth,
  educationDisplayName,
  formatEducationSubtitle,
  formatExperiencePeriod,
  parseCompletionDateParts
} from '../shared/profileFormatters'
import SavedJobsPanel from '../components/SavedJobsPanel'
import {
  canAttachResume,
  canCreateProfile,
  profileLimitMessage,
  resumeLimitMessage
} from '../shared/planLimits'
import { Education, Experience, Profile } from '../shared/types'
import './options.css'

type DashboardTab = 'profile' | 'savedJobs'

function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

interface DashboardForm {
  title: string
  about: string
  skills: string[]
  experiences: Experience[]
  education: Education[]
}

function profileToForm(profile: Profile | null): DashboardForm {
  return {
    title: profile?.title ?? '',
    about: profile?.about ?? '',
    skills: profile?.skills ? [...profile.skills] : [],
    experiences: profile?.experiences ? [...profile.experiences] : [],
    education: profile?.education ? [...profile.education] : []
  }
}

const EMPTY_EXPERIENCE = (): Experience => ({
  id: uid('exp_'),
  role: '',
  company: '',
  responsibilities: '',
  startDate: '',
  endDate: null
})

const EMPTY_EDUCATION = (): Education => ({
  id: uid('edu_'),
  name: '',
  title: '',
  institution: '',
  completionDate: null
})

const EDUCATION_MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
]

const EDUCATION_YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 6 - 1950 },
  (_, index) => String(new Date().getFullYear() + 5 - index)
)

interface AppProps {
  embedded?: boolean
  user?: AuthUser | null
  onBack?: () => void
  startInCreateMode?: boolean
  onProfilesChange?: () => void
}

export default function App({
  embedded = false,
  user = null,
  onBack,
  startInCreateMode = false,
  onProfilesChange
}: AppProps): JSX.Element {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [form, setForm] = useState<DashboardForm>(profileToForm(null))
  const [newSkill, setNewSkill] = useState('')
  const [bulkSkills, setBulkSkills] = useState('')
  const [showEducationForm, setShowEducationForm] = useState(false)
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null)
  const [educationDraft, setEducationDraft] = useState<Education>(EMPTY_EDUCATION())
  const [educationNotCompleted, setEducationNotCompleted] = useState(true)
  const [educationDateYear, setEducationDateYear] = useState('')
  const [educationDateMonth, setEducationDateMonth] = useState('')
  const [educationDateDay, setEducationDateDay] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('profile')
  const [statusPulse, setStatusPulse] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSucceeded, setSaveSucceeded] = useState(false)
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [resumeUploading, setResumeUploading] = useState(false)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const [showExperienceForm, setShowExperienceForm] = useState(false)
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null)
  const [experienceDraft, setExperienceDraft] = useState<Experience>(EMPTY_EXPERIENCE())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const createModeHandled = useRef(false)

  const activeProfile = profiles?.find((p) => p.id === activeProfileId) ?? null
  const allowCreateProfile = user ? canCreateProfile(user.plan, profiles?.length ?? 0) : false

  const loadProfiles = useCallback(async () => {
    let p: Profile[]
    if (user) {
      try {
        p = await fetchAndCacheProfiles()
      } catch {
        p = await storageService.getAllProfiles()
        showToastRef.current?.('Erro ao sincronizar. Usando dados locais.', 'error', 4000)
      }
    } else {
      p = await storageService.getAllProfiles()
    }

    const activeId = await storageService.getActiveProfileId()
    setProfiles(p)
    const resolvedId = activeId && p.some((x) => x.id === activeId) ? activeId : p[0]?.id ?? null
    setActiveProfileId(resolvedId)
    const profile = p.find((x) => x.id === resolvedId) ?? null
    setForm(profileToForm(profile))
    return p
  }, [user])

  const showToastRef = useRef<
    ((message: string, type?: 'success' | 'error' | 'info', duration?: number) => void) | null
  >(null)

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (!activeProfileId || !profiles) return
    const profile = profiles.find((p) => p.id === activeProfileId)
    if (profile) {
      setForm(profileToForm(profile))
      setShowExperienceForm(false)
      setEditingExperienceId(null)
    }
  }, [activeProfileId, profiles])

  useEffect(() => {
    async function loadResumeMeta() {
      if (!activeProfile?.resumeId) {
        setResumeFileName(null)
        return
      }
      const meta = await getResumeMeta(activeProfile.resumeId)
      setResumeFileName(meta?.name ?? null)
    }
    loadResumeMeta()
  }, [activeProfile?.resumeId])

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusPulse(true)
      setTimeout(() => setStatusPulse(false), 500)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function selectProfile(id: string) {
    setActiveProfileId(id)
    await storageService.setActiveProfileId(id)
    setDropdownOpen(false)
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3500) {
    setToast({ message, type })
    setSaveMessage(message)
    setTimeout(() => {
      setToast(null)
      setSaveMessage(null)
    }, duration)
  }

  showToastRef.current = showToast

  async function createProfile() {
    if (user && !canCreateProfile(user.plan, profiles?.length ?? 0)) {
      showToast(profileLimitMessage(user.plan), 'error')
      return
    }

    const name = window.prompt('Nome do novo perfil:')
    if (!name?.trim()) return

    try {
      if (user) {
        const profile = await createProfileOnServer(name.trim())
        const all = await storageService.getAllProfiles()
        setProfiles(all)
        await selectProfile(profile.id)
        onProfilesChange?.()
        showToast('Perfil criado e sincronizado!', 'success')
      } else {
        showToast('Faça login para criar perfis.', 'error')
      }
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : 'Erro ao criar perfil.'
      showToast(message, 'error', 4000)
    }
  }

  useEffect(() => {
    if (!startInCreateMode || profiles === null || createModeHandled.current) return
    createModeHandled.current = true
    void createProfile()
  }, [startInCreateMode, profiles])

  async function saveProfile() {
    if (!activeProfile || isSaving) return
    if (!user) {
      showToast('Faça login para salvar perfis.', 'error')
      return
    }

    setIsSaving(true)
    try {
      const updated: Profile = {
        ...activeProfile,
        title: form.title.trim(),
        about: form.about.trim(),
        skills: form.skills,
        experiences: form.experiences,
        education: form.education
      }

      const saved = await saveProfileToServer(updated)
      const all = await storageService.getAllProfiles()
      setProfiles(all)

      if (saved.id !== activeProfileId) {
        setActiveProfileId(saved.id)
        await storageService.setActiveProfileId(saved.id)
      }

      setForm(profileToForm(saved))
      onProfilesChange?.()
      setSaveSucceeded(true)
      setTimeout(() => setSaveSucceeded(false), 2500)
      showToast('Perfil salvo e sincronizado!', 'success')
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao salvar o perfil. Tente novamente.'
      showToast(message, 'error', 4000)
    } finally {
      setIsSaving(false)
    }
  }

  function addSkill() {
    const skill = newSkill.trim()
    if (!skill || form.skills.includes(skill)) return
    setForm((f) => ({ ...f, skills: [...f.skills, skill] }))
    setNewSkill('')
  }

  function addBulkSkills() {
    const items = bulkSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!items.length) return
    setForm((f) => ({
      ...f,
      skills: [...f.skills, ...items.filter((s) => !f.skills.includes(s))]
    }))
    setBulkSkills('')
  }

  function removeSkill(skill: string) {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }))
  }

  function resetEducationDateFields(completionDate: string | null | undefined) {
    const parts = parseCompletionDateParts(completionDate)
    setEducationNotCompleted(!completionDate)
    setEducationDateYear(parts.year)
    setEducationDateMonth(parts.month)
    setEducationDateDay(parts.day)
  }

  function openNewEducationForm() {
    setEditingEducationId(null)
    setEducationDraft(EMPTY_EDUCATION())
    resetEducationDateFields(null)
    setShowEducationForm(true)
  }

  function openEditEducation(edu: Education) {
    setEditingEducationId(edu.id)
    setEducationDraft({ ...edu })
    resetEducationDateFields(edu.completionDate)
    setShowEducationForm(true)
  }

  function saveEducationDraft() {
    const title = (educationDraft.title ?? educationDraft.name).trim()
    const institution = (educationDraft.institution ?? '').trim()
    if (!title || !institution) {
      alert('Preencha pelo menos curso e instituição.')
      return
    }

    let completionDate: string | null = null
    if (!educationNotCompleted) {
      if (!educationDateYear || !educationDateMonth || !educationDateDay) {
        alert('Selecione ano, mês e dia de conclusão, ou marque "Ainda não concluí".')
        return
      }
      completionDate = buildCompletionDate(educationDateYear, educationDateMonth, educationDateDay)
      if (!completionDate) {
        alert('Data de conclusão inválida.')
        return
      }
    }

    const saved: Education = {
      ...educationDraft,
      title,
      institution,
      name: educationDisplayName(title, institution),
      completionDate
    }
    if (editingEducationId) {
      setForm((f) => ({
        ...f,
        education: f.education.map((e) => (e.id === editingEducationId ? saved : e))
      }))
    } else {
      setForm((f) => ({ ...f, education: [...f.education, saved] }))
    }
    setShowEducationForm(false)
    setEditingEducationId(null)
    setEducationDraft(EMPTY_EDUCATION())
    resetEducationDateFields(null)
  }

  function cancelEducationForm() {
    setShowEducationForm(false)
    setEditingEducationId(null)
    setEducationDraft(EMPTY_EDUCATION())
    resetEducationDateFields(null)
  }

  function removeEducation(id: string) {
    setForm((f) => ({ ...f, education: f.education.filter((e) => e.id !== id) }))
  }

  function openNewExperienceForm() {
    setEditingExperienceId(null)
    setExperienceDraft(EMPTY_EXPERIENCE())
    setShowExperienceForm(true)
  }

  function openEditExperience(exp: Experience) {
    setEditingExperienceId(exp.id)
    setExperienceDraft({ ...exp })
    setShowExperienceForm(true)
  }

  function saveExperienceDraft() {
    if (!experienceDraft.role.trim() || !experienceDraft.company.trim()) {
      alert('Preencha pelo menos cargo e empresa.')
      return
    }
    if (editingExperienceId) {
      setForm((f) => ({
        ...f,
        experiences: f.experiences.map((e) => (e.id === editingExperienceId ? experienceDraft : e))
      }))
    } else {
      setForm((f) => ({ ...f, experiences: [...f.experiences, experienceDraft] }))
    }
    setShowExperienceForm(false)
    setEditingExperienceId(null)
    setExperienceDraft(EMPTY_EXPERIENCE())
  }

  function cancelExperienceForm() {
    setShowExperienceForm(false)
    setEditingExperienceId(null)
    setExperienceDraft(EMPTY_EXPERIENCE())
  }

  function removeExperience(id: string) {
    setForm((f) => ({ ...f, experiences: f.experiences.filter((e) => e.id !== id) }))
  }

  async function handleDownloadResume() {
    if (!activeProfile) return
    const result = await downloadProfileResume(activeProfile)
    showToast(result.message, result.success ? 'success' : 'error')
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeProfile || !profiles) return

    if (user && !activeProfile.resumeId) {
      const attachmentCount = profiles.filter((p) => p.resumeId).length
      if (!canAttachResume(user.plan, attachmentCount)) {
        showToast(resumeLimitMessage(user.plan), 'error', 4000)
        e.target.value = ''
        return
      }
    }

    setResumeUploading(true)
    try {
      const updated = await attachResumeToProfile(activeProfile, file, user?.plan, profiles)
      setProfiles((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? null)
      setResumeFileName(file.name)
      showToast('Currículo anexado com sucesso!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error', 4000)
    } finally {
      setResumeUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveResume() {
    if (!activeProfile?.resumeId) return
    if (!window.confirm('Remover o currículo deste perfil?')) return
    const updated = await removeResumeFromProfile(activeProfile)
    setProfiles((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? null)
    setResumeFileName(null)
    showToast('Currículo removido', 'info')
  }

  const shellClass = embedded ? 'dashboard-shell dashboard-shell--embedded' : 'dashboard-shell'

  return (
    <div className={shellClass}>
      <header className="dashboard-header">
        <div className="dashboard-header-top">
          <div className="dashboard-header-left">
            {onBack && (
              <button type="button" className="dashboard-back-btn" onClick={onBack} title="Voltar">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            )}
            <span className="dashboard-brand">ProProfile</span>
          </div>
          <div className="dashboard-header-actions">
            <button type="button" className="dashboard-icon-btn" title="Notificações">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button type="button" className="dashboard-icon-btn" title="Conta">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </div>

        <nav className="dashboard-tabs" aria-label="Seções do dashboard">
          <button
            type="button"
            className={`dashboard-tab${activeTab === 'profile' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Perfil
          </button>
          <button
            type="button"
            className={`dashboard-tab${activeTab === 'savedJobs' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setActiveTab('savedJobs')}
          >
            Histórico de vagas
          </button>
        </nav>

        {activeTab === 'profile' && (
          <div className="profile-selector-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="profile-dropdown-btn"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <div className="profile-dropdown-btn-inner">
                <span className="profile-active-dot" />
                <span className="profile-dropdown-label">
                  {activeProfile ? `${activeProfile.name} (Ativo)` : 'Nenhum perfil — crie um'}
                </span>
              </div>
              <span className="material-symbols-outlined" style={{ color: 'var(--outline)' }}>
                expand_more
              </span>
            </button>

            {dropdownOpen && profiles && (
              <div className="profile-dropdown-menu">
                {profiles.length === 0 && (
                  <div className="profile-dropdown-empty">Nenhum perfil ainda</div>
                )}
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="profile-dropdown-item"
                    onClick={() => selectProfile(p.id)}
                  >
                    {p.name}
                    {p.id === activeProfileId ? ' (Ativo)' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  className="profile-dropdown-item profile-dropdown-item--create"
                  onClick={createProfile}
                  disabled={user ? !allowCreateProfile : true}
                  title={user && !allowCreateProfile ? profileLimitMessage(user.plan) : undefined}
                >
                  <span className="material-symbols-outlined">add</span>
                  Criar novo perfil
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="dashboard-main custom-scrollbar">
        {activeTab === 'savedJobs' && user ? (
          <SavedJobsPanel user={user} />
        ) : activeTab === 'savedJobs' ? (
          <div className="dashboard-empty">
            <span className="material-symbols-outlined">login</span>
            <p>Faça login para acessar o histórico de vagas.</p>
          </div>
        ) : !activeProfile ? (
          <div className="dashboard-empty">
            <span className="material-symbols-outlined">person_add</span>
            <p>Crie um perfil para começar a preencher as seções.</p>
            <button
              type="button"
              className="btn-save"
              onClick={createProfile}
              disabled={user ? !allowCreateProfile : true}
              title={user && !allowCreateProfile ? profileLimitMessage(user.plan) : undefined}
            >
              Criar perfil
            </button>
          </div>
        ) : (
          <>
            <div className="status-row">
              <span
                className={`status-badge${
                  statusPulse && !isSaving && !saveMessage ? ' pulse' : ''
                }${toast?.type === 'success' ? ' status-badge--success' : ''}${
                  toast?.type === 'error' ? ' status-badge--error' : ''
                }${isSaving ? ' status-badge--saving' : ''}${
                  !saveMessage && !isSaving ? ' status-badge--idle' : ''
                }`}
              >
                <span className={`material-symbols-outlined filled${isSaving ? ' spin' : ''}`}>
                  {toast?.type === 'error'
                    ? 'error'
                    : isSaving
                      ? 'progress_activity'
                      : toast?.type === 'success'
                        ? 'check_circle'
                        : 'info'}
                </span>
                {isSaving ? 'Salvando…' : saveMessage || 'Pronto para salvar'}
              </span>
            </div>

            <section className="dashboard-card">
              <div>
                <label className="field-label" htmlFor="title">
                  Título (Posição)
                </label>
                <input
                  id="title"
                  className="field-input field-input--title"
                  type="text"
                  placeholder="Ex: Full Stack Developer Engineer"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="about">
                  Sobre mim
                </label>
                <textarea
                  id="about"
                  className="field-textarea"
                  rows={3}
                  placeholder="Resumo sobre você..."
                  value={form.about}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                />
              </div>
            </section>

            <section className="dashboard-card">
              <h3 className="section-heading">
                <span className="material-symbols-outlined">description</span>
                Currículo
              </h3>
              <p className="field-hint">Anexe um arquivo PDF ou DOC para baixar quando precisar.</p>

              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="resume-file-input"
                onChange={handleResumeUpload}
              />

              {resumeFileName ? (
                <div className="resume-file-card">
                  <div className="resume-file-info">
                    <span className="material-symbols-outlined">draft</span>
                    <div>
                      <span className="resume-file-name">{resumeFileName}</span>
                      <span className="resume-file-meta">Pronto para download</span>
                    </div>
                  </div>
                  <div className="resume-file-actions">
                    <button
                      type="button"
                      className="btn-resume-action"
                      onClick={() => resumeInputRef.current?.click()}
                      disabled={resumeUploading}
                    >
                      Substituir
                    </button>
                    <button
                      type="button"
                      className="btn-resume-action btn-resume-action--danger"
                      onClick={handleRemoveResume}
                      disabled={resumeUploading}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-dashed resume-upload-btn"
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={resumeUploading}
                >
                  <span className="material-symbols-outlined">upload_file</span>
                  {resumeUploading ? 'Enviando…' : 'Selecionar PDF ou DOC'}
                </button>
              )}
            </section>

            <section className="dashboard-card">
              <h3 className="section-heading">
                <span className="material-symbols-outlined">psychology</span>
                Skills
              </h3>
              <div className="skill-add-row">
                <input
                  className="field-input"
                  placeholder="Adicionar (ex: React)"
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                />
                <button type="button" className="btn-add-skill" onClick={addSkill}>
                  Add
                </button>
              </div>
              <textarea
                className="field-textarea field-textarea--compact"
                placeholder="Lote (Skill1, Skill2...)"
                rows={1}
                value={bulkSkills}
                onChange={(e) => setBulkSkills(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addBulkSkills()
                  }
                }}
              />
              <p className="field-hint">Adicione uma por vez ou várias separadas por vírgula.</p>
              <div className="skill-chips-area">
                {form.skills.length === 0 && (
                  <span className="skill-chips-empty">Nenhuma skill adicionada</span>
                )}
                {form.skills.map((skill) => (
                  <div key={skill} className="skill-chip">
                    <span>{skill}</span>
                    <button type="button" className="skill-chip-remove" onClick={() => removeSkill(skill)}>
                      <span className="material-symbols-outlined">cancel</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard-card">
              <div className="section-heading-row">
                <h3 className="section-heading">
                  <span className="material-symbols-outlined">work</span>
                  Experiência
                </h3>
                <button
                  type="button"
                  className="dashboard-icon-btn dashboard-icon-btn--primary"
                  title="Adicionar experiência"
                  onClick={openNewExperienceForm}
                >
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
              </div>

              {showExperienceForm && (
                <div className="inline-form">
                  <div className="inline-form-title">
                    {editingExperienceId ? 'Editar experiência' : 'Nova experiência'}
                  </div>
                  <label className="field-label">Cargo</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Senior Frontend Engineer"
                    value={experienceDraft.role}
                    onChange={(e) => setExperienceDraft((d) => ({ ...d, role: e.target.value }))}
                  />
                  <label className="field-label">Empresa</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Acme Corp"
                    value={experienceDraft.company}
                    onChange={(e) => setExperienceDraft((d) => ({ ...d, company: e.target.value }))}
                  />
                  <label className="field-label">Funções / Responsabilidades</label>
                  <textarea
                    className="field-textarea"
                    rows={2}
                    placeholder="Descreva suas principais atividades..."
                    value={experienceDraft.responsibilities}
                    onChange={(e) =>
                      setExperienceDraft((d) => ({ ...d, responsibilities: e.target.value }))
                    }
                  />
                  <div className="inline-form-row">
                    <div>
                      <label className="field-label">Entrada</label>
                      <input
                        className="field-input"
                        placeholder="Ex: Jan 2020"
                        value={experienceDraft.startDate}
                        onChange={(e) =>
                          setExperienceDraft((d) => ({ ...d, startDate: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="field-label">Saída</label>
                      <input
                        className="field-input"
                        placeholder="Ex: Dez 2023"
                        value={experienceDraft.endDate ?? ''}
                        disabled={experienceDraft.endDate === null}
                        onChange={(e) =>
                          setExperienceDraft((d) => ({ ...d, endDate: e.target.value || null }))
                        }
                      />
                    </div>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={experienceDraft.endDate === null}
                      onChange={(e) =>
                        setExperienceDraft((d) => ({
                          ...d,
                          endDate: e.target.checked ? null : ''
                        }))
                      }
                    />
                    Trabalho atual (Presente)
                  </label>
                  <div className="inline-form-actions">
                    <button type="button" className="btn-inline-cancel" onClick={cancelExperienceForm}>
                      Cancelar
                    </button>
                    <button type="button" className="btn-inline-save" onClick={saveExperienceDraft}>
                      {editingExperienceId ? 'Atualizar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="experience-list">
                {form.experiences.length === 0 && !showExperienceForm && (
                  <p className="insert-panel-empty">Nenhuma experiência cadastrada.</p>
                )}
                {form.experiences.map((exp) => (
                  <div key={exp.id} className="experience-item">
                    <div className="experience-item-head">
                      <div className="experience-item-left">
                        <span className="material-symbols-outlined text-primary">corporate_fare</span>
                        <div className="experience-item-text">
                          <h4 className="experience-item-title">{exp.role}</h4>
                          <p className="experience-item-sub">
                            {exp.company} • {formatExperiencePeriod(exp)}
                          </p>
                        </div>
                      </div>
                      <div className="experience-item-actions">
                        <button
                          type="button"
                          className="experience-action-btn"
                          title="Editar"
                          onClick={() => openEditExperience(exp)}
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="experience-action-btn experience-action-btn--delete"
                          title="Excluir"
                          onClick={() => removeExperience(exp.id)}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                    {exp.responsibilities.trim() && (
                      <div className="experience-item-body">{exp.responsibilities}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard-card">
              <div className="section-heading-row">
                <h3 className="section-heading">
                  <span className="material-symbols-outlined">school</span>
                  Formação
                </h3>
                <button
                  type="button"
                  className="dashboard-icon-btn dashboard-icon-btn--primary"
                  title="Adicionar formação"
                  onClick={openNewEducationForm}
                >
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
              </div>

              {showEducationForm && (
                <div className="inline-form">
                  <div className="inline-form-title">
                    {editingEducationId ? 'Editar formação' : 'Nova formação'}
                  </div>
                  <label className="field-label">Curso / Certificação</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Bacharelado em Desenvolvimento de Software"
                    value={educationDraft.title ?? educationDraft.name}
                    onChange={(e) =>
                      setEducationDraft((d) => ({ ...d, title: e.target.value, name: e.target.value }))
                    }
                  />
                  <label className="field-label">Instituição</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Universidade Federal"
                    value={educationDraft.institution ?? ''}
                    onChange={(e) =>
                      setEducationDraft((d) => ({ ...d, institution: e.target.value }))
                    }
                  />
                  <label className="field-label">Data de conclusão</label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={educationNotCompleted}
                      onChange={(e) => {
                        setEducationNotCompleted(e.target.checked)
                        if (e.target.checked) {
                          setEducationDateYear('')
                          setEducationDateMonth('')
                          setEducationDateDay('')
                        }
                      }}
                    />
                    Ainda não concluí
                  </label>
                  {!educationNotCompleted && (
                    <div className="inline-form-row inline-form-row--3">
                      <div>
                        <label className="field-label">Ano</label>
                        <select
                          className="field-select"
                          value={educationDateYear}
                          onChange={(e) => {
                            const year = e.target.value
                            setEducationDateYear(year)
                            if (year && educationDateMonth && educationDateDay) {
                              const maxDay = daysInMonth(
                                Number(year),
                                Number(educationDateMonth)
                              )
                              if (Number(educationDateDay) > maxDay) setEducationDateDay('')
                            }
                          }}
                        >
                          <option value="">Selecione</option>
                          {EDUCATION_YEAR_OPTIONS.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Mês</label>
                        <select
                          className="field-select"
                          value={educationDateMonth}
                          onChange={(e) => {
                            const month = e.target.value
                            setEducationDateMonth(month)
                            if (educationDateYear && month && educationDateDay) {
                              const maxDay = daysInMonth(
                                Number(educationDateYear),
                                Number(month)
                              )
                              if (Number(educationDateDay) > maxDay) setEducationDateDay('')
                            }
                          }}
                        >
                          <option value="">Selecione</option>
                          {EDUCATION_MONTHS.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Dia</label>
                        <select
                          className="field-select"
                          value={educationDateDay}
                          onChange={(e) => setEducationDateDay(e.target.value)}
                          disabled={!educationDateYear || !educationDateMonth}
                        >
                          <option value="">Selecione</option>
                          {Array.from(
                            {
                              length: daysInMonth(
                                Number(educationDateYear),
                                Number(educationDateMonth)
                              )
                            },
                            (_, index) => String(index + 1)
                          ).map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="inline-form-actions">
                    <button type="button" className="btn-inline-cancel" onClick={cancelEducationForm}>
                      Cancelar
                    </button>
                    <button type="button" className="btn-inline-save" onClick={saveEducationDraft}>
                      {editingEducationId ? 'Atualizar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="experience-list">
                {form.education.length === 0 && !showEducationForm && (
                  <p className="insert-panel-empty">Nenhum curso cadastrado.</p>
                )}
                {form.education.map((edu) => (
                  <div key={edu.id} className="education-item">
                    <div className="experience-item-head">
                      <div className="experience-item-left">
                        <span className="material-symbols-outlined text-primary">school</span>
                        <div className="experience-item-text">
                          <h4 className="education-item-title">{edu.title ?? edu.name}</h4>
                          {formatEducationSubtitle(edu) && (
                            <p className="education-item-sub">{formatEducationSubtitle(edu)}</p>
                          )}
                        </div>
                      </div>
                      <div className="experience-item-actions">
                        <button
                          type="button"
                          className="experience-action-btn"
                          title="Editar"
                          onClick={() => openEditEducation(edu)}
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="experience-action-btn experience-action-btn--delete"
                          title="Excluir"
                          onClick={() => removeEducation(edu.id)}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {activeTab === 'profile' && (
        <footer className="dashboard-footer">
          <button
            type="button"
            className={`btn-save${isSaving ? ' btn-save--saving' : ''}${saveSucceeded ? ' btn-save--saved' : ''}`}
            onClick={saveProfile}
            disabled={!activeProfile || isSaving}
          >
            <span className={`material-symbols-outlined${isSaving ? ' spin' : ''}`}>
              {isSaving ? 'progress_activity' : saveSucceeded ? 'check' : 'save'}
            </span>
            {isSaving ? 'Salvando…' : saveSucceeded ? 'Salvo!' : 'Salvar'}
          </button>
          <div className="dashboard-footer-actions">
            <button
              type="button"
              className="btn-footer-icon btn-footer-icon--pdf"
              title="Baixar currículo"
              onClick={handleDownloadResume}
              disabled={!activeProfile?.resumeId}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
            </button>
          </div>
        </footer>
      )}

      {toast && (
        <div className={`dashboard-toast dashboard-toast--${toast.type}`} role="status">
          <span className="material-symbols-outlined filled">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  )
}
