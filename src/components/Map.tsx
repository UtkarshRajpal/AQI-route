'use client'

import { useMemo, useRef, useEffect, useState} from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup , Tooltip, useMap} from 'react-leaflet'
import L from 'leaflet'

function MapRefSetter({ center, mapRef }: { center: [number, number], mapRef: any }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    map.setView(center, 13)
  }, [center, map, mapRef])
  return null
}


interface Route {
  id: string
  name: string
  aqi: number
  aqiLevel: string
  distance: number
  duration: string
  description: string
  coordinates?: Array<{ lat: number; lng: number }>
  // AQI samples at different points along the route (0%, 25%, 50%, 75%, 100% progress)
  aqiSamples?: Array<{ lat: number; lng: number; aqi: number; progress: number }>
}

interface MapProps {
  routes: Route[]
  startLocation?: { lat: number; lng: number; label?: string }
  endLocation?: { lat: number; lng: number; label?: string }
  selectedRouteId?: string
  onRouteSelect?: (routeId: string) => void
  onToggleFilter?: (routeId: string) => void
}

const getRouteColor = (aqi: number): string => {
  if (aqi <= 50) return '#10b981' // Green - Good
  if (aqi <= 100) return '#f59e0b' // Yellow - Moderate
  if (aqi <= 150) return '#f97316' // Orange - USG
  if (aqi <= 200) return '#ef4444' // Red - Unhealthy
  if (aqi <= 300) return '#8b5cf6' // Purple - Very Unhealthy
  return '#1f2937' // Dark gray - Hazardous
}

// Custom icons
// const createIcon = (color: string, label: string) => {
//   return L.divIcon({
//     html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${label}</div>`,
//     iconSize: [30, 30],
//     className: 'custom-div-icon',
//   })
// }

