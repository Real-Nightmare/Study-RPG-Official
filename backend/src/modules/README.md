# Backend Modules

NestJS feature modules. Every module follows the same layout:
`module.ts` / `controller.ts` / `service.ts` / `entities` (+ `dto/` where relevant),
with unit tests beside the sources (`*.spec.ts`). New core-tool modules follow the
`planner` pattern — see [`docs/guides/connector-guide.md`](../../../docs/guides/connector-guide.md).

| Module | Purpose |
|--------|---------|
| [academics](./academics/) | Subjects → chapters → topics study structure |
| [admin](./admin/) | Administration APIs and platform management |
| [admin-notes](./admin-notes/) | Admin moderation of community notes |
| [ai](./ai/) | Multi-agent AI pipeline + Study RPG philosophy prompts |
| [analytics](./analytics/) | Usage analytics |
| [auth](./auth/) | Authentication (JWT) and account lifecycle |
| [blog](./blog/) | Announcements and blog content |
| [chat](./chat/) | Study chat (Socket.IO) |
| [clickhouse](./clickhouse/) | ClickHouse client wrapper (analytics store) |
| [code-sandbox](./code-sandbox/) | Sandboxed code execution for solutions |
| [content](./content/) | Study sets, flashcards, notes, documents, extraction |
| [dashboard](./dashboard/) | Dashboard aggregation endpoints |
| [database](./database/) | PostgreSQL pool wrapper (raw SQL) |
| [economy](./economy/) | In-game economy: marketplace, scraper/burner, supply ledger |
| [email](./email/) | Transactional email (SES) |
| [events](./events/) | Study events: StudyPass, quests, Abstracted, Great Extinction |
| [exam-clone](./exam-clone/) | AI-cloned practice exams (Socket.IO) |
| [exam-periods](./exam-periods/) | Exam period planning and gating |
| [factions](./factions/) | Factions / parties and their battles |
| [firebase](./firebase/) | Firebase Admin wrapper (push/identity) |
| [focus-sessions](./focus-sessions/) | Focus sessions, rest gates, anti-overstudy wellbeing |
| [integrity](./integrity/) | Study integrity: Campfire loop, Free-to-Win guards |
| [knowledge-base](./knowledge-base/) | Chunking and knowledge base assembly |
| [learning-paths](./learning-paths/) | Structured learning paths |
| [mistakes](./mistakes/) | Mistake tracking and review |
| [notifications](./notifications/) | Web push notifications |
| [planner](./planner/) | Task planner — the reference core-tool pattern |
| [problem-solver](./problem-solver/) | Problem solver tools (Socket.IO) |
| [programmes](./programmes/) | AI study programmes |
| [puzzles](./puzzles/) | Study puzzles |
| [qdrant](./qdrant/) | Qdrant collection resolver (vector index) |
| [queue](./queue/) | BullMQ queue wrapper |
| [quiz](./quiz/) | Quizzes + live quiz rooms (Socket.IO) |
| [rag](./rag/) | RAG: retrieval, evaluation, reranking, deletion |
| [redis](./redis/) | Redis client wrapper (cache) |
| [research](./research/) | Research tools (web search) |
| [rpg](./rpg/) | RPG core: stats, STP ledger, cards, battle engine |
| [social](./social/) | Social feed and community (Socket.IO) |
| [storage](./storage/) | File storage (S3) |
| [subscription](./subscription/) | Stripe subscriptions — infrastructure only (never game progression) |
| [teach-back](./teach-back/) | Teach-back evaluation agent |
| [users](./users/) | User profiles and settings |
