'use client'

interface Route {
  id: string
  name: string
  aqi: number
  aqiLevel: string
  distance: number
  duration: string
  description: string
  color: string
  aqiSamples?: Array<{
    lat: number
    lng: number
    aqi: number
    progress: number
  }>
}

interface RouteResultsProps {
  routes: Route[]
  selectedRouteId?: string
  onSelectRoute?: (routeId: string) => void
}

export default function RouteResults({ routes, selectedRouteId, onSelectRoute }: RouteResultsProps) {
  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-green-100 text-green-800 border-green-300'
    if (aqi <= 100) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (aqi <= 150) return 'bg-orange-100 text-orange-800 border-orange-300'
    if (aqi <= 200) return 'bg-red-100 text-red-800 border-red-300'
    if (aqi <= 300) return 'bg-purple-100 text-purple-800 border-purple-300'
    return 'bg-gray-900 text-white border-gray-900'
  }

  const getAQIDescription = (level: string) => {
    const descriptions: Record<string, string> = {
      'Good': '👍 Air quality is satisfactory',
      'Moderate': '⚠️ Acceptable for most; sensitive groups may experience issues',
      'USG': '😷 Sensitive groups may experience health effects',
      'Unhealthy': '🚨 Everyone may start experiencing health effects',
      'Very Unhealthy': '💀 Health alert: serious effects for general population',
      'Hazardous': '⚠️ Health warning of emergency conditions',
    }
    return descriptions[level] || level
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Best Routes</h2>
      <p className="text-xs text-gray-600">
        Found {routes.length} route{routes.length !== 1 ? 's' : ''} - sorted by air quality
      </p>

      {routes.map((route, idx) => (
        <div
          key={route.id}
          onClick={() => onSelectRoute?.(route.id)}
          className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 ${
            selectedRouteId === route.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Route {idx + 1}: {route.name}
                </h3>
                <p className="text-xs text-gray-600 mt-1">{route.description}</p>
              </div>
              <div className="text-right">
                <div className={`px-2 py-1 rounded-full border text-xs font-semibold ${getAQIColor(route.aqi)}`}>
                  AQI: {route.aqi}
                </div>
                <p className="text-xs text-gray-500 mt-1">{route.aqiLevel}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded p-3 mb-3">
              <p className="text-xs text-gray-700">
                {getAQIDescription(route.aqiLevel)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Distance</p>
                <p className="text-sm font-semibold text-gray-900">{route.distance.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Duration</p>
                <p className="text-sm font-semibold text-gray-900">{route.duration}</p>
              </div>
            </div>

            {route.aqiSamples && route.aqiSamples.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">AQI Along Path</p>
                <div className="space-y-1">
                  {route.aqiSamples.map((sample, sIdx) => {
                    const progressPercent = Math.round(sample.progress * 100)
                    let sampleColor = 'bg-gray-100'
                    if (sample.aqi > 0) {
                      if (sample.aqi <= 50) sampleColor = 'bg-green-100'
                      else if (sample.aqi <= 100) sampleColor = 'bg-yellow-100'
                      else if (sample.aqi <= 150) sampleColor = 'bg-orange-100'
                      else if (sample.aqi <= 200) sampleColor = 'bg-red-100'
                      else if (sample.aqi <= 300) sampleColor = 'bg-purple-100'
                      else sampleColor = 'bg-gray-800'
                    }
                    return (
                      <div key={sIdx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{progressPercent}% of journey</span>
                        <div className={`px-2 py-1 rounded ${sampleColor} font-semibold`}>
                          {sample.aqi > 0 ? `AQI ${sample.aqi}` : 'No Data'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
