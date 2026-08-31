# Adding an AI Module

How to add a new AI-powered feature to Study RPG.

## Module Pattern

Every new AI module follows the same structure. Copy the `planner` module as a template:

```
backend/src/modules/<tool>/
  dto/
    <tool>.dto.ts        # request validation
  <tool>.module.ts       # NestJS module definition
  <tool>.controller.ts   # HTTP endpoints
  <tool>.service.ts      # business logic
  index.ts               # barrel export
  <tool>.spec.ts         # unit tests
```

Register in `backend/src/app.module.ts`.

## Rules

1. **Raw SQL only** — no ORM. Use the database module's pool.
2. **DTOs enforced** — global validation pipe rejects unknown fields.
3. **camelCase responses** — shared interceptor handles this.
4. **AI calls through the AI module** — don't roll your own HTTP to LLM endpoints.
5. **Secrets via ConfigService** — never hardcode keys. Add new vars to `.env.example`.
6. **Migrations** — new tables in `backend/migrations/NNN_name.sql` with unique prefix.

## Frontend Consumption

1. Add API methods to `frontend/src/services/`
2. Use TanStack Query for server state
3. Add i18n keys to **all** 15 locale files
4. Use buttons over clickable divs for accessibility

## Example: Adding a New AI Tool

```typescript
// <tool>.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ToolService {
  constructor(
    private db: DatabaseService,
    private ai: AiService,
  ) {}

  async process(input: string) {
    // 1. Call AI
    const result = await this.ai.complete([
      { role: 'user', content: input }
    ]);

    // 2. Store in Postgres (raw SQL)
    await this.db.query(
      'INSERT INTO tool_results (input, output) VALUES ($1, $2)',
      [input, result]
    );

    return { output: result };
  }
}
```

## Spec-First Development

New features are authored as specs before code:

```
specs/<NNN>-<name>/
  spec.md     # what and why
  plan.md     # how
  tasks.md    # checklist
```

Use the Spec Kit skills: `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`.
