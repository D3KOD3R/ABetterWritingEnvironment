import {
  EDITOR_DRAFTS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  buildSceneRecords,
  completeManuscriptTask,
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createManuscriptTask,
  createPassageNote,
  createSceneDraft,
  createStructureDrafts,
  createTemplateDrafts,
  findSceneByBlockId,
  groupScenesByChapter,
  normalizeManuscriptTasks,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizePassageNotes,
  resolveManuscriptTaskRange,
  updateManuscriptTaskTitle,
  updatePassageNoteTitle,
} from "./editor-model.js";

const appRoot = document.querySelector("#app");

const state = {
  shellReady: false,
  workspace: null,
  projectTitle: "",
  activePane: "manuscript",
  sceneDrafts: {},
  structureDrafts: createStructureDrafts(),
  templateDrafts: createTemplateDrafts(),
  manuscriptTasks: [],
  passageNotes: [],
  sidePanelMode: "issues",
  selectedTaskId: null,
  selectedPassageNoteId: null,
  inlinePassageDraft: null,
  taskContextMenu: null,
  taskComposer: null,
  taskPreview: null,
  editorPrefs: createDefaultEditorPrefs(),
  localAiPrefs: createDefaultLocalAiPrefs(),
  localAiTitleStatus: {},
  scenes: [],
  selectedSceneId: null,
  selectedBlockId: null,
  selectedIssueId: null,
  selectedNodeId: null,
  selectedEntityId: null,
};

let eventsWired = false;

boot().catch((error) => {
  console.error(error);
  appRoot.innerHTML = `
    <div class="error-shell">
      <p class="loading-kicker">Desktop Host Failed</p>
      <h1>Unable to load the author workspace.</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    </div>
  `;
});

async function boot() {
  const response = await fetch("/api/workspace");
  if (!response.ok) {
    throw new Error(`Workspace request failed with status ${response.status}.`);
  }

  state.workspace = await response.json();
  state.projectTitle = loadProjectTitle(state.workspace.project.title);
  state.workspace.project.title = state.projectTitle;
  state.sceneDrafts = loadSceneDrafts();
  state.structureDrafts = loadStructureDrafts();
  state.templateDrafts = loadTemplateDrafts();
  state.manuscriptTasks = loadManuscriptTasks();
  state.passageNotes = loadPassageNotes();
  state.editorPrefs = loadEditorPrefs();
  state.localAiPrefs = loadLocalAiPrefs();
  refreshScenes();

  state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
  state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
  state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;

  const initialBlockId =
    state.workspace.selectionDefaults.lineId ??
    state.scenes[0]?.blocks[0]?.blockId ??
    null;
  syncSelectionFromBlock(initialBlockId);

  render();
  wireEvents();
  syncSceneDocumentLayout();
}

