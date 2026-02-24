import { NextRequest, NextResponse } from 'next/server'

interface Route {
  id: string
  name: string
  waypoints: string[]
  distance: number
  duration: string
  description: string
  coordinates?: Array<{ lat: number; lng: number }>
  aqi?: number
  aqiLevel?: string
  color?: string
  aqiSamples?: Array<{
    lat: number
    lng: number
    aqi: number
    progress: number // 0 to 1, where 0 is start and 1 is end
  }>
}

// Get real coordinates from a location string using Nominatim
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        headers: { 'User-Agent': 'AQI-Route-Planner' },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`Nominatim returned status ${response.status}`)
      return null
    }
    
    const data = await response.json()
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error instanceof Error ? error.message : error)
  }
  return null
}

// Get real route coordinates using OSRM
async function getRealRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<{ coordinates: Array<{ lat: number; lng: number }>; distance: number; duration: number }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&overview=full`,
      { 
        headers: { 'User-Agent': 'AQI-Route-Planner' },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`OSRM returned status ${response.status}`)
      return generateFallbackRoute(start, end)
    }
    
    const data = await response.json()
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      const coords = route.geometry.coordinates
      return {
        coordinates: coords.map((c: [number, number]) => ({ lat: c[1], lng: c[0] })),
        distance: Math.round(route.distance / 1000), // Convert to km
        duration: Math.round(route.duration / 60) // Convert to minutes
      }
    }
  } catch (error) {
    console.error('OSRM routing error:', error instanceof Error ? error.message : error)
  }
  
  // Fallback to straight line
  return generateFallbackRoute(start, end)
}

// Get alternative route through a waypoint
async function getAlternativeRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  waypointLocation: string
): Promise<{ coordinates: Array<{ lat: number; lng: number }>; distance: number; duration: number }> {
  try {
    const waypoint = await geocodeLocation(waypointLocation)
    if (!waypoint) return getRealRoute(start, end)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${waypoint.lng},${waypoint.lat};${end.lng},${end.lat}?geometries=geojson&overview=full`,
      { 
        headers: { 'User-Agent': 'AQI-Route-Planner' },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`OSRM returned status ${response.status}`)
      return getRealRoute(start, end)
    }
    
    const data = await response.json()
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      const coords = route.geometry.coordinates
      return {
        coordinates: coords.map((c: [number, number]) => ({ lat: c[1], lng: c[0] })),
        distance: Math.round(route.distance / 1000),
        duration: Math.round(route.duration / 60)
      }
    }
  } catch (error) {
    console.error('Alternative route error:', error instanceof Error ? error.message : error)
  }
  
  return getRealRoute(start, end)
}

// Fallback route generation
function generateFallbackRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): { coordinates: Array<{ lat: number; lng: number }>; distance: number; duration: number } {
  const points = []
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps
    points.push({
      lat: start.lat + (end.lat - start.lat) * progress,
      lng: start.lng + (end.lng - start.lng) * progress
    })
  }
  
  // Rough estimate: assume average speed of 50 km/h on roads
  const latDist = Math.abs(end.lat - start.lat) * 111 // 1 degree latitude = 111 km
  const lngDist = Math.abs(end.lng - start.lng) * 111 * Math.cos((start.lat * Math.PI) / 180)
  const distance = Math.round(Math.sqrt(latDist * latDist + lngDist * lngDist))
  const duration = Math.round((distance / 50) * 60)
  
  return { coordinates: points, distance, duration }
}

