# Roadmap Platform -- PRODUCTION Cursor Playbook (Code Included)

This is the **production-grade version** of your build guide.
Includes: - copy/paste prompts - real code scaffolds - schemas - API
examples - best practices

------------------------------------------------------------------------

# STEP 1 -- MONOREPO STRUCTURE

## Expected Structure

/apps /web /services /api-gateway /portfolio-service /packages /types

------------------------------------------------------------------------

## Root package.json

``` json
{
  "name": "roadmap-platform",
  "private": true,
  "workspaces": ["apps/*", "services/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build"
  }
}
```

------------------------------------------------------------------------

# STEP 2 -- SHARED TYPES

``` ts
export type Roadmap = {
  id: string;
  name: string;
  description?: string;
};

export type Initiative = {
  id: string;
  title: string;
  description?: string;
};

export type RoadmapItem = {
  id: string;
  roadmapId: string;
  initiativeId: string;
  startDate: string;
  endDate: string;
};
```

------------------------------------------------------------------------

# STEP 3 -- PRISMA SCHEMA

``` prisma
model Roadmap {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  items     RoadmapItem[]
}

model Initiative {
  id          String   @id @default(uuid())
  title       String
  description String?
  items       RoadmapItem[]
}

model RoadmapItem {
  id           String     @id @default(uuid())
  roadmapId    String
  initiativeId String
  startDate    DateTime
  endDate      DateTime

  roadmap      Roadmap    @relation(fields: [roadmapId], references: [id])
  initiative   Initiative @relation(fields: [initiativeId], references: [id])
}
```

------------------------------------------------------------------------

# STEP 4 -- BASIC API (NestJS)

``` ts
@Controller('roadmaps')
export class RoadmapController {
  constructor(private service: RoadmapService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoadmapDto) {
    return this.service.create(dto);
  }
}
```

------------------------------------------------------------------------

# STEP 5 -- FRONTEND FETCH

``` ts
export async function getRoadmaps() {
  const res = await fetch('/api/roadmaps');
  return res.json();
}
```

------------------------------------------------------------------------

# STEP 6 -- TIMELINE LOGIC

``` ts
function groupByQuarter(items) {
  return items.reduce((acc, item) => {
    const q = getQuarter(item.startDate);
    acc[q] = acc[q] || [];
    acc[q].push(item);
    return acc;
  }, {});
}
```

------------------------------------------------------------------------

# STEP 7 -- DOCKER

``` yaml
version: "3"
services:
  db:
    image: postgres
    ports:
      - "5433:5432"
```

------------------------------------------------------------------------

# STEP 8 -- AI SERVICE EXAMPLE

``` ts
export async function generateDescription(input) {
  return openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: input }]
  });
}
```

------------------------------------------------------------------------

# FINAL NOTES

-   Build iteratively
-   Keep services simple early
-   Treat timeline as derived data
-   Focus on UX early

------------------------------------------------------------------------

You now have a production-ready starting point with real code.
