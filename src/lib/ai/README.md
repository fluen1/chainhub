# AI Foundation Module

Infrastructure for ChainHub's AI extraction pipeline. Handles:

- OpenAI API client (Responses API + structured outputs)
- Content loading from uploaded files (PDF in v1)
- Job queue via pg-boss
- Feature flags for gradual rollout
- Structured logging

## Quick start

### Running the worker

```bash
npm run worker:dev    # development with hot reload
npm run worker        # production-style single run
```

### Testing

```bash
npm test                                  # all tests
npm test -- feature-flags                 # unit tests only
npm test -- queue.integration             # requires DB
npm test -- extract-poc.integration       # requires DB + ANTHROPIC_API_KEY
```

Integration tests are skipped if their required environment variables are missing.

### Environment variables

| Variable              | Required | Description                                                  |
| --------------------- | -------- | ------------------------------------------------------------ |
| OPENAI_API_KEY        | Yes      | OpenAI API key (`sk-proj-...`)                               |
| OPENAI_BASE_URL       | No       | Override base URL (fx `https://eu.api.openai.com/v1` til EU) |
| AI_EXTRACTION_ENABLED | No       | Global kill switch (`true`/`false`)                          |
| AI_LOG_LEVEL          | No       | Log level: `debug`, `info` (default), `warn`, `error`        |
| DIRECT_URL            | Yes      | Direct Postgres connection (pg-boss needs this)              |

### Adding a new job type

1. Add constant to `queue.ts` `JOB_NAMES`
2. Create handler in `jobs/<name>.ts`
3. Register in `worker/index.ts`
4. Write tests

### Cost tracking

Every model-kald logs tokens and cost:

```typescript
import { computeCostUsd } from './client'
const cost = computeCostUsd('gpt-5-mini', inputTokens, outputTokens)
```

### Feature flags

Check before every AI call:

```typescript
import { isAIEnabled } from './feature-flags'
if (!(await isAIEnabled(orgId, 'extraction'))) return
```

## What's here vs what's coming

### Built (Plan 1)

- Prisma models (DocumentExtraction, AIFieldCorrection, OrganizationAISettings)
- Feature flag infrastructure
- Structured logging (pino)
- OpenAI client (Responses API + structured outputs)
- Content loader for PDF
- pg-boss queue + worker process
- Proof-of-concept extraction job

### Coming (Plan 2+)

- EJERAFTALE schema with production prompt
- Multi-pass extraction pipeline
- Word/Excel/image content loaders
- Agreement-based confidence
- Source verification
