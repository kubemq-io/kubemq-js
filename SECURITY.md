# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in kubemq-js, please report it
responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security@kubemq.io with details
3. Include steps to reproduce, if possible
4. We will acknowledge receipt within 48 hours

## Supported Versions

| Version | Supported        |
| ------- | ---------------- |
| 3.x     | ✅ Active        |
| 2.x     | ⚠️ Security only |
| < 2.0   | ❌ End of life   |

## Dependency Policy

- Production dependencies are scanned weekly via Dependabot
- `npm audit` runs on every CI build
- No release ships with known critical vulnerabilities in production dependencies
- SBOM (Software Bill of Materials) is generated for each release
