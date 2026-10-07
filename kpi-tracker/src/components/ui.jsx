import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { initials, round } from '../lib/utils'

// ---------------- router (hash based so it works from any static host) ----------------
let seq = 0
function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = h.split('?')
  return { path, seq, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) }
}
export function useRoute() {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const on = () => {
      seq += 1
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
export const navigate = (to) => {
  window.location.hash = to
}
/** Back to the parent page (never browser history): label says where it goes. */
export function BackLink({ to, label }) {
  return (
    <a href={`#${to}`} className="back-link">
      <span className="back-arrow">←</span> Back to {label}
    </a>
  )
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a href={`#${to}`} className={className} {...rest}>
      {children}
    </a>
  )
}

// ---------------- primitives ----------------
export function Badge({ tone = 'gray', dot, children, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

const GOAL_STATUS = {
  draft: ['gray', 'Draft'],
  ready: ['violet', 'Ready'],
  running: ['green', 'Running'],
  stopped: ['red', 'Stopped'],
}
export function GoalStatus({ status }) {
  const [tone, label] = GOAL_STATUS[status] || ['gray', status]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

export function toneFor(p) {
  if (p >= 90) return 'green'
  if (p >= 70) return ''
  if (p >= 50) return 'amber'
  return 'red'
}

export function Progress({ value = 0, tone, size = '', marker, title }) {
  const v = Math.max(0, value || 0)
  return (
    <div className={`bar ${size} ${tone ?? ''}`} title={title ?? `${round(v, 1)}%`}>
      <span style={{ width: `${Math.min(100, v)}%` }} />
      {marker !== undefined && <i className="marker" style={{ left: `${Math.min(100, marker)}%` }} />}
    </div>
  )
}

/** A compact coloured circle with the percentage inside — used instead of long progress bars. */
export function ScoreDot({ value, size = 'md', title, muted }) {
  const v = Number(value) || 0
  const tone = muted ? 'gray' : toneFor(v) || 'blue'
  const txt = `${Math.round(v)}%`
  return (
    <span className={`score-dot ${size} ${tone}`} title={title ?? `${round(v, 1)}%`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="16" className="sd-track" />
        <circle cx="18" cy="18" r="16" className="sd-fill" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, v))} 100`} />
      </svg>
      <b>{txt}</b>
    </span>
  )
}

/** Progress bar with the percentage beside it — the reports use this instead of score circles. */
export function PctBar({ value, width = 90, muted, title }) {
  const v = Number(value) || 0
  const tone = muted ? 'gray' : toneFor(v)
  return (
    <div className="pct-bar" title={title ?? `${round(v, 1)}%`}>
      <div style={{ width }}><Progress value={v} tone={tone} /></div>
      <b className={`pct ${tone || ''}`}>{Math.round(v)}%</b>
    </div>
  )
}

/** Headline score for report headers: big percentage, a label and a bar (no circle). */
export function ScoreTile({ value, label, width = 120 }) {
  const v = Number(value) || 0
  const tone = toneFor(v)
  return (
    <div className="score-tile">
      <div className={`v pct ${tone || ''}`}>{round(v, 0)}%</div>
      <div className="tiny muted">{label}</div>
      <div style={{ width }} className="mt-4"><Progress value={v} tone={tone} /></div>
    </div>
  )
}

export function Ring({ value = 0, size = 76, stroke = 8, color = 'var(--blue-600)', track = '#e6ebf2', label, sub, textColor }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: textColor }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: size > 90 ? 22 : size > 60 ? 16 : 12, lineHeight: 1 }}>{label ?? `${round(value, 0)}%`}</div>
          {sub && size >= 56 && <div style={{ fontSize: size > 80 ? 10 : 9, opacity: 0.8, marginTop: 3, maxWidth: size - stroke * 2 - 14, marginInline: 'auto', lineHeight: 1.15, whiteSpace: 'normal' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

export function Avatar({ name, size = '' }) {
  const hue = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 5
  const grads = [
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#0ea5e9,#0369a1)',
    'linear-gradient(135deg,#6366f1,#4338ca)',
    'linear-gradient(135deg,#14b8a6,#0f766e)',
    'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  ]
  return (
    <div className={`avatar ${size}`} style={{ background: grads[hue] }}>
      {initials(name)}
    </div>
  )
}

export function Person({ staff, sub, size = 'sm' }) {
  if (!staff) return <span className="muted">—</span>
  return (
    <div className="row gap-6" style={{ minWidth: 0 }}>
      <Avatar name={staff.name} size={size} />
      <div style={{ minWidth: 0 }}>
        <div className="semi" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{staff.name}</div>
        {sub !== false && <div className="tiny muted">{sub ?? staff.title}</div>}
      </div>
    </div>
  )
}

export function Field({ label, required, hint, error, children, field, style }) {
  return (
    <div className="field" data-field={field} style={style}>
      {label && (
        <label>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="err">
          <AlertCircle size={12} /> {error}
        </span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  )
}

/** Number input that keeps the user's text while typing (no jumping when the value is re-derived). */
export function NumInput({ value, onChange, className = 'input', invalid, step = 'any', min, max, placeholder, disabled, style, id }) {
  const [text, setText] = useState(value === null || value === undefined || value === '' ? '' : String(round(value, 4)))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value === null || value === undefined || value === '' ? '' : String(round(value, 4)))
  }, [value])
  return (
    <input
      id={id}
      type="number"
      className={`${className} ${invalid ? 'invalid' : ''}`}
      value={text}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        setText(value === null || value === undefined || value === '' ? '' : String(round(value, 4)))
      }}
      onChange={(e) => {
        setText(e.target.value)
        onChange(e.target.value === '' ? '' : Number(e.target.value))
      }}
    />
  )
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} disabled={o.disabled} title={o.title} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={value === t.key ? 'on' : ''} onClick={() => onChange(t.key)}>
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, sub, icon, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon && <div className="stat" style={{ padding: 0 }}><div className="icon">{icon}</div></div>}
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          {onClose && (
            <button className="btn ghost icon sm" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children, action }) {
  return (
    <div className="empty">
      {icon && <div className="ic">{icon}</div>}
      <h3 style={{ color: 'var(--text)' }}>{title}</h3>
      {children && <p className="mt-4">{children}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'info', children, style }) {
  const Icon = { info: Info, warn: AlertTriangle, error: AlertCircle, success: CheckCircle2 }[tone]
  return (
    <div className={`alert ${tone}`} style={style}>
      <Icon size={16} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

// ---------------- toasts & confirm ----------------
const FeedbackCtx = createContext(null)

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  const toast = useCallback((msg, tone = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setConfirmState({ ...opts, resolve })
      }),
    [],
  )

  const close = (v) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'error' ? <AlertCircle size={18} /> : t.tone === 'warn' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} color="#4ade80" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal
          title={confirmState.title || 'Are you sure?'}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => close(false)}>
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button className={`btn ${confirmState.danger ? 'danger-solid' : 'primary'}`} onClick={() => close(true)}>
                {confirmState.okLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <div style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>{confirmState.message}</div>
        </Modal>
      )}
    </FeedbackCtx.Provider>
  )
}

export const useFeedback = () => useContext(FeedbackCtx)
