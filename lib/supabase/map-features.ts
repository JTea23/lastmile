import { getSupabaseClient } from './client'

export type GeoJSONPoint = {
  type: 'Point'
  coordinates: [number, number]
}

export type GeoJSONLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export type MapFeatureGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon

export type MapFeature = {
  id: string
  name: string
  description: string | null
  feature_type: string
  source: string
  metadata: Record<string, unknown> | null
  geometry: MapFeatureGeometry
  created_at?: string
  updated_at?: string
}

export async function getMapFeatures(): Promise<MapFeature[]> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.warn('Map features are unavailable because Supabase is not configured.')
    return []
  }

  const { data, error } = await supabase
    .from('map_features_geojson')
    .select('*')

  if (error) {
    console.error('Error fetching map features:', error)
    throw error
  }

  return (data ?? []) as MapFeature[]
}
