# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.5.x   | Yes                |
| 0.4.x   | Security fixes only |
| < 0.4   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in CodeCortex, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email: **rushikeshmore271@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Impact assessment (what an attacker could do)

### Response Timeline

- **48 hours:** Acknowledgment of your report
- **7 days:** Assessment and fix plan communicated
- **30 days:** Fix released (or earlier for critical issues)

### What to Expect

1. We will acknowledge your report within 48 hours
2. We will investigate and determine the severity
3. We will develop and test a fix
4. We will release a patched version on npm
5. We will credit you in the release notes (unless you prefer anonymity)

### Scope

CodeCortex is a CLI tool and MCP server that reads and analyzes codebases. Security issues we care about include:

- **Command injection** via file paths or user input
- **Path traversal** outside the intended project directory
- **Information disclosure** of sensitive file contents
- **Dependency vulnerabilities** in production dependencies
- **MCP protocol abuse** that could affect connected AI agents

### Past Security Fixes

We take security seriously and fix issues promptly:

- **v0.4.4** (2026-03-08): Fixed command injection vulnerability in file discovery — replaced `execSync('cat')` with `readFileSync` to prevent shell metacharacter exploitation ([commit 128bba5](https://github.com/rushikeshmore/CodeCortex/commit/128bba5))

## Security Best Practices for Users

- Always run CodeCortex on **trusted codebases** — it reads and analyzes file contents
- Keep CodeCortex updated: `npm install -g codecortex-ai@latest`
- Use Node.js 20-22 (the supported and tested versions)
- Review `.codecortex/` output before committing to your repo if your codebase contains sensitive patterns
