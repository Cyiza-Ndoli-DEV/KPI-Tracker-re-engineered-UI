import { createRoot } from 'react-dom/client'
import { StoreProvider, useStore, currentUserId } from './store'
import { FeedbackProvider, useRoute, Empty, Link } from './components/ui'
import Layout, { NAV, allowed } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Cycles from './pages/Cycles'
import CycleForm from './pages/CycleForm'
import Goals from './pages/Goals'
import Kpis from './pages/Kpis'
import KpiNodeDetail from './pages/KpiNodeDetail'
import Reports from './pages/Reports'
import PersonReport from './pages/PersonReport'
import GoalDetail from './pages/GoalDetail'
import KpiDetail from './pages/KpiDetail'
import Wizard from './pages/Wizard'
import Drafts from './pages/Drafts'
import MyKpis from './pages/MyKpis'
import Rankings from './pages/Rankings'
import Admin from './pages/Admin'
import { ShieldAlert } from 'lucide-react'
import { isEmployeeRole } from './data/seed'
import './styles.css'

function Router() {
  const route = useRoute()
  const { state } = useStore()
  const [a, b] = route.parts
  const navItem = NAV.find((n) => n.to && n.to !== '/' && route.path.startsWith(n.to))
  // anyone may open the page of a KPI share they hold themselves
  const ownShare = (a === 'kpis' && route.parts[2] && state.allocations.find((x) => x.id === route.parts[2])?.unitId === currentUserId(state)) || (a === 'reports' && b === 'person' && route.parts[2] === currentUserId(state))
  const blocked = navItem && !allowed(navItem, state.role) && !ownShare

  let page
  if (blocked)
    page = (
      <Empty icon={<ShieldAlert />} title="Not available for this role" action={<Link to="/" className="btn primary">Back to dashboard</Link>}>
        Switch the role in the header to see this screen.
      </Empty>
    )
  else if (!a) page = <Dashboard />
  else if (a === 'cycles' && b === 'new') page = <CycleForm key="new" />
  else if (a === 'cycles' && b && route.parts[2] === 'edit') page = <CycleForm key={b} id={b} />
  else if (a === 'cycles') page = <Cycles />
  else if (a === 'goals' && b) page = <GoalDetail key={b} id={b} />
  else if (a === 'goals') page = <Goals />
  else if (a === 'kpis' && b && route.parts[2]) page = <KpiNodeDetail key={route.parts[2]} kpiId={b} allocId={route.parts[2]} />
  else if (a === 'kpis' && b) page = <KpiDetail key={b} id={b} query={route.query} />
  else if (a === 'kpis') page = <Kpis />
  else if (a === 'wizard') page = <Wizard key={route.query.draft || `new-${route.seq}`} draftId={route.query.draft} />
  else if (a === 'drafts') page = <Drafts />
  else if (a === 'my-kpis') page = <MyKpis />
  else if (a === 'rankings' && !isEmployeeRole(state.role)) page = <Reports key={`${state.role}-rank`} query={{ tab: 'ranking' }} />
  else if (a === 'rankings') page = <Rankings />
  else if (a === 'reports' && b === 'person' && route.parts[2]) page = <PersonReport key={route.parts[2]} id={route.parts[2]} />
  else if (a === 'reports') page = <Reports key={`${state.role}-${route.query.tab || ''}`} query={route.query} />
  else if (a === 'admin') page = <Admin />
  else page = <Empty title="Page not found" action={<Link to="/" className="btn primary">Go home</Link>} />

  return <Layout route={route}>{page}</Layout>
}

createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <FeedbackProvider>
      <Router />
    </FeedbackProvider>
  </StoreProvider>,
)
