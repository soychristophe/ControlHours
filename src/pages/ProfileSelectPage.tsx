/**
 * pages/ProfileSelectPage.tsx
 * Selección de perfil con auto-login, backup local y sync cloud.
 */

import { useState, useRef } from 'react'
import { UserPlus, Upload, Trash2, ChevronRight, Clock, Download, RefreshCw } from 'lucide-react'
import {
  getProfiles, createProfile, deleteProfile,
  setActiveProfileId, importData, exportData,
  snapshotProfile, updateProfile,
  type Profile,
} from '@/utils/backup'

const AVATARS = ['🧑‍💼','👩‍🔧','👨‍🍳','👩‍💻','🧑‍🎨','👷','🧑‍🏫','👩‍⚕️','🧑‍🚀','🦊','🐺','🦁','🐸','🐧','🌵','⚡','🍀','🔥']

function relativeTime(iso: string | null): string {
  if (!iso) return 'Sin guardar'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'Ahora mismo'
  if (mins  < 60) return `Hace ${mins}m`
  if (hours < 24) return `Hace ${hours}h`
  return `Hace ${days}d`
}

function ProfileCard({ profile, onSelect, onDelete, onImport, onExport }: {
  profile: Profile
  onSelect: (p: Profile) => void
  onDelete: (p: Profile) => void
  onImport: (p: Profile, file: File) => void
  onExport: (p: Profile) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative group animate-slide-up">
      <button
        onClick={() => onSelect(profile)}
        className="w-full flex items-center gap-4 px-4 py-4 bg-surface-card border border-surface-border rounded-card hover:border-accent/40 hover:bg-surface-raised active:scale-[0.98] transition-all duration-150 text-left"
      >
        <span className="text-3xl leading-none select-none flex-shrink-0">{profile.avatar}</span>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary font-semibold text-base leading-tight truncate">{profile.name}</p>
          <p className="text-text-muted text-xs font-mono mt-0.5 flex items-center gap-1.5">
            <Clock size={10} />
            {relativeTime(profile.lastSaved)}
            {profile.sessionCount > 0 && (
              <span className="text-text-muted/60">· {profile.sessionCount} sesiones</span>
            )}
          </p>
        </div>
        <ChevronRight size={18} className="text-text-muted group-hover:text-accent transition-colors" />
      </button>

      {/* Hover actions */}
      <div className="absolute top-2 right-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button title="Exportar backup" onClick={(e) => { e.stopPropagation(); onExport(profile) }}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-raised border border-surface-border text-text-muted hover:text-accent hover:border-accent/40 transition-colors">
          <Download size={12} />
        </button>
        <button title="Importar backup" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-raised border border-surface-border text-text-muted hover:text-accent hover:border-accent/40 transition-colors">
          <Upload size={12} />
        </button>
        <button title="Eliminar perfil" onClick={(e) => { e.stopPropagation(); onDelete(profile) }}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-raised border border-surface-border text-text-muted hover:text-danger hover:border-danger/40 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(profile, f); e.target.value = '' }} />
    </div>
  )
}

function CreateProfileModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (profile: Profile) => void
}) {
  const [name,   setName]   = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(createProfile(trimmed, avatar))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-surface-card border border-surface-border rounded-t-2xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] animate-slide-up"
        onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-4">Nuevo perfil</p>
        <div className="grid grid-cols-9 gap-1.5 mb-5">
          {AVATARS.map((em) => (
            <button key={em} onClick={() => setAvatar(em)}
              className={`text-xl leading-none aspect-square rounded-lg flex items-center justify-center transition-all duration-100
                ${avatar === em ? 'bg-accent/20 ring-1 ring-accent scale-110' : 'bg-surface-raised hover:bg-surface-border'}`}>
              {em}
            </button>
          ))}
        </div>
        <input autoFocus type="text" placeholder="Tu nombre…" maxLength={24} value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-4 py-3 rounded-xl bg-surface border border-surface-border text-text-primary placeholder:text-text-muted text-sm font-medium focus:outline-none focus:border-accent/60 transition-colors mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-surface-border text-text-muted text-sm hover:border-text-muted/40 transition-colors">Cancelar</button>
          <button onClick={submit} disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-accent text-surface font-semibold text-sm hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150">
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ profile, onCancel, onConfirm }: {
  profile: Profile; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xs bg-surface-card border border-surface-border rounded-2xl p-6 animate-slide-up">
        <p className="text-lg font-semibold text-text-primary mb-1">¿Eliminar perfil?</p>
        <p className="text-sm text-text-muted mb-6">
          Se eliminará <span className="text-text-secondary font-medium">{profile.name}</span> de esta lista. Los datos del store no se borran.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-surface-border text-text-muted text-sm hover:border-text-muted/40 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-danger text-white font-semibold text-sm hover:bg-danger/80 transition-colors">Eliminar</button>
        </div>
      </div>
    </div>
  )
}

