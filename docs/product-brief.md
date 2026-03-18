# Mars Greenhouse Mission Control — Product Brief

## What We're Building

A mission-control web app that simulates a small Martian greenhouse with 3–4 crop zones. The system tracks crop health, resource levels, and crew nutrition status. When failures occur, one AI agent activates **Nutrition Preservation Mode** — reallocating scarce resources and explaining the tradeoff in plain language.

## Core Differentiator

> "This system doesn't just grow crops. It protects astronaut nutrition under failure."

Most greenhouse sims optimize for yield. We optimize for **crew nutrition continuity**. The AI agent's job is not to maximize biomass — it's to keep 4 astronauts alive and fed for 450 days.

## The Demo Story

1. Dashboard shows a healthy mission in progress (day ~87 of 450)
2. Operator injects a failure scenario (e.g., water recycling drops to 60%)
3. System detects nutritional risk — caloric coverage drops below threshold
4. AI agent activates Nutrition Preservation Mode
5. Agent recommends specific resource reallocations across zones
6. Dashboard shows before/after comparison: what was lost, what was saved
7. Agent explains the tradeoff in one clear paragraph
8. "Days Safe" counter updates — crew nutrition is preserved

## Target Audience

Hackathon judges. They need to understand the concept in under 2 minutes.

## Assumptions

- 4 astronauts, 450-day mission
- 3–4 crop zones (lettuce, potato, beans/peas, radish)
- Hydroponic system only
- No real sensors — simulation drives state
- Knowledge base (Bedrock) provides crop thresholds and nutritional targets
- One AI agent (not multi-agent)
- No auth, no persistence beyond session, no mobile

## Success Criteria

- Demo runs without crashing
- Failure → AI response → explanation flow is clear and fast
- Judges can see the nutrition impact before and after
- Frontend is visually compelling enough to tell the story
