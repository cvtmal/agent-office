You are helping me build the next major phase of an existing project.

## Project context

I already have a working repository for my Claude Code agent harness. The harness can orchestrate agents (for example a CTO that can spawn and stop software developer Claude Code sessions), and it already uses a document-oriented workflow with files such as state, handoff, decisions, incidents, and outcomes.

The next step is NOT to rebuild the harness. The next step is to build a browser-based visual layer: a 2D pixel-art office that brings my currently running agents to life.

This should run in the browser, locally is fine. Do NOT build a desktop app.

## Product goal

Build a local-first browser application that visualizes my currently running agents as characters in a pixel-art office.

The office is not just decorative. It should reflect real harness state:
- which agents exist
- what role they have
- what they are currently doing
- whether they are idle, working, blocked, waiting, reviewing, or finished
- task handoffs
- key artifacts such as state, decisions, incidents, and outcomes

I want this to feel like my agents are visibly working in an office.

## Art direction

The visual style must be inspired by classic LucasArts point-and-click adventure games, especially the Monkey-Island-era feel:
- beautiful, soulful pixel art
- cozy and atmospheric
- strong visual storytelling
- expressive characters
- richly decorated rooms
- warm, slightly dramatic lighting
- adventure-game-style scene composition
- retro point-and-click interface sensibility

Important:
- Use the attached reference images ONLY as stylistic inspiration.
- Their subject matter/content is irrelevant.
- What matters is the pixel-art quality, the room atmosphere, the character charm, the color treatment, and the classic point-and-click adventure vibe.

Do NOT make this look like a generic dashboard with pixel sprites pasted on top.
Do NOT make it look like a flat management sim.
It should feel like an actual handcrafted pixel-art world.

## Technical direction

Target:
- browser-based app
- local development first
- TypeScript preferred
- modern frontend stack

Use a stack that is practical for an agentic workflow and suitable for 2D pixel-art rendering in the browser.

Preferred default approach:
- PixiJS for 2D rendering
- Vite for app setup
- React for non-canvas UI / inspector panels if useful
- Zustand or similar lightweight state store
- WebSocket or polling bridge to the harness
- Tiled-compatible map/data approach if useful
- A structure that can later support Aseprite/Tiled asset workflows

Do not overengineer.

## Core architectural principle

Separate the system into two layers:

1. Existing harness / orchestration layer
   - this already exists
   - it remains the source of truth for agents, tasks, and status

2. Pixel office visualization layer
   - reads structured state/events from the harness
   - renders agents, rooms, and activity
   - allows inspection of agent details
   - may later allow lightweight control actions

The office UI should consume a simple adapter/bridge layer rather than depending tightly on harness internals.

## What I want you to do first

Your first job is to create the initial implementation plan and then begin scaffolding the project.

Please do the following in order:

### 1. Inspect the repository
- understand the current repo shape
- identify where the existing harness lives
- identify how agent state is currently represented
- identify useful files such as STATE, HANDOFF, DECISIONS, INCIDENTS, outcomes, or similar
- identify the cleanest integration point for a browser-based office UI

### 2. Propose the architecture
Design a practical MVP architecture for the pixel office, including:
- frontend app structure
- rendering layer
- harness bridge / adapter
- event/state model
- asset pipeline approach
- scene model
- character model
- room / map model

### 3. Define the MVP
The MVP should be intentionally small but magical.

MVP requirements:
- one browser app running locally
- one main office scene
- render current agents as pixel characters
- each agent has a role, a visible status, and a location
- show at least a few simple states such as idle, working, blocked, meeting
- clicking an agent opens a detail panel
- detail panel shows real underlying info from the harness where possible
- one simple visual task/handoff mechanism
- one simple “CTO” office or control area
- use placeholder pixel assets if needed, but structure the project so real art can be improved later

### 4. Create a phased plan
Create a short implementation roadmap with:
- Phase 1: scaffold and static scene
- Phase 2: real harness integration
- Phase 3: interaction and richer visualization
- Phase 4: art/style polish

### 5. Start implementation
After the plan, begin making changes in the repo:
- scaffold the browser app
- create the initial folder structure
- implement the first office scene
- implement a basic agent rendering model
- wire in mock data first if needed
- then connect to real harness state in the cleanest incremental way

## Desired UX / scene ideas

The office should feel alive.

Examples of how agent states might map visually:
- idle -> standing or subtle idle animation
- working -> seated at desk / typing / focused
- blocked -> frustrated / thinking / visible marker
- meeting -> gathered around table or conversation area
- reviewing -> near board or review desk
- completed -> brief celebratory feedback or completion marker

The app should support atmosphere:
- cozy office or studio vibe
- interesting furniture and props
- strong room personality
- visual differentiation between roles/areas
- feeling of place rather than sterile UI

## Constraints

- browser app only
- local-first is fine
- do not build a desktop app
- do not replace the harness
- do not get stuck building a huge engine
- prefer a playable / viewable MVP quickly
- keep code understandable and maintainable
- if some data is not yet available from the harness, create a clean mockable adapter interface

## Output expectations

Before coding, provide:
1. a concise summary of your understanding
2. the proposed architecture
3. the MVP definition
4. the phased plan
5. any critical repo questions

Then begin implementation.

## Important style guidance for implementation

The project should optimize for:
- soul
- atmosphere
- clarity
- extensibility
- visible liveliness
- clean separation of visualization from orchestration

When making design choices, prefer:
- charming and handcrafted
- simple and robust
- easy to iterate on
- capable of becoming more beautiful later

Avoid:
- corporate dashboard aesthetics
- soulless pixel placeholders with no visual direction
- overcomplicated game-engine architecture
- premature generalization

Start now by inspecting the repository and proposing the MVP architecture.

Important: do not try to complete everything at once.
First focus on producing a strong MVP plan and scaffolding only the minimum needed for:
- one room
- one scene
- one agent avatar
- one side panel
- one harness adapter
  Then iterate.

Before implementation, create a short design doc under docs/design/ for the pixel office project, including:
- vision
- architecture
- art direction
- MVP scope
- integration plan
- open questions

## Recommendation
- PixiJS
- local browser-only
- single main office scene
- mock adapter first, real harness second
- classic point-and-click adventure atmosphere
- one magical MVP instead of a full simulated company