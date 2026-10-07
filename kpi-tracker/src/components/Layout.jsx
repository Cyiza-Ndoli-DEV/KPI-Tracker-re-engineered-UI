import { useState } from 'react'
import { LayoutDashboard, CalendarRange, Target, Wand2, FileClock, UserCheck, Trophy, Settings, Gauge, BarChart3, CalendarDays, ArrowLeft, AlignLeft, CircleUserRound, Power, User } from 'lucide-react'
import { useStore, useCurrentUser } from '../store'
import { ROLES } from '../data/seed'
import { Link, navigate, useFeedback } from './ui'
import { fmtDate, todayISO } from '../lib/utils'
import { byId } from '../lib/calc'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: 'all' },
  { to: '/cycles', label: 'Review Cycles', icon: CalendarRange, roles: ['admin'] },
  { to: '/goals', label: 'Goals', icon: Target, roles: ['admin', 'dept_head', 'team_lead'] },
  { to: '/kpis', label: 'KPIs', icon: Gauge, roles: ['admin', 'dept_head', 'team_lead'] },
  { to: '/wizard', label: 'Goal Setup Wizard', icon: Wand2, roles: ['admin'] },
  { to: '/drafts', label: 'Drafts', icon: FileClock, roles: ['admin'], count: 'drafts' },
  { to: '/my-kpis', label: 'My KPIs', icon: UserCheck, roles: 'all' },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'dept_head', 'team_lead'] },
  // managers find rankings inside Reports; employees keep the stand-alone page
  { to: '/rankings', label: 'Rankings', icon: Trophy, roles: 'all', menuRoles: ['employee', 'employee2'] },
  { to: '/admin', label: 'Admin Settings', icon: Settings, roles: ['admin'], count: 'requests' },
]

export const allowed = (item, role) => !item.roles || item.roles === 'all' || item.roles.includes(role)

const PAGE_LABEL = { '': 'Dashboard', cycles: 'Review Cycles', goals: 'Goals', kpis: 'KPIs', wizard: 'Goal Setup Wizard', drafts: 'Drafts', 'my-kpis': 'My KPIs', rankings: 'Rankings', reports: 'Reports', admin: 'Admin Settings' }

export default function Layout({ route, children }) {
  const { state, setRole, setViewCycle } = useStore()
  const { toast } = useFeedback()
  const user = useCurrentUser()
  const [collapsed, setCollapsed] = useState(false)
  const counts = {
    drafts: state.drafts.length,
    requests: state.editRequests.filter((r) => r.status === 'pending').length,
  }
  const isActive = (to) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
  const first = route.parts[0] || ''

  return (
    <div className="shell">
      <header className="hr-topbar">
        <div className="hr-topbar-left">
          <button className="hr-icon-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle menu">
            <AlignLeft size={30} />
          </button>
        </div>
        <div className="hr-brand">Pahappa HR</div>
        <div className="hr-topbar-right">
          <button className="hr-icon-btn" title="My KPIs" onClick={() => navigate('/my-kpis')}>
            <CircleUserRound size={28} />
          </button>
          <button className="hr-icon-btn" title="Log out (disabled in the prototype)" onClick={() => toast('Log out is disabled in the prototype.', 'warn')}>
            <Power size={26} />
          </button>
        </div>
      </header>

      <div className="hr-body">
        {!collapsed && (
          <aside className="hr-sidebar">
            <div className="welcome-card">
              <div className="welcome-avatar"><User size={30} /></div>
              <div>
                <div className="bold" style={{ fontSize: 15 }}>Welcome</div>
                <div className="welcome-name">{user?.name?.toUpperCase()}</div>
              </div>
            </div>
            <nav className="hr-nav">
              {NAV.filter((n) => allowed(n, state.role) && (!n.menuRoles || n.menuRoles.includes(state.role))).map((n) => (
                <Link key={n.to} to={n.to} className={`hr-nav-item ${isActive(n.to) ? 'active' : ''}`}>
                  <n.icon size={17} />
                  <span>{n.label}</span>
                  {n.count && counts[n.count] > 0 && <span className={`count ${n.count === 'requests' ? 'warn' : ''}`}>{counts[n.count]}</span>}
                </Link>
              ))}
              <a className="hr-nav-item" href="#/" onClick={(e) => { e.preventDefault(); toast('In Pahappa HR this returns to the main HR menu.', 'warn') }}>
                <ArrowLeft size={17} />
                <span>Back To Menu</span>
              </a>
            </nav>
          </aside>
        )}

        <div className="hr-main">
          <div className="hr-crumb">
            <span>{PAGE_LABEL[first] ?? 'KPI Tracker'}</span>
            <div className="spacer" />
            <span className="crumb-chip"><CalendarDays size={13} /> Today: {fmtDate(todayISO())}</span>
            <label className="crumb-field">
              Cycle
              <select value={state.viewCycleId} onChange={(e) => setViewCycle(e.target.value)}>
                {state.cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </label>
            <label className="crumb-field">
              View as
              <select value={state.role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(ROLES).map(([k, r]) => (
                  <option key={k} value={k}>{r.label} — {byId(state.staff, r.userId)?.name}</option>
                ))}
              </select>
            </label>
          </div>
          <main className="page">{children}</main>
          <footer className="hr-footer">
            <div>
              <div className="hr-footer-brand">Pahappa HR</div>
              <div className="hr-footer-copy">Copyright © 2026. Powered by <b>Pahappa LTD</b> · KPI Tracker prototype (mock data)</div>
            </div>
            <div className="spacer" />
            <span className="hr-footer-copy">v3.0.0</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
