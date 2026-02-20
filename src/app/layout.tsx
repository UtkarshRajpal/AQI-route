import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AQI Route Planner",
  description: "Find the healthiest air quality route from A to B",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