export function ProfileSelectPage({ onLogin }: { onLogin: (profileId: string) => void }) {
  const [profiles,     setProfiles]     = useState<Profile[]>(getProfiles)
  const [showCreate,   setShowCreate]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [syncing,      setSyncing]      = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }
  function refresh() { setProfiles(getProfiles()) }

  function handleSelect(profile: Profile) {
    setActiveProfileId(profile.id)
    snapshotProfile(profile.id)
    onLogin(profile.id)
  }

  function handleCreate(profile: Profile) {
    setShowCreate(false)
    refresh()
    setActiveProfileId(profile.id)
    onLogin(profile.id)
  }

  function handleDelete(profile: Profile) {
    deleteProfile(profile.id)
    setDeleteTarget(null)
    refresh()
    showToast(`Perfil "${profile.name}" eliminado`)
  }

  function handleExport(profile: Profile) {
    snapshotProfile(profile.id)
    exportData(profile.name)
    refresh()
    showToast('Backup exportado ✓')
  }

  async function handleImport(profile: Profile, file: File) {
    try {
      const backup = await importData(file)
      updateProfile(profile.id, { lastSaved: backup.exportedAt, sessionCount: backup.sessions.length })
      refresh()
      showToast(`Importadas ${backup.sessions.length} sesiones ✓`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error al importar')
    }
  }

  async function handleCloudSync() {
    setSyncing(true)
    try {
      // Trigger a fetch to wakeup the sync hook in the main app
      // The actual sync happens via useSync in AppShell after login
      // Here we just signal the user
      await new Promise((r) => setTimeout(r, 800))
      showToast('Abre la app y usa "Forzar sync" en Settings para subir a D1 ✓')
    } finally {
      setSyncing(false)
    }
  }

  const hasProfiles = profiles.length > 0

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 bg-surface">
      {/* Header */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-accent/10 border border-accent/20">
          <Clock size={28} className="text-accent" strokeWidth={1.5} />
        </div>
        <h1 className="font-mono text-xl font-semibold text-text-primary tracking-tight">TimeIreland</h1>
        <p className="text-text-muted text-sm mt-1">{hasProfiles ? '¿Quién eres?' : 'Crea tu primer perfil'}</p>
      </div>

      {/* Profile list */}
      <div className="w-full max-w-sm flex flex-col gap-2.5">
        {profiles.map((p) => (
          <ProfileCard key={p.id} profile={p}
            onSelect={handleSelect}
            onDelete={(p) => setDeleteTarget(p)}
            onImport={handleImport}
            onExport={handleExport}
          />
        ))}

        <button onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border border-dashed border-surface-border rounded-card text-text-muted text-sm hover:border-accent/40 hover:text-accent active:scale-[0.98] transition-all duration-150 mt-1">
          <UserPlus size={16} />
          Nuevo perfil
        </button>

        {/* Cloud sync hint */}
        {hasProfiles && (
          <button onClick={handleCloudSync} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-surface-border rounded-card text-text-muted text-xs hover:border-accent/20 hover:text-text-secondary transition-all duration-150 disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Comprobando…' : 'Sincronización con D1 → entra a la app y usa Settings'}
          </button>
        )}
      </div>

      <p className="text-text-muted/50 text-xs font-mono mt-10 text-center max-w-xs leading-relaxed">
        Datos locales en este dispositivo. Usa el backup JSON para iCloud / Google Drive.
      </p>

      {showCreate && (
        <CreateProfileModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal profile={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)} />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-pill bg-surface-card border border-surface-border text-text-secondary text-sm font-medium shadow-lg animate-slide-up pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
