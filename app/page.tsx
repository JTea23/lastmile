'use client'

import { useEffect, useState } from 'react'
import { Accessibility, ChevronDown, Crosshair, Filter, Heart, Menu, Navigation, Search, UserRound, Map as MapIcon, Home as HomeIcon, X } from 'lucide-react'
import { CampusMap } from '@/components/campus-map'

type Layer = 'no-go' | 'terrain' | 'parking'
type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }
type Route = { id: string; name: string; layers: Layer[]; accessibleOnly: boolean; saved: boolean; openedAt: number }
const ROUTES_STORAGE_KEY = 'lastmile-routes-v1'

const filters: { id: Layer; label: string; tone: string }[] = [
  { id: 'no-go', label: 'Lime no-go zones', tone: 'coral' },
  { id: 'terrain', label: 'Stairs & slopes', tone: 'amber' },
  { id: 'parking', label: 'Parking areas', tone: 'blue' },
]

function routeName(layers: Layer[], accessibleOnly: boolean) {
  if (accessibleOnly) return 'Accessible campus route'
  const selected = filters.filter((filter) => layers.includes(filter.id)).map((filter) => filter.label)
  return selected.length ? `${selected[0]} route` : 'Campus route'
}

export default function Page() {
  const [activeTab, setActiveTab] = useState('Home')
  const [activeLayers, setActiveLayers] = useState<Layer[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [mapAction, setMapAction] = useState<MapAction | undefined>()
  const [locationError, setLocationError] = useState<string | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [routesLoaded, setRoutesLoaded] = useState(false)
  const [activeRoute, setActiveRoute] = useState<Route | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROUTES_STORAGE_KEY)
      if (stored) setRoutes(JSON.parse(stored) as Route[])
    } catch {
      setRoutes([])
    } finally {
      setRoutesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (routesLoaded) window.localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes))
  }, [routes, routesLoaded])

  const triggerMap = (type: MapAction['type']) => setMapAction({ type, id: Date.now() })
  const toggleLayer = (layer: Layer) => setActiveLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])
  const addRecent = (route: Route) => setRoutes((current) => [route, ...current.filter((item) => item.id !== route.id)].slice(0, 20))
  const saveCurrentRoute = () => {
    const route: Route = { id: crypto.randomUUID(), name: routeName(activeLayers, accessibleOnly), layers: [...activeLayers], accessibleOnly, saved: true, openedAt: Date.now() }
    setRoutes((current) => [route, ...current])
    setActiveRoute(route)
  }
  const openRoute = (route: Route) => {
    setActiveLayers(route.layers)
    setAccessibleOnly(route.accessibleOnly)
    setActiveRoute(route)
    setActiveTab('Home')
    setShowFilters(false)
    setLocationError(null)
    addRecent({ ...route, openedAt: Date.now() })
  }
  const toggleSaved = (route: Route) => setRoutes((current) => current.map((item) => item.id === route.id ? { ...item, saved: !item.saved } : item))
  const savedRoutes = routes.filter((route) => route.saved)
  const recentRoutes = [...routes].sort((a, b) => b.openedAt - a.openedAt).slice(0, 8)

  return (
    <main className="prototype-shell">
      <header className="prototype-header">
        <nav className="prototype-nav" aria-label="Primary navigation">
          {[
            { label: 'Home', icon: HomeIcon },
            { label: 'Routes', icon: MapIcon },
            { label: 'Profile', icon: UserRound },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className={activeTab === label ? 'nav-pill active' : 'nav-pill'} onClick={() => setActiveTab(label)} aria-current={activeTab === label ? 'page' : undefined}>
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        <button className="mobile-icon-button" aria-label="Open menu"><Menu /></button>
      </header>

      <aside className="prototype-sidebar">
        <section className="prototype-intro">
          <h1>Last Mile Navigator</h1>
          <p>{activeTab === 'Routes' ? 'Your saved and recent campus routes' : 'Find the best accessible routes across campus'}</p>
          <label className="prototype-search">
            <Menu aria-hidden="true" />
            <span className="sr-only">Search last mile navigator</span>
            <input placeholder="Search Last Mile Navigator" aria-label="Search Last Mile Navigator" />
            <Search aria-hidden="true" />
          </label>
        </section>
        {activeTab === 'Routes' ? (
          <section className="prototype-bottom-sheet routes-sheet" aria-label="Saved and recent routes">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading"><div><p className="section-label">ROUTE LIBRARY</p><h2>Your routes</h2></div></div>
            <div className="route-list-scroll">
              <h3 className="route-group-title">Saved <span>{savedRoutes.length}</span></h3>
              {savedRoutes.length ? savedRoutes.map((route) => <RouteCard key={`saved-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} />) : <p className="route-empty">Save a route from Home to find it here.</p>}
              <h3 className="route-group-title recent-title">Recent <span>{recentRoutes.length}</span></h3>
              {recentRoutes.length ? recentRoutes.map((route) => <RouteCard key={`recent-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} />) : <p className="route-empty">Routes you open will appear here.</p>}
            </div>
          </section>
        ) : (
          <section className="prototype-bottom-sheet" aria-label="Navigation summary">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading"><div><p className="section-label">NEAR YOU</p><h2>{activeRoute ? activeRoute.name : 'Explore UW Seattle'}</h2></div><button className="locate-button" onClick={() => triggerMap('locate')} aria-label="Locate me"><Crosshair /></button></div>
            <button className="route-preview" onClick={saveCurrentRoute}><span className="route-icon"><Navigation /></span><span><strong>{activeRoute ? 'Save another route' : 'Save current route'}</strong><small>{activeLayers.length + (accessibleOnly ? 1 : 0)} route filters · saved on this device</small></span><Heart aria-hidden="true" /></button>
          </section>
        )}
      </aside>

      <section className="prototype-map-section" aria-label="UW Seattle campus map">
        <CampusMap activeLayers={activeLayers} action={mapAction} onLocationError={setLocationError} route={activeRoute} />
        {locationError && <p className="location-status" role="status">{locationError}</p>}
        <div className="prototype-map-controls">
          <button className="filter-pill" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}><Filter aria-hidden="true" /> Filter{activeLayers.length > 0 ? ` · ${activeLayers.length}` : ''}</button>
          <button className={accessibleOnly ? 'accessibility-button selected' : 'accessibility-button'} onClick={() => setAccessibleOnly((current) => !current)} aria-pressed={accessibleOnly} aria-label="Toggle accessible routes"><Accessibility aria-hidden="true" /></button>
        </div>
        <div className="prototype-zoom-controls" aria-label="Map zoom controls"><button onClick={() => triggerMap('zoom-in')} aria-label="Zoom in">+</button><button onClick={() => triggerMap('zoom-out')} aria-label="Zoom out">−</button><button onClick={() => triggerMap('locate')} aria-label="Find my location"><Crosshair /></button></div>
      </section>

      {showFilters && <section className="prototype-filter-panel" aria-label="Map filters">
        <div className="filter-panel-heading"><div><p className="section-label">MAP FILTERS</p><h2>Show on map</h2></div><button className="close-filter" onClick={() => setShowFilters(false)} aria-label="Close filters"><X /></button></div>
        <p className="filter-help">Toggle layers to highlight accessibility details on the map.</p>
        {filters.map((filter) => <button key={filter.id} className={activeLayers.includes(filter.id) ? `filter-option active ${filter.tone}` : `filter-option ${filter.tone}`} onClick={() => toggleLayer(filter.id)} aria-pressed={activeLayers.includes(filter.id)}><span className={`filter-swatch ${filter.tone}`} />{filter.label}<span className={activeLayers.includes(filter.id) ? 'filter-check checked' : 'filter-check'} aria-hidden="true">{activeLayers.includes(filter.id) ? '✓' : ''}</span></button>)}
      </section>}
    </main>
  )
}

function RouteCard({ route, onOpen, onToggleSaved }: { route: Route; onOpen: (route: Route) => void; onToggleSaved: (route: Route) => void }) {
  const filterLabels = filters.filter((filter) => route.layers.includes(filter.id)).map((filter) => filter.label)
  if (route.accessibleOnly) filterLabels.unshift('Accessible only')
  return (
    <article className="route-card">
      <button className="route-card-open" onClick={() => onOpen(route)} aria-label={`Open ${route.name} on map`}>
        <span className="route-card-icon"><Navigation aria-hidden="true" /></span>
        <span className="route-card-copy"><strong>{route.name}</strong><small>{filterLabels.length ? filterLabels.join(' · ') : 'No extra filters'}</small></span>
      </button>
      <button className={route.saved ? 'route-favorite is-saved' : 'route-favorite'} onClick={() => onToggleSaved(route)} aria-label={route.saved ? `Remove ${route.name} from saved routes` : `Save ${route.name}`} aria-pressed={route.saved}><Heart aria-hidden="true" fill={route.saved ? 'currentColor' : 'none'} /></button>
    </article>
  )
}
