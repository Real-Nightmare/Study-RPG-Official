# Planner Module

AI task planner — the **reference core-tool pattern** (`dto/` + service + controller +
module + `index.ts` barrel). New core-tool modules should mirror this module.

- **HTTP**: `@Controller('tasks')`
- **Key service**: `TasksService`
- **See**: [`docs/guides/connector-guide.md`](../../../docs/guides/connector-guide.md)