const createIcon = (color: string, label: string) => {
  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: 600;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        border: 2px solid rgba(255,255,255,0.9);
      ">
        <span style="
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateY(-0.5px);
        ">
          ${label}
        </span>
      </div>
    `,
    iconSize: [32, 32],
    className: 'custom-div-icon',
  })
}

const createPinIcon = (color: string) => {
  return L.divIcon({
    html: `
      <div style="width: 24px; height: 30px; position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="width: 16px; height: 16px; background: ${color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.25);"></div>
        <div style="position: absolute; bottom: 0; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${color};"></div>
      </div>
    `,
    iconSize: [24, 30],
    className: 'custom-div-icon',
    iconAnchor: [12, 30],
  })
}

export default function Map({
  routes,
  startLocation,
  endLocation,
  selectedRouteId,
  onRouteSelect,
  onToggleFilter,
}: MapProps) {
  // Calculate center
  const center = useMemo(() => {
    try {
      const allCoords = [
        ...(routes?.flatMap((r) => r.coordinates || []) || []),
        ...(startLocation ? [startLocation] : []),
        ...(endLocation ? [endLocation] : []),
      ]

      if (allCoords.length === 0) {
        return [40.7128, -74.006] as [number, number]
      }

      const lats = allCoords.map((c) => c.lat).filter((lat) => typeof lat === 'number' && !isNaN(lat))
      const lngs = allCoords.map((c) => c.lng).filter((lng) => typeof lng === 'number' && !isNaN(lng))
      
      if (lats.length === 0 || lngs.length === 0) {
        return [40.7128, -74.006] as [number, number]
      }

      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)

      return [(minLat + maxLat) / 2, (minLng + maxLng) / 2] as [number, number]
    } catch (error) {
      console.error('Error calculating map center:', error)
      return [40.7128, -74.006] as [number, number]
    }
  }, [routes, startLocation, endLocation])

  const mapRef = useRef<any>(null)
  const [hoveredSegment, setHoveredSegment] = useState<{ routeId: string; segmentIdx: number; aqi: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const getRouteLabel = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('direct')) return 'D'
    if (n.includes('south')) return 'S'
    if (n.includes('north')) return 'N'
    return name.charAt(0)
  }

  // Add this effect to recenter the map when center changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, 13) // 13 is the zoom level
    }
  }, [center])

  // Auto-focus on selected route
  useEffect(() => {
    if (mapRef.current && selectedRouteId) {
      const selectedRoute = routes.find(r => r.id === selectedRouteId)
      if (selectedRoute && selectedRoute.coordinates && selectedRoute.coordinates.length > 0) {
        // Calculate bounds from the route coordinates
        const lats = selectedRoute.coordinates.map(c => c.lat)
        const lngs = selectedRoute.coordinates.map(c => c.lng)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        
        // Fit map to bounds with padding
        const bounds = [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]]
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [selectedRouteId, routes])

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
      <MapRefSetter center={center} mapRef={mapRef} />
      
        {/* OpenStreetMap tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Routes - render segments with different colors based on AQI samples (like Google Maps traffic) */}
        {routes.map((route) => {
          if (!route.coordinates || route.coordinates.length < 2) return null
          const isSelected = selectedRouteId === route.id

          // Helper function to get AQI color for a specific progress point
          const getAQIForProgress = (progress: number): number => {
            if (!route.aqiSamples || route.aqiSamples.length === 0) return route.aqi
            
            // Find the nearest samples around this progress point
            const samples = route.aqiSamples.sort((a, b) => a.progress - b.progress)
            
            // Find the surrounding samples
            let before = samples[0]
            let after = samples[samples.length - 1]
            
            for (let i = 0; i < samples.length - 1; i++) {
              if (samples[i].progress <= progress && progress <= samples[i + 1].progress) {
                before = samples[i]
                after = samples[i + 1]
                break
              }
            }
            
            // Linear interpolation between the two nearest samples
            if (before.progress === after.progress) return before.aqi
            const ratio = (progress - before.progress) / (after.progress - before.progress)
            return Math.round(before.aqi + (after.aqi - before.aqi) * ratio)
          }

          // Create segments between consecutive coordinates, color-coded by AQI
          const segments = []
          for (let i = 0; i < route.coordinates.length - 1; i++) {
            const currentPoint = route.coordinates[i]
            const nextPoint = route.coordinates[i + 1]
            const progress = i / (route.coordinates.length - 1)
            const segmentAqi = getAQIForProgress(progress)
            segments.push({
              positions: [[currentPoint.lat, currentPoint.lng], [nextPoint.lat, nextPoint.lng]] as [number, number][],
              color: getRouteColor(segmentAqi),
              aqi: segmentAqi,
            })
          }

          return (
            <>
              {/* Render each segment with its own color based on AQI */}
              {segments.map((segment, segmentIdx) => (
                <Polyline
                  key={`${route.id}-segment-${segmentIdx}`}
                  positions={segment.positions}
                  pathOptions={{
                    color: segment.color,
                    weight: isSelected ? 5 : 3,
                    opacity: isSelected ? 1 : 0.7,
                  }}
                  eventHandlers={{
                    click: () => onRouteSelect?.(route.id),
                    mouseover: (e) => {
                      setHoveredSegment({ routeId: route.id, segmentIdx, aqi: segment.aqi })
                      // Increase weight on hover
                      e.target.setStyle({ weight: isSelected ? 6 : 4 })
                    },
                    mouseout: (e) => {
                      setHoveredSegment(null)
                      // Reset weight
                      e.target.setStyle({ weight: isSelected ? 5 : 3 })
                    },
                    mousemove: (e) => {
                      // Update tooltip position based on mouse position
                      if (mapRef.current && e.latlng) {
                        const containerPoint = mapRef.current.latLngToContainerPoint(e.latlng)
                        setTooltipPos({ x: containerPoint.x, y: containerPoint.y })
                      }
                    },
                  }}
                />
              ))}
              
              {/* Marker at the center of the route - click to filter */}
              <Marker
                position={[
                  route.coordinates[Math.floor(route.coordinates.length / 2)].lat,
                  route.coordinates[Math.floor(route.coordinates.length / 2)].lng,
                ]}

                icon={createIcon(getRouteColor(route.aqi), getRouteLabel(route.name))}
                eventHandlers={{
                  click: () => onToggleFilter?.(route.id),
                }}
              />
            </>
          )
        })}

        {/* Start Marker */}
        {startLocation && (
          // <Marker position={[startLocation.lat, startLocation.lng]} icon={createPinIcon('#3b82f6')}>
          //   <Popup>
          //     <div className="text-sm font-semibold">Start Location</div>
          //   </Popup>
          // </Marker>
          <Marker position={[startLocation.lat, startLocation.lng]} icon={createPinIcon('#3b82f6')}>
            <Tooltip direction="top" offset={[0, -20]} opacity={1}>
              {startLocation.label || 'Start Location'}
            </Tooltip>
            <Popup>
              <div className="text-sm font-semibold">Start Location</div>
            </Popup>
          </Marker>
        )}

        {/* End Marker */}
        {endLocation && (
          // <Marker position={[endLocation.lat, endLocation.lng]} icon={createPinIcon('#ec4899')}>
          //   <Popup>
          //     <div className="text-sm font-semibold">End Location</div>
          //   </Popup>
          // </Marker>
          <Marker position={[endLocation.lat, endLocation.lng]} icon={createPinIcon('#ec4899')}>
            <Tooltip direction="top" offset={[0, -20]} opacity={1}>
              {endLocation.label || 'End Location'}
            </Tooltip>
            <Popup>
              <div className="text-sm font-semibold">End Location</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {hoveredSegment && (
        <div
          className="absolute z-[500] bg-white border border-gray-300 rounded-md px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
            transform: 'translate(-50%, -100%)',
            whiteSpace: 'nowrap',
          }}
        >
          AQI: {hoveredSegment.aqi}
        </div>
      )}

      {/* Legend */}
      {routes.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-[400]">
          <div className="text-sm font-bold text-gray-900 mb-3">Route Information</div>
          <div className="space-y-2">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => onRouteSelect?.(route.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${
                  selectedRouteId === route.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: getRouteColor(route.aqi) }}
                  ></div>
                  <div className="flex-1">
                    <p className="font-semibold">{route.name}</p>
                    <p className="text-xs opacity-75">AQI: {route.aqi}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* AQI Legend */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-900 mb-2">AQI Scale</div>
            <div className="space-y-1 text-xs">
              {[
                { color: '#10b981', label: '0-50: Good' },
                { color: '#f59e0b', label: '51-100: Moderate' },
                { color: '#f97316', label: '101-150: USG' },
                { color: '#ef4444', label: '151-200: Unhealthy' },
                { color: '#8b5cf6', label: '201-300: V. Unhealthy' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
