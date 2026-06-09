import React, { useEffect, useRef, useState } from 'react'
import storageService from '../services/storageService'
import {
  attachResumeToProfile,
  downloadProfileResume,
  getResumeMeta,
  removeResumeFromProfile
} from '../services/resumeFileService'
import { createEmptyProfile, formatExperiencePeriod } from '../shared/profileFormatters'
import { Education, Experience, Profile } from '../shared/types'
import './options.css'

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

interface AppProps {
  embedded?: boolean
  onBack?: () => void
}

export default function App({ embedded = false, onBack }: AppProps): JSX.Element {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [form, setForm] = useState<DashboardForm>(profileToForm(null))
  const [newSkill, setNewSkill] = useState('')
  const [bulkSkills, setBulkSkills] = useState('')
  const [newEducationName, setNewEducationName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
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

  const activeProfile = profiles?.find((p) => p.id === activeProfileId) ?? null

  useEffect(() => {
    ;(async () => {
      const [p, activeId] = await Promise.all([
        storageService.getAllProfiles(),
        storageService.getActiveProfileId()
      ])
      setProfiles(p)
      const resolvedId = activeId && p.some((x) => x.id === activeId) ? activeId : p[0]?.id ?? null
      setActiveProfileId(resolvedId)
      const profile = p.find((x) => x.id === resolvedId) ?? null
      setForm(profileToForm(profile))
    })()
  }, [])

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

  async function createProfile() {
    const name = window.prompt('Nome do novo perfil:')
    if (!name?.trim()) return
    const profile = createEmptyProfile(uid('profile_'), name.trim())
    await storageService.addProfile(profile)
    const all = await storageService.getAllProfiles()
    setProfiles(all)
    await selectProfile(profile.id)
  }

  async function saveProfile() {
    if (!activeProfile || isSaving) return
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
      await storageService.updateProfile(updated)
      setProfiles(await storageService.getAllProfiles())
      setSaveSucceeded(true)
      setTimeout(() => setSaveSucceeded(false), 2500)
      showToast('Perfil salvo com sucesso!', 'success')
    } catch {
      showToast('Erro ao salvar o perfil. Tente novamente.', 'error', 4000)
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

  function addEducation() {
    const name = newEducationName.trim()
    if (!name) return
    setForm((f) => ({
      ...f,
      education: [...f.education, { id: uid('edu_'), name }]
    }))
    setNewEducationName('')
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
    if (!file || !activeProfile) return

    setResumeUploading(true)
    try {
      await attachResumeToProfile(activeProfile, file)
      setProfiles(await storageService.getAllProfiles())
      setResumeFileName(file.name)
      showToast('Currículo anexado com sucesso!', 'success')
    } catch (err) {
      alert(String(err))
    } finally {
      setResumeUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveResume() {
    if (!activeProfile?.resumeId) return
    if (!window.confirm('Remover o currículo deste perfil?')) return
    await removeResumeFromProfile(activeProfile)
    setProfiles(await storageService.getAllProfiles())
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
              >
                <span className="material-symbols-outlined">add</span>
                Criar novo perfil
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-main custom-scrollbar">
        {!activeProfile ? (
          <div className="dashboard-empty">
            <span className="material-symbols-outlined">person_add</span>
            <p>Crie um perfil para começar a preencher as seções.</p>
            <button type="button" className="btn-save" onClick={createProfile}>
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
              <h3 className="section-heading">
                <span className="material-symbols-outlined">school</span>
                Formação
              </h3>
              <div className="skill-add-row">
                <input
                  className="field-input"
                  placeholder="Ex: Linux Administration"
                  type="text"
                  value={newEducationName}
                  onChange={(e) => setNewEducationName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEducation()}
                />
                <button type="button" className="btn-add-skill" onClick={addEducation}>
                  Add
                </button>
              </div>
              <p className="field-hint">Somente o nome do curso ou certificação.</p>
              {form.education.map((edu) => (
                <div key={edu.id} className="education-item education-item--row">
                  <span className="education-item-title">{edu.name}</span>
                  <button
                    type="button"
                    className="experience-action-btn experience-action-btn--delete"
                    onClick={() => removeEducation(edu.id)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
              {form.education.length === 0 && (
                <p className="insert-panel-empty">Nenhum curso cadastrado.</p>
              )}
            </section>
          </>
        )}
      </main>

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