// Get real AQI data from WAQI with proper timeout
async function getAQIForLocation(lat: number, lng: number): Promise<{ aqi: number; level: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lng}/?token=b8e1c4f01465876d631491959d117af0baf7029c`,
      { 
        headers: { 'User-Agent': 'AQI-Route-Planner' },
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`WAQI API returned status ${response.status}`)
      return { aqi: 0, level: 'No Data' }
    }
    
    const data = await response.json()
    console.log('WAQI Response:', data)
    
    if (data.status === 'ok' && data.data && typeof data.data.aqi === 'number') {
      return {
        aqi: data.data.aqi,
        level: getAQILevel(data.data.aqi)
      }
    }
  } catch (error) {
    console.error('WAQI fetch error:', error instanceof Error ? error.message : error)
  }
  
  return { aqi: 0, level: 'No Data' }
}

// Calculate average AQI for a route by sampling multiple points
async function getRouteAQI(coordinates: Array<{ lat: number; lng: number }>): Promise<{ averageAQI: number; samples: Array<{ lat: number; lng: number; aqi: number; progress: number }> }> {
  try {
    // Sample 5 points along the route (0%, 25%, 50%, 75%, 100%)
    const progressPoints = [0, 0.25, 0.5, 0.75, 1]
    const samplePoints = progressPoints.map(progress => {
      const index = Math.floor(progress * (coordinates.length - 1))
      return { point: coordinates[index], progress }
    })
    
    console.log('Sampling AQI from', samplePoints.length, 'points along the route')
    const aqiValues = await Promise.all(
      samplePoints.map(async ({ point, progress }) => {
        const aqiData = await getAQIForLocation(point.lat, point.lng)
        const displayProgress = Math.round(progress * 100)
        console.log(`AQI at ${displayProgress}% (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}): ${aqiData.aqi}`)
        return {
          lat: point.lat,
          lng: point.lng,
          aqi: aqiData.aqi,
          progress
        }
      })
    )
    
    // Filter out "No Data" values (aqi === 0)
    const validValues = aqiValues.filter(v => v.aqi > 0)
    
    if (validValues.length === 0) {
      console.log('No valid AQI data found, returning 0')
      return { averageAQI: 0, samples: aqiValues }
    }
    
    const averageAQI = Math.round(
      validValues.reduce((sum, data) => sum + data.aqi, 0) / validValues.length
    )
    
    console.log('Average AQI calculated:', averageAQI)
    return { averageAQI, samples: aqiValues }
  } catch (error) {
    console.error('Route AQI calculation error:', error)
    return { averageAQI: 0, samples: [] }
  }
}

function getAQILevel(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'USG'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

function getAQIColor(aqi: number): string {
  if (aqi === 0) return 'gray' // No data
  if (aqi <= 50) return 'green'
  if (aqi <= 100) return 'yellow'
  if (aqi <= 150) return 'orange'
  if (aqi <= 200) return 'red'
  if (aqi <= 300) return 'purple'
  return 'darkred'
}

async function getRoutesBetweenPoints(
  start: string,
  end: string,
  startCoords?: { lat: number; lng: number },
  endCoords?: { lat: number; lng: number }
) {
  // Use provided coordinates or geocode the location names
  let startLoc = startCoords
  let endLoc = endCoords
  
  if (!startLoc) {
    startLoc = await geocodeLocation(start) || undefined
  }
  if (!endLoc) {
    endLoc = await geocodeLocation(end) || undefined
  }
  
  // Fallback to NYC if geocoding fails
  if (!startLoc) startLoc = { lat: 40.7128, lng: -74.006 }
  if (!endLoc) endLoc = { lat: 40.758, lng: -73.9855 }

  // Get 3 real routes using OSRM
  // const [directRoute, northRoute, southRoute] = await Promise.all([
  //   getRealRoute(startLoc, endLoc),
  //   getAlternativeRoute(startLoc, endLoc, 'North via ' + (startLoc.lat + 0.02)),
  //   getAlternativeRoute(startLoc, endLoc, 'South via ' + (startLoc.lat - 0.02))
  // ])

  const northWaypoint = { lat: startLoc.lat + 0.02, lng: startLoc.lng }
  const southWaypoint = { lat: startLoc.lat - 0.02, lng: startLoc.lng }

  const [directRoute, northRoute, southRoute] = await Promise.all([
    getRealRoute(startLoc, endLoc),
    getAlternativeRoute(startLoc, endLoc, `${northWaypoint.lat},${northWaypoint.lng}`),
    getAlternativeRoute(startLoc, endLoc, `${southWaypoint.lat},${southWaypoint.lng}`)
  ])

  // Calculate AQI for each route
  const [directAQI, northAQI, southAQI] = await Promise.all([
    getRouteAQI(directRoute.coordinates),
    getRouteAQI(northRoute.coordinates),
    getRouteAQI(southRoute.coordinates)
  ])

  // Build route objects
  const routes: Route[] = [
    {
      id: '1',
      name: 'Direct Route',
      waypoints: [start, 'Direct', end],
      distance: directRoute.distance,
      duration: `${directRoute.duration} mins`,
      description: 'Fastest route',
      coordinates: directRoute.coordinates,
      aqi: directAQI.averageAQI,
      aqiLevel: getAQILevel(directAQI.averageAQI),
      color: getAQIColor(directAQI.averageAQI),
      aqiSamples: directAQI.samples
    },
    {
      id: '2',
      name: 'Northern Alternative',
      waypoints: [start, 'Northern Path', end],
      distance: northRoute.distance,
      duration: `${northRoute.duration} mins`,
      description: 'Northern alternative route',
      coordinates: northRoute.coordinates,
      aqi: northAQI.averageAQI,
      aqiLevel: getAQILevel(northAQI.averageAQI),
      color: getAQIColor(northAQI.averageAQI),
      aqiSamples: northAQI.samples
    },
    {
      id: '3',
      name: 'Southern Alternative',
      waypoints: [start, 'Southern Path', end],
      distance: southRoute.distance,
      duration: `${southRoute.duration} mins`,
      description: 'Southern alternative route',
      coordinates: southRoute.coordinates,
      aqi: southAQI.averageAQI,
      aqiLevel: getAQILevel(southAQI.averageAQI),
      color: getAQIColor(southAQI.averageAQI),
      aqiSamples: southAQI.samples
    }
  ]

  return routes
}


export async function POST(req: NextRequest) {
  try {
    const { start, end, startCoords, endCoords } = await req.json()
    console.log('Route request:', { start, end, startCoords, endCoords })

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start and end points are required' },
        { status: 400 }
      )
    }

    // Get real routes with real AQI data
    const routes = await getRoutesBetweenPoints(start, end, startCoords, endCoords)
    console.log('Routes retrieved:', routes.length)

    // Sort by AQI (best air quality first)
    routes.sort((a, b) => {
      // Routes with no data go to the end
      const aAqi = a.aqi || 0
      const bAqi = b.aqi || 0
      if (aAqi === 0 && bAqi === 0) return 0
      if (aAqi === 0) return 1
      if (bAqi === 0) return -1
      return aAqi - bAqi
    })

    console.log('Sorted routes:', routes.map(r => ({ name: r.name, aqi: r.aqi })))
    return NextResponse.json({
      routes
    })
  } catch (error) {
    console.error('Error in routes API:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
