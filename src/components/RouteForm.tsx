'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

interface PlacePrediction {
  place_id: string | number
  description: string
  main_text: string
  secondary_text?: string
  lat?: number
  lng?: number
}

interface RouteFormProps {
  onSearch: (start: string, end: string, startCoords?: { lat: number; lng: number }, endCoords?: { lat: number; lng: number }) => void
  loading: boolean
  userLocation?: { lat: number; lng: number } | null
}

// Mock suggestions for backup - now with Hyderabad cities
const MOCK_LOCATIONS = [
  { main_text: 'Hyderabad', secondary_text: 'Telangana, India', lat: 17.3850, lng: 78.4867 },
  { main_text: 'Secunderabad', secondary_text: 'Telangana, India', lat: 17.3750, lng: 78.5000 },
  { main_text: 'Kukatpally', secondary_text: 'Hyderabad, India', lat: 17.4750, lng: 78.4500 },
  { main_text: 'Banjara Hills', secondary_text: 'Hyderabad, India', lat: 17.3800, lng: 78.4500 },
  { main_text: 'Whitefield', secondary_text: 'Bangalore, India', lat: 12.9698, lng: 77.7499 },
  { main_text: 'Indiranagar', secondary_text: 'Bangalore, India', lat: 12.9716, lng: 77.6412 },
]

