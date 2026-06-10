import React from 'react'
import { createRoot } from 'react-dom/client'
import AuthScreen from '../components/AuthScreen'
import { useAuth } from '../hooks/useAuth'
import App from './App'
import './options.css'

function OptionsRoot(): JSX.Element {
  const { user, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="dashboard-shell">
        <p className="dashboard-loading">Carregando…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="dashboard-shell dashboard-shell--auth">
        <AuthScreen onLogin={login} />
      </div>
    )
  }

  return <App user={user} />
}

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <OptionsRoot />
  </React.StrictMode>
)
