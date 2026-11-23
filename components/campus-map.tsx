'use client'

import { useEffect, useRef, useState } from 'react'
import type L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  getMapSymbol,
  symbolBadgeHtml,
  type MapLayer,
  type MapSymbol,
  type MapSymbolId,
} from '@/lib/map-symbols'

import type {
  MapFeature,
} from '@/lib/supabase/map-features'

type MapAction = {
  type: 'zoom-in' | 'zoom-out' | 'locate'
  id: number
}

type Building = {
  name: string
  coordinates: [number, number]
}

type Route = {
  layers: MapLayer[]
  accessibleOnly: boolean
  start?: Building
  destination?: Building
  geometry?: [number, number][]
}

type CampusMapProps = {
  activeLayers: MapLayer[]
  action?: MapAction
  onLocationError?: (message: string | null) => void
  route?: Route | null
  destination?: Building | null
  mapFeatures: MapFeature[]
}

type FeatureLayer = MapLayer

export function CampusMap({
  activeLayers,
  action,
  onLocationError,
  route,
  destination,
  mapFeatures,
}: CampusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)

  const overlaysRef = useRef<Record<FeatureLayer, L.LayerGroup>>({
    'no-go': null as unknown as L.LayerGroup,
    'lime-parking': null as unknown as L.LayerGroup,
    terrain: null as unknown as L.LayerGroup,
    parking: null as unknown as L.LayerGroup,
  })

  const locationMarkerRef = useRef<L.CircleMarker | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const destinationMarkerRef = useRef<L.Marker | null>(null)
  const locationWatchRef = useRef<number | null>(null)
  const onLocationErrorRef = useRef(onLocationError)

  const [mapReady, setMapReady] = useState(false)

  onLocationErrorRef.current = onLocationError

  // Convert GeoJSON [longitude, latitude] to Leaflet [latitude, longitude].
  const toLeafletCoordinates = (
    coordinates: [number, number],
  ): [number, number] => [
    coordinates[1],
    coordinates[0],
  ]

  const getFeatureLayer = (feature: MapFeature): FeatureLayer => {
    if (feature.feature_type === 'restricted_area') {
      return 'no-go'
    }

    if (
      feature.feature_type === 'stairs' ||
      feature.feature_type === 'slope'
    ) {
      return 'terrain'
    }

    if (feature.feature_type === 'parking') {
      return feature.metadata?.parking_type === 'lime'
        ? 'lime-parking'
        : 'parking'
    }

    // Other feature types are not currently displayed in a layer.
    return 'parking'
  }

  const getFeatureSymbol = (feature: MapFeature): MapSymbolId => {
    if (feature.feature_type === 'restricted_area') {
      return 'no-go'
    }

    if (feature.feature_type === 'stairs') {
      return 'stairs'
    }

    if (feature.feature_type === 'slope') {
      return 'slope'
    }

    if (feature.metadata?.parking_type === 'lime') {
      return 'lime-parking'
    }

    return 'parking'
  }

  const getFeatureTooltip = (feature: MapFeature) => {
    return feature.description
      ? `${feature.name} · ${feature.description}`
      : feature.name
  }

  // Create the Leaflet map and its base tile layer.
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return

    let map: L.Map | null = null
    let cancelled = false

    const initialize = async () => {
      const L = (await import('leaflet')).default

      if (cancelled || !mapRef.current) return

      map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([47.6553, -122.3035], 16)

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        },
      ).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      leafletModuleRef.current = L
      leafletRef.current = map

      setMapReady(true)
    }

    initialize()

    return () => {
      cancelled = true

      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current)
      }

      locationWatchRef.current = null
      map?.remove()

      leafletRef.current = null
      leafletModuleRef.current = null
      locationMarkerRef.current = null
      routeLayerRef.current = null
      destinationMarkerRef.current = null
      setMapReady(false)
    }
  }, [])

  // Create the marker icon using the existing map-symbols definitions.
  const createSymbolMarker = (
    L: typeof import('leaflet'),
    position: L.LatLngExpression,
    symbol: MapSymbol,
    tooltip: string,
  ) => {
    return L.marker(position, {
      icon: L.divIcon({
        className: 'map-symbol-icon',
        html: symbolBadgeHtml(symbol),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      keyboard: false,
      alt: symbol.label,
    }).bindTooltip(tooltip, { sticky: true })
  }

  // Build all accessibility feature layers from the Supabase records.
  useEffect(() => {
    const map = leafletRef.current
    const L = leafletModuleRef.current

    if (!mapReady || !map || !L) return

    const areaStyle = (symbol: MapSymbol, fillOpacity: number) => ({
      color: symbol.color,
      fillColor: symbol.fill,
      fillOpacity,
      weight: 2,
    })

    const layerGroups: Record<FeatureLayer, L.LayerGroup> = {
      'no-go': L.layerGroup(),
      'lime-parking': L.layerGroup(),
      terrain: L.layerGroup(),
      parking: L.layerGroup(),
    }

    mapFeatures.forEach((feature) => {
      const layerName = getFeatureLayer(feature)
      const symbol = getMapSymbol(getFeatureSymbol(feature))
      const tooltip = getFeatureTooltip(feature)
      const group = layerGroups[layerName]
      const geometry = feature.geometry

      if (geometry.type === 'Point') {
        const position = toLeafletCoordinates(geometry.coordinates)

        // The first Lime no-go feature is stored as a point with
        // a radius in its metadata, so render it as a circle.
        if (
          feature.feature_type === 'restricted_area' &&
          feature.metadata?.shape === 'circle'
        ) {
          const radius = Number(feature.metadata.radius_meters ?? 140)

          L.circle(position, {
            radius,
            ...areaStyle(symbol, 0.55),
          })
            .bindTooltip(tooltip, { sticky: true })
            .addTo(group)
        }

        createSymbolMarker(L, position, symbol, tooltip).addTo(group)
      }

      if (geometry.type === 'LineString') {
        const positions = geometry.coordinates.map(toLeafletCoordinates)

        L.polyline(positions, {
          color: symbol.color,
          weight: 7,
          opacity: 0.85,
        })
          .bindTooltip(tooltip, { sticky: true })
          .addTo(group)

        // Add a symbol marker at the approximate midpoint of the line.
        if (positions.length > 0) {
          const middle = positions[Math.floor(positions.length / 2)]
          createSymbolMarker(L, middle, symbol, tooltip).addTo(group)
        }
      }

      if (geometry.type === 'Polygon') {
        const outerRing = geometry.coordinates[0]

        if (!outerRing?.length) return

        const positions = outerRing.map(toLeafletCoordinates)

        const polygon = L.polygon(
          positions,
          areaStyle(
            symbol,
            feature.feature_type === 'restricted_area' ? 0.65 : 0.7,
          ),
        )
          .bindTooltip(tooltip, { sticky: true })
          .addTo(group)

        createSymbolMarker(
          L,
          polygon.getBounds().getCenter(),
          symbol,
          tooltip,
        ).addTo(group)
      }
    })

    // Replace the old overlays with the newly created database-driven ones.
    Object.values(overlaysRef.current).forEach((layer) => {
      layer?.removeFrom(map)
    })

    overlaysRef.current = layerGroups

    // Only display layers the user has selected.
    Object.entries(layerGroups).forEach(([key, layer]) => {
      if (activeLayers.includes(key as MapLayer)) {
        layer.addTo(map)
      }
    })
  }, [mapReady, mapFeatures, activeLayers])

  // Display the selected destination.
  useEffect(() => {
    const map = leafletRef.current
    const L = leafletModuleRef.current

    if (!mapReady || !map || !L) return

    destinationMarkerRef.current?.removeFrom(map)
    destinationMarkerRef.current = null

    if (destination) {
      map.flyTo(
        destination.coordinates,
        Math.max(map.getZoom(), 17),
        { duration: 0.8 },
      )

      destinationMarkerRef.current = L.marker(
        destination.coordinates,
      )
        .addTo(map)
        .bindTooltip(destination.name, {
          permanent: true,
          direction: 'top',
        })

      destinationMarkerRef.current.openTooltip()
    }
  }, [mapReady, destination])

  // Display the selected route.
  useEffect(() => {
    const map = leafletRef.current
    const L = leafletModuleRef.current

    if (!mapReady || !map || !L) return

    routeLayerRef.current?.removeFrom(map)
    routeLayerRef.current = null

    if (route?.geometry?.length && route.start && route.destination) {
      const start = route.start.coordinates
      const routeDestination = route.destination.coordinates

      routeLayerRef.current = L.layerGroup([
        L.polyline(route.geometry, {
          color: '#315f8a',
          weight: 6,
          opacity: 0.95,
          dashArray: '10 8',
          lineCap: 'round',
        }).bindTooltip(
          'Walking route on mapped pedestrian paths',
          { sticky: true },
        ),

        L.circleMarker(start, {
          radius: 7,
          color: '#fff',
          weight: 3,
          fillColor: '#2e7d43',
          fillOpacity: 1,
        }).bindTooltip(`Start: ${route.start.name}`),

        L.circleMarker(routeDestination, {
          radius: 7,
          color: '#fff',
          weight: 3,
          fillColor: '#315f8a',
          fillOpacity: 1,
        }).bindTooltip(`Destination: ${route.destination.name}`),
      ]).addTo(map)

      map.fitBounds(
        L.latLngBounds(route.geometry).pad(0.22),
        { maxZoom: 17 },
      )
    }
  }, [mapReady, route])

  // Handle zoom and current-location controls.
  useEffect(() => {
    const map = leafletRef.current

    if (!mapReady || !map || !action) return

    if (action.type === 'zoom-in') {
      map.zoomIn()
    }

    if (action.type === 'zoom-out') {
      map.zoomOut()
    }

    if (action.type === 'locate') {
      if (!navigator.geolocation) {
        onLocationErrorRef.current?.(
          'Location is not available in this browser.',
        )
        return
      }

      onLocationErrorRef.current?.(null)

      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current)
      }

      let isFirstPosition = true

      locationWatchRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          onLocationErrorRef.current?.(null)

          const position: L.LatLngExpression = [
            coords.latitude,
            coords.longitude,
          ]

          if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng(position)
          } else {
            locationMarkerRef.current =
              leafletModuleRef.current?.circleMarker(position, {
                radius: 9,
                color: '#ffffff',
                weight: 3,
                fillColor: '#1178b5',
                fillOpacity: 1,
              }) ?? null

            locationMarkerRef.current
              ?.bindTooltip('Your current location')
              .addTo(map)
          }

          if (isFirstPosition) {
            map.setView(position, Math.max(map.getZoom(), 17))
            isFirstPosition = false
          }
        },
        (error) => {
          const message =
            error.code === error.PERMISSION_DENIED
              ? 'Allow location access in your browser to show your position.'
              : error.code === error.TIMEOUT
                ? 'Could not get your location yet. Please try again.'
                : 'Your location is unavailable right now.'

          onLocationErrorRef.current?.(message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        },
      )
    }
  }, [mapReady, action])

  return (
    <div
      ref={mapRef}
      className="campus-map"
      aria-label="Interactive map of the University of Washington Seattle campus"
      role="application"
    />
  )
}