# WattsWay

An intelligent trip planner for Tesla owners. Plan long-distance drives with optimized charging stops, real-time traffic data, and AI-powered assistance.

## Features

- **Route Planning** - Enter start and destination to generate optimized driving routes
- **Charging Stop Optimization** - Automatically finds Tesla Supercharger stops along your route based on your vehicle's range
- **Tesla Model Support** - Select your specific Tesla model for accurate range and consumption calculations
- **Battery Management** - Set your current charge level and see projected battery state at each stop
- **Real-Time Traffic** - Live traffic data integrated into route calculations
- **AI Assistant** - Ask questions about your trip with the built-in AI chat
- **Save Trips** - Save and revisit your planned trips
- **Unit Toggle** - Switch between miles/km and other unit preferences
- **Interactive Map** - Visual route display with charging stations using Leaflet

<!-- ## Screenshots

_Coming soon_ -->

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later
- API keys for [xAI](https://x.ai/), [TomTom](https://developer.tomtom.com/)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/wattswayapp/website.git
   cd website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your API keys in `.env.local`. See `.env.example` for the required variables.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start development server     |
| `npm run build` | Create production build      |
| `npm run start` | Start production server      |
| `npm run lint`  | Run ESLint                   |

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Maps:** Leaflet / React Leaflet
- **Routing API:** TomTom / OSRM
- **Geocoding:** TomTom / OpenStreetMap Nominatim
- **AI:** xAI
- **Icons:** Lucide React

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## Security

To report a security vulnerability, please see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
