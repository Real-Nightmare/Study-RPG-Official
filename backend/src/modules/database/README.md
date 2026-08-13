# Database Module

Infrastructure wrapper around the PostgreSQL `pg` pool. **Raw SQL only — no ORM.** All
feature modules query through this service.

- **Key service**: `DatabaseService`
- **Migrations**: `backend/migrations/` (`npm run migrate`)
