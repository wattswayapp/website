# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in WattsWay, please report it responsibly. **Do not open a public GitHub issue.**

Instead, please email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/wattswayapp/website/security/advisories/new).

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### What to expect

- We will acknowledge your report within 48 hours
- We will provide an estimated timeline for a fix
- We will notify you when the vulnerability has been addressed
- We will credit you in the release notes (unless you prefer to remain anonymous)

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |

## Best Practices for Contributors

- Never commit API keys, tokens, or credentials to the repository
- Use `.env.local` for local secrets (it is git-ignored)
- Reference `.env.example` for required environment variables
