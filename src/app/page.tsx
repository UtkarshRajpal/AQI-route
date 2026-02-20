'use client'

import { useState, useEffect } from 'react'
import RouteForm from '@/components/RouteForm'
import RouteResults from '@/components/RouteResults'
import Map from '@/components/Map'

interface Route {
  id: string
  name: string
  aqi: number
  aqiLevel: string
  distance: number
  duration: string
  description: string
  color: string
  coordinates?: Array<{ lat: number; lng: number }>
}

export default function Home() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | undefined>()
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | undefined>()
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  // Get user's current location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
          setLocationLoading(false)
          console.log(`User location: ${latitude}, ${longitude}`)
        },
        (error) => {
          console.error('Error getting location:', error)
          setLocationLoading(false)
        }
      )
    } else {
      console.log('Geolocation not supported')
      setLocationLoading(false)
    }
  }, [])

  const handleSearch = async (
    startPoint: string,
    endPoint: string,
    startLocation?: { lat: number; lng: number },
    endLocation?: { lat: number; lng: number }
  ) => {
    setLoading(true)
    setError('')
    setStartCoords(startLocation)
    setEndCoords(endLocation)
    setSelectedRouteId('')
    
    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          start: startPoint, 
          end: endPoint,
          startCoords: startLocation,
          endCoords: endLocation
        }),
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else {
        setRoutes(data.routes || [])
        if (data.routes && data.routes.length > 0) {
          setSelectedRouteId(data.routes[0].id)
        }
      }
    } catch (err) {
      setError('Failed to fetch routes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-8 h-full">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🌍 AQI Route Planner
          </h1>
          <p className="text-lg text-gray-600">
            Find the healthiest air quality route from A to B
          </p>
        </header>

        {/* Main Layout: Form on left, Map on right */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel: Search Form and Results */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {locationLoading ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
                🔍 Getting your location...
              </div>
            ) : userLocation ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
                ✓ Location detected: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </div>
            ) : null}
            
            <RouteForm onSearch={handleSearch} loading={loading} userLocation={userLocation} />
            
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Routes List */}
            {routes.length > 0 && (
              <div className="overflow-y-auto">
                <RouteResults 
                  routes={routes} 
                  selectedRouteId={selectedRouteId}
                  onSelectRoute={setSelectedRouteId}
                />
              </div>
            )}

            {!loading && routes.length === 0 && !error && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-gray-600 text-sm">
                Enter starting and ending points to find the best routes
              </div>
            )}
          </div>

          {/* Right Panel: Map */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
            {routes.length > 0 ? (
              <Map
                routes={routes}
                startLocation={startCoords}
                endLocation={endCoords}
                selectedRouteId={selectedRouteId}
                onRouteSelect={setSelectedRouteId}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                  <p className="text-gray-600 text-lg">Map will appear here</p>
                  <p className="text-gray-500 text-sm mt-2">Search for routes to view them on the map</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