function wireEvents() {
  if (eventsWired) {
    return;
  }
  eventsWired = true;

  document.addEventListener("click", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (clickTarget?.closest("[data-title-input]")) {
      hideTaskContextMenu();
      return;
    }

    const target = clickTarget?.closest("[data-action]");
    if (!target) {
      if (focusEditorWhitespace(clickTarget, event)) {
        hideTaskSurfaces();
        return;
      }

      const taskTarget = clickTarget?.closest("[data-task-preview-id]");
      if (taskTarget) {
        navigateTaskAnchor(taskTarget.dataset.taskPreviewId);
        return;
      }

      hideTaskContextMenu();
      return;
    }

    const { action } = target.dataset;

    if (action !== "add-selection-task" && action !== "add-passage-note") {
      hideTaskContextMenu();
    }

    if (action === "add-selection-task") {
      openTaskComposerFromContextMenu(event);
      return;
    }

    if (action === "add-passage-note") {
      openPassageNoteComposerFromContextMenu(target.dataset.noteType);
      return;
    }

    if (action === "save-selection-task") {
      saveTaskFromComposer();
      return;
    }

    if (action === "save-passage-note") {
      savePassageNoteFromComposer();
      return;
    }

    if (action === "commit-inline-passage-note") {
      commitInlinePassageNote();
      return;
    }

    if (action === "cancel-inline-passage-note") {
      cancelInlinePassageNote();
      return;
    }

    if (action === "cancel-selection-task") {
      cancelTaskComposer();
      return;
    }

    if (action === "complete-task") {
      completeTask(target.dataset.taskId);
      return;
    }

    if (action === "suggest-scene-title") {
      suggestSceneTitle(target.dataset.sceneId);
      return;
    }

    if (action === "select-pane") {
      selectWorkspacePane(target.dataset.paneId);
      return;
    }

    if (action === "select-side-panel") {
      selectSidePanel(target.dataset.sidePanel);
      return;
    }

    if (action === "select-passage-note") {
      selectPassageNote(target.dataset.noteId);
      return;
    }

    if (action === "select-chapter") {
      const chapterScene = getScenesForChapter(target.dataset.chapterId)[0];
      if (chapterScene) {
        selectSceneById(chapterScene.sceneId);
      }
      return;
    }

    if (action === "select-scene") {
      selectSceneById(target.dataset.sceneId);
      return;
    }

    if (action === "select-line") {
      state.selectedIssueId = null;
      syncSelectionFromBlock(target.dataset.lineId);
      render();
      return;
    }

    if (action === "select-issue") {
      const issue = getIssue(target.dataset.issueId);
      if (!issue) {
        return;
      }

      state.selectedIssueId = issue.id;
      syncSelectionFromBlock(issue.blockId);
      render();
      return;
    }

    if (action === "select-event") {
      const eventTag = getEvent(target.dataset.eventId);
      if (!eventTag) {
        return;
      }

      state.selectedIssueId = null;
      syncSelectionFromBlock(eventTag.blockId);
      render();
      return;
    }

    if (action === "select-node") {
      const node = getNode(target.dataset.nodeId);
      if (!node) {
        return;
      }

      state.selectedNodeId = node.id;
      if (node.primaryBlockId) {
        state.selectedIssueId = null;
        syncSelectionFromBlock(node.primaryBlockId);
      }
      if (node.linkedEntityIds[0]) {
        state.selectedEntityId = node.linkedEntityIds[0];
      }
      render();
      return;
    }

    if (action === "select-entity") {
      const entity = getEntity(target.dataset.entityId);
      if (!entity) {
        return;
      }

      state.selectedEntityId = entity.id;
      if (entity.introductionBlockId) {
        state.selectedIssueId = null;
        syncSelectionFromBlock(entity.introductionBlockId);
      }
      if (entity.introductionNodeId) {
        state.selectedNodeId = entity.introductionNodeId;
      }
      render();
      return;
    }

    if (action === "add-chapter") {
      addChapterDraft();
      return;
    }

    if (action === "add-scene") {
      addSceneDraft();
      return;
    }

    if (action === "add-template") {
      addTemplateDraft();
      return;
    }

    if (action === "reset-scene-draft") {
      resetSceneDraft(target.dataset.sceneId);
      state.selectedIssueId = null;
      render();
    }
  });

  document.addEventListener("contextmenu", (event) => {
    const editorContext = getEditorContextFromEvent(event);
    if (!editorContext) {
      hideTaskSurfaces();
      return;
    }

    const { textarea, contextRange, inlinePosition } = editorContext;
    const sceneId = textarea.dataset.sceneId;

    if (!sceneId || !contextRange) {
      hideTaskSurfaces();
      return;
    }

    event.preventDefault();
    state.taskComposer = null;
    state.taskContextMenu = {
      sceneId,
      selectedText: contextRange.selectedText,
      startOffset: contextRange.startOffset,
      endOffset: contextRange.endOffset,
      insertionOffset: contextRange.hasExplicitSelection
        ? contextRange.endOffset
        : textarea.selectionStart,
      hasExplicitSelection: contextRange.hasExplicitSelection,
      inlinePosition,
      x: event.clientX,
      y: event.clientY,
    };
    renderTaskContextMenu();
  });

  document.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (!target) {
      return;
    }

    previewTaskAnchor(target.dataset.taskPreviewId);
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (!target) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && target.contains(related)) {
      return;
    }

    if (!state.taskPreview?.pinned) {
      clearTaskAnchorPreview();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target) {
      previewTaskAnchor(target.dataset.taskPreviewId);
    }
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (!target) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && target.contains(related)) {
      return;
    }

    if (!state.taskPreview?.pinned) {
      clearTaskAnchorPreview();
    }
  });

  document.addEventListener("dblclick", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-inline-passage-draft]")
      : null;
    if (
      target &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)
    ) {
      commitInlinePassageNote();
      return;
    }

    const sceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-scene-title-id]")
      : null;
    if (!sceneTitleTarget) {
      return;
    }

    const sceneId = sceneTitleTarget.dataset.sceneTitleId;
    if (!sceneId) {
      return;
    }

    selectSceneById(sceneId);
    window.requestAnimationFrame(() => {
      const titleInput = document.querySelector(
        `.editor-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
      );
      if (titleInput instanceof HTMLInputElement) {
        titleInput.focus();
        titleInput.select();
      }
    });
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const { editField, sceneId } = target.dataset;
    if (!editField) {
      return;
    }

    if (editField === "project-title") {
      state.projectTitle = target.value;
      state.workspace.project.title = target.value;
      writeStoredJson(EDITOR_PROJECT_TITLE_KEY, target.value);
      return;
    }

    if (editField === "inline-passage-note") {
      if (state.inlinePassageDraft) {
        state.inlinePassageDraft = {
          ...state.inlinePassageDraft,
          body: target.value,
        };
        syncInlinePassageDraftLayout();
      }
      return;
    }

    if (editField === "inline-passage-verse") {
      if (state.inlinePassageDraft) {
        state.inlinePassageDraft = {
          ...state.inlinePassageDraft,
          typedText: target.value,
        };
        updateInlinePassageDraftStatus(
          getCurrentSceneEditorText(state.inlinePassageDraft.sceneId),
        );
        syncInlinePassageDraftLayout();
      }
      return;
    }

    if (editField === "task-title") {
      state.manuscriptTasks = updateManuscriptTaskTitle(
        state.manuscriptTasks,
        target.dataset.taskId,
        target.value,
      );
      writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
      return;
    }

    if (editField === "passage-note-title") {
      state.passageNotes = updatePassageNoteTitle(
        state.passageNotes,
        target.dataset.noteId,
        target.value,
      );
      writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
      return;
    }

    if (!sceneId) {
      return;
    }

    if (editField === "scene-title") {
      updateSceneDraft(sceneId, (draft) => {
        draft.sceneTitle = target.value;
      });
      updateSceneTitleLabel(sceneId, target.value);
      updateFocusedLineCard();
      return;
    }

    if (editField === "editor-text") {
      clearTaskAnchorPreview({ restoreSelection: false });
      const previousText = getScene(sceneId)?.editorText ?? "";
      trackInlinePassageDraftTyping(sceneId, previousText, target);
      updateSceneDraft(sceneId, (draft) => {
        draft.editorText = target.value;
      });
      syncSceneDocumentLayout();
      centerEditorOnCaret(target);
      updateFocusedLineCard();
      updateInlinePassageDraftStatus(target.value);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.localAiSetting === "enabled") {
      state.localAiPrefs = normalizeLocalAiPrefs({
        ...state.localAiPrefs,
        enabled: target.checked,
      });
      writeStoredJson(EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs);
      renderHeader();
      renderManuscriptPanel();
      syncSceneDocumentLayout();
      return;
    }

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const { editorPref } = target.dataset;
    if (!editorPref) {
      return;
    }

    const rawValue =
      editorPref === "fontFamilyId" ? target.value : Number(target.value);
    state.editorPrefs = normalizeEditorPrefs({
      ...state.editorPrefs,
      [editorPref]: rawValue,
    });
    writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  });

  window.addEventListener("resize", () => {
    hideTaskSurfaces();
    syncSceneDocumentLayout();
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLTextAreaElement &&
      ["inline-passage-note", "inline-passage-verse"].includes(event.target.dataset.editField) &&
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      commitInlinePassageNote();
      return;
    }

    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      navigateTaskAnchor(target.dataset.taskPreviewId);
      return;
    }

    if (event.key === "Escape") {
      hideTaskSurfaces();
    }
  });
}

function render() {
  if (!state.shellReady) {
    renderShell();
    state.shellReady = true;
  }

  renderHeader();
  renderBinderPanel();
  renderManuscriptPanel();
  renderConsolePanel();
  renderWorldPanel();
  renderEntityPanel();
  renderDreamScapingPanel();
  renderNarrationPanel();
  renderVoicePanel();
  renderTaskContextMenu();
  renderPaneVisibility();
  if (state.activePane === "manuscript") {
    syncSceneDocumentLayout();
  }
}

function renderShell() {
  appRoot.innerHTML = `
    <div id="hero-slot"></div>

    <main class="workspace-grid pane-section" data-pane-section="manuscript">
      <aside id="binder-slot" class="panel binder-panel"></aside>
      <section id="manuscript-slot" class="panel manuscript-panel"></section>
      <aside id="console-slot" class="panel console-panel"></aside>
    </main>

    <section class="world-grid pane-section" data-pane-section="world">
      <section id="world-slot" class="panel spine-panel"></section>
      <aside id="entity-slot" class="panel entity-panel"></aside>
    </section>

    <section class="ideation-grid pane-section" data-pane-section="world">
      <section id="dream-slot" class="panel dream-panel"></section>
    </section>

    <section class="production-grid pane-section" data-pane-section="narration">
      <section id="narration-slot" class="panel narration-panel"></section>
    </section>

    <section class="production-grid pane-section" data-pane-section="voice">
      <section id="voice-slot" class="panel voice-panel"></section>
    </section>
    <div id="task-menu-slot"></div>
  `;
}

function renderTaskContextMenu() {
  const slot = document.querySelector("#task-menu-slot");
  if (!slot) {
    return;
  }

  const composer = state.taskComposer;
  if (composer) {
    const excerpt = composer.selectedText.trim().slice(0, 120);
    const isPassageNoteComposer = composer.composerType === "passage-note";
    const noteLabel = composer.noteType === "research" ? "Research" : "Inspiration";
    const left = Math.min(Math.max(8, composer.x), Math.max(8, window.innerWidth - 380));
    const top = Math.min(Math.max(8, composer.y), Math.max(8, window.innerHeight - 260));
    slot.innerHTML = `
      <form
        class="task-composer"
        style="left:${left}px; top:${top}px; ${escapeHtml(buildEditorStyle())}"
      >
        <label for="task-description-input">${escapeHtml(isPassageNoteComposer ? noteLabel : "Task body")}</label>
        <textarea
          id="task-description-input"
          class="task-description-input"
          placeholder="${escapeHtml(isPassageNoteComposer ? getPassageNotePlaceholder(composer.noteType) : "Describe what needs to be done for this task...")}"
          ${isPassageNoteComposer ? "data-passage-note-body" : "data-task-description"}
        ></textarea>
        <p>${escapeHtml(excerpt)}</p>
        <div class="task-composer-actions">
          <button class="tag-button" type="button" data-action="${isPassageNoteComposer ? "save-passage-note" : "save-selection-task"}">
            ${escapeHtml(isPassageNoteComposer ? `Save ${noteLabel.toLowerCase()}` : "Add task")}
          </button>
          <button class="tag-button" type="button" data-action="cancel-selection-task">Cancel</button>
        </div>
      </form>
    `;

    const input = document.querySelector(
      isPassageNoteComposer ? "[data-passage-note-body]" : "[data-task-description]",
    );
    if (input instanceof HTMLTextAreaElement) {
      input.focus();
    }
    return;
  }

  const menu = state.taskContextMenu;
  if (!menu) {
    slot.innerHTML = "";
    return;
  }

  const excerpt = menu.selectedText.trim().slice(0, 80);
  const left = Math.min(Math.max(8, menu.x), Math.max(8, window.innerWidth - 276));
  const top = Math.min(Math.max(8, menu.y), Math.max(8, window.innerHeight - 230));
  slot.innerHTML = `
    <div
      class="task-context-menu"
      style="left:${left}px; top:${top}px;"
      role="menu"
    >
      ${menu.hasExplicitSelection ? `
        <button class="task-menu-item" data-action="add-selection-task" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">+</span>
          <span>Add task</span>
        </button>
      ` : ""}
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="inspiration" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">i</span>
        <span>Add inspiration</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="research" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">r</span>
        <span>Add research</span>
      </button>
      <p>${escapeHtml(excerpt)}</p>
    </div>
  `;
}

function getPassageNotePlaceholder(noteType) {
  return noteType === "research"
    ? "Collect references, facts, and questions for this passage..."
    : "What are you trying to convey here?";
}

function getPassageNoteVerb(noteType) {
  return noteType === "research" ? "research" : "inspiration";
}

function renderHeader() {
  const workspace = state.workspace;
  document.querySelector("#hero-slot").innerHTML = `
    <header class="hero">
      <div>
        <p class="eyebrow">Local-First Creative Operating Environment</p>
        <h1>
          <input
            class="project-title-input"
            type="text"
            value="${escapeHtml(state.projectTitle)}"
            data-edit-field="project-title"
            aria-label="Project title"
          />
        </h1>
        <p class="hero-copy">
          The desktop host composes canonical manuscript and world models with local analysis, narration follow, and voice render planning.
        </p>
      </div>
      <nav class="hero-tabs" aria-label="Workspace panes">
        ${renderPaneTab("manuscript", "Manuscript", workspace.settings.executionMode)}
        ${renderPaneTab("world", "World", "Spines and templates")}
        ${renderPaneTab("narration", "Narration", workspace.narration.provider.label)}
        ${renderPaneTab("voice", "Voice", workspace.voice.provider.label)}
        ${renderLocalAiSetting()}
      </nav>
      <div class="hero-stats">
        ${renderStat("Lines", workspace.project.stats.lineCount)}
        ${renderStat("Issues", workspace.project.stats.issueCount)}
        ${renderStat("Events", workspace.project.stats.eventCount)}
        ${renderStat("Characters", workspace.project.stats.characterCount)}
      </div>
    </header>
  `;
}

function renderLocalAiSetting() {
  const enabled = state.localAiPrefs.enabled;
  return `
    <label class="local-ai-setting">
      <input
        type="checkbox"
        data-local-ai-setting="enabled"
        ${enabled ? "checked" : ""}
      />
      <span>Local AI</span>
      <strong>${enabled ? "Titles on" : "Titles off"}</strong>
    </label>
  `;
}

function renderPaneTab(paneId, label, detail) {
  const isActive = state.activePane === paneId;
  return `
    <button
      class="hero-tab ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-pane"
      data-pane-id="${escapeHtml(paneId)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(detail)}</strong>
    </button>
  `;
}

function renderBinderPanel() {
  const workspace = state.workspace;
  const chapters = groupScenesByChapter(state.scenes);
  const taskCountsByChapter = countRemainingTasksByChapter(state.manuscriptTasks);
  document.querySelector("#binder-slot").innerHTML = `
    <div class="panel-heading manuscript-nav-heading">
      <p class="panel-kicker">Manuscript</p>
      <div class="panel-actions manuscript-nav-actions">
        <button class="tag-button panel-action-button" data-action="add-chapter">New chapter</button>
        <button class="tag-button panel-action-button" data-action="add-scene">New scene</button>
      </div>
    </div>
    <div class="binder-tree">
      ${chapters.map((chapter) => renderChapterNode(chapter, taskCountsByChapter[chapter.chapterId] ?? 0)).join("")}
    </div>
    <div class="character-block">
      <h3>Character Index</h3>
      ${workspace.project.characters.map((character) => `
        <div class="character-card">
          <strong>${escapeHtml(character.name)}</strong>
          <span>${escapeHtml(character.aliasList.join(", ") || "No aliases")}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderChapterNode(chapter, taskCount) {
  const isCurrentChapter = getSelectedScene()?.chapterId === chapter.chapterId;
  return `
    <div class="binder-node binder-chapter">
      <button class="binder-button ${isCurrentChapter ? "is-active" : ""}" data-action="select-chapter" data-chapter-id="${escapeHtml(chapter.chapterId)}">
        <span class="binder-kind">chapter</span>
        <span>${escapeHtml(chapter.chapterTitle)}</span>
        ${taskCount > 0 ? renderTaskBadge(taskCount, chapter.chapterTitle) : ""}
      </button>
      <div class="binder-children">
        ${chapter.scenes.map((scene) => renderSceneNode(scene)).join("")}
      </div>
    </div>
  `;
}

function renderTaskBadge(taskCount, chapterTitle) {
  return `
    <span class="task-badge" title="${escapeHtml(`${taskCount} open task${taskCount === 1 ? "" : "s"} in ${chapterTitle}`)}">
      <span class="task-badge-icon" aria-hidden="true">!</span>
      <span>${escapeHtml(String(taskCount))}</span>
    </span>
  `;
}

function renderSceneNode(scene) {
  const isCurrentScene = scene.sceneId === state.selectedSceneId;
  return `
    <div class="binder-node binder-scene">
      <button
        class="binder-button ${isCurrentScene ? "is-active" : ""}"
        data-action="select-scene"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        data-scene-title-id="${escapeHtml(scene.sceneId)}"
      >
        <span class="binder-kind">scene</span>
        <span>${escapeHtml(scene.sceneTitle)}</span>
      </button>
    </div>
  `;
}

function renderManuscriptPanel() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  document.querySelector("#manuscript-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Scene Editor</p>
      <h2>Scene Editor Viewport</h2>
    </div>
    ${selectedScene ? renderSceneEditor(selectedScene) : ""}
  `;
}

function renderSceneEditor(scene) {
  const hasDraft = Boolean(state.sceneDrafts[scene.sceneId]);
  const localAiStatus = state.localAiTitleStatus[scene.sceneId];
  return `
    <section class="scene-editor-shell">
      <div class="scene-editor-header">
        <div class="editor-title-row">
          <input
            class="editor-title-input"
            type="text"
            value="${escapeHtml(scene.sceneTitle)}"
            data-edit-field="scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            aria-label="Scene title"
          />
          <button
            class="tag-button editor-action-button ai-title-button"
            type="button"
            data-action="suggest-scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            ${state.localAiPrefs.enabled ? "" : "disabled"}
          >${localAiStatus === "loading" ? "Thinking..." : "Suggest title"}</button>
          ${localAiStatus && localAiStatus !== "loading" ? `<span class="local-ai-status">${escapeHtml(localAiStatus)}</span>` : ""}
        </div>
        <div class="scene-editor-tools">
          ${renderEditorSetting("Font", "fontFamilyId", FONT_OPTIONS.map((option) => ({
            value: option.id,
            label: option.label,
          })), state.editorPrefs.fontFamilyId)}
          ${renderEditorSetting("Size", "fontSize", FONT_SIZE_OPTIONS.map((value) => ({
            value: String(value),
            label: `${value}px`,
          })), String(state.editorPrefs.fontSize))}
          ${renderEditorSetting("Line Height", "lineHeight", LINE_HEIGHT_OPTIONS.map((value) => ({
            value: String(value),
            label: `${value}x`,
          })), String(state.editorPrefs.lineHeight))}
          ${renderEditorSetting("Text Width", "editorWidth", EDITOR_WIDTH_OPTIONS.map((value) => ({
            value: String(value),
            label: `${value}px`,
          })), String(state.editorPrefs.editorWidth))}
          ${hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
        </div>
      </div>

      <div
        class="scene-editor-codeframe"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        <div class="editor-document-body">
          <textarea
            class="editor-document-input"
            data-edit-field="editor-text"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            spellcheck="true"
          >${escapeHtml(scene.editorText ?? "")}</textarea>
        </div>
        ${renderInlinePassageDraft(scene)}
      </div>
    </section>
  `;
}

function renderInlinePassageDraft(scene) {
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== scene.sceneId) {
    return "";
  }

  const label = draft.noteType === "research" ? "Research" : "Inspiration";
  const anchor = getInlinePassageDraftAnchor(draft, scene.editorText ?? "", {
    includePendingVerse: true,
  });
  const prompt = anchor
    ? `${label} will save against: ${anchor.selectedText.slice(0, 96)}`
    : `Save this ${label.toLowerCase()} note against the verse typed in the manuscript field below.`;
  return `
    <section
      class="inline-passage-bubble inline-passage-${escapeHtml(draft.noteType)}"
      data-inline-passage-draft
      style="--inline-passage-y:${Math.round(draft.y)}px;"
    >
      <div class="inline-passage-heading">
        <span>${escapeHtml(label)} note</span>
        <strong data-inline-passage-status>${escapeHtml(prompt)}</strong>
        <button class="inline-passage-close" type="button" data-action="cancel-inline-passage-note" aria-label="Cancel ${escapeHtml(label)}">x</button>
      </div>
      <textarea
        data-edit-field="inline-passage-note"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        placeholder="${escapeHtml(getPassageNotePlaceholder(draft.noteType))}"
      >${escapeHtml(draft.body ?? "")}</textarea>
      <label class="inline-passage-verse-shell">
        <span>Typed verse</span>
        <textarea
          class="inline-passage-verse-field"
          data-edit-field="inline-passage-verse"
          data-scene-id="${escapeHtml(scene.sceneId)}"
          placeholder="Type the manuscript verse this note belongs to."
        >${escapeHtml(draft.typedText ?? "")}</textarea>
      </label>
      <div class="inline-passage-actions">
        <span aria-hidden="true"></span>
        <button class="tag-button" type="button" data-inline-passage-save data-action="commit-inline-passage-note">Save to typed verse</button>
      </div>
    </section>
  `;
}

function renderEditorSetting(label, prefKey, options, selectedValue) {
  return `
    <label class="editor-inline-setting">
      <span>${escapeHtml(label)}</span>
      <select data-editor-pref="${escapeHtml(prefKey)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderConsolePanel() {
  document.querySelector("#console-slot").innerHTML = `
    ${renderSidePanelTabs()}
    ${state.sidePanelMode === "issues"
      ? renderIssuePanelBody()
      : renderPassageNotePanel(state.sidePanelMode)}
  `;
}

function renderSidePanelTabs() {
  const issueCount = state.workspace.project.issues.length;
  const inspirationCount = state.passageNotes.filter((note) => note.noteType === "inspiration").length;
  const researchCount = state.passageNotes.filter((note) => note.noteType === "research").length;
  return `
    <div class="side-panel-tabs" aria-label="Editor side panel modes">
      ${renderSidePanelTab("issues", "Issues", issueCount)}
      ${renderSidePanelTab("inspiration", "Inspiration", inspirationCount)}
      ${renderSidePanelTab("research", "Research", researchCount)}
    </div>
  `;
}

function renderSidePanelTab(panelId, label, count) {
  const isActive = state.sidePanelMode === panelId;
  return `
    <button
      class="side-panel-tab ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-side-panel"
      data-side-panel="${escapeHtml(panelId)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(count))}</strong>
    </button>
  `;
}

function renderIssuePanelBody() {
  const workspace = state.workspace;
  const selectedIssue = getIssue(state.selectedIssueId);
  const openTasks = state.manuscriptTasks.filter((task) => task.status === "open");

  return `
    <div class="panel-heading">
      <p class="panel-kicker">Issue Console</p>
    </div>
    ${selectedIssue ? renderIssueFocus(selectedIssue) : ""}
    ${renderTaskChapterList(openTasks)}
    <div class="console-list">
      ${workspace.project.issues.map((issue) => renderIssue(issue)).join("")}
    </div>
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Event Pinning</p>
      <h2>Major Story Beats</h2>
    </div>
    <div class="event-list">
      ${workspace.project.eventTags.map((eventTag) => renderEvent(eventTag)).join("")}
    </div>
  `;
}

function renderPassageNotePanel(noteType) {
  const notes = state.passageNotes.filter((note) => note.noteType === noteType);
  const label = noteType === "research" ? "Research" : "Inspiration";

  return `
    <div class="panel-heading">
      <p class="panel-kicker">${escapeHtml(label)}</p>
    </div>
    ${notes.length ? `
      <div class="passage-note-list console-list">
        ${notes.map((note) => renderPassageNoteItem(note)).join("")}
      </div>
    ` : renderEmptyPassageNoteState(label)}
  `;
}

function renderEmptyPassageNoteState(label) {
  return `
    <div class="empty-note-state">
      <strong>No ${escapeHtml(label.toLowerCase())} bubbles yet.</strong>
      <span>Right-click in the editor, choose ${escapeHtml(label)}, then type into the inline bubble.</span>
    </div>
  `;
}

function renderPassageNoteItem(note) {
  const isSelected = state.selectedPassageNoteId === note.id;
  return `
    <div
      class="console-item passage-note-item ${isSelected ? "is-selected" : ""}"
      data-action="select-passage-note"
      data-note-id="${escapeHtml(note.id)}"
      role="button"
      tabindex="0"
    >
      <span class="console-meta">${escapeHtml(note.chapterTitle || "Chapter")} · ${escapeHtml(note.sceneTitle || "Scene")}</span>
      <input
        class="inline-title-input passage-note-title-input"
        type="text"
        value="${escapeHtml(note.title || "Inspiration note")}"
        data-title-input
        data-edit-field="passage-note-title"
        data-note-id="${escapeHtml(note.id)}"
        aria-label="${escapeHtml(note.noteType === "research" ? "Research title" : "Inspiration title")}"
      />
      <span>${escapeHtml(note.body.trim() || "Untitled reflection")}</span>
    </div>
  `;
}

function renderTaskChapterList(tasks) {
  if (!tasks.length) {
    return "";
  }

  const chapters = groupScenesByChapter(state.scenes)
    .map((chapter) => ({
      ...chapter,
      tasks: tasks.filter((task) => task.chapterId === chapter.chapterId),
    }))
    .filter((chapter) => chapter.tasks.length > 0);

  return `
    <div class="task-panel">
      <div class="task-panel-heading">
        <p class="selection-label">Tasks</p>
        <strong>${escapeHtml(String(tasks.length))}</strong>
      </div>
      <div class="task-chapter-list">
        ${chapters.map((chapter) => renderTaskChapterGroup(chapter)).join("")}
      </div>
    </div>
  `;
}

function renderTaskChapterGroup(chapter) {
  return `
    <section class="task-chapter-group">
      <div class="task-chapter-heading">
        <strong>${escapeHtml(chapter.chapterTitle)}</strong>
        <span>${escapeHtml(String(chapter.tasks.length))}</span>
      </div>
      <div class="task-list">
        ${chapter.tasks.map((task) => renderSceneTask(task)).join("")}
      </div>
    </section>
  `;
}

function renderSceneTask(task) {
  const isSelected = state.selectedTaskId === task.id;
  return `
    <div class="task-item ${isSelected ? "is-selected" : ""}" data-task-preview-id="${escapeHtml(task.id)}" tabindex="0">
      <div class="task-copy">
        <input
          class="inline-title-input task-title-input"
          type="text"
          value="${escapeHtml(task.title || `${task.sceneTitle || "Scene"} task ${task.taskNumber || 1}`)}"
          data-title-input
          data-edit-field="task-title"
          data-task-id="${escapeHtml(task.id)}"
          aria-label="Task title"
        />
        <span class="task-body">${escapeHtml(task.body || task.description || "No task body")}</span>
        ${isSelected ? `<em class="task-reference">Reference: ${escapeHtml(task.selectedText)}</em>` : ""}
      </div>
      <button class="tag-button task-complete-button" data-action="complete-task" data-task-id="${escapeHtml(task.id)}">Done</button>
    </div>
  `;
}

function renderIssue(issue) {
  const isSelected = issue.id === state.selectedIssueId;
  return `
    <button class="console-item ${isSelected ? "is-selected" : ""}" data-action="select-issue" data-issue-id="${escapeHtml(issue.id)}">
      <span class="console-meta">${escapeHtml(issue.severity)} · ${escapeHtml(issue.category)} · scene line ${issue.sceneLineNumber}</span>
      <strong>${escapeHtml(issue.summary)}</strong>
      <span>${escapeHtml(issue.sceneTitle)}</span>
    </button>
  `;
}

function renderIssueFocus(issue) {
  return `
    <div class="focus-card issue-focus">
      <p class="selection-label">Selected Issue</p>
      <h3>${escapeHtml(issue.summary)}</h3>
      <p>${escapeHtml(issue.detail ?? issue.evidenceExcerpt)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(issue.chapterTitle)}</span>
        <span>${escapeHtml(issue.sceneTitle)}</span>
        <span>Confidence ${Math.round(issue.confidence * 100)}%</span>
      </div>
    </div>
  `;
}

function renderEvent(eventTag) {
  const isSelectedLine = eventTag.blockId === state.selectedBlockId;
  return `
    <button class="console-item event-item ${isSelectedLine ? "is-selected" : ""}" data-action="select-event" data-event-id="${escapeHtml(eventTag.id)}">
      <span class="console-meta">${escapeHtml(eventTag.kind)} · scene line ${eventTag.sceneLineNumber}</span>
      <strong>${escapeHtml(eventTag.label)}</strong>
      <span>${escapeHtml(eventTag.evidenceExcerpt)}</span>
    </button>
  `;
}

function renderWorldPanel() {
  const workspace = state.workspace;
  document.querySelector("#world-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">World Spine View</p>
      <h2>${escapeHtml(workspace.world.title)}</h2>
    </div>
    <div class="spine-stack">
      ${workspace.world.spines.map((spine) => renderSpine(spine)).join("")}
    </div>
    <div class="edge-list">
      <h3>Cross-Spine Links</h3>
      ${workspace.world.edges.map((edge) => renderEdge(edge)).join("")}
    </div>
  `;
}

function renderSpine(spine) {
  return `
    <section class="spine-lane">
      <div class="spine-header">
        <div>
          <p class="selection-label">${escapeHtml(spine.kind)}</p>
          <h3>${escapeHtml(spine.label)}</h3>
        </div>
        <p>${escapeHtml(spine.description)}</p>
      </div>
      <div class="spine-track">
        ${spine.nodes.map((node) => renderNode(node)).join("")}
      </div>
    </section>
  `;
}

function renderNode(node) {
  const isSelected = node.id === state.selectedNodeId;
  return `
    <button class="node-card ${isSelected ? "is-selected" : ""}" data-action="select-node" data-node-id="${escapeHtml(node.id)}">
      <span class="node-order">0${node.order}</span>
      <strong>${escapeHtml(node.label)}</strong>
      <span>${escapeHtml(node.summary)}</span>
      <span class="node-meta">${escapeHtml(node.lineNumbers.length ? `Lines ${node.lineNumbers.join(", ")}` : "World-only")}</span>
    </button>
  `;
}

function renderEdge(edge) {
  const isRelated = edge.fromNodeId === state.selectedNodeId || edge.toNodeId === state.selectedNodeId;
  return `
    <div class="edge-card ${isRelated ? "is-related" : ""}">
      <span class="console-meta">${escapeHtml(edge.kind)}</span>
      <strong>${escapeHtml(edge.label ?? `${edge.fromNodeLabel} -> ${edge.toNodeLabel}`)}</strong>
      <span>${escapeHtml(edge.fromSpineLabel)} / ${escapeHtml(edge.fromNodeLabel)}</span>
      <span>${escapeHtml(edge.toSpineLabel)} / ${escapeHtml(edge.toNodeLabel)}</span>
    </div>
  `;
}

function renderEntityPanel() {
  const workspace = state.workspace;
  const selectedNode = getNode(state.selectedNodeId);
  const selectedEntity = getEntity(state.selectedEntityId);
  const nodeEdges = selectedNode
    ? workspace.world.edges.filter(
        (edge) => edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id,
      )
    : [];
  const templateRecords = [...workspace.world.templates, ...state.templateDrafts];
  const worldSuggestions = workspace.analysis.suggestionQueue.filter(
    (suggestion) => suggestion.suggestionType !== "dream-scaping",
  );

  document.querySelector("#entity-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">World Inspector</p>
      <h2>Entities and Links</h2>
    </div>
    ${selectedNode ? renderNodeFocus(selectedNode, nodeEdges) : ""}
    ${selectedEntity ? renderEntityFocus(selectedEntity) : ""}
    <div class="panel-heading split-heading">
      <p class="panel-kicker">World Templates</p>
      <h2>Template Library</h2>
    </div>
    <div class="panel-actions">
      <button class="tag-button panel-action-button" data-action="add-template">New template</button>
    </div>
    <div class="template-list">
      ${templateRecords.map((template) => renderTemplateCard(template)).join("")}
    </div>
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Review Queue</p>
      <h2>World Suggestions</h2>
    </div>
    <div class="suggestion-list">
      ${worldSuggestions.map((suggestion) => renderSuggestion(suggestion)).join("")}
    </div>
    <div class="panel-heading split-heading">
      <p class="panel-kicker">World Entities</p>
      <h2>Tracked Records</h2>
    </div>
    <div class="entity-list">
      ${workspace.world.entities.map((entity) => renderEntity(entity)).join("")}
    </div>
  `;
}

function renderNodeFocus(node, edges) {
  return `
    <div class="focus-card">
      <p class="selection-label">Selected Timeline Node</p>
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.summary)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(node.linkedEntityNames.join(", ") || "No linked entities")}</span>
        <span>${escapeHtml(node.lineNumbers.length ? `Lines ${node.lineNumbers.join(", ")}` : "World-only")}</span>
      </div>
      ${edges.length ? `<div class="focus-links">${edges.map((edge) => `<span>${escapeHtml(edge.kind)}: ${escapeHtml(edge.label ?? edge.id)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function renderEntity(entity) {
  const isSelected = entity.id === state.selectedEntityId;
  return `
    <button class="entity-card ${isSelected ? "is-selected" : ""}" data-action="select-entity" data-entity-id="${escapeHtml(entity.id)}">
      <span class="console-meta">${escapeHtml(entity.templateName)}</span>
      <strong>${escapeHtml(entity.name)}</strong>
      <span>${escapeHtml(entity.notes)}</span>
    </button>
  `;
}

function renderEntityFocus(entity) {
  return `
    <div class="focus-card entity-focus">
      <p class="selection-label">Selected Entity</p>
      <h3>${escapeHtml(entity.name)}</h3>
      <p>${escapeHtml(entity.notes)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(entity.templateName)}</span>
        <span>${escapeHtml(entity.introductionLineNumber ? `Introduced on line ${entity.introductionLineNumber}` : "No introduction anchor")}</span>
      </div>
      <div class="field-grid">
        ${entity.fields.map((field) => `<div class="field-card"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`).join("")}
      </div>
    </div>
  `;
}

function renderTemplateCard(template) {
  return `
    <div class="template-card ${template.isDraft ? "is-draft" : ""}">
      <span class="console-meta">${escapeHtml(template.key ?? "template")}</span>
      <strong>${escapeHtml(template.name)}</strong>
      <span>${escapeHtml(template.description ?? "Describe this world template.")}</span>
      <span>${escapeHtml(`${template.fieldCount ?? 0} fields`)}</span>
    </div>
  `;
}

function renderDreamScapingPanel() {
  const workspace = state.workspace;
  const dream = workspace.analysis.dreamScaping;
  const suggestions = dream
    ? workspace.analysis.suggestionQueue.filter((suggestion) =>
        dream.suggestionIds.includes(suggestion.id),
      )
    : [];

  document.querySelector("#dream-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Dream Scaping</p>
      <h2>Story-Fit Ideation</h2>
    </div>
    ${dream ? `
      <div class="focus-card">
        <p class="selection-label">Submitted Idea</p>
        <h3>${escapeHtml(dream.ideaTitle)}</h3>
        <p>${escapeHtml(dream.ideaText)}</p>
      </div>
    ` : ""}
    <div class="suggestion-list">
      ${suggestions.map((suggestion) => renderDreamSuggestion(suggestion)).join("")}
    </div>
  `;
}

function renderDreamSuggestion(suggestion) {
  return `
    <div class="suggestion-card dream-suggestion">
      <span class="console-meta">${escapeHtml(suggestion.suggestionType)} · ${escapeHtml(suggestion.reviewState)}</span>
      <strong>${escapeHtml(suggestion.title)}</strong>
      <p>${escapeHtml(suggestion.rationale)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(suggestion.fit ?? "story fit")}</span>
        <span>${escapeHtml(suggestion.placementLabel ?? "placement pending")}</span>
      </div>
      <div class="focus-links">
        <span>${escapeHtml(suggestion.revisionPrompt ?? "")}</span>
      </div>
      <div class="suggestion-actions">
        ${suggestion.evidence.map((evidence) => `
          <button class="tag-button tag-event" data-action="select-line" data-line-id="${escapeHtml(evidence.blockId)}">
            Open scene line ${escapeHtml(String(evidence.sceneLineNumber))}
          </button>
        `).join("")}
        ${suggestion.nodeId ? `
          <button class="tag-button tag-issue" data-action="select-node" data-node-id="${escapeHtml(suggestion.nodeId)}">
            Open node
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderSuggestion(suggestion) {
  return `
    <div class="suggestion-card">
      <span class="console-meta">${escapeHtml(suggestion.suggestionType)} · ${escapeHtml(suggestion.reviewState)}</span>
      <strong>${escapeHtml(suggestion.title)}</strong>
      <p>${escapeHtml(suggestion.rationale)}</p>
      <div class="focus-links">
        ${suggestion.detailLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </div>
      <div class="suggestion-actions">
        ${suggestion.evidence.map((evidence) => `
          <button class="tag-button tag-event" data-action="select-line" data-line-id="${escapeHtml(evidence.blockId)}">
            Open scene line ${escapeHtml(String(evidence.sceneLineNumber))}
          </button>
        `).join("")}
        ${suggestion.nodeId ? `
          <button class="tag-button tag-issue" data-action="select-node" data-node-id="${escapeHtml(suggestion.nodeId)}">
            Open node
          </button>
        ` : ""}
        ${suggestion.entityId ? `
          <button class="tag-button tag-issue" data-action="select-entity" data-entity-id="${escapeHtml(suggestion.entityId)}">
            Open entity
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderNarrationPanel() {
  const workspace = state.workspace;
  document.querySelector("#narration-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Narration Follow</p>
      <h2>${escapeHtml(workspace.narration.session.sessionLabel)}</h2>
    </div>
    <div class="focus-card">
      <p class="selection-label">Current Tracked Line</p>
      <h3>Line ${workspace.narration.session.currentLineNumber}</h3>
      <p>${escapeHtml(workspace.narration.session.currentText)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(workspace.narration.provider.label)}</span>
        <span>${escapeHtml(workspace.narration.provider.alignmentStrategy)}</span>
      </div>
    </div>
    <div class="event-list">
      ${workspace.narration.alignmentJobs.map((job) => `
        <div class="console-item">
          <span class="console-meta">${escapeHtml(job.status)} alignment</span>
          <strong>Matched line ${job.result?.matchedLineNumber ?? "?"}</strong>
          <span>${escapeHtml(job.result?.resolvedText ?? "")}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderVoicePanel() {
  const workspace = state.workspace;
  document.querySelector("#voice-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Character Voice Narration</p>
      <h2>Voice Routing</h2>
    </div>
    <div class="voice-grid">
      <div>
        <h3>Profiles</h3>
        <div class="entity-list">
          ${workspace.voice.profiles.map((profile) => `
            <div class="entity-card">
              <span class="console-meta">${escapeHtml(profile.role)}</span>
              <strong>${escapeHtml(profile.label)}</strong>
              <span>${escapeHtml(profile.style)}</span>
            </div>
          `).join("")}
        </div>
      </div>
      <div>
        <h3>Bindings</h3>
        <div class="entity-list">
          ${workspace.voice.bindings.map((binding) => `
            <div class="entity-card">
              <span class="console-meta">${escapeHtml(binding.voiceProfileId)}</span>
              <strong>${escapeHtml(binding.speakerLabel)}</strong>
              <span>${escapeHtml(binding.previewText)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
    <div class="edge-list">
      <h3>Render Jobs</h3>
      ${workspace.voice.renderJobs.map((job) => `
        <div class="edge-card">
          <span class="console-meta">${escapeHtml(job.type)} · ${escapeHtml(job.status)}</span>
          <strong>${escapeHtml(job.result?.outputLabel ?? job.id)}</strong>
          <span>${escapeHtml(`${job.result?.clipCount ?? 0} clips`)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStat(label, value) {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function buildEditorStyle() {
  return [
    `--editor-content-width:${state.editorPrefs.editorWidth}px`,
    `--editor-font-size:${state.editorPrefs.fontSize}px`,
    `--editor-line-height:${state.editorPrefs.lineHeight}`,
    `--editor-font-stack:${getFontStack()}`,
  ].join("; ");
}

function getFontStack() {
  return FONT_OPTIONS.find((option) => option.id === state.editorPrefs.fontFamilyId)?.stack
    ?? FONT_OPTIONS[0].stack;
}

function syncSceneDocumentLayout() {
  const editor = document.querySelector("[data-scene-editor]");
  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const textarea = editor.querySelector(".editor-document-input");
  const gutter = editor.querySelector("[data-editor-gutter]");
  if (!(textarea instanceof HTMLTextAreaElement) || !(gutter instanceof HTMLElement)) {
    return;
  }

  textarea.style.height = "0px";
  const scrollHeight = textarea.scrollHeight;
  textarea.style.height = `${scrollHeight}px`;

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight || "0") || 1;
  const paddingTop = parseFloat(style.paddingTop || "0");
  const paddingBottom = parseFloat(style.paddingBottom || "0");
  const visualLineCount = Math.max(
    1,
    Math.round((scrollHeight - paddingTop - paddingBottom) / lineHeight),
  );

  gutter.innerHTML = Array.from({ length: visualLineCount }, (_, index) => `
    <span class="editor-gutter-line">${index + 1}</span>
  `).join("");
  syncInlinePassageDraftLayout();
}

function syncInlinePassageDraftLayout() {
  document
    .querySelectorAll("[data-inline-passage-draft] textarea")
    .forEach((field) => {
      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    });
}

function refreshScenes() {
  state.scenes = buildSceneRecords(
    state.workspace,
    state.sceneDrafts,
    state.structureDrafts,
  );
}

function loadSceneDrafts() {
  const candidate = readStoredJson(EDITOR_DRAFTS_KEY);
  return candidate && typeof candidate === "object" ? candidate : {};
}

function loadStructureDrafts() {
  const candidate = readStoredJson(EDITOR_STRUCTURE_KEY);
  return candidate && typeof candidate === "object"
    ? candidate
    : createStructureDrafts();
}

function loadTemplateDrafts() {
  const candidate = readStoredJson(EDITOR_TEMPLATE_DRAFTS_KEY);
  return Array.isArray(candidate) ? candidate : createTemplateDrafts();
}

function loadManuscriptTasks() {
  return normalizeManuscriptTasks(readStoredJson(EDITOR_TASKS_KEY));
}

function loadPassageNotes() {
  return normalizePassageNotes(readStoredJson(EDITOR_PASSAGE_NOTES_KEY));
}

function loadProjectTitle(defaultTitle) {
  const candidate = readStoredJson(EDITOR_PROJECT_TITLE_KEY);
  return typeof candidate === "string" && candidate.trim()
    ? candidate
    : defaultTitle;
}

function loadEditorPrefs() {
  return normalizeEditorPrefs(readStoredJson(EDITOR_PREFS_KEY));
}

function loadLocalAiPrefs() {
  return normalizeLocalAiPrefs(readStoredJson(EDITOR_LOCAL_AI_PREFS_KEY));
}

function getEditorContextFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest("[data-inline-passage-draft]")) {
    return null;
  }

  const codeframe = target.closest("[data-scene-editor]");
  const textarea =
    target instanceof HTMLTextAreaElement && target.classList.contains("editor-document-input")
      ? target
      : codeframe?.querySelector(".editor-document-input");

  if (!(codeframe instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (!(target instanceof HTMLTextAreaElement)) {
    const cursorOffset = textarea.value.length;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(cursorOffset, cursorOffset);
  }

  const contextRange = getEditorContextRange(textarea) ?? {
    selectedText: "",
    startOffset: textarea.selectionStart,
    endOffset: textarea.selectionStart,
    hasExplicitSelection: false,
  };

  return {
    textarea,
    contextRange,
    inlinePosition: getInlinePassagePosition(codeframe, event),
  };
}

function getInlinePassagePosition(codeframe, event) {
  const bounds = codeframe.getBoundingClientRect();
  const maxLeft = Math.max(92, codeframe.clientWidth - 390);
  const left = Math.max(92, Math.min(maxLeft, event.clientX - bounds.left + codeframe.scrollLeft));
  const top = Math.max(24, event.clientY - bounds.top + codeframe.scrollTop);

  return { x: left, y: top };
}

function getEditorContextRange(textarea) {
  const value = textarea.value;
  const explicitStart = textarea.selectionStart;
  const explicitEnd = textarea.selectionEnd;

  if (explicitEnd > explicitStart && value.slice(explicitStart, explicitEnd).trim()) {
    return trimTextRange(value, explicitStart, explicitEnd, true);
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, explicitStart - 1)) + 1;
  const nextBreak = value.indexOf("\n", explicitStart);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  if (lineEnd <= lineStart || !value.slice(lineStart, lineEnd).trim()) {
    return null;
  }

  return trimTextRange(value, lineStart, lineEnd, false);
}

function trimTextRange(value, startOffset, endOffset, hasExplicitSelection) {
  let nextStart = startOffset;
  let nextEnd = endOffset;

  while (nextStart < nextEnd && /\s/.test(value[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(value[nextEnd - 1])) {
    nextEnd -= 1;
  }

  if (nextEnd <= nextStart) {
    return null;
  }

  return {
    selectedText: value.slice(nextStart, nextEnd),
    startOffset: nextStart,
    endOffset: nextEnd,
    hasExplicitSelection,
  };
}

function selectWorkspacePane(paneId) {
  if (!["manuscript", "world", "narration", "voice"].includes(paneId)) {
    return;
  }

  state.activePane = paneId;
  renderHeader();
  renderPaneVisibility();

  if (paneId === "manuscript") {
    syncSceneDocumentLayout();
  }
}

function renderPaneVisibility() {
  document.querySelectorAll("[data-pane-section]").forEach((section) => {
    const paneId = section instanceof HTMLElement ? section.dataset.paneSection : null;
    section.toggleAttribute("hidden", paneId !== state.activePane);
  });
}

function selectSidePanel(panelId) {
  if (!["issues", "inspiration", "research"].includes(panelId)) {
    return;
  }

  state.sidePanelMode = panelId;
  if (panelId === "issues") {
    state.selectedPassageNoteId = null;
  } else {
    const selectedNote = state.passageNotes.find((note) =>
      note.noteType === panelId && note.id === state.selectedPassageNoteId,
    );
    state.selectedPassageNoteId =
      selectedNote?.id ??
      state.passageNotes.find((note) => note.noteType === panelId)?.id ??
      null;
  }
  renderConsolePanel();
}

function focusEditorWhitespace(clickTarget, event) {
  const codeframe = clickTarget?.closest("[data-scene-editor]");
  if (!(codeframe instanceof HTMLElement)) {
    return false;
  }

  if (clickTarget?.closest(".editor-document-input")) {
    return false;
  }

  if (!clickTarget?.closest(".editor-document-body")) {
    return false;
  }

  const textarea = codeframe.querySelector(".editor-document-input");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  event.preventDefault();
  clearTaskAnchorPreview({ restoreSelection: false });

  const cursorOffset = textarea.value.length;
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(cursorOffset, cursorOffset);
  centerEditorOnCaret(textarea);
  return true;
}

function navigateTaskAnchor(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return;
  }

  state.selectedTaskId = task.id;
  clearTaskAnchorPreview({ restoreSelection: false });

  if (state.selectedSceneId !== task.sceneId) {
    selectSceneById(task.sceneId);
    window.requestAnimationFrame(() => focusTaskRange(task, { behavior: "smooth" }));
    return;
  }

  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
}

function focusTaskRange(task, options = {}) {
  const textarea = getEditorTextareaForScene(task.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const resolvedRange = resolveManuscriptTaskRange(task, textarea.value);
  syncResolvedTaskRange(task, resolvedRange);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: startOffset,
    selectionEnd: endOffset,
    wasFocused: true,
    pinned: true,
  };

  textarea.classList.add("has-task-preview");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
  centerEditorOnOffset(textarea, startOffset, options);
}

function previewTaskAnchor(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return;
  }

  const textarea = getEditorTextareaForScene(task.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (state.taskPreview?.taskId === task.id) {
    return;
  }

  clearTaskAnchorPreview({ restoreSelection: true });

  const resolvedRange = resolveManuscriptTaskRange(task, textarea.value);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");
  const taskElement = document.querySelector(`[data-task-preview-id="${CSS.escape(task.id)}"]`);

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    wasFocused: document.activeElement === textarea,
    pinned: false,
  };

  textarea.classList.add("has-task-preview");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
  }
  if (taskElement instanceof HTMLElement) {
    taskElement.classList.add("is-previewing");
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
}

function getEditorTextareaForScene(sceneId) {
  return document.querySelector(
    `.editor-document-input[data-scene-id="${CSS.escape(sceneId)}"]`,
  );
}

function syncResolvedTaskRange(task, resolvedRange) {
  if (!resolvedRange.matched) {
    return;
  }

  if (
    task.startOffset === resolvedRange.startOffset &&
    task.endOffset === resolvedRange.endOffset
  ) {
    return;
  }

  state.manuscriptTasks = state.manuscriptTasks.map((candidate) =>
    candidate.id === task.id
      ? {
          ...candidate,
          startOffset: resolvedRange.startOffset,
          endOffset: resolvedRange.endOffset,
        }
      : candidate,
  );
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
}

function centerEditorOnCaret(textarea) {
  centerEditorOnOffset(textarea, textarea.selectionStart);
}

function centerEditorOnOffset(textarea, offset, options = {}) {
  const codeframe = textarea.closest(".scene-editor-codeframe");
  if (!(codeframe instanceof HTMLElement)) {
    return;
  }

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight || "0") || 1;
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const body = textarea.closest(".editor-document-body");
  const bodyStyle = body instanceof HTMLElement ? window.getComputedStyle(body) : null;
  const paddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || "0") : 0;
  const measuredOffsetTop = measureTextareaOffsetTop(textarea, offset);
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const charactersPerLine = Math.max(
    8,
    Math.floor(textarea.clientWidth / approximateCharacterWidth),
  );
  const visualLine = estimateVisualLineBeforeOffset(
    textarea.value,
    offset,
    charactersPerLine,
  );
  const offsetTop = Number.isFinite(measuredOffsetTop)
    ? measuredOffsetTop
    : visualLine * lineHeight;
  const targetTop = paddingTop + offsetTop - codeframe.clientHeight / 2 + lineHeight;
  const maxScrollTop = Math.max(0, codeframe.scrollHeight - codeframe.clientHeight);
  const top = Math.max(0, Math.min(maxScrollTop, targetTop));

  codeframe.scrollTo({
    top,
    behavior: options.behavior ?? "auto",
  });
}

function measureTextareaOffsetTop(textarea, offset) {
  const style = window.getComputedStyle(textarea);
  const marker = document.createElement("span");
  const mirror = document.createElement("div");
  const bounds = textarea.getBoundingClientRect();
  const mirroredProperties = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "overflowWrap",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "tabSize",
    "textIndent",
    "textTransform",
    "wordBreak",
    "wordSpacing",
  ];

  for (const property of mirroredProperties) {
    mirror.style[property] = style[property];
  }

  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    top: "0",
    left: "-9999px",
    width: `${bounds.width}px`,
    minHeight: "0",
    height: "auto",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  });

  const safeOffset = Math.max(0, Math.min(offset, textarea.value.length));
  mirror.append(document.createTextNode(textarea.value.slice(0, safeOffset)));
  marker.textContent = "\u200b";
  mirror.append(marker);
  mirror.append(document.createTextNode(textarea.value.slice(safeOffset) || "\u200b"));
  document.body.append(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
}

function estimateVisualLineBeforeOffset(text, offset, charactersPerLine) {
  const beforeCursor = String(text ?? "").slice(0, Math.max(0, offset));
  const logicalLines = beforeCursor.split("\n");
  let visualLine = 0;

  for (let index = 0; index < logicalLines.length; index += 1) {
    const line = logicalLines[index];
    if (index === logicalLines.length - 1) {
      visualLine += Math.floor(line.length / charactersPerLine);
      continue;
    }

    visualLine += Math.max(1, Math.ceil(line.length / charactersPerLine));
  }

  return visualLine;
}

function clearTaskAnchorPreview(options = {}) {
  const preview = state.taskPreview;
  if (!preview) {
    return;
  }

  const restoreSelection = options.restoreSelection ?? true;
  const textarea = document.querySelector(
    `.editor-document-input[data-scene-id="${CSS.escape(preview.sceneId)}"]`,
  );

  if (textarea instanceof HTMLTextAreaElement) {
    textarea.classList.remove(
      "has-task-preview",
      "has-passage-note-preview",
      "has-inspiration-preview",
      "has-research-preview",
    );
    textarea.closest(".scene-editor-codeframe")?.classList.remove(
      "is-task-previewing",
      "is-passage-note-previewing",
      "is-inspiration-previewing",
      "is-research-previewing",
    );

    if (restoreSelection) {
      if (preview.wasFocused) {
        textarea.setSelectionRange(preview.selectionStart, preview.selectionEnd);
      } else {
        textarea.setSelectionRange(textarea.selectionEnd, textarea.selectionEnd);
        textarea.blur();
      }
    }
  }

  document
    .querySelectorAll("[data-task-preview-id].is-previewing")
    .forEach((element) => element.classList.remove("is-previewing"));
  state.taskPreview = null;
}

function openPassageNoteComposerFromContextMenu(noteType) {
  const menu = state.taskContextMenu;
  if (!menu || (noteType !== "inspiration" && noteType !== "research")) {
    return;
  }

  state.sidePanelMode = noteType;
  state.taskContextMenu = null;
  state.taskComposer = null;
  const selectedText = menu.hasExplicitSelection ? String(menu.selectedText ?? "") : "";
  const anchorStartOffset = menu.hasExplicitSelection
    ? menu.startOffset
    : menu.insertionOffset;
  const anchorEndOffset = menu.hasExplicitSelection
    ? menu.endOffset
    : menu.insertionOffset;
  state.inlinePassageDraft = {
    sceneId: menu.sceneId,
    noteType,
    selectedText,
    startOffset: anchorStartOffset,
    endOffset: anchorEndOffset,
    anchorStartOffset,
    seededSelection: Boolean(menu.hasExplicitSelection),
    typedStartOffset: null,
    typedEndOffset: null,
    body: "",
    typedText: selectedText,
    x: menu.inlinePosition?.x ?? 110,
    y: menu.inlinePosition?.y ?? 40,
  };
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  renderTaskContextMenu();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const field = document.querySelector("[data-edit-field='inline-passage-note']");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    }
  });
}

function savePassageNoteFromComposer() {
  const composer = state.taskComposer;
  if (!composer || composer.composerType !== "passage-note") {
    return;
  }

  const scene = getScene(composer.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  const noteInput = document.querySelector("[data-passage-note-body]");
  const body = noteInput instanceof HTMLTextAreaElement ? noteInput.value.trim() : "";

  if (!body) {
    if (noteInput instanceof HTMLTextAreaElement) {
      noteInput.focus();
    }
    return;
  }

  const note = {
    ...createPassageNote(scene, {
      selectedText: composer.selectedText,
      startOffset: composer.startOffset,
      endOffset: composer.endOffset,
      body,
    }, composer.noteType),
  };

  state.passageNotes = [note, ...state.passageNotes];
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  maybeSuggestPassageNoteTitle(note);
  state.taskComposer = null;
  renderConsolePanel();
  renderTaskContextMenu();
  focusPassageNoteRange(note, { behavior: "smooth" });
}

function commitInlinePassageNote() {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return;
  }

  const scene = getScene(draft.sceneId);
  if (!scene) {
    cancelInlinePassageNote();
    return;
  }

  const noteField = document.querySelector("[data-edit-field='inline-passage-note']");
  const verseField = document.querySelector("[data-edit-field='inline-passage-verse']");
  const body = noteField instanceof HTMLTextAreaElement
    ? noteField.value.trim()
    : String(draft.body ?? "").trim();
  const pendingVerseText = verseField instanceof HTMLTextAreaElement
    ? verseField.value
    : String(draft.typedText ?? "");

  if (!body) {
    if (noteField instanceof HTMLTextAreaElement) {
      noteField.focus();
    }
    return;
  }

  const editorText = getCurrentSceneEditorText(draft.sceneId, scene.editorText ?? "");
  let anchor = null;

  if (pendingVerseText.trim()) {
    const insertion = insertInlinePassageVerse(draft, pendingVerseText, editorText);
    if (!insertion) {
      focusTypedVerseTarget(draft);
      return;
    }
    anchor = insertion.anchor;
  } else {
    anchor = getInlinePassageDraftAnchor(draft, editorText);
  }

  if (!anchor) {
    focusTypedVerseTarget(draft);
    updateInlinePassageDraftStatus(editorText);
    return;
  }

  const note = createPassageNote(scene, {
    selectedText: anchor.selectedText,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    body,
  }, draft.noteType);

  state.passageNotes = [note, ...state.passageNotes];
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.inlinePassageDraft = null;
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  maybeSuggestPassageNoteTitle(note);
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  renderConsolePanel();
  focusPassageNoteRange(note, { behavior: "smooth" });
}

function cancelInlinePassageNote() {
  state.inlinePassageDraft = null;
  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function trackInlinePassageDraftTyping(sceneId, previousText, textarea) {
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== sceneId || !(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const nextText = textarea.value;
  const previous = String(previousText ?? "");
  if (previous === nextText) {
    return;
  }

  const change = getTextChangeRange(previous, nextText);
  if (!change) {
    return;
  }

  const anchorStart = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : change.startOffset;
  const previousTypedStart = Number.isInteger(draft.typedStartOffset)
    ? draft.typedStartOffset
    : null;
  const previousTypedEnd = Number.isInteger(draft.typedEndOffset)
    ? draft.typedEndOffset
    : null;
  const delta = nextText.length - previous.length;

  let typedStart = previousTypedStart;
  let typedEnd = previousTypedEnd;

  if (typedStart === null || typedEnd === null || typedEnd <= typedStart) {
    if (change.endOffset <= change.startOffset || change.startOffset < anchorStart - 1) {
      return;
    }
    typedStart = change.startOffset;
    typedEnd = change.endOffset;
  } else if (change.startOffset <= typedEnd + 1) {
    typedStart = Math.min(typedStart, change.startOffset);
    typedEnd = Math.max(typedStart, typedEnd + delta, change.endOffset);
  } else {
    return;
  }

  state.inlinePassageDraft = {
    ...draft,
    typedStartOffset: clampEditorOffset(typedStart, nextText.length),
    typedEndOffset: clampEditorOffset(typedEnd, nextText.length),
  };
}

function getTextChangeRange(previousText, nextText) {
  let prefixLength = 0;
  const shortestLength = Math.min(previousText.length, nextText.length);

  while (
    prefixLength < shortestLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const endOffset = nextText.length - suffixLength;
  return endOffset >= prefixLength
    ? {
        startOffset: prefixLength,
        endOffset,
      }
    : null;
}

function insertInlinePassageVerse(draft, verseText, editorText) {
  const content = String(editorText ?? "");
  const rawVerseText = String(verseText ?? "");
  const existingRange = getInlinePassageDraftExistingSelectionRange(draft, content);
  const replacementStartOffset = existingRange?.startOffset
    ?? clampEditorOffset(draft.anchorStartOffset, content.length);
  const replacementEndOffset = existingRange?.endOffset ?? replacementStartOffset;
  const nextEditorText = `${content.slice(0, replacementStartOffset)}${rawVerseText}${content.slice(replacementEndOffset)}`;
  const insertedEndOffset = replacementStartOffset + rawVerseText.length;
  const anchor = trimTextRange(nextEditorText, replacementStartOffset, insertedEndOffset, true);

  if (!anchor || !anchor.selectedText.trim()) {
    return null;
  }

  updateSceneDraft(draft.sceneId, (sceneDraft) => {
    sceneDraft.editorText = nextEditorText;
  });

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = nextEditorText;
    textarea.setSelectionRange(anchor.startOffset, anchor.endOffset, "forward");
  }

  return {
    editorText: nextEditorText,
    anchor,
  };
}

function getInlinePassageDraftExistingSelectionRange(draft, editorText) {
  if (!draft?.seededSelection) {
    return null;
  }

  const content = String(editorText ?? "");
  const startOffset = clampEditorOffset(draft.startOffset, content.length);
  const endOffset = clampEditorOffset(draft.endOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  return {
    startOffset,
    endOffset,
  };
}

function getInlinePassageDraftPendingVerse(draft) {
  const rawVerseText = String(draft?.typedText ?? "");
  if (!rawVerseText.trim()) {
    return null;
  }

  const range = trimTextRange(rawVerseText, 0, rawVerseText.length, true);
  if (!range || !range.selectedText.trim()) {
    return null;
  }

  const anchorStartOffset = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : 0;

  return {
    selectedText: range.selectedText,
    startOffset: anchorStartOffset + range.startOffset,
    endOffset: anchorStartOffset + range.endOffset,
  };
}

function getInlinePassageDraftAnchor(draft, editorText, options = {}) {
  if (!draft) {
    return null;
  }

  if (options.includePendingVerse) {
    const pendingVerse = getInlinePassageDraftPendingVerse(draft);
    if (pendingVerse) {
      return pendingVerse;
    }
  }

  const content = String(editorText ?? "");
  const startOffset = clampEditorOffset(draft.typedStartOffset, content.length);
  const endOffset = clampEditorOffset(draft.typedEndOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  const range = trimTextRange(content, startOffset, endOffset, true);
  if (!range || !range.selectedText.trim()) {
    return null;
  }

  return range;
}

function updateInlinePassageDraftStatus(editorText) {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return;
  }

  const label = draft.noteType === "research" ? "Research" : "Inspiration";
  const anchor = getInlinePassageDraftAnchor(draft, editorText, {
    includePendingVerse: true,
  });
  const status = document.querySelector("[data-inline-passage-status]");
  if (status) {
    status.textContent = anchor
      ? `${label} will save against: ${anchor.selectedText.slice(0, 96)}`
      : `Save this ${getPassageNoteVerb(draft.noteType)} note against the verse typed in the manuscript field below.`;
  }
}

function getCurrentSceneEditorText(sceneId, fallbackText = "") {
  const textarea = getEditorTextareaForScene(sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    return textarea.value;
  }
  return String(fallbackText ?? "");
}

function focusTypedVerseTarget(draft) {
  const verseField = document.querySelector("[data-edit-field='inline-passage-verse']");
  if (verseField instanceof HTMLTextAreaElement) {
    verseField.focus();
    return;
  }

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const offset = clampEditorOffset(draft.anchorStartOffset, textarea.value.length);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(offset, offset);
  centerEditorOnCaret(textarea);
}

function clampEditorOffset(value, textLength) {
  const numericValue = Number(value);
  const length = Math.max(0, Number(textLength) || 0);
  if (!Number.isInteger(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(numericValue, length));
}

function selectPassageNote(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return;
  }

  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  renderConsolePanel();
  focusPassageNoteRange(note, { behavior: "smooth" });
}

function focusPassageNoteRange(note, options = {}) {
  if (state.selectedSceneId !== note.sceneId) {
    selectSceneById(note.sceneId);
    window.requestAnimationFrame(() => {
      const latestNote = state.passageNotes.find((candidate) => candidate.id === note.id) ?? note;
      focusPassageNoteRangeInCurrentScene(latestNote, options);
    });
    return;
  }

  focusPassageNoteRangeInCurrentScene(note, options);
}

function focusPassageNoteRangeInCurrentScene(note, options = {}) {
  const textarea = getEditorTextareaForScene(note.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const resolvedRange = resolveManuscriptTaskRange(note, textarea.value);
  syncResolvedPassageNoteRange(note, resolvedRange);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");

  clearTaskAnchorPreview({ restoreSelection: false });

  state.taskPreview = {
    taskId: note.id,
    sceneId: note.sceneId,
    selectionStart: startOffset,
    selectionEnd: endOffset,
    wasFocused: true,
    pinned: true,
  };

  textarea.classList.add("has-task-preview");
  textarea.classList.add("has-passage-note-preview", `has-${note.noteType}-preview`);
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
    codeframe.classList.add("is-passage-note-previewing", `is-${note.noteType}-previewing`);
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
  centerEditorOnOffset(textarea, startOffset, options);
}

function syncResolvedPassageNoteRange(note, resolvedRange) {
  if (!resolvedRange.matched) {
    return;
  }

  if (
    note.startOffset === resolvedRange.startOffset &&
    note.endOffset === resolvedRange.endOffset
  ) {
    return;
  }

  state.passageNotes = state.passageNotes.map((candidate) =>
    candidate.id === note.id
      ? {
          ...candidate,
          startOffset: resolvedRange.startOffset,
          endOffset: resolvedRange.endOffset,
        }
      : candidate,
  );
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
}

function openTaskComposerFromContextMenu(event) {
  const menu = state.taskContextMenu;
  if (!menu) {
    return;
  }

  const scene = getScene(menu.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  state.taskContextMenu = null;
  state.taskComposer = {
    ...menu,
    composerType: "task",
    x: event.clientX + 10,
    y: event.clientY,
  };
  renderTaskContextMenu();
}

function saveTaskFromComposer() {
  const composer = state.taskComposer;
  if (!composer) {
    return;
  }

  const scene = getScene(composer.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  const descriptionInput = document.querySelector("[data-task-description]");
  const body =
    descriptionInput instanceof HTMLTextAreaElement ? descriptionInput.value.trim() : "";

  if (!body) {
    if (descriptionInput instanceof HTMLTextAreaElement) {
      descriptionInput.focus();
    }
    return;
  }

  const task = createManuscriptTask(scene, {
    body,
    taskNumber: getNextTaskNumberForScene(scene.sceneId),
    selectedText: composer.selectedText,
    startOffset: composer.startOffset,
    endOffset: composer.endOffset,
  });
  state.manuscriptTasks = [...state.manuscriptTasks, task];
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
  maybeSuggestTaskTitle(task);
  state.taskComposer = null;
  renderBinderPanel();
  renderConsolePanel();
  renderTaskContextMenu();
}

async function suggestSceneTitle(sceneId) {
  const scene = getScene(sceneId);
  if (!scene || !state.localAiPrefs.enabled) {
    return;
  }

  state.localAiTitleStatus = {
    ...state.localAiTitleStatus,
    [scene.sceneId]: "loading",
  };
  renderManuscriptPanel();
  syncSceneDocumentLayout();

  const result = await requestLocalAiTitle({
    userInput: scene.editorText || scene.sceneSynopsis || scene.sceneTitle,
    manuscriptContext: [
      `Chapter: ${scene.chapterTitle}`,
      `Current scene title: ${scene.sceneTitle}`,
      `Scene text:\n${scene.editorText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 24,
  });

  if (result.ok) {
    applySceneTitle(scene.sceneId, result.title);
    state.localAiTitleStatus = {
      ...state.localAiTitleStatus,
      [scene.sceneId]: "Suggested",
    };
  } else {
    state.localAiTitleStatus = {
      ...state.localAiTitleStatus,
      [scene.sceneId]: result.message,
    };
  }

  renderBinderPanel();
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
}

function maybeSuggestTaskTitle(task) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = task.title;
  requestLocalAiTitle({
    userInput: task.body || task.description || "",
    manuscriptContext: [
      `Chapter: ${task.chapterTitle}`,
      `Scene: ${task.sceneTitle}`,
      `Referenced manuscript text:\n${task.selectedText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 20,
  }).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentTask = state.manuscriptTasks.find((candidate) => candidate.id === task.id);
    if (!currentTask || currentTask.title !== fallbackTitle) {
      return;
    }

    state.manuscriptTasks = updateManuscriptTaskTitle(
      state.manuscriptTasks,
      task.id,
      result.title,
    );
    writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest task title", error));
}

function maybeSuggestPassageNoteTitle(note) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = note.title;
  requestLocalAiTitle({
    userInput: note.body || "",
    manuscriptContext: [
      `Chapter: ${note.chapterTitle}`,
      `Scene: ${note.sceneTitle}`,
      `Referenced manuscript text:\n${note.selectedText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 20,
  }).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentNote = state.passageNotes.find((candidate) => candidate.id === note.id);
    if (!currentNote || currentNote.title !== fallbackTitle) {
      return;
    }

    state.passageNotes = updatePassageNoteTitle(
      state.passageNotes,
      note.id,
      result.title,
    );
    writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest passage note title", error));
}

async function requestLocalAiTitle({ userInput, manuscriptContext, projectContext, maxTokens }) {
  try {
    const response = await fetch("/api/local-ai/generate-title", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userInput,
        manuscriptContext,
        projectContext,
        outputFormat: "text",
        maxTokens,
        temperature: 0.25,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "Local AI unavailable",
      };
    }

    const payload = await response.json();
    if (!payload.ok) {
      return {
        ok: false,
        message: localAiUnavailableMessage(payload),
      };
    }

    const title = sanitizeSuggestedTitle(payload.text);
    if (!title) {
      return {
        ok: false,
        message: "No title returned",
      };
    }

    return {
      ok: true,
      title,
    };
  } catch (error) {
    console.warn("Local AI title request failed", error);
    return {
      ok: false,
      message: "Local AI unavailable",
    };
  }
}

function localAiUnavailableMessage(payload) {
  if (payload?.reason === "provider_unavailable") {
    return "Local AI unavailable";
  }

  if (payload?.reason === "tier_not_configured") {
    return "AI tier not configured";
  }

  return "Title not generated";
}

function sanitizeSuggestedTitle(value) {
  const cleaned = String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s"']+|["']+$/g, "").trim())
    .find(Boolean);

  if (!cleaned) {
    return "";
  }

  return cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;
}

function applySceneTitle(sceneId, title) {
  updateSceneDraft(sceneId, (draft) => {
    draft.sceneTitle = title;
  });
  updateSceneTitleLabel(sceneId, title);
  updateFocusedLineCard();
}

function getNextTaskNumberForScene(sceneId) {
  return state.manuscriptTasks
    .filter((task) => task.sceneId === sceneId)
    .reduce((highestTaskNumber, task) => {
      const taskNumber =
        Number.isInteger(task.taskNumber) && task.taskNumber > 0
          ? task.taskNumber
          : 0;
      return Math.max(highestTaskNumber, taskNumber);
    }, 0) + 1;
}

function cancelTaskComposer() {
  state.taskComposer = null;
  renderTaskContextMenu();
}

function completeTask(taskId) {
  if (!taskId) {
    return;
  }

  if (state.selectedTaskId === taskId) {
    state.selectedTaskId = null;
  }
  clearTaskAnchorPreview();
  state.manuscriptTasks = completeManuscriptTask(state.manuscriptTasks, taskId);
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
  renderBinderPanel();
  renderConsolePanel();
}

function hideTaskContextMenu() {
  if (!state.taskContextMenu) {
    return;
  }

  state.taskContextMenu = null;
  renderTaskContextMenu();
}

function hideTaskSurfaces() {
  if (!state.taskContextMenu && !state.taskComposer) {
    return;
  }

  state.taskContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
}

function updateSceneDraft(sceneId, mutate) {
  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  const draft = cloneValue(state.sceneDrafts[sceneId] ?? createSceneDraft(scene));
  mutate(draft);
  state.sceneDrafts = {
    ...state.sceneDrafts,
    [sceneId]: draft,
  };
  writeStoredJson(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
}

function resetSceneDraft(sceneId) {
  if (!state.sceneDrafts[sceneId]) {
    return;
  }

  const nextDrafts = { ...state.sceneDrafts };
  delete nextDrafts[sceneId];
  state.sceneDrafts = nextDrafts;
  writeStoredJson(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
}

function addChapterDraft() {
  const chapterCount = groupScenesByChapter(state.scenes).length + 1;
  const timestamp = Date.now();
  const sceneId = `draft-scene-${timestamp}`;
  const chapterId = `draft-chapter-${timestamp}`;
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: [
      ...cloneValue(state.structureDrafts.scenes ?? []),
      {
        sceneId,
        chapterId,
        chapterTitle: `New Chapter ${chapterCount}`,
        sceneTitle: "New Scene",
        initialText: "",
      },
    ],
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

function addSceneDraft() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  if (!selectedScene) {
    return;
  }

  const sceneCount = getScenesForChapter(selectedScene.chapterId).length + 1;
  const sceneId = `draft-scene-${Date.now()}`;
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: [
      ...cloneValue(state.structureDrafts.scenes ?? []),
      {
        sceneId,
        chapterId: selectedScene.chapterId,
        chapterTitle: selectedScene.chapterTitle,
        sceneTitle: `New Scene ${sceneCount}`,
        initialText: "",
      },
    ],
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

function addTemplateDraft() {
  const templateNumber = state.templateDrafts.length + 1;
  state.templateDrafts = [
    ...state.templateDrafts,
    {
      id: `draft-template-${Date.now()}`,
      name: `New Template ${templateNumber}`,
      key: `draft-template-${templateNumber}`,
      description: "Describe this world template.",
      fieldCount: 0,
      isDraft: true,
    },
  ];
  writeStoredJson(EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts);
  renderEntityPanel();
}

function selectSceneById(sceneId) {
  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId = scene.blocks[0]?.blockId ?? null;
  render();
}

function syncSelectionFromBlock(blockId) {
  const scene = blockId ? findSceneByBlockId(state.scenes, blockId) : state.scenes[0];
  if (!scene) {
    return;
  }

  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId =
    blockId && scene.blocks.some((block) => block.blockId === blockId)
      ? blockId
      : scene.blocks[0]?.blockId ?? null;
}

function getSelectedScene() {
  return getScene(state.selectedSceneId);
}

function getScene(sceneId) {
  return state.scenes.find((scene) => scene.sceneId === sceneId) ?? null;
}

function getScenesForChapter(chapterId) {
  return state.scenes.filter((scene) => scene.chapterId === chapterId);
}

function getIssue(issueId) {
  return state.workspace.project.issues.find((issue) => issue.id === issueId) ?? null;
}

function getEvent(eventId) {
  return state.workspace.project.eventTags.find((eventTag) => eventTag.id === eventId) ?? null;
}

function getNode(nodeId) {
  for (const spine of state.workspace.world.spines) {
    const node = spine.nodes.find((candidate) => candidate.id === nodeId);
    if (node) {
      return node;
    }
  }
  return null;
}

function getEntity(entityId) {
  return state.workspace.world.entities.find((entity) => entity.id === entityId) ?? null;
}

function updateSceneTitleLabel(sceneId, title) {
  document
    .querySelectorAll(`[data-scene-title-id="${CSS.escape(sceneId)}"] span:last-child`)
    .forEach((node) => {
      node.textContent = title;
    });
}

function updateFocusedLineCard() {
  renderConsolePanel();
}

function readStoredJson(storageKey) {
  if (!("localStorage" in window)) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Unable to read ${storageKey}`, error);
    return null;
  }
}

function writeStoredJson(storageKey, value) {
  if (!("localStorage" in window)) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to write ${storageKey}`, error);
  }
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