export default function RouteForm({ onSearch, loading, userLocation }: RouteFormProps) {
  const [startPoint, setStartPoint] = useState('')
  const [endPoint, setEndPoint] = useState('')
  const [startSuggestions, setStartSuggestions] = useState<PlacePrediction[]>([])
  const [endSuggestions, setEndSuggestions] = useState<PlacePrediction[]>([])
  const [showStartSuggestions, setShowStartSuggestions] = useState(false)
  const [showEndSuggestions, setShowEndSuggestions] = useState(false)
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | undefined>()
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | undefined>()
  const [apiInitialized, setApiInitialized] = useState(false)
  const autocompleteServiceRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-set user location as starting point (only on first load)
  useEffect(() => {
    if (userLocation && startPoint === '') {
      setStartCoords(userLocation)
      setStartPoint(`My Location (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`)
    }
  }, [userLocation]) // Remove startCoords from dependency to prevent infinite loop

  // Initialize Google Places Services
  useEffect(() => {
    const initializeGooglePlaces = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      
      if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        console.log('Google Maps API key not configured - using mock suggestions')
        return
      }

      const loader = new Loader({
        apiKey,
        libraries: ['places'],
      })

      try {
        const google = await loader.load()
        if (google.maps) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
          geocoderRef.current = new google.maps.Geocoder()
          setApiInitialized(true)
        }
      } catch (err) {
        console.error('Failed to load Google Places API:', err)
      }
    }

    initializeGooglePlaces()
  }, [])

  const getMockPredictions = (input: string): PlacePrediction[] => {
    return MOCK_LOCATIONS
      .filter((loc) => 
        loc.main_text.toLowerCase().includes(input.toLowerCase()) ||
        loc.secondary_text.toLowerCase().includes(input.toLowerCase())
      )
      .map((loc) => ({
        place_id: loc.main_text.replace(/\s+/g, '_'),
        description: `${loc.main_text}, ${loc.secondary_text}`,
        main_text: loc.main_text,
        secondary_text: loc.secondary_text,
      }))
  }

  // Get real predictions from Nominatim API
  const getNominatimPredictions = async (input: string): Promise<PlacePrediction[]> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(input)}&limit=5`
      )
      if (!response.ok) {
        console.warn('Nominatim returned non-ok response', response.status)
        return []
      }
      const data = await response.json()
      
      if (data.length > 0) {
        return data.map((result: any) => ({
          place_id: result.osm_id,
          description: result.display_name,
          main_text: result.name || result.address.city || result.address.town || result.address.village || result.display_name,
          secondary_text: [result.address.state, result.address.country].filter(Boolean).join(', '),
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        }))
      }
    } catch (err) {
      console.error('Nominatim error:', err)
    }
    
    return []
  }

  const getPlacePredictions = async (input: string, isStart: boolean) => {
    if (!input || input.length < 2) {
      if (isStart) {
        setStartSuggestions([])
        setShowStartSuggestions(false)
      } else {
        setEndSuggestions([])
        setShowEndSuggestions(false)
      }
      return
    }

    // Try Nominatim API first for real-time results
    const realSuggestions = await getNominatimPredictions(input)
    
    if (realSuggestions.length > 0) {
      if (isStart) {
        setStartSuggestions(realSuggestions)
        setShowStartSuggestions(true)
      } else {
        setEndSuggestions(realSuggestions)
        setShowEndSuggestions(true)
      }
      return
    }

    // Fallback to mock suggestions if Nominatim fails
    const mockSuggestions = getMockPredictions(input)
    if (isStart) {
      setStartSuggestions(mockSuggestions)
      setShowStartSuggestions(mockSuggestions.length > 0)
    } else {
      setEndSuggestions(mockSuggestions)
      setShowEndSuggestions(mockSuggestions.length > 0)
    }
  }

  const getCoordinatesFromPlace = async (placeId: string | number, suggestion: PlacePrediction, isStart: boolean) => {
    // Check if coordinates are already in the suggestion (from Nominatim)
    if ('lat' in suggestion && 'lng' in suggestion) {
      const coords = { lat: (suggestion as any).lat, lng: (suggestion as any).lng }
      if (isStart) {
        setStartCoords(coords)
      } else {
        setEndCoords(coords)
      }
      return
    }

    // Check if it's a mock location
    const mockLoc = MOCK_LOCATIONS.find((loc) => loc.main_text.replace(/\s+/g, '_') === placeId)
    if (mockLoc) {
      const coords = { lat: mockLoc.lat, lng: mockLoc.lng }
      if (isStart) {
        setStartCoords(coords)
      } else {
        setEndCoords(coords)
      }
      return
    }

    // Use geocoder if available (Google Maps API)
    if (!geocoderRef.current) return

    try {
      const results = await geocoderRef.current.geocode({ placeId })
      if (results.results.length > 0) {
        const location = results.results[0].geometry.location
        const coords = { lat: location.lat(), lng: location.lng() }

        if (isStart) {
          setStartCoords(coords)
        } else {
          setEndCoords(coords)
        }
      }
    } catch (err) {
      console.error('Error geocoding:', err)
    }
  }

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setStartPoint(value)
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new debounce timer
    if (value) {
      debounceTimerRef.current = setTimeout(() => {
        getPlacePredictions(value, true)
      }, 300) // Wait 300ms after user stops typing
    } else {
      setStartSuggestions([])
    }
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEndPoint(value)
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new debounce timer
    if (value) {
      debounceTimerRef.current = setTimeout(() => {
        getPlacePredictions(value, false)
      }, 300) // Wait 300ms after user stops typing
    } else {
      setEndSuggestions([])
    }
  }

  const selectStartSuggestion = async (suggestion: PlacePrediction) => {
    setStartPoint(suggestion.description)
    setShowStartSuggestions(false)
    setStartSuggestions([])
    await getCoordinatesFromPlace(suggestion.place_id, suggestion, true)
  }

  const selectEndSuggestion = async (suggestion: PlacePrediction) => {
    setEndPoint(suggestion.description)
    setShowEndSuggestions(false)
    setEndSuggestions([])
    await getCoordinatesFromPlace(suggestion.place_id, suggestion, false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startPoint.trim() && endPoint.trim()) {
      onSearch(startPoint, endPoint, startCoords, endCoords)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Routes</h2>

      {/* API Key warning */}
      {!apiInitialized && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Find the route from <b>Start Location</b> to <b>End Location</b> with the best air quality, helping you avoid pollution and travel healthier!
        </div>
      )}

      <div className="space-y-4">
        {/* Starting Point */}
        <div className="relative">
          <label className="sr-only">Starting Point</label>
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold">S</span>
          </div>
          <input
            type="text"
            value={startPoint}
            onChange={handleStartChange}
            onFocus={() => startSuggestions.length > 0 && setShowStartSuggestions(true)}
            placeholder="Start location"
            className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={loading}
            autoComplete="off"
          />
          {showStartSuggestions && startSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {startSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => selectStartSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-medium text-gray-900">{suggestion.main_text}</p>
                  {suggestion.secondary_text && (
                    <p className="text-sm text-gray-600">{suggestion.secondary_text}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ending Point */}
        <div className="relative">
          <label className="sr-only">Ending Point</label>
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">E</span>
          </div>
          <input
            type="text"
            value={endPoint}
            onChange={handleEndChange}
            onFocus={() => endSuggestions.length > 0 && setShowEndSuggestions(true)}
            placeholder="End location"
            className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={loading}
            autoComplete="off"
          />
          {showEndSuggestions && endSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {endSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => selectEndSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-medium text-gray-900">{suggestion.main_text}</p>
                  {suggestion.secondary_text && (
                    <p className="text-sm text-gray-600">{suggestion.secondary_text}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !startPoint || !endPoint}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Finding Routes...' : 'Find Routes'}
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
        💡 Routes are ranked by Air Quality Index (AQI) - lower is better!
      </div>
    </form>
  )
}
