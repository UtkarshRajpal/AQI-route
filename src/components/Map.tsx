'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

interface Route {
  id: string
  name: string
  aqi: number
  aqiLevel: string
  distance: number
  duration: string
  description: string
  coordinates?: Array<{ lat: number; lng: number }>
}

interface MapProps {
  routes: Route[]
  startLocation?: { lat: number; lng: number; label?: string }
  endLocation?: { lat: number; lng: number; label?: string }
  selectedRouteId?: string
  onRouteSelect?: (routeId: string) => void
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
const createIcon = (color: string, label: string) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${label.charAt(0)}</div>`,
    iconSize: [30, 30],
    className: 'leaflet-div-icon',
  })
}

export default function Map({
  routes,
  startLocation,
  endLocation,
  selectedRouteId,
  onRouteSelect,
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

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Routes */}
        {routes.map((route) => {
          if (!route.coordinates || route.coordinates.length === 0) return null
          const isSelected = selectedRouteId === route.id
          const pathCoords = route.coordinates.map((c) => [c.lat, c.lng]) as [number, number][]

          return (
            <Polyline
              key={route.id}
              positions={pathCoords}
              pathOptions={{
                color: getRouteColor(route.aqi),
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 1 : 0.7,
              }}
              eventHandlers={{
                click: () => onRouteSelect?.(route.id),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{route.name}</p>
                  <p className="text-xs text-gray-600">{route.description}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="font-semibold">AQI:</span> {route.aqi}
                    </div>
                    <div>
                      <span className="font-semibold">Distance:</span> {route.distance.toFixed(1)} km
                    </div>
                    <div>
                      <span className="font-semibold">Time:</span> {route.duration}
                    </div>
                  </div>
                </div>
              </Popup>
            </Polyline>
          )
        })}

        {/* Start Marker */}
        {startLocation && (
          <Marker position={[startLocation.lat, startLocation.lng]} icon={createIcon('#3b82f6', 'S')}>
            <Popup>
              <div className="text-sm font-semibold">Start Location</div>
            </Popup>
          </Marker>
        )}

        {/* End Marker */}
        {endLocation && (
          <Marker position={[endLocation.lat, endLocation.lng]} icon={createIcon('#ef4444', 'E')}>
            <Popup>
              <div className="text-sm font-semibold">End Location</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

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
