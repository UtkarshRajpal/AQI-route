# 🌍 AQI Route Planner

A web application that helps users find the healthiest air quality routes from point A to point B. Compare multiple routes and choose the one with the best Air Quality Index (AQI) level.

## Features

- 🗺️ **Multiple Route Options**: Get multiple route suggestions between two points
- 📊 **Real-time AQI Data**: Integrated with WAQI (World Air Quality Index) API
- 🎯 **Sorted by Air Quality**: Routes automatically ranked by AQI level (lower is better)
- 🎨 **Visual AQI Levels**: Color-coded routes based on air quality:
  - 🟢 **Good** (AQI 0-50)
  - 🟡 **Moderate** (AQI 51-100)
  - 🟠 **Unhealthy for Sensitive Groups** (AQI 101-150)
  - 🔴 **Unhealthy** (AQI 151-200)
  - 🟣 **Very Unhealthy** (AQI 201-300)
  - ⚫ **Hazardous** (AQI 301+)

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **APIs**:
  - WAQI (World Air Quality Index) - Free API for AQI data
  - Google Maps Routes API (ready for integration)
- **Styling**: Tailwind CSS with custom components
- **Package Manager**: npm

## Prerequisites

- **Node.js**: 18.17.0 or higher (recommended: 20.9.0+)
- **npm**: 8.0 or higher
- **Internet Connection**: Required for API calls to WAQI

**Note**: This project currently uses Node v16.15.0. For best compatibility, upgrade to Node v20+:

```bash
# Download from https://nodejs.org/ or use a version manager like nvm-windows
```

## Project Structure

```
aqi-test/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── route.ts          # API endpoint for route data
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   └── globals.css                # Global styles
│   └── components/
│       ├── RouteForm.tsx              # Search form component
│       └── RouteResults.tsx           # Results display component
├── public/                            # Static assets
├── package.json                       # Project dependencies
├── tsconfig.json                      # TypeScript configuration
├── tailwind.config.ts                 # Tailwind CSS config
├── postcss.config.js                  # PostCSS config
├── next.config.js                     # Next.js configuration
└── .eslintrc.json                     # ESLint configuration
```

## Getting Started

### 1. Install Dependencies

```bash
cd aqi-test
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 3. Use the Application

1. Open your browser and go to `http://localhost:3000`
2. Enter a starting point (e.g., "Central Park, NYC")
3. Enter an ending point (e.g., "Times Square, NYC")
4. Click "Find Routes"
5. View the routes sorted by air quality (best AQI first)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run lint` - Run ESLint

## API Integration

### Routes API Endpoint

**POST** `/api/routes`

Request:

```json
{
  "start": "Starting Location",
  "end": "Ending Location"
}
```

Response:

```json
{
  "routes": [
    {
      "id": "1",
      "name": "Route Name",
      "distance": 45.2,
      "duration": "45 mins",
      "aqi": 68,
      "aqiLevel": "Moderate",
      "description": "Route description",
      "color": "yellow"
    }
  ]
}
```

## Future Enhancements

- [ ] Integrate Google Maps API for real route data
- [ ] Add map visualization with route overlays
- [ ] Include historical AQI trends for routes
- [ ] User accounts and saved routes
- [ ] Mobile app version
- [ ] Real-time route updates
- [ ] Route comparison tools
- [ ] Share route links
- [ ] Export route data

## Environment Variables

Currently, the app uses WAQI's demo token. For production:

```bash
# .env.local
NEXT_PUBLIC_WAQI_TOKEN=your_waqi_api_token
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

Get your free WAQI token: https://waqi.info/api/

## Troubleshooting

### Build Issues

If you encounter issues during build, try:

```bash
rm -rf .next node_modules
npm install
npm run build
```

### AQI API Not Working

- Check your internet connection
- Verify WAQI API is accessible: https://api.waqi.info/
- The app has fallback mock data if the API fails

### Node Version Error

If you see "Unsupported engine" warnings:

```bash
# Upgrade Node.js to v20+
# https://nodejs.org/

# Or skip engine checks (not recommended):
npm install --force
```

## License

MIT License - feel free to use this project for your own purposes

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Make your improvements
4. Submit a pull request

## Support

For issues, questions, or suggestions, please create an issue in the repository.

---

Built with ❤️ for cleaner air and healthier journeys
