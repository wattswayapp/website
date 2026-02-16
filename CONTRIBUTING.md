# Contributing to WattsWay

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/wattswayapp/website.git
   cd website
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Then fill in your own API keys in `.env.local`:
   - **XAI_API_KEY** - Get one at [xAI](https://x.ai/)
   - **NEXT_PUBLIC_TOMTOM_API_KEY** / **TOMTOM_API_KEY** - Get one at [TomTom Developer Portal](https://developer.tomtom.com/)

5. **Start the dev server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
   Use prefixes like `feat/`, `fix/`, `docs/`, or `refactor/`.

2. Make your changes and ensure they pass linting:
   ```bash
   npm run lint
   ```

3. Test that the project builds:
   ```bash
   npm run build
   ```

4. Commit with a clear message describing what changed and why.

## Pull Requests

- Open your PR against the `main` branch
- Provide a clear title and description of what the PR does
- Link any related issues
- Keep PRs focused - one feature or fix per PR

## Code Style

- TypeScript is used throughout the project
- Follow the existing ESLint configuration
- Use Tailwind CSS for styling
- Keep components focused and reasonably sized

## Reporting Bugs

Open an issue on GitHub with:
- A clear title and description
- Steps to reproduce the bug
- Expected vs actual behavior
- Browser and OS information if relevant

## Security Issues

Please do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.
