/**
 * components/BackupSection.tsx
 * Backup local JSON + forzar sincronización con D1
 */

import { useState, useRef } from 'react'
import {
  Download, Upload, LogOut, Save,
  CheckCircle2, AlertCircle, FolderOpen, RefreshCw,
} from 'lucide-react'
import {
  exportData, importData,
  getProfiles, getActiveProfileId,
  snapshotProfile, updateProfile,
} from '@/utils/backup'
import { useSync } from '@/hooks/useSync'

interface BackupSectionProps {
  onSwitchProfile: () => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase px-1 mt-2 mb-1">
      {children}
    </p>
  )
}

function Row({
  icon, label, hint, right, onClick, danger = false, disabled = false,
}: {
  icon:      React.ReactNode
  label:     string
  hint?:     string
  right?:    React.ReactNode
  onClick?:  () => void
  danger?:   boolean
  disabled?: boolean
}) {
  const base = "w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-surface-border last:border-0 transition-colors duration-150 text-left disabled:opacity-40 disabled:pointer-events-none"
  const color = danger
    ? "hover:bg-danger/5 active:bg-danger/10"
    : "hover:bg-surface-raised active:bg-surface-raised"

  const content = (
    <>
      <span className={`flex-shrink-0 ${danger ? 'text-danger' : 'text-text-muted'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-danger' : 'text-text-primary'}`}>{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5 leading-snug">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </>
  )

  if (onClick) {
    return (
      <button onClick={onClick} disabled={disabled} className={`${base} ${color}`}>
        {content}
      </button>
    )
  }
  return <div className={`${base} cursor-default`}>{content}</div>
}

function InlineToast({ type, message }: { type: 'ok' | 'err'; message: string }) {
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl mx-2 my-2 animate-slide-up
      ${type === 'ok' ? 'bg-accent/10 border border-accent/20' : 'bg-danger/10 border border-danger/20'}`}>
      {type === 'ok'
        ? <CheckCircle2 size={16} className="text-accent mt-0.5 flex-shrink-0" />
        : <AlertCircle  size={16} className="text-danger  mt-0.5 flex-shrink-0" />}
      <p className={`text-xs leading-snug ${type === 'ok' ? 'text-accent' : 'text-danger'}`}>{message}</p>
    </div>
  )
}

function ConfirmImportModal({ fileName, onCancel, onConfirm }: {
  fileName: string; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xs bg-surface-card border border-surface-border rounded-2xl p-6 animate-slide-up">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-hrDim mb-4">
          <FolderOpen size={22} className="text-amber-hr" />
        </div>
        <p className="text-base font-semibold text-text-primary mb-1">Importar backup</p>
        <p className="text-sm text-text-muted mb-1">Se reemplazarán los datos actuales con:</p>
        <p className="text-xs font-mono text-text-secondary bg-surface px-3 py-2 rounded-lg mb-4 break-all">{fileName}</p>
        <p className="text-xs text-text-muted mb-5">Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-surface-border text-text-muted text-sm hover:border-text-muted/40 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-accent text-surface font-semibold text-sm hover:bg-accent/90 transition-all">Importar</button>
        </div>
      </div>
    </div>
  )
}

export function BackupSection({ onSwitchProfile }: BackupSectionProps) {
  const fileRef       = useRef<HTMLInputElement>(null)
  const [status,      setStatus]      = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const { syncNow, isSyncing, pendingCount, lastSyncedAt } = useSync()

  const activeId   = getActiveProfileId()
  const profiles   = getProfiles()
  const profile    = profiles.find((p) => p.id === activeId)
  const profileName = profile?.name ?? 'Mi perfil'

  function flash(type: 'ok' | 'err', msg: string) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 4000)
  }

  function handleExport() {
    try {
      if (activeId) snapshotProfile(activeId)
      exportData(profileName)
      flash('ok', 'Archivo descargado. En iOS usa el share sheet para guardarlo en iCloud Drive o Google Drive.')
    } catch {
      flash('err', 'No se pudo exportar el backup.')
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
    e.target.value = ''
  }

  async function handleImportConfirm() {
    if (!pendingFile) return
    const file = pendingFile
    setPendingFile(null)
    try {
      const backup = await importData(file)
      if (activeId) {
        updateProfile(activeId, { lastSaved: backup.exportedAt, sessionCount: backup.sessions.length })
      }
      flash('ok', `Importadas ${backup.sessions.length} sesiones y ${backup.projects.length} proyectos.`)
    } catch (e: unknown) {
      flash('err', e instanceof Error ? e.message : 'Error al importar el archivo.')
    }
  }

  async function handleForceSync() {
    try {
      await syncNow()
      flash('ok', pendingCount > 0 ? `Sincronizados ${pendingCount} cambios con D1 ✓` : 'Todo sincronizado ✓')
    } catch {
      flash('err', 'Error al sincronizar con la base de datos.')
    }
  }

  const syncLabel = isSyncing
    ? 'Sincronizando…'
    : pendingCount > 0
      ? `Forzar sync (${pendingCount} pendientes)`
      : 'Forzar sincronización'

  const lastSync = lastSyncedAt
    ? `Último sync: ${new Date(lastSyncedAt).toLocaleTimeString('es-IE', { hour: '2-digit', minute: '2-digit' })}`
    : undefined

  return (
    <>
      <SectionTitle>Backup y perfiles</SectionTitle>

      <div className="bg-surface-card border border-surface-border rounded-card">
        {/* Active profile chip */}
        {profile && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
            <span className="text-2xl leading-none">{profile.avatar}</span>
            <div>
              <p className="text-sm font-medium text-text-primary">{profile.name}</p>
              <p className="text-xs text-text-muted font-mono">
                {profile.sessionCount} sesiones · {profile.lastSaved
                  ? `guardado ${new Date(profile.lastSaved).toLocaleDateString('es-IE')}`
                  : 'sin backup'}
              </p>
            </div>
          </div>
        )}

        {status && (
          <div className="px-0">
            <InlineToast type={status.type} message={status.msg} />
          </div>
        )}

        {/* Force sync */}
        <Row
          icon={<RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />}
          label={syncLabel}
          hint={lastSync}
          onClick={handleForceSync}
          disabled={isSyncing}
          right={pendingCount > 0
            ? <span className="text-[10px] font-mono bg-accent/20 text-accent px-2 py-0.5 rounded-pill">{pendingCount}</span>
            : undefined
          }
        />

        {/* Export */}
        <Row
          icon={<Download size={18} />}
          label="Exportar backup JSON"
          hint="En iOS: share sheet → iCloud Drive / Google Drive. En Android: mueve el archivo al Drive."
          onClick={handleExport}
        />

        {/* Import */}
        <Row
          icon={<Upload size={18} />}
          label="Importar backup JSON"
          hint="Carga un .json exportado previamente. Reemplaza los datos actuales."
          onClick={() => fileRef.current?.click()}
        />

        {/* Save snapshot */}
        <Row
          icon={<Save size={18} />}
          label="Guardar estado en perfil"
          hint="Actualiza el contador de sesiones sin descargar archivo."
          onClick={() => {
            if (activeId) { snapshotProfile(activeId); flash('ok', 'Perfil actualizado.') }
          }}
        />

        {/* Switch profile */}
        <Row
          icon={<LogOut size={18} />}
          label="Cambiar de perfil"
          hint="Vuelve a la pantalla de selección de perfiles."
          onClick={onSwitchProfile}
          danger
        />
      </div>

      <div className="px-1 mt-2">
        <p className="text-[11px] text-text-muted leading-relaxed">
          💡 Los datos se sincronizan automáticamente con la base de datos cada 5 minutos cuando hay conexión. Usa "Forzar sync" para subir cambios inmediatamente.
        </p>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFilePick} />

      {pendingFile && (
        <ConfirmImportModal
          fileName={pendingFile.name}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleImportConfirm}
        />
      )}
    </>
  )
}
