# AI Augmented Author and Audiobook Generation Writing Environment

Source document: [An AI augmented author writing environment. .docx](</c:/Users/ASUS/Desktop/Repos/ABetterNovelAuthoringEnvironment/An AI augmented author writing environment. .docx>)

This file is the readable Markdown copy of the Word document and is intended to be the main feature-reference and progress-tracking document going forward.

## Manuscript Issue Console

Gives the writer a structured, code-like review panel that logs detected issues in a clear event window and links each one directly to the relevant line or section of the manuscript. With optional AI augmentation, the system can analyse passages, explain what may need attention, and visually guide the user to exactly where changes should be made. The suite can also be used in an IDE-like mode, where manuscript lines are indexed and addressable, allowing the author to jump directly to flagged passages, navigate issues more easily, and work through revisions with the same precision and clarity found in software development environments.

### Progress

- Status: Foundation implemented.
- Notes: Anchored `IssueRecord` data, local issue suggestions, issue console records, and editor navigation are in place. Next work is issue lifecycle controls and author-created tasks on selected spans.

## Local Writing Assistant

Provides real-time writing support by identifying potential issues as the author works, such as awkward phrasing, repetition, clarity problems, pacing concerns, or structural inconsistencies. It can run in a Local AI Only mode, where all analysis is performed directly on the user's own machine using their GPU, allowing the author to receive private, immediate feedback without sending manuscript content to any external service.

### Progress

- Status: Foundation implemented.
- Notes: Local rule analysis runs behind an analysis service contract and reports provider metadata as `local-only`. Next work is incremental changed-block analysis and real local model adapters.

## Event Pinning

Lets the program automatically detect and mark major story moments throughout a manuscript, such as deaths, first encounters, character introductions, key interactions, and other important plot developments. The writer can also describe a specific event in plain language, and the AI will locate the matching passage in the manuscript and place a user-defined tag directly on the relevant line, making it easier to track structure, revisit important beats, and navigate complex narratives.

### Progress

- Status: Foundation implemented.
- Notes: Anchored event tags, local event detection, event console records, and navigation to source scene lines are in place. Next work is user-defined tagging from selected spans.

## Narration Follow Mode

Is a live reading view that listens to the narrator's voice, matches the spoken words against the manuscript in real time, and automatically keeps the current line or sentence centered on screen as the text scrolls smoothly ahead. Designed for audiobook recording, rehearsed narration, and long-form manuscript review, it reduces manual scrolling and page hunting, helping the reader stay locked onto the script with minimal interruption even if they pause, repeat a phrase, or momentarily lose their place.

### Progress

- Status: Foundation implemented.
- Notes: Narration session snapshots, alignment jobs, local alignment service boundaries, and a narration follow panel are in place. Next work is microphone capture and streaming alignment recovery.

## Character Voice Narration

Allows the author to produce full audiobook performances directly inside the writing suite by assigning distinct voices to different characters and narration roles across the manuscript. The system can either generate speech from text or convert the author's own spoken performance into selected character voices, making it possible for a single user to voice an entire cast while keeping dialogue delivery, speaker identity, and audio production linked directly to the manuscript structure.

### Progress

- Status: Foundation implemented.
- Notes: Speaker assignments, voice profiles, speaker bindings, preview jobs, chapter render jobs, and voice routing UI are in place. Next work is editable voice assignment and real provider adapters.

## World Spine View

Gives the author an interactive worldbuilding workspace built around visual timeline spines rather than flat notes pages. Events are placed as nodes along horizontal timelines, while selecting a node opens a linked vertical editing pane where the user can refine the reasoning, references, implications, and supporting notes behind that event. Multiple spines can be stacked for different planets, factions, characters, or story threads, with visual links showing where events intersect or influence one another, making large-scale chronology and causality far easier to build, understand, and revise. Timeline nodes that affect other event nodes are shown in the timeline spine. There is a link between the node on that spine and the node of another spine, if the event takes place in another locality.

### Progress

- Status: Foundation implemented.
- Notes: Structured spines, timeline nodes, timeline edges, entity links, world inspector records, and cross-spine navigation are in place. Next work is direct node editing, filtering, and richer visual edge rendering.

## Dream Scaping

Dream scaping is more of an outlier. The writer, for instance, has an idea or scene they feel is quite powerful and they want to integrate this into their story somehow. Dream scaping uses the AI assistant to look at the overarching story and suggest how this might fit into their current story.

Later iterations of the feature could work in with the worldbuilding spine.

### Progress

- Status: Foundation implemented on 2026-04-24.
- Notes: Dream Scaping now has a typed reviewable suggestion contract, local `exploreDreamScape` analysis flow, desktop workspace data, an editor panel, and tests. Next work is an author-facing idea submission form plus accept/reject actions.
