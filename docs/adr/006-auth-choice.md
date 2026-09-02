# ADR-006: Authentication with JWT and bcrypt

## Status

Accepted

## Context

The Staff Shift Scheduler needs authentication to protect write endpoints
(create, update, delete). Without auth, anyone with network access can
modify employees, shifts, and skills — data that directly affects the
solver's output.

The project is a learning repository (see AGENTS.md), so the auth system
must be:
- Simple enough to explain in one sitting
- Correct enough to be portfolio-grade
- Standard enough to transfer to real projects

## Decision

We chose **JWT (JSON Web Tokens) with bcrypt password hashing**:

- **JWT** for stateless authentication: the server signs a token with a
  secret; the client sends it on every request; the server verifies the
  signature without looking up a session store.
- **bcrypt** for password hashing: a battle-tested algorithm with built-in
  salt rounds (we use 10 — the industry default).
- **Passport.js** as the authentication framework: the NestJS integration
  (`@nestjs/passport`) provides guards, strategies, and decorators.
- **Global guard** via `APP_GUARD`: every route is protected by default;
  only routes explicitly marked `@Public()` skip authentication.

## Alternatives Considered

### Session-based auth (server-side sessions)
- **Pros**: familiar from traditional web apps, easy to revoke
- **Cons**: requires a session store (Redis or database), adds state to
  the API, complicates horizontal scaling
- **Why rejected**: JWT's statelessness is simpler for a single-instance
  API; session storage adds operational complexity with no benefit here

### OAuth2 / OpenID Connect
- **Pros**: industry standard for third-party auth, delegates password
  management
- **Cons**: requires an identity provider (Auth0, Keycloak, etc.), adds
  significant complexity, overkill for a learning project
- **Why rejected**: the learning goal is to understand auth fundamentals,
  not to integrate a third-party service

### Argon2 for password hashing
- **Pros**: newer, stronger than bcrypt (won the Password Hashing
  Competition)
- **Cons**: requires native binaries (C compilation), install issues on
  some platforms (Windows, some CI environments)
- **Why rejected**: bcrypt's npm package is pure JS (no native builds),
  which avoids platform-specific install issues. For a learning project,
  bcrypt's security is more than sufficient.

## Consequences

### Positive
- **Stateless**: no session store to manage, no sticky sessions needed
- **Standard**: JWT is the most common auth pattern in REST APIs
- **Secure by default**: the global guard means new endpoints are
  protected automatically; forgetting `@Public()` on a read endpoint is
  a minor inconvenience, not a security hole
- **Portable**: the same JWT pattern works with any frontend (React,
  mobile, CLI)

### Negative
- **Token revocation**: JWTs can't be revoked before expiry (24h in our
  case). For a production system, a token blacklist or short-lived tokens
  with refresh tokens would be needed.
- **Secret management**: the JWT_SECRET must be kept secure in production;
  committing it to version control would compromise all tokens.
- **No refresh tokens**: the current implementation issues long-lived
  tokens (24h). A production system would use short-lived access tokens
  (15min) with refresh tokens for renewal.

## Technical Details

- **Token payload**: `{ sub: userId, email, name }` — the minimum needed
  to identify the user without a database lookup
- **Token expiry**: 24 hours — long enough for a development session,
  short enough to limit exposure
- **Password requirements**: minimum 8 characters (enforced by the shared
  zod contract)
- **Guard behavior**: `JwtAuthGuard` extends Passport's `AuthGuard('jwt')`
  and checks for `@Public()` metadata before running JWT validation

## Related

- `apps/api/src/auth/` — the auth module implementation
- `packages/contracts/src/index.ts` — `registerSchema`, `loginSchema`,
  `authResponseSchema`
- `apps/api/prisma/schema.prisma` — `User` model
