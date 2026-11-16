export type MapLayer = 'no-go' | 'lime-parking' | 'terrain' | 'parking'

export type MapSymbolId = 'no-go' | 'lime-parking' | 'stairs' | 'slope' | 'parking'

export type MapSymbol = {
  id: MapSymbolId
  layer: MapLayer
  label: string
  detail: string
  color: string
  fill: string
  kind: 'area' | 'point' | 'line'
  icon: string
}

export const mapSymbols: MapSymbol[] = [
  { id: 'no-go', layer: 'no-go', label: 'Lime no-go zone', detail: "Bikes and scooters won't work or park", color: '#b42318', fill: '#fecdca', kind: 'area', icon: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>' },
  { id: 'lime-parking', layer: 'lime-parking', label: 'Lime parking area', detail: 'Park bikes and scooters here', color: '#1f7a3a', fill: '#bbf7d0', kind: 'area', icon: '<path d="M9 18V6h4.5a3.5 3.5 0 0 1 0 7H9"/>' },
  { id: 'stairs', layer: 'terrain', label: 'Stairs', detail: 'Steps along the path', color: '#b54708', fill: '#fedf89', kind: 'point', icon: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>' },
  { id: 'slope', layer: 'terrain', label: 'Steep slope', detail: 'Incline of 8% or more', color: '#b54708', fill: '#fedf89', kind: 'line', icon: '<path d="M8 4l4 8 4-4 5 12H3z"/>' },
  { id: 'parking', layer: 'parking', label: 'Car parking', detail: 'Parking lot or spaces', color: '#075985', fill: '#bae6fd', kind: 'point', icon: '<path d="M5 17H3v-5l2.2-5h13.6L21 12v5h-2"/><path d="M3 12h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>' },
]

export const getMapSymbol = (id: MapSymbolId) => mapSymbols.find((symbol) => symbol.id === id) as MapSymbol

export function symbolBadgeHtml(symbol: MapSymbol) {
  return `<span class="map-symbol" style="--symbol-color:${symbol.color}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${symbol.icon}</svg></span>`
}
