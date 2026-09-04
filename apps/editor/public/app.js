// Intent: bootstrap and orchestrate the browser editor while refactor slices move feature logic outward.
import {
  addRecentHighlightCustomColor,
  areHighlightCustomColorsEqual,
  CUSTOM_HIGHLIGHT_COLOR_ID,
  EDITOR_DRAFTS_KEY,
  EDITOR_ACTIVE_PROJECT_ID_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_PROJECT_LIBRARY_KEY,
  EDITOR_PROJECT_SOURCE_PATH_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  FONT_OPTIONS,
  buildSceneRecords,
  buildSceneLineMetrics,
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createDefaultSpellcheckProjectSettings,
  createPassageNote,
  createSceneDraft,
  createStructureDrafts,
  createTemplateDrafts,
  findSceneByBlockId,
  groupScenesByChapter,
  insertStructureSceneDraftAfterAnchor,
  normalizeManuscriptTasks,
  normalizeEditorPrefs,
  normalizeEditorAppearanceMode,
  normalizeHighlightRecentCustomColors,
  normalizeLocalAiPrefs,
  normalizePassageNotes,
  normalizeSpellcheckProjectSettings,
  isSupportedPassageNoteType,
  resolveHighlightColorOption,
  resolveManuscriptTaskRange,
} from "./editor-model.js";
import {
  createNarrationRecordingPreviewsForScene,
  formatSceneEditorSelectionWordCount,
  formatSceneEditorWordCount,
  getPassageNotePlaceholder,
  renderManuscriptPanelHTML,
} from "./features/scene-editor.js";
import {
  clearInlineFormatRangesForSelection,
  createDefaultManuscriptInlineFormattingState,
  createNextDecorationEraserState,
  createManuscriptCommandController,
  INLINE_DECORATION_ERASER,
  INLINE_FORMATS,
  isDecorationEraserPending,
  isInlineFormatActiveAtOffset,
  normalizeInlineFormatRanges,
  normalizeManuscriptInlineFormattingState,
} from "./features/manuscript-editor/manuscript-command-controller.js";
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectManuscriptProjections,
} from "./features/manuscript-editor/projection-selector.js";
import {
  PANEL_RESIZER_FALLBACK_PROFILE_KEY,
  createPanelResizerLayoutProfile,
  isPanelResizerLayoutProfileLikelyClamped,
  normalizePanelResizerLayoutProfiles,
  recoverPanelResizerLayoutProfileWidths,
  resolvePanelResizerLayoutProfile,
  resolvePanelResizerLayoutProfileKey,
  resolvePanelResizerLayoutProfileWidths,
  resolvePanelResizerPercentWidths,
  resolveMeasuredEditorGutterLineCount,
  shouldReplacePanelResizerFallbackProfile,
  upsertPanelResizerLayoutProfile,
} from "./features/manuscript-editor/manuscript-layout-service.js";
import {
  DRAFT_PROOF_BACKDROP_COLOR_DEFAULT,
  addDraftProofCoverageRange,
  addRecentDraftProofBackdropColor,
  clearDraftProofRunData,
  completeDraftProofRun,
  continueDraftProofRun,
  createDefaultDraftProofingState,
  deleteDraftProofRuns,
  getDraftProofSettingsForRun,
  normalizeDraftProofingState,
  pauseDraftProofRun,
  pruneDraftProofCoverageForScenes,
  removeDraftProofCoverageRange,
  resolveDraftProofSettingsRunId,
  startNewDraftProofRun,
  startOrResumeDraftProofRun,
  updateDraftProofRunSettings,
  updateDraftProofSettings,
  updateDraftProofCoverageForTextEdit,
} from "./features/draft-proofing/draft-proofing-service.js";
import {
  renderDraftProofSettingsWindowHTML,
  shouldCloseDraftProofSettingsWindowForClick,
} from "./features/draft-proofing/draft-proofing-settings-window.js";
import {
  applyManuscriptMarksForSceneSelection,
  clearManuscriptMarksForSceneSelection,
  createAuthorMarkProjectionFromManuscriptMark,
  isCompatibilityManuscriptMark,
  promoteCompatibilityManuscriptMarksForSceneFormat,
  syncCompatibilityManuscriptMarksForScene as syncCompatibilityManuscriptMarksForSceneState,
  updateManuscriptMarksForSceneTextEdit,
} from "./features/manuscript-editor/manuscript-mark-service.js";
import {
  createManuscriptMarkHistoryEntry,
  createManuscriptMarkHistorySnapshot,
  createManuscriptMarkHistoryState,
  popManuscriptMarkHistoryRedo,
  popManuscriptMarkHistoryUndo,
  pushManuscriptMarkHistoryEntry,
} from "./features/manuscript-editor/manuscript-mark-history-service.js";
import { createManuscriptFindController } from "./features/manuscript-editor/manuscript-find-controller.js";
import { createManuscriptInputController } from "./features/manuscript-editor/manuscript-input-controller.js";
import {
  reconcileSceneBlocksWithEditorText,
  updateSceneBlocksForTextEdit,
} from "./features/manuscript-editor/manuscript-block-text-service.js";
import { createManuscriptSelectionController } from "./features/manuscript-editor/manuscript-selection-controller.js";
import { createManuScriptInfographicLanePreviewsForScene } from "./features/manuscript-editor/ManuScriptInfographicLane-selector.js";
import { createAnchoredRecordNavigationController } from "./features/manuscript-editor/anchored-record-navigation-controller.js";
import { validateLiveSpellcheckMenuRange } from "./features/manuscript-editor/spellcheck-range-guard.js";
import {
  buildGrammarCheckEntries,
  buildGrammarCheckSummary,
  closeGrammarCheckPanelState,
  createGrammarCheckPanelDragController,
  createGrammarCheckPanelResizeController,
  normalizeGrammarCheckPanelBounds,
  renderGrammarCheckPanelHTML,
  setGrammarCheckPanelBoundsState,
  setGrammarCheckPanelPositionState,
  toggleGrammarCheckPanelState,
  toggleGrammarCheckPanelWordSelectionState,
  updateGrammarCheckPanelSelectionState,
} from "./features/spellcheck/grammar-check-panel.js";
import {
  applySpellcheckProjectListMutation,
} from "./features/spellcheck/spellcheck-project-settings.js";
import {
  buildSpellcheckEditorContextMenu,
  buildSpellcheckEditorHoverContextMenu,
} from "./features/spellcheck/spellcheck-context-controller.js";
import { renderSpellcheckContextMenuHTML } from "./features/spellcheck/spellcheck-context-menu.js";
import {
  DEFAULT_SPELLCHECK_REFRESH_DELAY_MS,
  createSpellcheckRefreshController,
} from "./features/spellcheck/spellcheck-refresh-controller.js";
import {
  renderAnchoredRecordContextMenuHTML,
  renderTaskComposerHTML,
} from "./features/anchored-records/task-context-menu.js";
import {
  buildInlinePassageNoteDraftFromContextMenu,
  buildPassageNoteTitleRequest,
  buildPassageNotePanelModel,
  buildPassageNoteFromComposer,
  buildTaskComposerFromContextMenu,
  buildTaskFromComposer,
  buildTaskPanelModel,
  buildTaskTitleRequest,
  canApplySuggestedRecordTitle,
  getInlinePassageDraftAnchor as getInlinePassageDraftAnchorFromController,
  planInlinePassageVerseInsertion,
  selectOpenManuscriptTasks,
  updateInlinePassageDraftTypingState,
} from "./features/anchored-records/anchored-record-controller.js";
import { renderPassageNotePanelHTML } from "./features/anchored-records/passage-note-panel.js";
import { renderTaskPanelHTML } from "./features/anchored-records/task-panel.js";
import {
  SIDE_PANEL_FEATURES,
  renderHiddenSidePanelOverviewHTML,
  renderSidePanelCustomizationPopoverHTML,
  renderSidePanelTabsHTML,
} from "./features/side-panel-customization/side-panel-customization.js";
import {
  getTopPanelCustomizationContextFromContextMenuTarget,
  getTopPanelCustomizationFeatures,
} from "./features/top-panel-customization/top-panel-customization.js";
import { renderCustomMetadataFormHTML } from "./features/metadata-console/custom-metadata-panel.js";
import {
  CUSTOM_METADATA_ICON_MAX_BYTES,
  DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR,
  buildCustomMetadataSidePanelFeatures,
  createCustomMetadataDefinition,
  findCustomMetadataDefinition,
  getMetadataNoteLabel,
  normalizeCustomMetadataIcon,
  normalizeCustomMetadataDefinitions,
  validateCustomMetadataIconFile,
} from "./features/metadata-console/custom-metadata-service.js";
import { renderMetadataSubgroupPanelHTML } from "./features/metadata-console/metadata-subgroup-panel.js";
import {
  countMetadataSubgroupNotesByGroup,
  createMetadataSubgroup,
  createMetadataSubgroupNote,
  createMetadataSubgroupNoteInputFromPassageNote,
  deleteMetadataSubgroup,
  deleteMetadataSubgroupNote,
  findMetadataSubgroup,
  findMetadataSubgroupNote,
  isSupportedMetadataSubgroupGroupId,
  mergeMetadataSubgroupsById,
  normalizeMetadataSubgroups,
  selectMetadataSubgroupsByGroupId,
  updateMetadataSubgroup,
  updateMetadataSubgroupNote,
} from "./features/metadata-console/metadata-subgroup-service.js";
import {
  USER_MARK_COMMAND_MODE,
  resolveUserMarkCommandIntent,
  resolveUserMarkCommandSelection,
} from "./features/manuscript-decorations/user-highlight-command-service.js";
import {
  createDeleteConfirmationPreferences,
  renderDeleteConfirmationDialogHTML,
} from "./features/anchored-records/delete-confirmation-dialog.js";
import { createAnchoredRecordService } from "./features/anchored-records/anchored-record-service.js";
import {
  DEFAULT_ANCHOR_IDLE_VALIDATION_DELAY_MS,
  createManuscriptAnchorIdleValidationScheduler,
} from "./features/manuscript-anchors/manuscript-anchor-idle-validation-scheduler.js";
import {
  createOffsetAnchoredRecordEvidencePatch,
  updateCanonicalAnchorRecordForTextEdit,
  validateCanonicalAnchorRecordAgainstText,
  validateCanonicalAnchorRecordsByAnchorText,
  resolveOffsetAnchoredRecordRange,
  validateOffsetAnchoredRecordsByScene,
  updateOffsetAnchoredRecordsForTextEdit,
} from "./features/manuscript-anchors/manuscript-anchor-record-service.js";
import {
  deriveManuscriptEditTransaction,
} from "./features/manuscript-anchors/manuscript-edit-transaction-service.js";
import { escapeHtml, formatDisplayNumber } from "./shared/ui-utils.js";
import { createDeveloperLogger } from "./shared/developer-logger.js";
import {
  getProjectRecordFilePath,
  getSuggestedProjectFileName as getSuggestedProjectFileNameFromTitle,
  hasProjectFilePath,
  normalizeProjectFilePath,
  resolveProjectFilePath,
} from "./adapters/storage/project-file.js";
import {
  buildSpellcheckProjectLexicon,
  collectSpellcheckMisspellings,
  ensureSpellcheckBaseLexicon,
  ensureSpellcheckReferenceLexicon,
  getSpellcheckWordRange,
  normalizeSpellcheckWord,
} from "./spellcheck.js";
import {
  buildDictionaryEditorContextMenu,
  buildDictionaryLookupContext,
  buildDictionaryShortcutContext,
} from "./features/dictionary/dictionary-context-controller.js";
import {
  ensureEnglishDefinitionLexicon,
  lookupEnglishDefinition,
} from "./features/dictionary/english-definition-lexicon-service.js";
import { renderDictionaryWindowHTML } from "./features/dictionary/dictionary-window.js";
import { renderEditorChrome } from "./shell/editor-chrome.js";
import { createWritingGoalsService } from "./features/writing-targets/writing-goals-service.js";
import { createWritingGoalsStateService } from "./features/writing-targets/writing-goals-state-service.js";
import {
  PROJECT_STATE_STORAGE_KEYS,
  createEditorStorage,
} from "./adapters/storage/editor-storage.js";
import {
  createBrowserStorageAdapter,
  createDurableBrowserTokenStorage,
} from "./adapters/storage/browser-storage-adapter.js";
import { createProjectRepository } from "./adapters/storage/project-repository.js";
import { createPreferencesRepository } from "./adapters/storage/preferences-repository.js";
import { createProjectService } from "./adapters/storage/project-service.js";
import {
  adjustChapterWordCountForLiveScene,
  buildWorkspaceStatsFromProjectIndex,
  getProjectRecordWordCountForSettings,
  getProjectWordCount,
  mergeProjectIndexWithLiveSceneOverrides,
} from "./adapters/storage/project-metrics.js";
import { PROJECT_SCHEMA_VERSION } from "./adapters/storage/project-migrations.js";
import { createProjectPersistenceService } from "./adapters/storage/project-persistence-service.js";
import {
  PROJECT_PACKAGE_DIALOG_MODES,
  applyProjectPackageBrowseResult,
  canConfirmProjectPackageDialog,
  createProjectPackageDialogState,
  renderProjectPackageDialogHTML,
  updateProjectPackageDialogField,
} from "./features/project-lifecycle/project-package-dialog.js";
import { createNewProjectCandidateBuilder } from "./features/project-lifecycle/new-project-candidate.js";
import { createProjectSourceService } from "./adapters/storage/project-source-service.js";
import {
  createProjectLibraryStateService,
  mergeProjectLibraryItemsById,
  normalizeProjectSelectionDefaults,
  shouldPreferBrowserCacheProjectLibraryOnBoot,
} from "./state/project-library-state.js";
import { createProjectRecordStateService } from "./state/project-record-state.js";
import { createProjectRuntimeRecordStateService } from "./state/project-runtime-record-state.js";
import { createProjectActivationStateService } from "./state/project-activation-state.js";
import { createProjectActivationController } from "./state/project-activation-controller.js";
import {
  createCollapsedConsoleChapterState,
  createSidePanelVisibilityState,
  createTopPanelVisibilityState,
  getVisibleSidePanelIds,
  normalizeCollapsedChapterIds,
  normalizeSidePanelsHiddenState,
  normalizeWorkspacePaneId,
  pruneCollapsedChapterIds,
  resolveVisibleSidePanelMode,
  setSidePanelFeatureVisible,
  setTopPanelCardVisible,
  toggleSidePanelsHiddenState,
  toggleCollapsedChapterId,
  toggleCollapsedConsoleChapter,
} from "./state/editor-ui-state.js";
import {
  captureKeyboardShortcutFromEvent,
  findKeyboardShortcutConflict,
  getKeyboardShortcutBehavior,
  normalizeKeyboardShortcutSettings,
  resolveKeyboardShortcutBehaviorIdForEvent,
  resetKeyboardShortcutBinding,
  resetKeyboardShortcutSettings,
  setKeyboardShortcutBinding,
} from "./state/keyboard-shortcut-state.js";
import {
  captureTextareaEditorHostBookmark,
  captureTextareaEditorHostViewport,
  clearTextareaAnchoredRecordPreview,
  clearTextareaProjectionLayer,
  clearTextareaRuntimeSelectionPreview,
  estimateTextareaVisualLineBeforeOffset,
  findTextareaOffsetForVisualLineEnd,
  focusTextareaEditorHost,
  getTextareaEditorHostWrapMetrics,
  readTextareaEditorHostSelection,
  renderTextareaAuthorMarkLayer,
  renderTextareaDiagnosticLayer,
  renderTextareaDraftProofLayer,
  renderTextareaManuScriptInfographicLane,
  renderTextareaNarrationFollowLayer,
  renderTextareaNarrationRecordingLayer,
  renderTextareaSpellcheckLayer,
  resolveTextareaEditorHostContentWidth,
  resolveTextareaVisualLineIndexForOffset,
  resolveTextareaEditorHost,
  restoreTextareaEditorHostBookmark,
  restoreTextareaEditorHostViewport,
  scrollTextareaEditorHostToOffset,
  scrollTextareaEditorHostToSelection,
  selectTextareaEditorHostRange,
  showTextareaAnchoredRecordPreview,
  showTextareaRuntimeSelectionPreview,
  syncTextareaSpellcheckTypingState,
} from "./adapters/editor-host/textarea-editor-host.js";
import {
  createEmptyRevisionProjectState,
  createRevisionStorageService,
  getPersistableRevisionProjectState,
  normalizeRevisionProjectState,
} from "./adapters/storage/revision-storage-service.js";
import { createRevisionService } from "./features/revisions/revision-service.js";
import { createRevisionPanelController } from "./features/revisions/revision-panel-controller.js";
import { renderRevisionWindowHTML } from "./features/revisions/revision-window.js";
import { createLocalAiTitleService } from "./features/local-ai/local-ai-title-service.js";
import {
  createLocalAiModelLibraryClient,
  renderLocalAiPanelHTML,
} from "./features/local-ai/local-ai-panel.js";
import { renderKeyboardShortcutSettingsWindowHTML } from "./features/keyboard-shortcuts/keyboard-shortcut-settings-window.js";
import {
  SPOTIFY_MUSIC_CLIENT_ID_STORAGE_KEY,
  createDefaultSpotifyMusicPanelState,
  createSpotifyMusicService,
  formatSpotifyPlaybackTimeLabel,
} from "./features/spotify-music/spotify-music-service.js";
import {
  MILESTONE_SOUND_EFFECT_TYPES,
  createMilestoneSoundEffectsService,
  isMilestoneSoundEffectsEnabled,
  selectWritingGoalMilestoneSoundEffects,
} from "./features/milestone-sounds/milestone-sound-effects-service.js";
import { createNarrationMediaService } from "./features/narration/narration-media-service.js";
import { createNarrationMediaRecorderService } from "./features/narration/narration-media-recorder-service.js";
import {
  createNarrationRecordingTranscriptAlignmentService,
  createWhisperCppWordTimingProvider,
  resolveNarrationRecordingAlignedSeekTime,
  shouldRefreshNarrationRecordingTranscriptAlignment,
} from "./features/narration/narration-recording-alignment-service.js";
import { createNarrationRecordingAlignmentJobService } from "./features/narration/narration-recording-alignment-job-service.js";
import { createNarrationRecordingCommandService } from "./features/narration/narration-recording-command-service.js";
import { createNarrationRecordingFinalizationService } from "./features/narration/narration-recording-finalization-service.js";
import { createNarrationRecordingRuntimeService } from "./features/narration/narration-recording-runtime-service.js";
import {
  buildNarrationTakeSelection as buildNarrationTakeSelectionRecord,
  resolveNarrationTakeSelectionFromTextInput,
  selectNarrationTakeSelectionForScene,
} from "./features/narration/narration-selection-service.js";
import {
  syncNarrationAlignmentJobsMetadata,
  syncNarrationSessionMetadata,
  syncVoiceRecordingsMetadata,
  syncVoiceRenderJobsMetadata,
} from "./features/narration/narration-metadata-sync-service.js";
import { createNarrationFollowAlignmentService } from "./features/narration/narration-follow-alignment-service.js";
import {
  createNarrationReadingRateTracker,
} from "./features/narration/narration-reading-rate-service.js";
import { createNarrationFollowViewportMetricsCache } from "./features/narration/narration-follow-viewport-metrics-service.js";
import { estimateNarrationVisibleTextRange } from "./features/narration/narration-visible-range-service.js";
import {
  createNarrationFollowLeadSelection,
  resolveNarrationFollowViewportOffsets,
} from "./features/narration/narration-follow-display-service.js";
import {
  createDefaultNarrationFollowSettings,
  normalizeNarrationFollowSettings,
  toggleNarrationDecorations,
  toggleNarrationManuscriptDecorations,
  toggleNarrationFollowScroll,
} from "./features/narration/narration-follow-settings-service.js";
import {
  createNarrationLiveSpeechTrackerService,
  createBrowserWebSpeechTrackerProvider,
  createPrimaryLiveWithCleanupTrackerProvider,
} from "./features/narration/narration-live-speech-tracker-service.js";
import { createNarrationSpeechRecognitionService } from "./features/narration/narration-speech-recognition-service.js";
import { createDesktopRealtimeSpeechTrackerProvider } from "./features/narration/narration-desktop-speech-tracker-service.js";
import { createNarrationLiveAudioFrameService } from "./features/narration/narration-live-audio-frame-service.js";
import { createNarrationRealtimeSpeechClient } from "./features/narration/narration-realtime-speech-client.js";
import { createNarrationViewportTracker } from "./features/narration/narration-viewport-tracker-service.js";
import {
  NARRATION_AUDIO_PANEL_ID,
  renderNarrationMetadataPanelHTML,
} from "./features/narration/narration-metadata-panel.js";
import {
  createNarrationRecordingReviewSelection,
  createNarrationRecordingReviewModel,
  createNarrationRecordingReviewState,
  renderNarrationRecordingReviewWaveformHTML,
  renderNarrationRecordingReviewTranscriptHTML,
} from "./features/narration/narration-recording-review-service.js";
import {
  VOICE_RECORDING_WAVEFORM_STATUS,
  createVoiceRecordingWaveformService,
  createVoiceRecordingWaveformState,
} from "./features/voice/voice-recording-waveform-service.js";
import {
  WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION,
  buildWorldSpineTimelineModel,
  createWorldSpineLocationFilterViewportModel,
  createWorldSpineInteractionController,
  findWorldSpineNode,
  isWorldSpineAssignableEventNode,
  isWorldSpineLocationRowDeleteEligible,
  normalizeWorldSpineRightPaneMode,
  renderWorldSpinePanelHTML,
  renderWorldSpineWhitespaceContextMenuHTML,
} from "./features/world-spine/world-spine-panel.js";
import {
  buildWorldSpineEventComposerFromContextMenu,
  buildWorldSpineEventTagFromComposer,
} from "./features/world-spine/world-spine-event-tag-service.js";
import { createWorldSpineEventScenePlacement } from "./features/world-spine/world-spine-event-scene-service.js";
import {
  applyWorldSpineImplicationEdgeToWorld,
  deleteWorldSpineImplicationEdgeFromWorld,
  normalizeWorldSpineImplicationText,
  normalizeWorldSpineEdges,
  updateWorldSpineImplicationEdgeInWorld,
} from "./features/world-spine/world-spine-implication-service.js";
import {
  applyWorldSpineCatalogueItemAssignmentToWorld,
  applyWorldSpineEventSublocationToWorld,
  buildWorldSpineCatalogueAssignmentMenuModel,
} from "./features/world-spine/world-spine-catalogue-assignment-service.js";
import {
  canRedoWorldSpineHistory,
  canUndoWorldSpineHistory,
  createWorldSpineHistoryState,
  pushWorldSpineHistoryEntry,
  redoWorldSpineHistory,
  undoWorldSpineHistory,
} from "./features/world-spine/world-spine-history-service.js";
import {
  WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
  createWorldSpineLayoutProfile,
  normalizeWorldSpineLayoutProfiles,
  resolveWorldSpineLayoutProfile,
  resolveWorldSpineLayoutProfileKey,
  resolveWorldSpineLayoutProfileWidths,
  shouldReplaceWorldSpineFallbackProfile,
  upsertWorldSpineLayoutProfile,
} from "./features/world-spine/world-spine-layout-service.js";
import {
  buildWorldSpineLocationFilterModel,
  clearWorldSpineLocationFilterSelection,
  createDefaultWorldSpineLocationFilterState,
  normalizeWorldSpineLocationFilterState,
  updateWorldSpineLocationFilterSelection,
} from "./features/world-spine/world-spine-location-filter-service.js";
import {
  applyWorldSpineLocationAssignmentToSceneEventTags,
  applyWorldSpineLocationAssignmentToSceneRecord,
  applyWorldSpineLocationAssignmentToStructureDrafts,
  applyWorldSpineLocationAssignmentToWorldPlaceLinks,
  applyWorldSpineUnplacementToSceneEventTags,
  applyWorldSpineUnplacementToSceneRecord,
  applyWorldSpineUnplacementToStructureDrafts,
  createWorldSpineLocationRowAssignment,
  createWorldSpineSceneDropPersistenceOptions,
  createWorldSpineUnplacedLocationRowAssignment,
  hasWorldSpineLocationAssignment,
  hasWorldSpineUnplacedLocationRowAssignment,
  upsertWorldSpineLocationAssignmentInSceneStore,
  upsertWorldSpineUnplacementInSceneStore,
} from "./features/world-spine/world-spine-location-row-service.js";
import {
  applySceneWorldSpineMetadataToDraft,
  buildSceneWorldSpineMetadataFromFormValues,
  buildSceneWorldSpineMetadataMenuModel,
  renderSceneWorldSpineMetadataMenuHTML,
} from "./features/world-spine/scene-world-spine-metadata.js";
import {
  buildWorldSpineCharacterOptions,
  buildWorldSpinePickerOptionSets,
} from "./features/world-spine/world-spine-character-options.js";
import {
  DEFAULT_WORLDBUILDING_CATEGORY_ID,
  WORLDBUILDING_CATALOGUE_IMAGE_ACCEPT,
  WORLDBUILDING_CATALOGUE_IMAGE_MAX_BYTES,
  addParallelWorldSpine,
  applyWorldSpineLocationRowNameToWorld,
  applyWorldSpineLocationRowUnplacementToWorld,
  applyWorldSpineLocationImageToWorld,
  applyWorldbuildingCategoryLocationRoleToWorld,
  applyWorldbuildingCatalogueItemImageToWorld,
  applyWorldbuildingItemToWorld,
  buildWorldbuildingCatalogueImageMediaPath,
  buildWorldbuildingItemFromFormValues,
  buildWorldbuildingRelatedCatalogueCardsModel,
  buildWorldbuildingStudioModel,
  collectWorldbuildingFormValues,
  createWorldbuildingCatalogueEditFormState,
  deleteWorldbuildingCatalogueItemFromWorld,
  dropWorldbuildingEventDraftOnWorldSpine,
  normalizeWorldbuildingCatalogueImage,
  refreshWorldbuildingScopedPickerDatalists,
  renderWorldbuildingEventDraftPlacementPreviewHTML,
  renderWorldbuildingStudioHTML,
  validateWorldbuildingCatalogueImageFile,
} from "./features/world-spine/worldbuilding-studio.js";
import {
  clampWorldbuildingCatalogueBounds,
  normalizeWorldbuildingCatalogueBounds,
} from "./state/worldbuilding-catalogue-panel-state.js";
import {
  applyNarrationCleanupTranscriptToRecord,
  createNarrationTakeSession as createNarrationTakeSessionRecord,
  formatNarrationRecordingElapsedLabel,
} from "./features/narration/narration-take-service.js";
import { createVoiceWorkflowService } from "./features/voice/voice-workflow-service.js";
import { createVoiceRecordingActionService } from "./features/voice/voice-recording-action-service.js";
import { createVoiceRecordingPreviewController } from "./features/voice/voice-recording-preview-service.js";
import { createVoiceRecordingService } from "./features/voice/voice-recording-service.js";

// Intent: keep shell-wide constants and state visible until each concern moves into its roadmap owner.
const AUTHOR_MARK_DECORATION_FORMAT_IDS = new Set(["bold", "highlight"]);
const MANUSCRIPT_INLINE_FORMAT_SHORTCUT_BEHAVIORS = Object.freeze({
  "format.bold": "bold",
  "format.highlight": "highlight",
  "format.italic": "italic",
});
const appRoot = document.querySelector("#app");
const EDITOR_RIGHT_DOCK_COLLAPSED_KEY = "abe-right-dock-collapsed-v1";
const EDITOR_BINDER_WIDTH_KEY = "abe-binder-width-v1";
const EDITOR_CONSOLE_WIDTH_KEY = "abe-console-width-v1";
const EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY = "abe-panel-resizer-layout-profiles-v1";
const EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY = "abe-world-spine-panel-layout-profiles-v1";
const EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY = "abe-world-spine-event-rail-width-v1";
const EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY = "abe-world-spine-manuscript-pane-width-v1";
const EDITOR_WRITING_TARGETS_KEY = "abe-writing-targets-v1";
const EDITOR_PROJECT_FILE_PATH_KEY = "abe-project-file-path-v1";
const EDITOR_SIDE_PANEL_VISIBILITY_KEY = "abe-side-panel-visibility-v1";
const EDITOR_SIDE_PANELS_HIDDEN_KEY = "abe-side-panels-hidden-v1";
const EDITOR_TOP_PANEL_VISIBILITY_KEY = "abe-top-panel-visibility-v1";
const EDITOR_NARRATION_FOLLOW_SETTINGS_KEY = "abe-narration-follow-settings-v1";
const APPEARANCE_MODE_MEDIA_QUERY = "(prefers-color-scheme: dark)";
// Intent: seed imported and newly-created author workspaces with rails wide enough for long chapter headings.
const DEFAULT_BINDER_PANEL_WIDTH = 520;
const DEFAULT_CONSOLE_PANEL_WIDTH = 520;
const DEFAULT_WORLD_SPINE_EVENT_RAIL_WIDTH = 224;
const DEFAULT_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH = 330;
const DEFAULT_WRITING_TARGET_WORDS = 150000;
const DEFAULT_SESSION_TARGET_WORDS = 5000;
const DEFAULT_WRITING_TARGET_LOOKBACK_DAYS = 7;
const DEFAULT_SESSION_TARGETS_PER_DAY = 5;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 20;
const PROJECT_FILE_AUTOSAVE_DELAY_MS = 5000;
// The tracker uses one idle grace period, then a longer close window, then a new-session window.
const WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES = 10;
const WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES = 25;
const WRITING_TARGET_MAX_HISTORY_DAYS = 180;
const WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY = 12;
const WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES = 5;
const WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES = 240;
const WRITING_TARGET_MAX_SESSION_SAMPLES = 20;
const WRITING_TARGET_SESSION_HISTORY_MAX = 24;
const WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES = 5;
const WRITING_TARGET_SESSION_PACE_STALE_MINUTES = 0.5;
const WRITING_TARGET_DEBUG_TYPING_LOG_MIN_INTERVAL_MS = 1000;
const WRITING_TARGET_GOAL_SYNC_SOURCES = ["releaseDate", "sessionTargetWords"];
const EDITOR_DELETE_CONFIRMATIONS_KEY = "abe-delete-confirmations-v1";
const DESKTOP_PROJECT_LIBRARY_BOOT_TIMEOUT_MS = 50;
const DEVELOPER_LOG_WINDOW_PATH = "/developer-logs.html";
const DEVELOPER_LOG_RUNTIME_BRIDGE_KEY = "__ABE_DEVELOPER_LOG_RUNTIME__";
const DESKTOP_LOG_BRIDGE_WARNING_THROTTLE_MS = 30000;
const VOICE_RECORDING_PLAYBACK_LOG_INTERVAL_MS = 1000;
const REVISION_DRAFTING_UI_ENABLED = false;
const MIN_BINDER_PANEL_WIDTH = 220;
const MIN_CONSOLE_PANEL_WIDTH = 260;
const MIN_MANUSCRIPT_PANEL_WIDTH = 560;
const MIN_WORLD_SPINE_EVENT_RAIL_WIDTH = 156;
const MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH = 220;
const MIN_WORLD_SPINE_TIMELINE_WIDTH = 420;
const PANEL_RESIZER_WIDTH = 8;
const WORKSPACE_GRID_COLUMN_GAP = 12;

const {
  clearProjectContentStorage,
  loadCollapsedChapterIds,
  loadCollapsedConsoleChapterIds,
  loadEditorPrefs,
  loadLocalAiPrefs,
  loadManuscriptTasks,
  loadPassageNotes,
  loadProjectTitle,
  loadSceneDrafts,
  loadStoredNumber,
  loadStoredString,
  loadStructureDrafts,
  loadTemplateDrafts,
  persistCollapsedChapterState,
  persistCollapsedConsoleChapterState,
  persistConsoleDockCollapsedState,
  readStoredJson,
  writeStoredJsonRaw,
} = createEditorStorage({
  reportBrowserLog,
  windowRef: window,
});
const browserStorageAdapter = createBrowserStorageAdapter({
  reportBrowserLog,
  windowRef: window,
});
const projectRepository = createProjectRepository({
  storageAdapter: browserStorageAdapter,
  libraryStorageKey: EDITOR_PROJECT_LIBRARY_KEY,
  activeProjectIdStorageKey: EDITOR_ACTIVE_PROJECT_ID_KEY,
});
const preferencesRepository = createPreferencesRepository({
  storageAdapter: browserStorageAdapter,
});
const projectService = createProjectService({
  projectRepository,
  preferencesRepository,
});
const voiceWorkflowService = createVoiceWorkflowService({
  projectService,
});
const CONSOLE_DOCK_COLLAPSED_WIDTH = 52;
const BINDER_PANEL_COMPACT_THRESHOLD = 280;
const WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION = 2;
const WRITING_TARGET_METRIC_KEYS = ["wordTarget", "sessionTarget", "forecast", "sessionTracker"];
const WRITING_TARGET_CADENCE_OPTIONS = [
  { value: "daily", label: "Daily target", unitLabel: "day", periodsPerWeek: 7 },
  { value: "weekly", label: "Weekly target", unitLabel: "week", periodsPerWeek: 1 },
];
const BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS = 350;

const state = {
  shellReady: false,
  workspace: null,
  activeProjectId: null,
  projectLibrary: [],
  projectLibrarySelectionId: null,
  projectTitle: "",
  projectFileHandle: null,
  projectFileHandlePermission: "",
  projectFilePath: "",
  projectFileStatus: "",
  projectFileBusy: false,
  projectFileStorageMode: "",
  projectPackageDialog: null,
  projectFileAutosaveDirty: false,
  projectFileAutosaveBlocked: null,
  projectFileAutosaveTarget: null,
  projectFileAutosaveTimer: null,
  projectFileAutosaveRevision: 0,
  projectPersistenceDirtyDomains: {},
  projectEditorWorkingDirtyState: {
    dirty: false,
    lastMutationAt: "",
    domains: {},
  },
  projectFileAutosaveSuppressionDepth: 0,
  projectCacheSuppressionDepth: 0,
  loadedProjectSceneStore: {},
  projectSourcePath: "",
  projectSourceStatus: "",
  projectSourceBusy: false,
  fileMenuOpen: false,
  projectSettingsMenuOpen: false,
  developerOptionsMenuOpen: false,
  consoleDockCollapsed: false,
  sidePanelsHidden: false,
  binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
  consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
  userSettingPanelResizerLeftPercent: null,
  userSettingPanelResizerRightPercent: null,
  panelResizerLayoutProfiles: {},
  writingTargetWindowOpen: false,
  revisionWindowOpen: false,
  draftProofSettingsWindowOpen: false,
  localAiPanelOpen: false,
  keyboardShortcutSettingsWindowOpen: false,
  keyboardShortcutCaptureBehaviorId: "",
  keyboardShortcutSettingsStatus: "",
  spotifyMusicPanelOpen: false,
  localAiModelLibrary: null,
  localAiModelRootDraft: "",
  localAiModelLibraryStatus: "",
  localAiModelLibraryLoading: false,
  spotifyMusicDesktopClientId: "",
  spotifyMusic: createDefaultSpotifyMusicPanelState(),
  draftProofClearConfirmationArmed: false,
  draftProofSettingsSelectedRunId: "",
  writingTargetProjectId: null,
  writingTargetState: null,
  writingTargetDraft: null,
  writingTargetDraftProjectId: null,
  writingTargetDraftBaseline: null,
  writingTargetViewMode: "month",
  writingTargetSelectedDateKey: "",
  writingTargetCalendarMonthKey: "",
  activePane: normalizeWorkspacePaneId(),
  sceneDrafts: {},
  structureDrafts: createStructureDrafts(),
  templateDrafts: createTemplateDrafts(),
  manuscriptTasks: [],
  passageNotes: [],
  customMetadataDefinitions: [],
  metadataSubgroups: [],
  draftProofing: createDefaultDraftProofingState(),
  draftProofMarksVisible: false,
  spellcheckProjectSettings: createDefaultSpellcheckProjectSettings(),
  sidePanelMode: "issues",
  sidePanelVisibility: createSidePanelVisibilityState(),
  sidePanelCustomizationOpen: false,
  sidePanelCustomizationPosition: null,
  topPanelVisibility: createTopPanelVisibilityState(),
  topPanelCustomizationOpen: false,
  topPanelCustomizationPosition: null,
  topPanelCustomizationGroupId: "",
  customMetadataFormOpen: false,
  customMetadataFormError: "",
  selectedTaskId: null,
  selectedPassageNoteId: null,
  selectedMetadataSubgroupNoteId: null,
  inlinePassageDraft: null,
  taskContextMenu: null,
  binderContextMenu: null,
  spellcheckContextMenu: null,
  highlightColorPaletteOpen: false,
  highlightColorPalettePosition: null,
  grammarCheckPanel: {
    open: false,
    position: null,
    bounds: null,
    selectedWords: [],
    selectionAnchorIndex: null,
  },
  taskComposer: null,
  taskPreview: null,
  dictionaryLookup: null,
  dictionaryLookupRequestId: 0,
  manuscriptInlineFormatting: createDefaultManuscriptInlineFormattingState(),
  manuscriptFind: {
    open: false,
    query: "",
    replaceText: "",
    activeIndex: 0,
    position: null,
  },
  revisionState: createEmptyRevisionProjectState(),
  revisionPanelState: {
    query: "",
    categoryFilter: "all",
    originFilter: "all",
    selectedSessionId: "",
    showFullDiff: false,
    statusMessage: "",
  },
  narrationTakeSelection: null,
  narrationTakeSession: null,
  narrationRecordingReview: null,
  narrationRecordingWaveforms: {},
  narrationRecordingPreviewId: null,
  narrationFollowSettings: normalizeNarrationFollowSettings(
    readStoredJson(EDITOR_NARRATION_FOLLOW_SETTINGS_KEY) ?? createDefaultNarrationFollowSettings(),
  ),
  editorPrefs: createDefaultEditorPrefs(),
  localAiPrefs: createDefaultLocalAiPrefs(),
  localAiTitleStatus: {},
  sceneEditorSelectionSnapshot: null,
  activeEditorSceneId: null,
  deleteConfirmationPreferences: loadDeleteConfirmationPreferences(),
  deleteConfirmationDialog: null,
  binderSceneMoveHistory: {
    undoStack: [],
    redoStack: [],
  },
  manuscriptMarkHistory: createManuscriptMarkHistoryState(),
  developerLogsWindowOpen: false,
  voiceNarration: voiceWorkflowService.loadState(),
  scenes: [],
  selectedSceneId: null,
  selectedBlockId: null,
  selectedIssueId: null,
  selectedNodeId: null,
  selectedEntityId: null,
  worldSpineHistory: createWorldSpineHistoryState(),
  worldSpineEventRailWidth: DEFAULT_WORLD_SPINE_EVENT_RAIL_WIDTH,
  worldSpineManuscriptPaneWidth: DEFAULT_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
  worldSpinePanelLayoutProfiles: {},
  worldSpineRightPaneMode: normalizeWorldSpineRightPaneMode(),
  worldSpineUnplacedDockCollapsed: false,
  worldSpineRelatedCardExpandedKey: "",
  worldSpineSublocationComposer: null,
  worldSpineLocationFilter: createDefaultWorldSpineLocationFilterState(),
  worldSpineLocationFilterOpen: false,
  worldSpineTimelineScrollLeft: 0,
  worldSpineManuscriptScrollTop: 0,
  worldSpineScrollTargetNodeId: "",
  worldSpineScrollTargetLocationKey: "",
  worldSpinePassageScrollTargetBlockId: "",
  worldSpineImplicationComposer: null,
  worldSpineContextMenu: null,
  worldSpineInsertionContext: null,
  worldbuildingStudioCategoryId: "",
  worldbuildingStudioStatus: "",
  worldbuildingCatalogueCategoryId: "",
  worldbuildingCataloguePosition: null,
  worldbuildingCatalogueBounds: null,
  worldbuildingCatalogueSelectedItemId: "",
  worldbuildingCatalogueSelectedItemKind: "",
  worldbuildingEditingCatalogueItemId: "",
  worldbuildingEditingCatalogueItemKind: "",
  worldbuildingDraggedEventDraftId: "",
  editingChapterTitleId: null,
  editingSceneTitleId: null,
  collapsedChapterIds: [],
  collapsedConsoleChapterIds: {
    issueTasks: [],
    issues: [],
    inspiration: [],
    research: [],
  },
};

let eventsWired = false;
let layoutResizeSession = null;
let writingTargetPointerDownStartedInsideWindow = false;
let revisionWindowPointerDownStartedInsideWindow = false;
let writingTargetDebugLastTypingLogAt = 0;
let writingTargetDebugLastSceneTypingWordCount = null;
let binderTitleClickState = null;
let binderSceneDragState = null;
let worldbuildingCatalogueDragState = null;
let worldbuildingCatalogueResizeState = null;
let worldbuildingCatalogueSuppressNextClick = false;
let worldSpineAssignmentSuppressNextClick = false;
let worldbuildingEventDraftDragState = null;
let metadataFolderDragState = null;
let manuscriptFindDragState = null;
let worldSpineLayoutResizeSession = null;
let manuscriptPendingFormatDragSelectionSession = null;
let draftProofSelectionGesture = null;
let draftProofLayerLogSignature = "";
let highlightColorHoverTimer = null;
let spellcheckHoverMenuHideTimer = null;
let spellcheckBaseLexicon = null;
let spellcheckReferenceLexicon = null;
let narrationRecordingRuntime = null;
let narrationViewportTracker = null;
let narrationReadingRateTracker = null;
let narrationFollowViewportPulseTimerId = null;
let narrationFollowPreviewFrameId = null;
let voiceRecordingPlaybackTelemetryTimerId = null;
let voiceRecordingPlaybackTelemetryStartedAtMs = 0;
let narrationRecordingWaveformSelectionGesture = null;
let narrationRecordingWaveformSuppressClick = false;
let narrationRecordingReviewCursorFallbackLogKey = "";
let lastDesktopLogBridgeWarningAt = 0;
let appearanceModeMediaQueryList = null;
let appearanceModeSystemPreferenceListener = null;

// Intent: keep pure find derivation and replacement planning outside browser shell effects.
const manuscriptFindController = createManuscriptFindController({
  getScenes: () => state.scenes,
});

// Intent: keep selection derivation separate from DOM focus, scrolling, and persistence orchestration.
const manuscriptSelectionController = createManuscriptSelectionController({
  findSceneBlockAtOffset,
});

// Intent: keep World Spine detail cards and scrolling behind the feature controller.
const worldSpineController = createWorldSpineInteractionController({
  getModel: () => buildWorldSpineViewportModelForState(),
  onTimelineScroll: (scrollLeft) => {
    state.worldSpineTimelineScrollLeft = scrollLeft;
  },
  onManuscriptScroll: (scrollTop) => {
    state.worldSpineManuscriptScrollTop = scrollTop;
  },
  onTimelineZoom: ({
    previousZoom,
    nextZoom,
    previousScrollLeft,
    nextScrollLeft,
  }) => {
    const before = captureWorldSpineHistorySnapshot();
    before.timelineZoom = previousZoom;
    before.worldSpineTimelineScrollLeft = previousScrollLeft;
    const after = captureWorldSpineHistorySnapshot();
    after.timelineZoom = nextZoom;
    after.worldSpineTimelineScrollLeft = nextScrollLeft;
    pushWorldSpineHistoryChange(before, {
      afterSnapshot: after,
      label: "Zoomed World Spine timeline",
      dirtyReason: "world-spine-timeline-zoomed",
      source: "worldSpineController.onTimelineZoom",
    });
  },
  onImplicationLinkDraft: (draft) => {
    openWorldSpineImplicationComposer(draft);
  },
  onImplicationContextMenu: (context) => {
    openWorldSpineImplicationContextMenu(context);
  },
  onImplicationNavigate: (context) => {
    navigateWorldSpineImplicationTarget(context);
  },
  onEventContextMenu: (context) => {
    openWorldSpineEventContextMenu(context);
  },
  onWhitespaceContextMenu: (context) => {
    openWorldSpineWhitespaceContextMenu(context);
  },
  onSelectionClear: () => {
    clearWorldSpineSelection();
  },
  onSceneNodeReorder: ({ sourceSceneId, dropTarget }) => {
    const targetScene = getMovableSceneById(dropTarget?.sceneId);
    const locationLabel = String(dropTarget?.locationLabel ?? "").trim();
    if (!targetScene && !locationLabel) {
      return false;
    }

    const historyBefore = captureWorldSpineHistorySnapshot();
    const rowAssignment = locationLabel
      ? createWorldSpineLocationRowAssignment(locationLabel, dropTarget)
      : null;
    const changedSceneIds = rowAssignment
      ? applyWorldSpineLocationToSceneRows([sourceSceneId], locationLabel, dropTarget, rowAssignment)
      : [];
    const sourceSceneIds = normalizeWorldSpineContextIdList([sourceSceneId]);
    const placeLinkResult = rowAssignment
      ? applyWorldSpineLocationAssignmentToWorldPlaceLinks(state.workspace?.world ?? {}, {
          sceneIds: sourceSceneIds,
          nodeIds: sourceSceneIds.map((sceneId) => `scene:${sceneId}`),
          assignment: rowAssignment,
        })
      : { world: state.workspace?.world ?? {}, changed: false };
    const changedPlaceLinks = Boolean(placeLinkResult.changed);
    if (changedPlaceLinks && state.workspace) {
      state.workspace.world = placeLinkResult.world;
      uiEventDispatcherLog.info("state-change", "world-spine.location-row.drag-place-links-updated", "Removed stale place-card links after World Spine event drag.", {
        location: rowAssignment.location,
        locationRowKey: rowAssignment.locationRowKey,
        sourceSceneId,
        removedPlaceEntityLinkIds: placeLinkResult.removedEntityLinkIds,
        removedPlaceEntityIds: placeLinkResult.removedEntityIds,
      });
    }
    if (changedSceneIds.length) {
      writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
      writeStoredJsonRaw(EDITOR_STRUCTURE_KEY, state.structureDrafts);
      refreshScenes();
    }

    const hasLocationChange = Boolean(changedSceneIds.length || changedPlaceLinks);
    const locationPersistenceOptions = hasLocationChange
      ? createWorldSpineSceneDropPersistenceOptions({ changedSceneIds, changedPlaceLinks })
      : {};
    const moved = targetScene
      ? moveBinderScene(sourceSceneId, {
          ...dropTarget,
          chapterId: targetScene.chapterId,
          chapterTitle: targetScene.chapterTitle,
        }, {
          recordHistory: false,
          ...locationPersistenceOptions,
        })
      : false;
    if (moved || hasLocationChange) {
      state.worldSpineScrollTargetNodeId = `scene:${sourceSceneId}`;
      pushWorldSpineHistoryChange(historyBefore, {
        label: moved && hasLocationChange
          ? "Reordered World Spine scene node and updated location"
          : moved
            ? "Reordered World Spine scene node"
            : "Updated World Spine scene location",
        dirtyReason: moved && hasLocationChange
          ? "world-spine-scene-node-reordered-and-location-updated"
          : moved
            ? "world-spine-scene-node-reordered"
            : changedSceneIds.length
              ? "world-spine-scene-location-updated"
              : "world-spine-scene-location-place-links-updated",
        source: "worldSpineController.onSceneNodeReorder",
      });
    }
    if (!moved && hasLocationChange) {
      persistCurrentProjectRecord(locationPersistenceOptions);
      render();
    }
    return moved || hasLocationChange;
  },
});

// Intent: dispatch live manuscript typing through feature-owned mutation planning with shell effects injected.
const manuscriptInputController = createManuscriptInputController({
  markEditorAsCurrent: (editorSurface) => markSceneEditorAsCurrent(editorSurface),
  updateSelectionSnapshot: (editorSurface) => updateSceneEditorSelectionSnapshotFromTextarea(editorSurface),
  updateInlineFormatToolbar: (editorSurface) => updateInlineFormatToolbarState(editorSurface),
  clearAnchoredPreview: (options) => clearTaskAnchorPreview(options),
  getSceneText: (sceneId) => getScene(sceneId)?.editorText ?? "",
  getSceneInlineFormatRanges,
  getInlineFormattingState: () => state.manuscriptInlineFormatting,
  getPendingFormatMetadata: () => ({
    highlight: getAuthorMarkDecorationMetadata("highlight"),
  }),
  recordRevisionTextEdit: (sceneId, previousText, nextText) => recordRevisionSceneTextEdit(sceneId, previousText, nextText),
  trackInlinePassageTyping: (sceneId, previousText, editorSurface) => trackInlinePassageDraftTyping(sceneId, previousText, editorSurface),
  updateAnchoredRecordsForTextEdit: (sceneId, previousText, nextText, options) =>
    updateAnchoredRecordsForSceneTextEdit(sceneId, previousText, nextText, options),
  getTypingSpellcheckRange: (editorSurface) => getEditorTypingSpellcheckRange(editorSurface),
  commitSceneTextEdit: ({
    sceneId,
    previousText,
    nextText,
    inlineFormatRanges,
    pendingFormats,
    selectionStart,
    selectionEnd,
    selectionBeforeInputStart,
    selectionBeforeInputEnd,
  }) => {
    const scene = getScene(sceneId);
    const sourceBlocks = scene?.blocks ?? state.sceneDrafts?.[sceneId]?.blocks;
    const editedBlocks = updateSceneBlocksForTextEdit({
      blocks: sourceBlocks,
      sceneId,
      previousText,
      nextText,
      selectionStart,
      selectionEnd,
      selectionBeforeInputStart,
      selectionBeforeInputEnd,
    });
    const nextBlocks = reconcileSceneBlocksWithEditorText({
      blocks: editedBlocks,
      sceneId,
      chapterId: scene?.chapterId ?? state.sceneDrafts?.[sceneId]?.chapterId ?? "",
      text: nextText,
    });
    if (previousText !== nextText) {
      state.manuscriptMarkHistory = createManuscriptMarkHistoryState();
      state.worldSpineHistory = createWorldSpineHistoryState();
    }
    updateManuscriptMarksAfterSceneTextEdit({
      sceneId,
      previousText,
      nextText,
      previousSceneBlocks: scene?.blocks,
      nextSceneBlocks: nextBlocks,
      pendingFormats,
      selectionStart,
      selectionEnd,
    });
    updateSceneDraft(sceneId, (draft) => {
      draft.editorText = nextText;
      draft.blocks = nextBlocks;
      draft.inlineFormatRanges = inlineFormatRanges;
      draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, previousText, nextText);
    });
  },
  scheduleTypingRefresh: (sceneId, text, options) => scheduleSceneEditorTypingRefresh(sceneId, text, options),
  isGrammarCheckEnabled: () => state.editorPrefs.grammarCheckEnabled !== false,
  scheduleSpellcheckRefresh: (sceneId) => scheduleSceneEditorSpellcheckRefresh(sceneId),
});

// Intent: keep spellcheck debounce timer ownership outside the browser shell.
const spellcheckRefreshController = createSpellcheckRefreshController({
  delayMs: DEFAULT_SPELLCHECK_REFRESH_DELAY_MS,
  setTimeoutRef: window.setTimeout.bind(window),
  clearTimeoutRef: window.clearTimeout.bind(window),
  onFlush: (sceneId) => flushSceneEditorSpellcheckRefresh(sceneId),
});
const anchorIdleValidationScheduler = createManuscriptAnchorIdleValidationScheduler({
  delayMs: DEFAULT_ANCHOR_IDLE_VALIDATION_DELAY_MS,
  setTimeoutRef: window.setTimeout.bind(window),
  clearTimeoutRef: window.clearTimeout.bind(window),
  onValidate: (sceneId, { reason } = {}) => validateAnchoredRecordsForSceneIdle(sceneId, {
    source: `anchor-idle.${reason ?? "scene-text-edit"}`,
  }),
});
const grammarCheckPanelDragController = createGrammarCheckPanelDragController({
  isPanelOpen: () => state.grammarCheckPanel?.open === true,
  getViewport: () => getGrammarCheckPanelViewport(),
  setPosition: (left, top) => setGrammarCheckPanelPosition(left, top),
});
const grammarCheckPanelResizeController = createGrammarCheckPanelResizeController({
  isPanelOpen: () => state.grammarCheckPanel?.open === true,
  getViewport: () => getGrammarCheckPanelViewport(),
  setBounds: (bounds) => setGrammarCheckPanelBounds(bounds),
});

// Intent: centralize anchor-aware task/note resolution while the shell retains browser navigation effects.
const anchoredRecordNavigationController = createAnchoredRecordNavigationController({
  resolveRecordRange: (record, text, { recordType } = {}) => resolveOffsetAnchoredRecordRange(record, text, {
    ownerType: recordType === "passageNote" ? "passageNote" : "task",
    now: new Date().toISOString(),
    fallbackRange: (candidate, source) => resolveManuscriptTaskRange(candidate, source),
  }),
  repairResolvedRange: (recordType, record, resolvedRange) => {
    if (recordType === "task") {
      syncResolvedTaskRange(record, resolvedRange);
      return;
    }
    syncResolvedPassageNoteRange(record, resolvedRange);
  },
});

// Intent: central developer observability service for cross-module diagnostics and separate log-window streaming.
const developerLogger = createDeveloperLogger({
  windowRef: window,
  storageAdapter: browserStorageAdapter,
  mirrorConsole: false,
  persistEntriesToStorage: false,
  onEntry: (entry) => {
    void postDeveloperLogEntryToDesktopHost(entry);
  },
});
const autosaveCoordinatorLog = developerLogger.createSource("AutosaveCoordinator");
const projectPersistenceLog = developerLogger.createSource("ProjectPersistenceService");
const sceneStorageLog = developerLogger.createSource("SceneStorageService");
const manuscriptStateLog = developerLogger.createSource("ManuscriptStateManager");
const editorInteractionLog = developerLogger.createSource("EditorInteractionGate");
const fileAccessBridgeLog = developerLogger.createSource("FileAccessBridge");
const projectLoadGateLog = developerLogger.createSource("ProjectLoadGate");
const projectSaveGateLog = developerLogger.createSource("ProjectSaveGate");
const localStorageAdapterLog = developerLogger.createSource("LocalStorageAdapter");
const desktopFileSystemLog = developerLogger.createSource("DesktopFileSystemAdapter");
const uiEventDispatcherLog = developerLogger.createSource("UIEventDispatcher");
const writingGoalsServiceLog = developerLogger.createSource("WritingGoalsService");
const revisionServiceLog = developerLogger.createSource("RevisionService");
const layoutStateLog = developerLogger.createSource("LayoutState");
const narrationFollowTrackerLog = developerLogger.createSource("NarrationFollowTracker");
const narrationViewportTrackerLog = developerLogger.createSource("NarrationViewportTracker");
const narrationReadingRateLog = developerLogger.createSource("NarrationReadingRate");
const draftProofingLog = developerLogger.createSource("DraftProofingService");
const spotifyMusicLog = developerLogger.createSource("SpotifyMusicService");
const milestoneSoundEffectsLog = developerLogger.createSource("MilestoneSoundEffectsService");
narrationViewportTracker = createNarrationViewportTracker({
  logger: narrationViewportTrackerLog,
});
narrationReadingRateTracker = createNarrationReadingRateTracker({
  logger: narrationReadingRateLog,
});
const narrationFollowViewportMetricsCache = createNarrationFollowViewportMetricsCache();
registerDeveloperLogRuntimeBridge();

const writingGoalsStateLogHooks = {
  logWritingTargetDebugEvent: () => {},
  logWritingTargetMetricCheckpoint: () => {},
  buildWritingTargetDebugTerminalSummary: () => ({
    open: false,
    entryCount: 0,
    recentErrorCount: 0,
    lastEventLabel: "",
  }),
};

// Intent: keep durable record construction and normalization outside the shell orchestration file.
const projectRecordStateService = createProjectRecordStateService({
  clone: cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  normalizeMetadataSubgroups,
  normalizeDraftProofingState,
  normalizeProjectSelectionDefaults,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  getPersistableRevisionProjectState,
  buildProjectIndexForRecord,
  buildWorkspaceStatsFromProjectIndex,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
});
const {
  normalizeProjectRecord,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
} = projectRecordStateService;
const { buildNewProjectCandidateSnapshot } = createNewProjectCandidateBuilder({
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
  exportProjectLibrarySnapshot: (options) => projectService.exportProjectLibrarySnapshot(options),
  getBaseWorkspace: () => state.workspace ?? state.projectLibrary[0]?.workspace ?? null,
});

// Intent: keep project-library normalization and active-record selection outside the shell orchestration file.
const projectLibraryStateService = createProjectLibraryStateService({
  state,
  normalizeProjectRecord,
  mergeProjectRecords,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
  clone: cloneValue,
});
const {
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  getActiveProjectRecord,
  getProjectRecordById,
} = projectLibraryStateService;

const writingGoalsStateService = createWritingGoalsStateService({
  state,
  readStoredJson,
  writeStoredJsonRaw,
  getProjectRecordById,
  getActiveProjectRecord,
  getSelectedScene,
  countRemainingTasksByChapter,
  cloneValue,
  persistCurrentProjectRecord,
  logWritingTargetDebugEvent: (...args) => writingGoalsStateLogHooks.logWritingTargetDebugEvent(...args),
  logWritingTargetMetricCheckpoint: (...args) => writingGoalsStateLogHooks.logWritingTargetMetricCheckpoint(...args),
  buildWritingTargetDebugTerminalSummary: (...args) => writingGoalsStateLogHooks.buildWritingTargetDebugTerminalSummary(...args),
  EDITOR_WRITING_TARGETS_KEY,
  DEFAULT_WRITING_TARGET_WORDS,
  DEFAULT_SESSION_TARGET_WORDS,
  DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
  DEFAULT_SESSION_TARGETS_PER_DAY,
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES,
  WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES,
  WRITING_TARGET_MAX_HISTORY_DAYS,
  WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_SAMPLES,
  WRITING_TARGET_SESSION_HISTORY_MAX,
  WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES,
  WRITING_TARGET_SESSION_PACE_STALE_MINUTES,
  WRITING_TARGET_GOAL_SYNC_SOURCES,
  WRITING_TARGET_CADENCE_OPTIONS,
  WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
  WRITING_TARGET_METRIC_KEYS,
});

const {
  syncWritingTargetState,
  syncWritingTargetPersistedState,
  getWritingTargetWorkingRecord,
  beginWritingTargetDraft,
  clearWritingTargetDraft,
  commitWritingTargetDraft,
  loadWritingTargetState,
  persistWritingTargetState,
  syncWritingTargetCanonicalState,
  buildWritingTargetSummary,
  buildWritingTargetSummaryForRecord,
  buildWritingTargetMetric,
  buildWritingTargetArchiveEntries,
  renderWritingTargetArchiveEntry,
  buildWritingTargetStreakSummary,
  getWritingTargetHistoryEntries,
  getWritingTargetHistoryEntryMap,
  getWritingTargetMonthKey,
  parseWritingTargetMonthKey,
  isWritingTargetDateKey,
  getWritingTargetStartOfWeek,
  getWritingTargetSelectedDateKey,
  primeWritingTargetDashboardSelection,
  buildWritingTargetDashboardModel,
  buildLiveWritingTargetHistoryEntry,
  getWritingTargetDayStatus,
  buildWritingTargetDashboardCards,
  getWritingTargetSelectedEntryModel,
  getCurrentManuscriptWordCount,
  resolveSceneDraftEditorText,
  countWords,
  compactWordCount,
  formatDayCount,
  formatMinuteCount,
  formatClockTimeLabel,
  formatSessionElapsedLabel,
  createPassageExcerpt,
  buildSessionPaceColor,
  mixRgbColor,
  formatRgbColor,
  formatDurationMinutes,
  formatDateLabel,
  formatGoalDateLabel,
  parseLocalDateKey,
  normalizeWritingTargetCadence,
  normalizeWritingTargetGoalSyncSource,
  normalizeWritingTargetVisibleMetrics,
  getWritingTargetCadenceMeta,
  getWritingTargetCadenceDays,
  getWritingTargetGoalSyncSource,
  getWritingTargetDaysUntilDate,
  startOfLocalDay,
  formatSessionAge,
  syncWritingTargetGoalFields,
  seedWritingTargetTestData,
  generateBelievableWritingTargetHistory,
  seededOffset,
  addHours,
  getLocalDateKey,
  normalizeDateInput,
  parseFlexibleDateInput,
  createValidatedDate,
  addDays,
  estimateWritingPace,
  trimWritingTargetHistory,
  normalizeWritingTargetRecord,
  getWritingTargetSnapshotContext,
  createWritingTargetHistoryEntry,
  createWritingTargetSessionSample,
  normalizeWritingTargetSessionSamples,
  normalizeWritingTargetSessionActivityReason,
  normalizeWritingTargetSessionHistory,
  addMinutes,
  getWritingTargetSessionThresholds,
  getWritingTargetSessionPhase,
  getWritingTargetSessionPhaseLabel,
  buildWritingTargetSessionLifecycleSummaryText,
  getWritingTargetSessionLifecycle,
  createWritingTargetSessionHistoryEntry,
  resumeWritingSession,
  touchWritingTargetSessionActivity,
  concludeWritingSession,
  refreshWritingTargetSessionLifecycle,
  estimateRecentSessionWordsPerMinute,
  getWritingTargetDailyBaselineWordCount,
  getWritingTargetTodayHistoryEntry,
  resolveWritingTargetDailyBaselineWordCount,
  getWritingTargetPreviousHistoryEntry,
  clampWritingTargetDailyBaselineWordCount,
  createDefaultWritingTargetRecord,
  readWritingTargetStore,
  clampPositiveNumber,
} = writingGoalsStateService;

// Intent: assemble save-time project records outside shell orchestration while retaining UI capture callbacks here.
const projectRuntimeRecordStateService = createProjectRuntimeRecordStateService({
  state,
  clone: cloneValue,
  getCurrentManuscriptWordCount,
  createProjectSettingsSnapshotFromState,
  captureSceneSelectionDefaultsForSave,
  captureInlinePassageDraftDefaultsForSave,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
});

const projectPersistenceService = createProjectPersistenceService({
  state,
  windowRef: window,
  projectService,
  projectRepository,
  fetchJsonFromDesktopApi,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  autosaveDelayMs: PROJECT_FILE_AUTOSAVE_DELAY_MS,
  shouldPersistProjectCache: () => shouldPersistProjectCache(),
  clearBrowserProjectCache: () => clearProjectContentStorage({
    additionalStorageKeys: [
      EDITOR_WRITING_TARGETS_KEY,
    ],
  }),
  writeProjectFilePathCache: (filePath) => {
    writeStoredJsonRaw(EDITOR_PROJECT_FILE_PATH_KEY, filePath);
  },
  createProjectRecordFromRuntimeState: () => createProjectLibraryRecordFromState(),
  getActiveProjectRecord: () => getActiveProjectRecord(),
  normalizeProjectLibrarySnapshot,
  normalizeProjectRecord,
  resolveActiveProjectId,
  activateLoadedProjectRecord: ({
    projectRecord,
    reason,
  }) => {
    activateProjectRecord(projectRecord, {
      reason: reason ?? "load-project-file",
      logLoadCheckpoint: true,
      renderAfter: true,
      recordSnapshot: true,
    });
  },
  prepareProjectSnapshotForSave: ({ reason }) => {
    logWritingTargetDebugEvent("info", "project.save", "Saving current project snapshot.", {
      reason: reason ?? "save-project",
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      hasFileHandle: Boolean(state.projectFileHandle),
      hasFilePath: hasProjectFilePath(state.projectFilePath),
    });
    commitWritingTargetDraft();
    recordWritingTargetSnapshot({ immediate: true, reason: reason ?? "save-project", skipProjectFileAutosave: true });
  },
  reportBrowserLog,
  renderHeader,
  resolveSuggestedProjectFileName: (projectTitle) => getSuggestedProjectFileName(projectTitle),
  onProjectRecordPersisted: ({ projectRecord, persistCache, options }) => {
    const activeLibraryRecord = state.projectLibrary.find((project) => project.id === state.activeProjectId) ?? null;
    const indexedScenes = Array.isArray(activeLibraryRecord?.projectIndex?.scenes)
      ? activeLibraryRecord.projectIndex.scenes
      : [];
    const indexedWordTotal = getProjectWordCount(activeLibraryRecord?.projectIndex);
    logWritingTargetDebugEvent("info", "persist.project-record", "Persisted active project record.", {
      projectId: projectRecord.id,
      persistCache,
      changedSceneIds: Array.isArray(options.changedSceneIds) ? options.changedSceneIds : [],
      skipProjectFileAutosave: options.skipProjectFileAutosave === true,
      libraryProjectCount: state.projectLibrary.length,
      indexedSceneCount: indexedScenes.length,
      indexedWordTotal,
      writingTargetHistoryEntries: Array.isArray(state.writingTargetState?.history) ? state.writingTargetState.history.length : 0,
    }, {
      skipUpload: Array.isArray(options.changedSceneIds) && options.changedSceneIds.length > 0,
    });
  },
  loggerSources: {
    autosaveCoordinator: autosaveCoordinatorLog,
    projectPersistence: projectPersistenceLog,
    projectLoadGate: projectLoadGateLog,
    projectSaveGate: projectSaveGateLog,
    desktopFileSystem: desktopFileSystemLog,
  },
});
const projectSourceService = createProjectSourceService({
  fetchJson: fetchJsonFromDesktopApi,
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  saveProjectLibrarySnapshot: (snapshot, options = {}) => projectService.saveProjectLibrarySnapshot(snapshot, options),
});
const localAiTitleService = createLocalAiTitleService({
  fetchJson: fetchJsonFromDesktopApi,
  logger: console,
});
const localAiModelLibraryClient = createLocalAiModelLibraryClient({
  fetchJson: fetchJsonFromDesktopApi,
  logger: console,
});
const spotifyMusicTokenStorage = createDurableBrowserTokenStorage({
  reportBrowserLog,
  windowRef: window,
});
const spotifyMusicPlaybackStateStorage = createDurableBrowserTokenStorage({
  reportBrowserLog,
  windowRef: window,
});
const spotifyMusicService = createSpotifyMusicService({
  fetchFn: fetch.bind(window),
  cryptoRef: window.crypto,
  windowRef: window,
  documentRef: document,
  authStorage: window.sessionStorage,
  playbackStateStorage: spotifyMusicPlaybackStateStorage,
  tokenStorage: spotifyMusicTokenStorage,
  logger: spotifyMusicLog,
});
const SPOTIFY_LIMITED_PLAYLIST_MESSAGE = "Spotify hides track lists for playlists you do not own or collaborate on. Use Play to start the playlist.";
// Intent: advance the chrome player's visible seek position between Spotify SDK state snapshots without persisting playback time.
const SPOTIFY_PLAYBACK_POSITION_TICK_MS = 1000;
let spotifyPlaybackPositionTickerId = null;
let spotifyPlaybackPositionSyncedAtMs = 0;
const milestoneSoundEffectsService = createMilestoneSoundEffectsService({
  logger: milestoneSoundEffectsLog,
});
const anchoredRecordService = createAnchoredRecordService({
  getTasks: () => state.manuscriptTasks,
  setTasks: (tasks) => {
    state.manuscriptTasks = tasks;
  },
  persistTasks: (options) => persistManuscriptTasksState(options),
  getNotes: () => state.passageNotes,
  setNotes: (notes) => {
    state.passageNotes = notes;
  },
  persistNotes: (options) => persistPassageNotesState(options),
});
const narrationMediaService = createNarrationMediaService({
  fetchJson: fetchJsonFromDesktopApi,
  getActiveProjectRoot: () => state.projectFilePath,
});
const narrationRecordingTranscriptAlignmentService = createNarrationRecordingTranscriptAlignmentService({
  wordTimingProvider: createWhisperCppWordTimingProvider({
    fetchJson: fetchJsonFromDesktopApi,
    reportLog: reportBrowserLog,
  }),
  reportLog: reportBrowserLog,
});
const narrationRecordingTranscriptAlignmentJobService = createNarrationRecordingAlignmentJobService({
  runAlignment: runNarrationRecordingTranscriptAlignmentJob,
  reportLog: reportBrowserLog,
});
const narrationRecordingRuntimeService = createNarrationRecordingRuntimeService({
  clearIntervalFn: (timerId) => window.clearInterval(timerId),
});
const narrationRecordingFinalizationService = createNarrationRecordingFinalizationService({
  cleanupRuntime: (runtime) => narrationRecordingRuntimeService.cleanupRuntime(runtime),
  saveMediaBlob: (input) => narrationMediaService.saveMediaBlob(input),
  resolveSelection: (runtime) => getNarrationTakeSelectionForScene(runtime?.selection?.sceneId ?? state.selectedSceneId),
  getProjectId: () => state.activeProjectId || state.workspace?.project?.id || "",
  reportLog: reportBrowserLog,
  blobConstructor: typeof Blob === "undefined" ? null : Blob,
});
const voiceRecordingService = createVoiceRecordingService({
  getWorkspace: () => state.workspace,
  getProjectId: () => state.activeProjectId ?? state.workspace?.project?.id ?? "",
});
const voiceRecordingWaveformService = createVoiceRecordingWaveformService({
  reportLog: reportBrowserLog,
});
const voiceRecordingActionService = createVoiceRecordingActionService({
  getRecordingById: (recordingId) => voiceRecordingService.getById(recordingId),
  loadMediaBlob: (input) => narrationMediaService.loadMediaBlob(input),
  deleteMediaFile: (input) => narrationMediaService.deleteMediaFile(input),
  playBlob: (blob, playbackOptions) => voiceRecordingPreviewController.playBlob(blob, playbackOptions),
  getScene: (sceneId) => getScene(sceneId),
  deleteRecordingById: (recordingId, projectId) => voiceRecordingService.deleteById(recordingId, projectId),
  reportLog: reportBrowserLog,
});
const narrationMediaRecorderService = createNarrationMediaRecorderService({
  mediaRecorderConstructor: typeof MediaRecorder === "undefined" ? null : MediaRecorder,
  blobConstructor: typeof Blob === "undefined" ? null : Blob,
  getRuntime: () => narrationRecordingRuntime,
  appendChunk: (recordingId, chunk) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }
    narrationRecordingRuntime.chunks.push(chunk);
  },
  applyRuntimePatch: (recordingId, patch) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }
    narrationRecordingRuntime = {
      ...narrationRecordingRuntime,
      ...patch,
    };
  },
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
  finalizeRecording: (recordingId) => {
    void finalizeNarrationRecording(recordingId);
  },
});
const narrationFollowAlignmentService = createNarrationFollowAlignmentService({
  getScene: (sceneId) => getScene(sceneId),
  getProjectId: () => state.activeProjectId ?? state.workspace?.project?.id ?? "",
  logger: narrationFollowTrackerLog,
});
const narrationRealtimeSpeechClient = createNarrationRealtimeSpeechClient({
  fetchJson: fetchJsonFromDesktopApi,
});
const narrationLiveAudioFrameService = createNarrationLiveAudioFrameService({
  chunkDurationMs: 700,
  maxBufferedAudioMs: 950,
  logger: narrationFollowTrackerLog,
});

// Intent: share recording runtime patching across live ASR providers without moving state ownership into providers.
function applyNarrationRecordingRuntimePatch(recordingId, patch) {
  if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
    return;
  }
  narrationRecordingRuntime = {
    ...narrationRecordingRuntime,
    ...patch,
  };
}

// Intent: prefer the browser-managed live recognizer when the tiny local Sherpa model is not good enough for read-along tracking.
const browserSpeechRecognitionConstructor = typeof window === "undefined"
  ? null
  : window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
const narrationSpeechRecognitionService = createNarrationSpeechRecognitionService({
  recognitionConstructor: browserSpeechRecognitionConstructor,
  getRuntime: () => narrationRecordingRuntime,
  applyRuntimePatch: applyNarrationRecordingRuntimePatch,
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
  resolveFollowMatch: ({ transcript, runtime, speechSnapshot }) => resolveNarrationFollowMatchForTranscript({
    transcript,
    runtime,
    speechSnapshot,
  }),
  logger: narrationFollowTrackerLog,
});
const browserWebSpeechTrackerProvider = createBrowserWebSpeechTrackerProvider({
  speechRecognitionService: narrationSpeechRecognitionService,
  availability: browserSpeechRecognitionConstructor ? "ready" : "disabled",
  unavailableReason: "Browser Web Speech is unavailable in this desktop webview.",
});
const desktopRealtimeSpeechTrackerProvider = createDesktopRealtimeSpeechTrackerProvider({
  realtimeSpeechClient: narrationRealtimeSpeechClient,
  liveAudioFrameService: narrationLiveAudioFrameService,
  getRuntime: () => narrationRecordingRuntime,
  applyRuntimePatch: applyNarrationRecordingRuntimePatch,
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
  resolveFollowMatch: ({ transcript, runtime, speechSnapshot }) => resolveNarrationFollowMatchForTranscript({
    transcript,
    runtime,
    speechSnapshot,
  }),
  logger: narrationFollowTrackerLog,
});
// Intent: keep local PCM/Whisper cleanup available when Browser Web Speech owns the live transcript.
const desktopCleanupSpeechTrackerProvider = createDesktopRealtimeSpeechTrackerProvider({
  realtimeSpeechClient: narrationRealtimeSpeechClient,
  liveAudioFrameService: narrationLiveAudioFrameService,
  getRuntime: () => narrationRecordingRuntime,
  applyRuntimePatch: (recordingId, patch) => {
    if (typeof patch?.cleanupTranscript !== "string") {
      return;
    }
    applyNarrationRecordingRuntimePatch(recordingId, {
      cleanupTranscript: patch.cleanupTranscript,
      speechSnapshot: patch.speechSnapshot ?? narrationRecordingRuntime?.speechSnapshot ?? null,
    });
  },
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
  resolveFollowMatch: () => null,
  logger: narrationFollowTrackerLog,
  applyLiveTranscriptPatches: false,
});
const narrationLiveSpeechTrackerService = createNarrationLiveSpeechTrackerService({
  providers: [
    createPrimaryLiveWithCleanupTrackerProvider({
      primaryProvider: browserWebSpeechTrackerProvider,
      cleanupProvider: desktopCleanupSpeechTrackerProvider,
      label: "Browser Web Speech + local cleanup",
    }),
    desktopRealtimeSpeechTrackerProvider,
  ],
  logger: narrationFollowTrackerLog,
});
const narrationRecordingCommandService = createNarrationRecordingCommandService({
  getRuntime: () => narrationRecordingRuntime,
  setRuntime: (runtime) => {
    narrationRecordingRuntime = runtime;
  },
  resolveSelection: (sceneId) => {
    const scene = sceneId ? getScene(sceneId) : getSelectedScene() ?? state.scenes[0] ?? null;
    const selection = scene ? getNarrationTakeSelectionForScene(scene.sceneId) : null;
    if (selection) {
      state.narrationTakeSelection = selection;
    }
    return {
      scene,
      selection,
    };
  },
  getProjectId: () => state.activeProjectId ?? state.workspace?.project?.id ?? "",
  setSession: (session) => setNarrationTakeSession(session),
  createTimer: () => window.setInterval(refreshNarrationRecordingSession, 1000),
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  hasMicrophoneCapture: () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  hasMediaRecorder: () => typeof MediaRecorder !== "undefined",
  mediaRecorderConstructor: typeof MediaRecorder === "undefined" ? null : MediaRecorder,
  createRecorder: (recordingId, stream, options) => narrationMediaRecorderService.createRecorder(recordingId, stream, options),
  createRecognition: (recordingId, context) => narrationLiveSpeechTrackerService.createTracker(recordingId, context),
  updateSessionFromRuntime: (overrides) => updateNarrationTakeSessionFromRuntime(overrides),
  abortStart: (selection, error, stream) => abortNarrationRecordingStart(selection, error, stream),
  finalizeRecording: (recordingId, error) => finalizeNarrationRecording(recordingId, error),
  clone: cloneValue,
});
const voiceRecordingPreviewController = createVoiceRecordingPreviewController({
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createAudio: (url) => new Audio(url),
  reportLog: reportBrowserLog,
  onPlaybackStateChange: (playbackState, eventType) => {
    handleVoiceRecordingPlaybackStateChange(playbackState, eventType);
  },
});

const revisionStorageService = createRevisionStorageService({
  logger: revisionServiceLog,
});
// Intent: keep project-record hydration assignments outside activation effect orchestration.
const projectActivationStateService = createProjectActivationStateService({
  state,
  clone: cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  normalizeMetadataSubgroups,
  normalizeDraftProofingState,
  readRevisionState: (record) => revisionStorageService.readRevisionState(record),
  createRevisionPanelStateForProject,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  normalizeSpellcheckProjectSettings,
});
const revisionPanelController = createRevisionPanelController();
const revisionService = createRevisionService({
  getProjectRecord: () => getActiveProjectRecord(),
  getProjectSnapshot: () => createProjectLibraryRecordFromState(),
  getRevisionState: () => state.revisionState,
  setRevisionState,
  logger: revisionServiceLog,
});

const writingGoalsService = createWritingGoalsService({
  state,
  windowRef: window,
  documentRef: document,
  serializeBrowserLogContext,
  postJsonToDesktopHost,
  buildWritingTargetSummary,
  buildWritingTargetDashboardModel,
  getWritingTargetSelectedEntryModel,
  buildWritingTargetDashboardCards,
  renderWritingTargetArchiveEntry,
  refreshWritingTargetSessionLifecycle,
  beginWritingTargetDraft,
  syncWritingTargetCanonicalState,
  normalizeWritingTargetCadence,
  isWritingTargetDateKey,
  getWritingTargetWorkingRecord,
  cloneValue,
  getCurrentManuscriptWordCount,
  createWritingTargetSessionSample,
  persistWritingTargetState,
  clearWritingTargetDraft,
  persistCurrentProjectRecord,
  getWritingTargetSnapshotContext,
  createWritingTargetHistoryEntry,
  trimWritingTargetHistory,
  resolveWritingTargetDailyBaselineWordCount,
  normalizeWritingTargetSessionSamples,
  resumeWritingSession,
  normalizeWritingTargetSessionActivityReason,
  buildWritingTargetSummaryForRecord,
  primeWritingTargetDashboardSelection,
  commitWritingTargetDraft,
  createDefaultWritingTargetRecord,
  getWritingTargetMonthKey,
  parseWritingTargetMonthKey,
  parseLocalDateKey,
  getLocalDateKey,
  beginProjectFileAutosaveSuppression,
  endProjectFileAutosaveSuppression,
  hasProjectFileDestination,
  saveCurrentProject,
  renderHeader,
  writingGoalsLogger: writingGoalsServiceLog,
  writingGoalsLogSourceName: "WritingGoalsService",
  getDeveloperLogEntries: () => developerLogger.getEntries(),
  WRITING_TARGET_CADENCE_OPTIONS,
  WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
  WRITING_TARGET_METRIC_KEYS,
  WRITING_TARGET_MAX_SESSION_SAMPLES,
});

const {
  renderWritingTargetWindow,
  buildWritingTargetDebugTerminalSummary,
  normalizeLogLevel,
  logWritingTargetMetricCheckpoint,
  buildWritingTargetMetricCheckpointSignature,
  logWritingTargetDebugEvent,
  syncWritingTargetWindowLiveState,
  syncSessionTrackerLiveState,
  syncHeaderLiveState,
  patchSessionTrackerPanel,
  startWritingTargetWindowRefreshTimer,
  stopWritingTargetWindowRefreshTimer,
  startSessionTrackerRefreshTimer,
  stopSessionTrackerRefreshTimer,
  updateWritingTargetField,
  syncWritingTargetFieldControls,
  toggleWritingTargetMetric,
  toggleWritingTargetWindow,
  closeWritingTargetWindow,
  saveWritingTargetGoals,
  cancelWritingTargetGoals,
  resetWritingTargetGoals,
  setWritingTargetViewMode,
  selectWritingTargetDay,
  shiftWritingTargetCalendarMonth,
  jumpWritingTargetCalendarToToday,
  resetWritingSession,
  saveWritingTargetState,
  recordWritingTargetSnapshot,
  queueWritingTargetSnapshot,
  clearWritingTargetSnapshotTimer,
  logWritingTargetLoadCheckpoint,
} = writingGoalsService;

// Intent: keep writing-goals domain logs routed through the shared writing-goals logger once the UI service is initialized.
writingGoalsStateLogHooks.logWritingTargetDebugEvent = logWritingTargetDebugEvent;
writingGoalsStateLogHooks.logWritingTargetMetricCheckpoint = logWritingTargetMetricCheckpoint;
writingGoalsStateLogHooks.buildWritingTargetDebugTerminalSummary = buildWritingTargetDebugTerminalSummary;

// Intent: centralize activation effects while the shell continues to compose browser and feature callbacks.
const projectActivationController = createProjectActivationController({
  state,
  clone: cloneValue,
  applyProjectRecordToState: (record) => projectActivationStateService.applyProjectRecordToState(record),
  persistActiveProjectId: (projectId) => projectPersistenceService.persistActiveProjectId(projectId),
  saveWritingTargetState,
  clearWritingTargetDraft,
  clearWritingTargetSnapshotTimer,
  clearProjectAutosaveState: () => clearProjectFileAutosaveState(),
  getNarrationRecordingRuntime: () => narrationRecordingRuntime,
  setNarrationRecordingRuntime: (runtime) => {
    narrationRecordingRuntime = runtime;
  },
  cleanupNarrationRecordingRuntime: (runtime) => narrationRecordingRuntimeService.cleanupRuntime(runtime),
  getVoiceRecordingPreviewAudio: () => voiceRecordingPreviewController.getPreviewAudio(),
  setVoiceRecordingPreviewAudio: (audio) => voiceRecordingPreviewController.setPreviewAudio(audio),
  getVoiceRecordingPreviewUrl: () => voiceRecordingPreviewController.getPreviewUrl(),
  setVoiceRecordingPreviewUrl: (url) => voiceRecordingPreviewController.setPreviewUrl(url),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  clearBinderTitleClickState: () => {
    binderTitleClickState = null;
  },
  writeProjectSourcePath: (value) => writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, value),
  writeBinderWidth: (value) => writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, value),
  writeConsoleWidth: (value) => writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, value),
  writePanelResizerLayoutProfiles: (value) => writeStoredJsonRaw(EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY, value),
  persistConsoleDockCollapsedState,
  persistCollapsedChapterState,
  persistCollapsedConsoleChapterState,
  readWritingTargetStore,
  writeWritingTargetStore: (value) => writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, value),
  syncLegacyProjectStorageFromState,
  logWritingTargetDebugEvent,
  projectLoadGateLog,
  manuscriptStateLog,
  refreshScenes,
  restoreSelectionFromWorkspaceDefaults,
  syncWritingTargetState,
  refreshWritingTargetSessionLifecycle,
  logWritingTargetLoadCheckpoint,
  render,
  recordWritingTargetSnapshot,
});

registerRuntimeLogging();

boot().catch((error) => {
  reportBrowserLog("error", "boot", "Workspace boot failed.", { error });
  console.error(error);
  appRoot.innerHTML = `
    <div class="error-shell">
      <p class="loading-kicker">Desktop Host Failed</p>
      <h1>Unable to load the author workspace.</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    </div>
  `;
});

// Intent: boot the editor from desktop APIs, bundled seed data, and local browser state in that priority order.
async function boot() {
  const desktopSettings = await loadDesktopSettingsSnapshot();
  const seedLibrary = await loadInitialProjectLibrary(desktopSettings);
  const explicitBootProjectFilePath = desktopSettings.lastProjectFilePathExplicit === true
    ? normalizeProjectFilePath(desktopSettings.lastProjectFilePath)
    : "";
  const hasExplicitBootProjectFilePath = hasProjectFilePath(explicitBootProjectFilePath);
  const ignoredDesktopProjectFilePath = seedLibrary.ignoredDesktopProjectFilePath === true
    ? explicitBootProjectFilePath
    : normalizeProjectFilePath(seedLibrary.ignoredDesktopProjectFilePath ?? "");
  const shouldUseExplicitBootProjectFilePath =
    hasExplicitBootProjectFilePath &&
    !areProjectFilePathsEquivalent(explicitBootProjectFilePath, ignoredDesktopProjectFilePath);
  state.projectLibrary = seedLibrary.projects;
  state.activeProjectId = seedLibrary.activeProjectId ?? seedLibrary.projects[0]?.id ?? null;
  state.projectLibrarySelectionId = state.activeProjectId;
  state.loadedProjectSceneStore = seedLibrary.sceneStore && typeof seedLibrary.sceneStore === "object" && !Array.isArray(seedLibrary.sceneStore)
    ? cloneValue(seedLibrary.sceneStore)
    : {};
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  state.projectFilePath = shouldUseExplicitBootProjectFilePath ? explicitBootProjectFilePath : "";
  state.spotifyMusicDesktopClientId = desktopSettings.spotifyClientId;
  state.projectFileStatus = "";
  state.projectFileBusy = false;
  state.projectFileAutosaveDirty = false;
  state.projectFileAutosaveBlocked = null;
  state.projectFileAutosaveTarget = null;
  state.projectFileAutosaveRevision = 0;
  state.projectPersistenceDirtyDomains = {};
  state.projectEditorWorkingDirtyState = {
    dirty: false,
    lastMutationAt: "",
    domains: {},
  };
  if (state.projectFileAutosaveTimer) {
    window.clearTimeout(state.projectFileAutosaveTimer);
    state.projectFileAutosaveTimer = null;
  }
  state.projectFileAutosaveSuppressionDepth = 0;
  state.projectSourcePath = loadStoredString(EDITOR_PROJECT_SOURCE_PATH_KEY) ?? "";
  state.projectSourceStatus = "";
  state.consoleDockCollapsed = readStoredJson(EDITOR_RIGHT_DOCK_COLLAPSED_KEY) === true;
  state.sidePanelsHidden = normalizeSidePanelsHiddenState(readStoredJson(EDITOR_SIDE_PANELS_HIDDEN_KEY));
  state.binderPanelWidth = loadStoredNumber(EDITOR_BINDER_WIDTH_KEY, DEFAULT_BINDER_PANEL_WIDTH);
  state.consoleDockWidth = loadStoredNumber(EDITOR_CONSOLE_WIDTH_KEY, DEFAULT_CONSOLE_PANEL_WIDTH);
  state.panelResizerLayoutProfiles = normalizePanelResizerLayoutProfiles(
    readStoredJson(EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY),
  );
  state.worldSpineEventRailWidth = loadStoredNumber(
    EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY,
    DEFAULT_WORLD_SPINE_EVENT_RAIL_WIDTH,
  );
  state.worldSpineManuscriptPaneWidth = loadStoredNumber(
    EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY,
    DEFAULT_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
  );
  state.worldSpinePanelLayoutProfiles = normalizeWorldSpineLayoutProfiles(
    readStoredJson(EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY),
  );
  applyProjectRecord(getActiveProjectRecord() ?? state.projectLibrary[0]);
  refreshScenes();
  // Intent: keep bundled seed paths from replacing the active browser project cache before reconnect.
  if (ignoredDesktopProjectFilePath) {
    const activeRecordPath = getBootFallbackProjectFilePath(ignoredDesktopProjectFilePath);
    if (activeRecordPath) {
      state.projectFilePath = activeRecordPath;
    }
    await projectPersistenceService.persistDesktopProjectFilePath("", false);
  } else if (!shouldUseExplicitBootProjectFilePath) {
    projectPersistenceService.syncActiveProjectFileDestinationFromRecord({
      persistDesktopProjectFilePath: false,
      source: "boot",
    });
  }
  const reconnectDesktopSettings = shouldUseExplicitBootProjectFilePath
    ? desktopSettings
    : {
        ...desktopSettings,
        lastProjectFilePath: "",
        lastProjectFilePathExplicit: false,
      };
  await reconnectProjectFileDestinationOnBoot(reconnectDesktopSettings);
  spellcheckBaseLexicon = await ensureSpellcheckBaseLexicon();
  spellcheckReferenceLexicon = await ensureSpellcheckReferenceLexicon();

  restoreSelectionFromWorkspaceDefaults();
  syncWritingTargetState({ forceReload: true });
  refreshWritingTargetSessionLifecycle({ reason: "boot" });
  initializeSpotifyMusicState();
  await completeSpotifyAuthorizationFromCurrentLocation();
  await refreshSpotifyMusicProfileFromCurrentToken();
  const spotifyPlaybackResumeSnapshot = hydrateSpotifyMusicPlaybackFromStoredSnapshot();

  render();
  syncLayoutWidths({ reason: "boot-post-render" });
  syncWorldSpinePanelLayout({ reason: "boot-post-render" });
  if (spotifyPlaybackResumeSnapshot && spotifyPlaybackResumeSnapshot.paused === false) {
    window.setTimeout(() => {
      void restoreSpotifyMusicPlaybackFromStoredSnapshot({ reason: "boot" });
    }, 0);
  }
  recordWritingTargetSnapshot({ immediate: true, reason: "boot", skipProjectFileAutosave: true });
  startSessionTrackerRefreshTimer();
  const bootedProject = getActiveProjectRecord();
  if (bootedProject?.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Booted saved project.", {
      projectId: bootedProject.id,
      title: bootedProject.title,
      chapters: bootedProject.workspace.project.stats.chapterCount,
      scenes: bootedProject.workspace.project.stats.sceneCount,
      templates: bootedProject.workspace.world?.stats?.templateCount ?? 0,
    });
  }
  wireEvents();
  syncSceneDocumentLayout();
}

function normalizeProjectFileComparisonKey(filePath) {
  const normalizedPath = normalizeProjectFilePath(filePath).replace(/\\+/g, "/");
  return normalizedPath.includes("/") || /^[A-Za-z]:\//.test(normalizedPath)
    ? normalizedPath.toLowerCase()
    : normalizedPath;
}

function areProjectFilePathsEquivalent(leftPath, rightPath) {
  const leftKey = normalizeProjectFileComparisonKey(leftPath);
  const rightKey = normalizeProjectFileComparisonKey(rightPath);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function getBootFallbackProjectFilePath(ignoredProjectFilePath = "") {
  const activeRecord = getActiveProjectRecord();
  if (!activeRecord) {
    return "";
  }

  const durableRecordPath = normalizeProjectFilePath(getProjectRecordFilePath(activeRecord));
  const rawRecordPath = normalizeProjectFilePath(
    activeRecord?.projectSettings?.projectFilePath ?? activeRecord?.projectFilePath ?? "",
  );
  const candidatePath = durableRecordPath || rawRecordPath;
  return areProjectFilePathsEquivalent(candidatePath, ignoredProjectFilePath) ? "" : candidatePath;
}

// Intent: delegate browser events while the shell still coordinates feature slices during the refactor.
function wireEvents() {
  if (eventsWired) {
    return;
  }
  eventsWired = true;
  wireAppearanceModeSystemPreferenceListener();

  document.addEventListener("pointerdown", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    beginNarrationRecordingWaveformSelectionGesture(clickTarget, event);
    if (handleWorldSpineCatalogueAssignmentPointerDown(event, clickTarget)) {
      return;
    }
    worldSpineController.handlePointerDown(event);
    if (isManuscriptSelectionCommandTarget(clickTarget)) {
      refreshSceneEditorSelectionStateFromActiveTextarea();
      event.preventDefault();
    }
    if (clickTarget instanceof HTMLTextAreaElement && clickTarget.classList.contains("editor-document-input")) {
      markSceneEditorAsCurrent(clickTarget);
      beginPendingFormatDragSelection(clickTarget, event);
      beginDraftProofSelectionGesture(clickTarget, event);
    } else {
      manuscriptPendingFormatDragSelectionSession = null;
      draftProofSelectionGesture = null;
    }
    writingTargetPointerDownStartedInsideWindow = Boolean(clickTarget?.closest(".writing-target-window"));
    revisionWindowPointerDownStartedInsideWindow = Boolean(clickTarget?.closest(".revision-window"));
    const catalogueResizeHandle = clickTarget?.closest("[data-worldbuilding-catalogue-resize-handle]");
    if (catalogueResizeHandle instanceof HTMLElement) {
      beginWorldbuildingCatalogueResize(catalogueResizeHandle, event);
      return;
    }

    const catalogueDragHandle = clickTarget?.closest("[data-worldbuilding-catalogue-drag-handle]");
    if (
      catalogueDragHandle instanceof HTMLElement &&
      !clickTarget?.closest("button, input, textarea, select, a, [data-action]")
    ) {
      beginWorldbuildingCatalogueDrag(catalogueDragHandle, event);
      return;
    }

    const worldSpineResizeHandle = clickTarget?.closest("[data-world-spine-resize-handle]");
    if (worldSpineResizeHandle instanceof HTMLElement) {
      if (state.sidePanelsHidden === true) {
        return;
      }
      beginWorldSpineLayoutResize(worldSpineResizeHandle.dataset.worldSpineResizeHandle, event);
      return;
    }

    const resizeHandle = clickTarget?.closest("[data-resize-handle]");
    if (!(resizeHandle instanceof HTMLElement)) {
      return;
    }

    const handleId = resizeHandle.dataset.resizeHandle;
    if (handleId !== "binder" && handleId !== "console") {
      return;
    }

    if (state.sidePanelsHidden === true) {
      return;
    }

    if (handleId === "console" && state.consoleDockCollapsed) {
      return;
    }

    beginLayoutResize(handleId, event);
  });

  document.addEventListener("pointermove", handleLayoutResizePointerMove);
  document.addEventListener("pointermove", handleWorldSpineLayoutResizePointerMove);
  document.addEventListener("pointermove", handleSpellcheckHoverPointerMove);
  document.addEventListener("pointermove", handleWorldbuildingCatalogueDragPointerMove);
  document.addEventListener("pointermove", (event) => worldSpineController.handlePointerMove(event));
  document.addEventListener("pointerup", endLayoutResize);
  document.addEventListener("pointerup", endWorldSpineLayoutResize);
  document.addEventListener("pointerup", endWorldbuildingCatalogueDrag);
  document.addEventListener("pointerup", (event) => worldSpineController.handlePointerEnd(event));
  document.addEventListener("pointerup", handleNarrationRecordingWaveformSelectionPointerEnd);
  document.addEventListener("pointercancel", endLayoutResize);
  document.addEventListener("pointercancel", endWorldSpineLayoutResize);
  document.addEventListener("pointercancel", endWorldbuildingCatalogueDrag);
  document.addEventListener("pointercancel", (event) => worldSpineController.handlePointerEnd(event));
  document.addEventListener("pointercancel", cancelNarrationRecordingWaveformSelectionGesture);
  document.addEventListener("pointercancel", cancelPendingFormatDragSelection);
  document.addEventListener("pointercancel", cancelDraftProofSelectionGesture);
  document.addEventListener("pointerup", (event) => {
    const pendingFormatDragSession = consumePendingFormatDragSelection(event);
    const draftProofGesture = consumeDraftProofSelectionGesture(event);
    const activeTextarea = refreshSceneEditorSelectionStateFromActiveTextarea();
    window.setTimeout(() => {
      const refreshedTextarea = refreshSceneEditorSelectionStateFromActiveTextarea() ?? activeTextarea;
      applyPendingFormatDragSelection(pendingFormatDragSession, refreshedTextarea);
      applyDraftProofSelectionGesture(draftProofGesture, refreshedTextarea);
      writingTargetPointerDownStartedInsideWindow = false;
      revisionWindowPointerDownStartedInsideWindow = false;
    }, 0);
  });
  document.addEventListener("pointerdown", handleGrammarCheckPointerDown);
  document.addEventListener("pointermove", handleGrammarCheckPointerMove);
  document.addEventListener("pointerup", handleGrammarCheckPointerEnd);
  document.addEventListener("pointercancel", handleGrammarCheckPointerEnd);
  document.addEventListener("pointerdown", handleManuscriptFindPointerDown);
  document.addEventListener("pointermove", handleManuscriptFindPointerMove);
  document.addEventListener("pointerup", handleManuscriptFindPointerEnd);
  document.addEventListener("pointercancel", handleManuscriptFindPointerEnd);
  document.addEventListener("input", handleWorldSpineAssignmentFilterInput);
  document.addEventListener("submit", handleWorldSpineParallelTimelineFormSubmit);
  document.addEventListener("wheel", handleManuscriptFindWheel, { passive: false });
  document.addEventListener("wheel", handleSidePanelTabsWheel, { passive: false });
  document.addEventListener("wheel", (event) => worldSpineController.handleWheel(event), { passive: false });
  document.addEventListener("scroll", (event) => worldSpineController.handleScroll(event), true);
  document.addEventListener("selectionchange", () => {
    const activeElement = refreshSceneEditorSelectionStateFromActiveTextarea();

    if (state.activePane !== "narration" || state.narrationTakeSession?.status === "recording") {
      return;
    }

    if (!(activeElement instanceof HTMLTextAreaElement) || !activeElement.classList.contains("editor-document-input")) {
      return;
    }

    updateNarrationTakeSelectionFromTextarea(activeElement);
  });
  document.addEventListener("dragstart", handleBinderSceneDragStart);
  document.addEventListener("dragover", handleBinderSceneDragOver);
  document.addEventListener("drop", handleBinderSceneDrop);
  document.addEventListener("dragend", handleBinderSceneDragEnd);
  document.addEventListener("dragstart", handleWorldbuildingStudioDragStart);
  document.addEventListener("dragover", handleWorldSpineTimelineDragOver);
  document.addEventListener("drop", handleWorldSpineTimelineDrop);
  document.addEventListener("dragend", handleWorldbuildingStudioDragEnd);
  document.addEventListener("dragstart", handleMetadataFolderDragStart);
  document.addEventListener("dragover", handleMetadataFolderDragOver);
  document.addEventListener("drop", handleMetadataFolderDrop);
  document.addEventListener("dragleave", handleMetadataFolderDragLeave);
  document.addEventListener("dragend", handleMetadataFolderDragEnd);
  window.addEventListener("resize", () => {
    syncLayoutWidths({ reason: "window-resize" });
    syncWorldSpinePanelLayout({ reason: "window-resize" });
    syncGrammarCheckPanelBoundsToViewport();
    syncWorldbuildingEntryPopoverPosition();
    syncWorldbuildingCataloguePositionToViewport();
  });
  window.addEventListener("pagehide", () => {
    persistSpotifyMusicPlaybackSnapshot({ reason: "pagehide" });
  });

  document.addEventListener("click", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (worldbuildingCatalogueSuppressNextClick) {
      worldbuildingCatalogueSuppressNextClick = false;
      event.preventDefault();
      return;
    }
    if (worldSpineAssignmentSuppressNextClick) {
      worldSpineAssignmentSuppressNextClick = false;
      event.preventDefault();
      return;
    }

    if (worldSpineController.handleClick(event) === true) {
      return;
    }
    if (state.fileMenuOpen && !clickTarget?.closest("[data-file-menu]")) {
      hideFileMenu();
    }
    if (state.projectSettingsMenuOpen && !clickTarget?.closest("[data-project-settings-menu]")) {
      hideProjectSettingsMenu();
    }
    if (state.developerOptionsMenuOpen && !clickTarget?.closest("[data-developer-options-menu]")) {
      hideDeveloperOptionsMenu();
    }
    if (state.binderContextMenu && !isTaskContextMenuOwnedTarget(clickTarget)) {
      hideBinderContextMenu();
    }
    if (state.worldSpineContextMenu && !clickTarget?.closest("[data-world-spine-context-menu]")) {
      hideWorldSpineContextMenu();
    }
    if (
      state.sidePanelCustomizationOpen &&
      clickTarget &&
      !clickTarget.closest("[data-side-panel-customization]")
    ) {
      closeSidePanelCustomization();
    }
    if (
      state.topPanelCustomizationOpen &&
      clickTarget &&
      !clickTarget.closest("[data-top-panel-customization]")
    ) {
      closeTopPanelCustomization();
    }
    if (
      state.worldbuildingCatalogueCategoryId &&
      clickTarget &&
      !clickTarget.closest("[data-worldbuilding-catalogue]") &&
      !clickTarget.closest("[data-worldbuilding-category-id]")
    ) {
      closeWorldbuildingCatalogue();
    }
    if (
      state.customMetadataFormOpen &&
      clickTarget &&
      !clickTarget.closest("[data-custom-metadata-form]") &&
      !clickTarget.closest('[data-action="open-custom-metadata-form"]')
    ) {
      closeCustomMetadataForm();
    }
    if (
      state.spotifyMusicPanelOpen &&
      clickTarget &&
      !clickTarget.closest("[data-spotify-music-chrome]")
    ) {
      closeSpotifyMusicPanel();
    }
    if (
      state.writingTargetWindowOpen &&
      clickTarget &&
      !clickTarget.closest(".writing-target-window") &&
      !clickTarget.closest('[data-action="toggle-writing-target-window"]') &&
      !writingTargetPointerDownStartedInsideWindow
    ) {
      closeWritingTargetWindow();
    }
    if (
      state.revisionWindowOpen &&
      clickTarget &&
      !clickTarget.closest(".revision-window") &&
      !clickTarget.closest('[data-action="toggle-revision-window"]') &&
      !revisionWindowPointerDownStartedInsideWindow
    ) {
      closeRevisionWindow();
    }
    if (
      state.draftProofSettingsWindowOpen &&
      shouldCloseDraftProofSettingsWindowForClick(clickTarget)
    ) {
      closeDraftProofSettingsWindow();
    }
    if (
      state.highlightColorPaletteOpen &&
      clickTarget &&
      !clickTarget.closest("[data-highlight-color-palette]") &&
      !clickTarget.closest('[data-action="toggle-inline-format"][data-inline-format="highlight"]')
    ) {
      closeHighlightColorPalette();
    }
    if (clickTarget?.closest("[data-title-input], [data-passage-note-body-input]")) {
      hideTaskSurfaces();
      return;
    }

    const topPanelRestoreTarget = clickTarget?.closest("[data-top-panel-restore-target]");
    if (topPanelRestoreTarget instanceof HTMLElement) {
      openTopPanelCustomization(topPanelRestoreTarget.dataset.topPanelRestoreTarget, {
        x: event.clientX,
        y: event.clientY,
      });
      hideTaskSurfaces();
      return;
    }

    const target = clickTarget?.closest("[data-action]");
    if (!target) {
      if (isTaskContextMenuOwnedTarget(clickTarget)) {
        return;
      }

      if (selectPassageNoteFromEditorClick(clickTarget)) {
        hideTaskContextMenu();
        return;
      }

      if (selectTaskFromEditorClick(clickTarget)) {
        hideTaskContextMenu();
        return;
      }

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
    if (action) {
      const trackedUserActions = new Set([
        "load-project",
        "save-project",
        "save-project-file-as",
        "load-project-file",
        "import-scrivener-project",
        "create-project",
        "load-project-source",
        "open-developer-logs",
        "toggle-writing-target-window",
        "toggle-revision-window",
        "toggle-side-panels-hidden",
        "set-appearance-mode",
        "open-keyboard-shortcut-settings",
        "select-scene",
        "select-next-scene",
      ]);
      if (trackedUserActions.has(action)) {
        uiEventDispatcherLog.info("user-action", `ui.action.${action}`, "User triggered UI action.", {
          action,
          sceneId: target.dataset.sceneId ?? "",
          projectId: target.dataset.projectId ?? state.activeProjectId ?? "",
        });
      }
    }

    if (
      !isTaskContextMenuOwnedTarget(target) &&
      action !== "add-selection-task" &&
      action !== "add-passage-note" &&
      action !== "add-world-spine-event" &&
      action !== "world-spine-insert-event-here" &&
      action !== "world-spine-add-parallel-timeline" &&
      action !== "world-spine-add-dual-timeline" &&
      action !== "world-spine-edit-location-row" &&
      action !== "save-world-spine-parallel-timeline" &&
      action !== "save-world-spine-location-row" &&
      action !== "close-world-spine-context-menu" &&
      action !== "apply-spellcheck-suggestion" &&
      action !== "add-grammar-check-dictionary" &&
      action !== "add-grammar-check-exceptions" &&
      action !== "dismiss-spellcheck-menu" &&
      action !== "lookup-dictionary-word" &&
      action !== "close-dictionary-window"
    ) {
      hideTaskContextMenu();
    }

    if (action === "cancel-project-package-dialog") {
      closeProjectPackageDialog();
      return;
    }

    if (action === "browse-project-package-path") {
      void browseProjectPackageDialog(state.projectPackageDialog?.locationPath ?? "");
      return;
    }

    if (action === "navigate-project-package") {
      void browseProjectPackageDialog(target.dataset.projectPackagePath ?? "");
      return;
    }

    if (action === "confirm-project-package-dialog") {
      void confirmProjectPackageDialog();
      return;
    }

    if (action === "toggle-file-menu") {
      toggleFileMenu();
      return;
    }

    if (action === "toggle-project-settings-menu") {
      toggleProjectSettingsMenu();
      return;
    }

    if (action === "toggle-developer-options-menu") {
      toggleDeveloperOptionsMenu();
      return;
    }

    if (action === "open-proof-read-settings") {
      hideProjectSettingsMenu();
      openDraftProofSettingsWindow();
      return;
    }

    if (action === "open-local-ai-panel") {
      hideProjectSettingsMenu();
      void openLocalAiPanel();
      return;
    }

    if (action === "open-keyboard-shortcut-settings") {
      hideProjectSettingsMenu();
      openKeyboardShortcutSettingsWindow();
      return;
    }

    if (action === "toggle-spotify-music-panel") {
      toggleSpotifyMusicPanel();
      return;
    }

    if (action === "close-spotify-music-panel") {
      closeSpotifyMusicPanel();
      return;
    }

    if (action === "set-appearance-mode") {
      setAppearanceModePreference(target.dataset.appearanceMode);
      return;
    }

    if (action === "close-proof-read-settings-window") {
      closeDraftProofSettingsWindow();
      return;
    }

    if (action === "close-local-ai-panel") {
      closeLocalAiPanel();
      return;
    }

    if (action === "close-keyboard-shortcut-settings-window") {
      closeKeyboardShortcutSettingsWindow();
      return;
    }

    if (action === "start-keyboard-shortcut-capture") {
      startKeyboardShortcutCapture(target.dataset.keyboardShortcutBehaviorId);
      return;
    }

    if (action === "clear-keyboard-shortcut-binding") {
      clearKeyboardShortcutBinding(target.dataset.keyboardShortcutBehaviorId);
      return;
    }

    if (action === "reset-keyboard-shortcut-binding") {
      resetKeyboardShortcutPreference(target.dataset.keyboardShortcutBehaviorId);
      return;
    }

    if (action === "reset-all-keyboard-shortcuts") {
      resetAllKeyboardShortcutPreferences();
      return;
    }

    if (action === "load-project") {
      if (target.dataset.projectId) {
        state.projectLibrarySelectionId = target.dataset.projectId;
      }
      hideFileMenu();
      loadSelectedProject(target.dataset.projectId);
      return;
    }

    if (action === "save-project") {
      hideFileMenu();
      void saveCurrentProject();
      return;
    }

    if (action === "save-project-file-as") {
      hideFileMenu();
      void saveCurrentProjectFileAs();
      return;
    }

    if (action === "load-project-file") {
      hideFileMenu();
      void loadProjectLibraryFromFile();
      return;
    }

    if (action === "import-scrivener-project") {
      hideFileMenu();
      void portScrivenerProject();
      return;
    }

    if (action === "create-project") {
      hideFileMenu();
      createProject();
      return;
    }

    if (action === "open-developer-logs") {
      hideFileMenu();
      openDeveloperLogsWindow();
      return;
    }

    if (action === "load-project-source") {
      hideFileMenu();
      loadProjectSource();
      return;
    }

    if (action === "toggle-writing-target-window") {
      hideFileMenu();
      closeRevisionWindow();
      closeLocalAiPanel();
      closeKeyboardShortcutSettingsWindow();
      closeSpotifyMusicPanel();
      toggleWritingTargetWindow();
      return;
    }

    if (action === "toggle-revision-window") {
      hideFileMenu();
      closeLocalAiPanel();
      closeSpotifyMusicPanel();
      toggleRevisionWindow();
      return;
    }

    if (action === "close-revision-window") {
      closeRevisionWindow();
      return;
    }

    if (action === "toggle-revision-overlay") {
      toggleRevisionOverlay(target.dataset.sceneId);
      return;
    }

    if (action === "bank-revision") {
      bankCurrentRevisionFromPanel();
      return;
    }

    if (action === "select-revision-session") {
      selectRevisionSession(target.dataset.revisionSessionId);
      return;
    }

    if (action === "revision-open-first-scene") {
      openFirstRevisionScene(target.dataset.revisionSessionId);
      return;
    }

    if (action === "revision-open-entity") {
      navigateRevisionEntity(target.dataset.revisionEntityType, target.dataset.revisionEntityId);
      return;
    }

    if (action === "revision-toggle-diff-detail") {
      toggleRevisionDiffDetail();
      return;
    }

    if (action === "revision-export-summary") {
      exportRevisionSummary(target.dataset.revisionSessionId);
      return;
    }

    if (action === "toggle-inline-format") {
      toggleManuscriptInlineFormat(target.dataset.inlineFormat);
      return;
    }

    if (action === "toggle-decoration-eraser") {
      toggleDecorationEraser();
      return;
    }

    if (action === "toggle-draft-proof-run") {
      toggleDraftProofRun();
      return;
    }

    if (action === "start-draft-proof-run") {
      startDraftProofRun();
      return;
    }

    if (action === "toggle-draft-proof-markers") {
      toggleDraftProofMarkerVisibility();
      return;
    }

    if (action === "toggle-ManuScriptInfographicLane") {
      toggleManuScriptInfographicLaneVisibility();
      return;
    }

    if (action === "complete-draft-proof-run") {
      finishDraftProofRun();
      return;
    }

    if (action === "reset-draft-proof-backdrop-color") {
      updateDraftProofBackdropColor(DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
      return;
    }

    if (action === "set-draft-proof-backdrop-preset") {
      setDraftProofBackdropPreset(target.dataset.draftProofPresetIndex);
      return;
    }

    if (action === "set-draft-proof-backdrop-recent") {
      setDraftProofRecentBackdropColor(target.dataset.draftProofRecentIndex);
      return;
    }

    if (action === "request-clear-draft-proof-data") {
      requestClearDraftProofData();
      return;
    }

    if (action === "clear-draft-proof-data") {
      clearAllDraftProofData();
      return;
    }

    if (action === "delete-selected-draft-proof-runs") {
      deleteSelectedDraftProofRuns(target);
      return;
    }

    if (action === "cancel-clear-draft-proof-data") {
      cancelClearDraftProofData();
      return;
    }

    if (action === "refresh-local-ai-models") {
      void refreshLocalAiModelLibrary();
      return;
    }

    if (action === "save-local-ai-model-settings") {
      void saveLocalAiModelSettings();
      return;
    }

    if (action === "ensure-local-ai-model-folders") {
      void ensureLocalAiModelFolders();
      return;
    }

    if (action === "spotify-save-client-id") {
      saveSpotifyClientId();
      return;
    }

    if (action === "spotify-connect") {
      void connectSpotifyMusicAccount();
      return;
    }

    if (action === "spotify-disconnect") {
      disconnectSpotifyMusicAccount();
      return;
    }

    if (action === "spotify-toggle-account-menu") {
      toggleSpotifyMusicAccountMenu();
      return;
    }

    if (action === "spotify-set-source") {
      setSpotifyMusicSource(target.dataset.spotifySource);
      return;
    }

    if (action === "spotify-load-playlists") {
      void loadSpotifyMusicPlaylists();
      return;
    }

    if (action === "spotify-load-playlist-tracks") {
      void loadSpotifyMusicPlaylistTracks(target.dataset.spotifyPlaylistId);
      return;
    }

    if (action === "spotify-play-playlist") {
      void playSpotifyMusicPlaylist(target.dataset.spotifyPlaylistUri || target.dataset.spotifyPlaylistId);
      return;
    }

    if (action === "spotify-search") {
      void searchSpotifyMusicTracks();
      return;
    }

    if (action === "spotify-analyze-tempo") {
      void analyzeSpotifyVisibleTrackTempo();
      return;
    }

    if (action === "spotify-start-player") {
      void startSpotifyInAppPlayer();
      return;
    }

    if (action === "spotify-toggle-playback") {
      void toggleSpotifyMusicPlayback();
      return;
    }

    if (action === "spotify-previous-track") {
      void skipSpotifyMusicPlayback("previous");
      return;
    }

    if (action === "spotify-next-track") {
      void skipSpotifyMusicPlayback("next");
      return;
    }

    if (action === "spotify-play-track") {
      void playSpotifyMusicTrack(target.dataset.spotifyTrackUri);
      return;
    }

    if (action === "spotify-queue-track") {
      void queueSpotifyMusicTrack(target.dataset.spotifyTrackUri);
      return;
    }

    if (action === "set-highlight-color") {
      if (target.dataset.highlightCustomRgbIndex !== undefined) {
        setHighlightRecentCustomColorPreference(target.dataset.highlightCustomRgbIndex);
        return;
      }

      setHighlightColorPreference(target.dataset.highlightColorId);
      return;
    }

    if (action === "toggle-grammar-check-panel") {
      toggleGrammarCheckPanel();
      return;
    }

    if (action === "open-manuscript-find") {
      openManuscriptFind();
      return;
    }

    if (action === "close-manuscript-find") {
      closeManuscriptFind();
      return;
    }

    if (action === "find-prev") {
      moveManuscriptFindMatch(-1);
      return;
    }

    if (action === "find-next") {
      moveManuscriptFindMatch(1);
      return;
    }

    if (action === "replace-find-current") {
      replaceManuscriptFindCurrent();
      return;
    }

    if (action === "replace-find-all") {
      replaceManuscriptFindAll();
      return;
    }

    if (action === "find-match") {
      navigateManuscriptFindMatch(Number(target.dataset.findMatchIndex));
      return;
    }

    if (action === "save-writing-target-goals") {
      saveWritingTargetGoals();
      return;
    }

    if (action === "close-writing-target-window") {
      closeWritingTargetWindow();
      return;
    }

    if (action === "cancel-writing-target-goals") {
      cancelWritingTargetGoals();
      return;
    }

    if (action === "reset-writing-target-goals") {
      resetWritingTargetGoals();
      return;
    }

    if (action === "reset-writing-session") {
      resetWritingSession();
      return;
    }

    if (action === "writing-target-set-view-mode") {
      setWritingTargetViewMode(target.dataset.viewMode);
      return;
    }

    if (action === "writing-target-calendar-prev-month") {
      shiftWritingTargetCalendarMonth(-1);
      return;
    }

    if (action === "writing-target-calendar-next-month") {
      shiftWritingTargetCalendarMonth(1);
      return;
    }

    if (action === "writing-target-calendar-today") {
      jumpWritingTargetCalendarToToday();
      return;
    }

    if (action === "select-writing-target-day") {
      selectWritingTargetDay(target.dataset.dateKey);
      return;
    }

    if (action === "writing-target-daily-note") {
      return;
    }

    if (action === "toggle-console-collapse") {
      hideFileMenu();
      toggleConsoleCollapse();
      return;
    }

    if (action === "toggle-side-panels-hidden") {
      hideFileMenu();
      toggleSidePanelsHidden();
      return;
    }

    if (action === "toggle-console-chapter-collapse") {
      hideFileMenu();
      toggleConsoleChapterCollapse(target.dataset.consolePanel, target.dataset.chapterKey);
      return;
    }

    if (action === "close-side-panel-customization") {
      closeSidePanelCustomization();
      return;
    }

    if (action === "reset-side-panel-customization") {
      resetSidePanelCustomization();
      return;
    }

    if (action === "close-top-panel-customization") {
      closeTopPanelCustomization();
      return;
    }

    if (action === "reset-top-panel-customization") {
      resetTopPanelCustomization(target.dataset.topPanelCustomizationGroup);
      return;
    }

    if (action === "hide-all-top-panel-customization") {
      hideTopPanelCustomizationGroup(target.dataset.topPanelCustomizationGroup);
      return;
    }

    if (action === "hide-top-panel-card") {
      hideTopPanelCard(target.dataset.topPanelCardId);
      return;
    }

    if (action === "open-custom-metadata-form") {
      openCustomMetadataForm();
      return;
    }

    if (action === "close-custom-metadata-form") {
      closeCustomMetadataForm();
      return;
    }

    if (action === "save-custom-metadata-definition") {
      saveCustomMetadataDefinitionFromForm();
      return;
    }

    if (action === "cancel-binder-context-menu") {
      hideBinderContextMenu();
      return;
    }

    if (action === "open-scene-world-spine-metadata") {
      openSceneWorldSpineMetadataMenu(target.dataset.sceneId);
      return;
    }

    if (action === "close-scene-world-spine-metadata") {
      closeSceneWorldSpineMetadataMenu();
      return;
    }

    if (action === "save-scene-world-spine-metadata") {
      saveSceneWorldSpineMetadataFromMenu(target.dataset.sceneId);
      return;
    }

    if (action === "open-worldbuilding-catalogue") {
      openWorldbuildingCatalogue(target.dataset.worldbuildingCategoryId, resolveWorldbuildingCatalogueOpenPosition(target, event));
      return;
    }

    if (action === "open-worldbuilding-custom-catalogue-item") {
      selectWorldbuildingStudioCategory("custom");
      return;
    }

    if (action === "add-worldbuilding-catalogue-item") {
      selectWorldbuildingStudioCategory(target.dataset.worldbuildingCategoryId ?? state.worldbuildingCatalogueCategoryId);
      return;
    }

    if (action === "close-worldbuilding-catalogue") {
      closeWorldbuildingCatalogue();
      return;
    }

    if (action === "select-worldbuilding-catalogue-item") {
      selectWorldbuildingCatalogueItem(
        target.dataset.worldbuildingCatalogueItemId,
        target.dataset.worldbuildingCatalogueItemKind,
      );
      return;
    }

    if (action === "edit-worldbuilding-catalogue-item") {
      editWorldbuildingCatalogueItem(target);
      return;
    }

    if (action === "delete-worldbuilding-catalogue-item") {
      deleteWorldbuildingCatalogueItem(target);
      return;
    }

    if (action === "save-worldbuilding-category-properties") {
      saveWorldbuildingCategoryProperties(target);
      return;
    }

    if (action === "cancel-worldbuilding-item") {
      closeWorldbuildingStudioForm();
      return;
    }

    if (action === "add-worldbuilding-custom-field") {
      addWorldbuildingCustomField(target);
      return;
    }

    if (action === "save-worldbuilding-item") {
      saveWorldbuildingStudioItem();
      return;
    }

    if (action === "world-spine-insert-event-here") {
      openWorldSpineEventInsertionFromContextMenu(target);
      return;
    }

    if (action === "world-spine-edit-location-row") {
      openWorldSpineLocationRowFormFromLabel(target, event);
      return;
    }

    if (action === "world-spine-add-parallel-timeline" || action === "world-spine-add-dual-timeline") {
      openParallelTimelineFormFromWorldSpineContextMenu();
      return;
    }

    if (action === "save-world-spine-parallel-timeline") {
      saveParallelTimelineFromWorldSpineForm();
      return;
    }

    if (action === "save-world-spine-location-row") {
      saveWorldSpineLocationRowFromForm();
      return;
    }

    if (action === "delete-world-spine-location-row") {
      deleteWorldSpineLocationRowFromForm();
      return;
    }

    if (action === "toggle-world-spine-unplaced-dock") {
      toggleWorldSpineUnplacedDock();
      return;
    }

    if (action === "attach-world-spine-location-row-image") {
      attachWorldSpineLocationRowImage(target);
      return;
    }

    if (action === "close-world-spine-context-menu") {
      hideWorldSpineContextMenu();
      return;
    }

    if (action === "toggle-world-spine-location-filter-pane") {
      toggleWorldSpineLocationFilterPane();
      return;
    }

    if (action === "clear-world-spine-location-filter") {
      clearWorldSpineLocationFilter();
      return;
    }

    if (action === "world-spine-select-catalogue-assignment-category") {
      selectWorldSpineCatalogueAssignmentCategoryFromContextMenu(target);
      return;
    }

    if (action === "world-spine-assign-catalogue-item") {
      assignWorldSpineCatalogueItemFromContextMenu(target);
      return;
    }

    if (action === "set-world-spine-right-pane-mode") {
      setWorldSpineRightPaneMode(target.dataset.worldSpineRightPaneMode);
      return;
    }

    if (action === "toggle-world-spine-related-card") {
      toggleWorldSpineRelatedCard(target);
      return;
    }

    if (action === "open-world-spine-sublocation-composer") {
      openWorldSpineSublocationComposer(target);
      return;
    }

    if (action === "cancel-world-spine-sublocation-composer") {
      closeWorldSpineSublocationComposer();
      return;
    }

    if (action === "save-world-spine-sublocation") {
      saveWorldSpineSublocationFromComposer();
      return;
    }

    if (action === "attach-worldbuilding-catalogue-image") {
      attachWorldbuildingCatalogueImage(target);
      return;
    }

    if (action === "open-ManuScriptInfographicLane-marker") {
      openManuScriptInfographicLaneMarker(target);
      return;
    }

    if (action === "apply-spellcheck-suggestion") {
      applySpellcheckSuggestionFromMenu(target);
      return;
    }

    if (action === "add-grammar-check-dictionary") {
      addGrammarCheckWordsToProjectList("dictionaryWords");
      return;
    }

    if (action === "add-grammar-check-exceptions") {
      addGrammarCheckWordsToProjectList("exceptionWords");
      return;
    }

    if (action === "dismiss-spellcheck-menu") {
      hideSpellcheckContextMenu();
      return;
    }

    if (action === "lookup-dictionary-word") {
      openDictionaryLookupFromMenuTarget(target);
      return;
    }

    if (action === "close-dictionary-window") {
      closeDictionaryWindow();
      return;
    }

    if (action === "toggle-grammar-check-word") {
      const grammarCheckTarget = target.closest("[data-grammar-check-word]");
      if (!(grammarCheckTarget instanceof HTMLElement)) {
        return;
      }

      toggleGrammarCheckPanelWordSelection(
        grammarCheckTarget.dataset.grammarCheckWord,
        Number(grammarCheckTarget.dataset.grammarCheckIndex),
        event.shiftKey === true,
      );
      return;
    }

    if (action === "focus-grammar-check-word") {
      const grammarCheckTarget = target.closest("[data-grammar-check-word]");
      if (!(grammarCheckTarget instanceof HTMLElement)) {
        return;
      }

      const firstIndex = Number(grammarCheckTarget.dataset.grammarCheckFirstIndex);
      const word = String(grammarCheckTarget.dataset.grammarCheckWord ?? "").trim();
      if (!word || !Number.isInteger(firstIndex)) {
        return;
      }

      focusGrammarCheckEntry({
        firstIndex,
        word,
      });
      return;
    }

    if (action === "grammar-check-select-all") {
      selectAllGrammarCheckPanelWords();
      return;
    }

    if (action === "grammar-check-clear-selection") {
      clearGrammarCheckPanelSelection();
      return;
    }

    if (action === "grammar-check-add-selected") {
      addSelectedGrammarCheckWordsToProjectDictionary();
      return;
    }

    if (action === "grammar-check-add-word") {
      addGrammarCheckPanelWordToProjectDictionary(target);
      return;
    }

    if (action === "close-grammar-check-panel") {
      closeGrammarCheckPanel();
      return;
    }

    if (action === "add-selection-task") {
      openTaskComposerFromContextMenu(event);
      return;
    }

    if (action === "add-passage-note") {
      openPassageNoteComposerFromContextMenu(target.dataset.noteType);
      return;
    }

    if (action === "add-world-spine-event") {
      openWorldSpineEventComposerFromContextMenu(event);
      return;
    }

    if (action === "save-selection-task") {
      saveTaskFromComposer();
      return;
    }

    if (action === "save-world-spine-event") {
      saveWorldSpineEventFromComposer();
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

    if (action === "trim-scene-whitespace") {
      trimSceneWhitespace(target.dataset.sceneId);
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

    if (action === "start-narration-recording") {
      hideFileMenu();
      void startNarrationRecording(target.dataset.sceneId);
      return;
    }

    if (action === "stop-narration-recording") {
      hideFileMenu();
      void stopNarrationRecording();
      return;
    }

    if (action === "clear-narration-selection") {
      hideFileMenu();
      clearNarrationTakeSelection();
      return;
    }

    if (action === "toggle-narration-follow-scroll") {
      hideFileMenu();
      toggleNarrationFollowScrollPreference();
      return;
    }

    if (action === "toggle-narration-manuscript-decorations") {
      hideFileMenu();
      toggleNarrationManuscriptDecorationPreference();
      return;
    }

    if (action === "toggle-narration-decorations") {
      hideFileMenu();
      toggleNarrationDecorationPreference();
      return;
    }

    if (action === "select-pane") {
      hideFileMenu();
      selectWorkspacePane(target.dataset.paneId);
      return;
    }

    if (action === "select-side-panel") {
      hideFileMenu();
      selectSidePanel(target.dataset.sidePanel);
      return;
    }

    if (action === "select-passage-note") {
      hideFileMenu();
      togglePassageNoteSelection(target.dataset.noteId);
      return;
    }

    if (action === "edit-passage-note") {
      hideFileMenu();
      openPassageNoteEditorFromPanel(target.dataset.noteId);
      return;
    }

    if (action === "delete-passage-note") {
      hideFileMenu();
      requestDeletePassageNoteFromPanel(target.dataset.noteId);
      return;
    }

    if (action === "add-metadata-folder" || action === "add-metadata-subgroup") {
      hideFileMenu();
      addMetadataSubgroupForPanel(target.dataset.metadataGroupId);
      return;
    }

    if (action === "add-metadata-child-folder") {
      hideFileMenu();
      addMetadataSubgroupForPanel(target.dataset.metadataGroupId, target.dataset.metadataParentSubgroupId);
      return;
    }

    if (action === "delete-metadata-folder" || action === "delete-metadata-subgroup") {
      hideFileMenu();
      removeMetadataSubgroup(target.dataset.metadataSubgroupId);
      return;
    }

    if (action === "add-metadata-folder-note" || action === "add-metadata-subgroup-note") {
      hideFileMenu();
      addMetadataSubgroupNote(target.dataset.metadataSubgroupId);
      return;
    }

    if (action === "delete-metadata-folder-note" || action === "delete-metadata-subgroup-note") {
      hideFileMenu();
      removeMetadataSubgroupNote(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId);
      return;
    }

    if (action === "point-metadata-subgroup-note-to-selection") {
      hideFileMenu();
      pointMetadataSubgroupNoteToCurrentSelection(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId);
      return;
    }

    if (action === "clear-metadata-subgroup-note-anchor") {
      hideFileMenu();
      clearMetadataSubgroupNoteAnchor(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId);
      return;
    }

    if (action === "open-metadata-subgroup-note-anchor") {
      hideFileMenu();
      openMetadataSubgroupNoteAnchor(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId);
      return;
    }

    if (action === "toggle-delete-confirmation-preference") {
      toggleDeleteConfirmationPreference(target.dataset.confirmationKey, target instanceof HTMLInputElement ? target.checked : false);
      renderDeleteConfirmationDialog();
      return;
    }

    if (action === "confirm-delete-confirmation") {
      confirmDeleteConfirmationDialog();
      return;
    }

    if (action === "cancel-delete-confirmation") {
      cancelDeleteConfirmationDialog();
      return;
    }

    if (action === "toggle-task-preview") {
      hideFileMenu();
      toggleTaskPreview(target.dataset.taskPreviewTaskId);
      return;
    }

    if (action === "toggle-chapter-collapse") {
      hideFileMenu();
      toggleChapterCollapse(target.dataset.chapterId);
      return;
    }

    if (action === "delete-scene") {
      deleteSceneFromBinder(target.dataset.sceneId);
      return;
    }

    if (action === "delete-chapter") {
      deleteChapterFromBinder(target.dataset.chapterId);
      return;
    }

    if (action === "select-chapter") {
      hideFileMenu();
      const chapterTitleTarget = clickTarget?.closest("[data-chapter-title-id]");
      if (chapterTitleTarget instanceof Element) {
        const chapterId = chapterTitleTarget.dataset.chapterTitleId;
        if (chapterId && consumeBinderTitleClick("chapter", chapterId)) {
          event.preventDefault();
          beginChapterTitleEdit(chapterId);
          return;
        }
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-edit-field='chapter-title']")
      ) {
        return;
      }

      selectChapterById(target.dataset.chapterId);
      return;
    }

    if (action === "select-scene") {
      hideFileMenu();
      const binderSceneTitleTarget = clickTarget?.closest("[data-binder-scene-title-id]");
      if (binderSceneTitleTarget instanceof Element) {
        const sceneId = binderSceneTitleTarget.dataset.binderSceneTitleId;
        if (sceneId && consumeBinderTitleClick("scene", sceneId)) {
          event.preventDefault();
          beginSceneTitleEdit(sceneId);
          return;
        }
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-edit-field='scene-title']")
      ) {
        return;
      }

      selectSceneById(target.dataset.sceneId);
      return;
    }

    if (action === "select-next-scene") {
      hideFileMenu();
      selectNextSceneFromSceneEditor(target.dataset.sceneId, target.dataset.nextSceneId);
      return;
    }

    if (action === "select-line") {
      hideFileMenu();
      state.selectedIssueId = null;
      syncSelectionFromBlock(target.dataset.lineId);
      render();
      return;
    }

    if (action === "preview-voice-recording") {
      hideFileMenu();
      void previewVoiceRecording(target.dataset.recordingId);
      return;
    }

    if (action === "re-record-voice-recording") {
      hideFileMenu();
      openVoiceRecordingReviewForRecordingId(target.dataset.recordingId);
      return;
    }

    if (action === "re-record-voice-recording-selection") {
      hideFileMenu();
      void rerecordVoiceRecordingSelection(target.dataset.recordingId);
      return;
    }

    if (action === "stop-voice-recording-preview") {
      hideFileMenu();
      stopVoiceRecordingPreview(target.dataset.recordingId);
      return;
    }

    if (action === "seek-narration-recording-waveform") {
      hideFileMenu();
      if (narrationRecordingWaveformSuppressClick) {
        narrationRecordingWaveformSuppressClick = false;
        return;
      }
      void seekNarrationRecordingReviewWaveform(target, event);
      return;
    }

    if (action === "seek-narration-recording-word") {
      hideFileMenu();
      if (event.shiftKey) {
        selectNarrationRecordingReviewWordRange(target);
        return;
      }
      logNarrationRecordingReviewWordClick(target, event);
      void seekNarrationRecordingReviewWord(target.dataset.recordingId, target.dataset.reviewWordTime);
      return;
    }

    if (action === "go-to-voice-recording-verse") {
      hideFileMenu();
      goToVoiceRecordingVerse(target.dataset.recordingId);
      return;
    }

    if (action === "close-narration-recording-review") {
      hideFileMenu();
      closeNarrationRecordingReview(target.dataset.recordingId);
      return;
    }

    if (action === "delete-voice-recording") {
      hideFileMenu();
      void deleteVoiceRecording(target.dataset.recordingId);
      return;
    }

    if (action === "select-issue") {
      hideFileMenu();
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
      hideFileMenu();
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
      hideFileMenu();
      selectWorldSpineNode(target.dataset.nodeId);
      return;
    }

    if (action === "world-spine-open-passage") {
      hideFileMenu();
      openWorldSpinePassage(target.dataset.nodeId, target.dataset.blockId);
      return;
    }

    if (action === "world-spine-edit-scene-metadata") {
      hideFileMenu();
      openWorldSpineSceneMetadataEditor(target.dataset.sceneId, event);
      return;
    }

    if (action === "world-spine-save-implication") {
      hideFileMenu();
      saveWorldSpineImplicationComposer();
      return;
    }

    if (action === "world-spine-edit-implication") {
      hideFileMenu();
      openWorldSpineImplicationEditorFromContextMenu(target);
      return;
    }

    if (action === "world-spine-delete-implication") {
      hideFileMenu();
      hideWorldSpineContextMenu({ renderAfter: false });
      deleteWorldSpineImplication(target.dataset.worldSpineEdgeId);
      return;
    }

    if (action === "world-spine-cancel-implication") {
      hideFileMenu();
      cancelWorldSpineImplicationComposer();
      return;
    }

    if (action === "world-spine-undo") {
      hideFileMenu();
      undoWorldSpineInteraction();
      return;
    }

    if (action === "world-spine-redo") {
      hideFileMenu();
      redoWorldSpineInteraction();
      return;
    }

    if (action === "select-entity") {
      hideFileMenu();
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
        setWorldSpineSelectedNodeId(entity.introductionNodeId);
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

    if (action === "load-project") {
      if (target.dataset.projectId) {
        state.projectLibrarySelectionId = target.dataset.projectId;
      }
      loadSelectedProject(target.dataset.projectId);
      return;
    }

    if (action === "save-project") {
      void saveCurrentProject();
      return;
    }

    if (action === "save-project-file-as") {
      void saveCurrentProjectFileAs();
      return;
    }

    if (action === "load-project-file") {
      void loadProjectLibraryFromFile();
      return;
    }

    if (action === "import-scrivener-project") {
      void portScrivenerProject();
      return;
    }

    if (action === "create-project") {
      createProject();
      return;
    }

    if (action === "load-project-source") {
      loadProjectSource();
      return;
    }

    if (action === "reset-scene-draft") {
      resetSceneDraft(target.dataset.sceneId);
      state.selectedIssueId = null;
      render();
    }
  });

  document.addEventListener("keydown", handleKeyboardShortcutCapture, true);
  document.addEventListener("keydown", handleWorldSpineAssignmentFilterKeyDown, true);
  document.addEventListener("keydown", (event) => worldSpineController.handleKeyDown(event), true);
  document.addEventListener("keydown", handleGlobalKeyboardShortcut, true);

  document.addEventListener("contextmenu", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    const topPanelCustomizationContext = getTopPanelCustomizationContextFromContextMenu(clickTarget);
    if (topPanelCustomizationContext) {
      event.preventDefault();
      openTopPanelCustomization(topPanelCustomizationContext.groupId, { x: event.clientX, y: event.clientY });
      return;
    }

    if (shouldOpenSidePanelCustomizationFromContextMenu(clickTarget)) {
      event.preventDefault();
      openSidePanelCustomization({ x: event.clientX, y: event.clientY });
      return;
    }

    const worldbuildingCategoryContext = getWorldbuildingCategoryContextFromTarget(clickTarget);
    if (worldbuildingCategoryContext) {
      event.preventDefault();
      selectWorldbuildingStudioCategory(worldbuildingCategoryContext.categoryId);
      return;
    }

    if (worldSpineController.handleContextMenu(event) === true) {
      return;
    }

    const grammarCheckPanelTarget = clickTarget?.closest("[data-grammar-check-panel]");
    if (grammarCheckPanelTarget instanceof HTMLElement) {
      const grammarCheckSuggestionTarget = clickTarget?.closest("[data-grammar-check-suggestion]");
      if (grammarCheckSuggestionTarget instanceof HTMLElement) {
        positionGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
      }
      event.preventDefault();
      hideSpellcheckContextMenu();
      return;
    }

    const highlightButtonTarget = getHighlightColorButtonTarget(clickTarget);
    if (highlightButtonTarget instanceof HTMLElement) {
      event.preventDefault();
      toggleHighlightColorPalette(highlightButtonTarget);
      return;
    }

    const binderSceneTarget = clickTarget?.closest("[data-binder-scene-id]");
    if (binderSceneTarget instanceof HTMLElement) {
      const sceneId = binderSceneTarget.dataset.binderSceneId;
      const scene = getScene(sceneId);
      if (scene) {
        event.preventDefault();
        openBinderContextMenu(
          "scene",
          {
            sceneId: scene.sceneId,
            sceneTitle: scene.sceneTitle,
            chapterId: scene.chapterId,
            chapterTitle: scene.chapterTitle,
          },
          event,
        );
      }
      return;
    }

    const binderChapterTarget = clickTarget?.closest("[data-chapter-id]");
    if (binderChapterTarget instanceof HTMLElement && binderChapterTarget.closest(".binder-chapter-button")) {
      const chapterId = binderChapterTarget.dataset.chapterId;
      const chapter = groupScenesByChapter(state.scenes).find((candidate) => candidate.chapterId === chapterId) ?? null;
      if (chapterId && chapter) {
        event.preventDefault();
        openBinderContextMenu(
          "chapter",
          {
            chapterId,
            chapterTitle: chapter.chapterTitle,
            sceneId: chapter.scenes[0]?.sceneId ?? "",
            sceneTitle: chapter.scenes[0]?.sceneTitle ?? "",
          },
          event,
        );
      }
      return;
    }

    const editorContext = getEditorContextFromEvent(event);
    if (!editorContext) {
      hideTaskSurfaces();
      return;
    }

    const spellcheckContext = getSpellcheckContextFromEvent(editorContext, event);
    if (spellcheckContext) {
      event.preventDefault();
      openSpellcheckContextMenu(spellcheckContext, "contextmenu");
      return;
    }

    const { textarea, contextRange, inlinePosition } = editorContext;
    const sceneId = textarea.dataset.sceneId;
    const dictionaryContext = getDictionaryContextFromEvent(editorContext, event);

    if (!sceneId || !contextRange) {
      hideTaskSurfaces();
      return;
    }

    event.preventDefault();
    state.taskComposer = null;
    state.binderContextMenu = null;
    state.spellcheckContextMenu = null;
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
      dictionaryContext,
      x: event.clientX,
      y: event.clientY,
    };
    renderTaskContextMenu();
  });

  document.addEventListener("pointerover", (event) => {
    worldSpineController.handlePointerOver(event);
    const eventTarget = event.target instanceof Element ? event.target : null;
    const highlightButtonTarget = getHighlightColorButtonTarget(eventTarget);
    if (highlightButtonTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!related || !highlightButtonTarget.contains(related)) {
        scheduleHighlightColorPaletteHoverOpen(highlightButtonTarget);
      }
    }

    const grammarCheckSuggestionTarget = eventTarget?.closest("[data-grammar-check-suggestion]");
    if (grammarCheckSuggestionTarget instanceof HTMLElement) {
      positionGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
    }

    const narrationRecordingTarget = eventTarget?.closest("[data-narration-recording-preview-id]");
    if (narrationRecordingTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!related || !narrationRecordingTarget.contains(related)) {
        previewNarrationRecordingAnchor(narrationRecordingTarget.dataset.narrationRecordingPreviewId);
      }
    }

    const target = eventTarget?.closest("[data-task-preview-trigger]") ?? null;
    if (!target) {
      return;
    }

    previewTaskAnchor(target.dataset.taskPreviewTaskId);
  });

  document.addEventListener("pointerout", (event) => {
    worldSpineController.handlePointerOut(event);
    const eventTarget = event.target instanceof Element ? event.target : null;
    const highlightButtonTarget = getHighlightColorButtonTarget(eventTarget);
    if (highlightButtonTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!related || !highlightButtonTarget.contains(related)) {
        clearHighlightColorHoverTimer();
      }
    }

    const grammarCheckSuggestionTarget = eventTarget?.closest("[data-grammar-check-suggestion]");
    if (grammarCheckSuggestionTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (
        !related ||
        (!grammarCheckSuggestionTarget.contains(related) &&
          !related.closest("[data-grammar-check-floating-suggestion-menu]"))
      ) {
        deactivateGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
      }
    }

    const narrationRecordingTarget = eventTarget?.closest("[data-narration-recording-preview-id]");
    if (narrationRecordingTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!related || !narrationRecordingTarget.contains(related)) {
        clearNarrationRecordingAnchorPreview(narrationRecordingTarget.dataset.narrationRecordingPreviewId);
      }
    }

    const target = eventTarget?.closest("[data-task-preview-id]") ?? null;
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
    worldSpineController.handleFocusIn(event);
    if (event.target instanceof HTMLTextAreaElement && event.target.classList.contains("editor-document-input")) {
      markSceneEditorAsCurrent(event.target);
    }

    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target) {
      previewTaskAnchor(target.dataset.taskPreviewId);
    }

    const grammarCheckSuggestionTarget = event.target instanceof Element
      ? event.target.closest("[data-grammar-check-suggestion]")
      : null;
    if (grammarCheckSuggestionTarget instanceof HTMLElement) {
      positionGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
    }

    const narrationRecordingTarget = event.target instanceof Element
      ? event.target.closest("[data-narration-recording-preview-id]")
      : null;
    if (narrationRecordingTarget instanceof HTMLElement) {
      previewNarrationRecordingAnchor(narrationRecordingTarget.dataset.narrationRecordingPreviewId);
    }
  });

  document.addEventListener("focusout", (event) => {
    worldSpineController.handleFocusOut(event);
    const chapterTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-edit-field='chapter-title']")
      : null;
    if (chapterTitleTarget) {
      const chapterId = chapterTitleTarget.dataset.chapterId;
      if (chapterId && state.editingChapterTitleId === chapterId) {
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && chapterTitleTarget.contains(related)) {
          return;
        }

        finishChapterTitleEdit(chapterId);
      }
      return;
    }

    const sceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-edit-field='scene-title']")
      : null;
    if (sceneTitleTarget) {
      const sceneId = sceneTitleTarget.dataset.sceneId;
      if (sceneId && state.editingSceneTitleId === sceneId) {
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && sceneTitleTarget.contains(related)) {
          return;
        }

        finishSceneTitleEdit(sceneId);
      }
      return;
    }

    const grammarCheckSuggestionTarget = event.target instanceof Element
      ? event.target.closest("[data-grammar-check-suggestion]")
      : null;
    if (grammarCheckSuggestionTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (
        !related ||
        (!grammarCheckSuggestionTarget.contains(related) &&
          !related.closest("[data-grammar-check-floating-suggestion-menu]"))
      ) {
        deactivateGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
      }
    }

    const narrationRecordingTarget = event.target instanceof Element
      ? event.target.closest("[data-narration-recording-preview-id]")
      : null;
    if (narrationRecordingTarget instanceof HTMLElement) {
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!related || !narrationRecordingTarget.contains(related)) {
        clearNarrationRecordingAnchorPreview(narrationRecordingTarget.dataset.narrationRecordingPreviewId);
      }
    }

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

    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.editField === "scene-title" &&
      event.target.dataset.binderSceneTitleId
    ) {
      return;
    }

    if (event.target instanceof HTMLInputElement && event.target.dataset.editField === "chapter-title") {
      return;
    }

    const binderSceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-binder-scene-title-id]")
      : null;
    if (binderSceneTitleTarget) {
      const sceneId = binderSceneTitleTarget.dataset.binderSceneTitleId;
      if (!sceneId) {
        return;
      }

      event.preventDefault();
      beginSceneTitleEdit(sceneId);
      return;
    }

    const chapterTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-chapter-title-id]")
      : null;
    if (chapterTitleTarget) {
      const chapterId = chapterTitleTarget.dataset.chapterTitleId;
      if (!chapterId) {
        return;
      }

      event.preventDefault();
      beginChapterTitleEdit(chapterId);
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

  // Intent: retain selected manuscript span offsets before native typing collapses the textarea selection.
  document.addEventListener("beforeinput", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.dataset.editField !== "editor-text") {
      return;
    }

    manuscriptInputController.handleEditorTextBeforeInput({
      sceneId: target.dataset.sceneId,
      editorSurface: target,
    });
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const worldbuildingForm = target.dataset.worldbuildingField !== undefined && typeof target.closest === "function"
      ? target.closest("[data-worldbuilding-studio-form]")
      : null;
    if (worldbuildingForm instanceof HTMLFormElement) {
      refreshWorldbuildingScopedPickerDatalists(worldbuildingForm, getWorldSpinePickerOptionSetsForState());
    }

    const findField = String(target.dataset.findField ?? "");
    if (findField === "manuscript-find-query" || findField === "manuscript-find-replace") {
      updateManuscriptFindField(findField, target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.revisionSearch !== undefined) {
      updateRevisionPanelSearch(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.highlightRgbChannel) {
      setHighlightCustomRgbPreference(target.dataset.highlightRgbChannel, target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.localAiModelSetting === "modelRoot") {
      state.localAiModelRootDraft = target.value;
      state.localAiModelLibraryStatus = "";
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.spotifyClientId !== undefined) {
      updateSpotifyClientIdDraft(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.spotifySearchQuery !== undefined) {
      updateSpotifySearchQuery(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.spotifyPlaybackSeek !== undefined) {
      updateSpotifyPlaybackSeekDraft(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.narrationReviewSeek !== undefined) {
      logNarrationRecordingReviewSliderSeek(target);
      seekNarrationRecordingReview(target.dataset.recordingId, target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.narrationReviewWaveformZoom !== undefined) {
      setNarrationRecordingWaveformZoom(target.dataset.recordingId, target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.projectPackageField && state.projectPackageDialog) {
      const field = target.dataset.projectPackageField;
      state.projectPackageDialog = updateProjectPackageDialogField(
        state.projectPackageDialog,
        field,
        target.value,
      );
      // Intent: typed locations invalidate the browsed directory result, so stale folders must disappear immediately.
      if (field === "locationPath") {
        clearProjectPackageDialogDirectoryList();
      }
      const confirmButton = document.querySelector('[data-action="confirm-project-package-dialog"]');
      if (confirmButton instanceof HTMLButtonElement) {
        confirmButton.disabled = !canConfirmProjectPackageDialog(state.projectPackageDialog);
      }
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
      persistCurrentProjectRecord();
      return;
    }

    if (editField === "project-source-path") {
      state.projectSourcePath = target.value;
      state.projectSourceStatus = "";
      writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, target.value);
      persistCurrentProjectRecord({ skipProjectFileAutosave: true });
      return;
    }

    if (editField === "writing-target-field") {
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        return;
      }
      updateWritingTargetField(target);
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
      anchoredRecordService.updateTaskTitle(target.dataset.taskId, target.value, {
        dirtyReason: "manuscript-task-title-edited",
        source: "task-title-input",
      });
      return;
    }

    if (editField === "passage-note-title") {
      anchoredRecordService.updatePassageNoteTitle(target.dataset.noteId, target.value, {
        dirtyReason: "passage-note-title-edited",
        source: "passage-note-title-input",
      });
      return;
    }

    if (editField === "passage-note-body") {
      anchoredRecordService.updatePassageNoteBody(target.dataset.noteId, target.value, {
        dirtyReason: "passage-note-body-edited",
        source: "passage-note-body-input",
      });
      return;
    }

    if (editField === "metadata-subgroup-title") {
      updateMetadataSubgroupTitle(target.dataset.metadataSubgroupId, target.value);
      return;
    }

    if (editField === "metadata-subgroup-note-title") {
      updateMetadataSubgroupNoteTitle(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId, target.value);
      return;
    }

    if (editField === "metadata-subgroup-note-body") {
      updateMetadataSubgroupNoteBody(target.dataset.metadataSubgroupId, target.dataset.metadataNoteId, target.value);
      return;
    }

    if (editField === "chapter-title") {
      updateChapterTitle(target.dataset.chapterId, target.value);
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
      updateSceneEditorTitle(sceneId, target.value);
      updateFocusedLineCard();
      return;
    }

    if (editField === "editor-text") {
      manuscriptInputController.handleEditorTextInput({
        sceneId,
        editorSurface: target,
      });
    }
  });

  document.addEventListener("paste", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (!["editor-text", "inline-passage-note", "inline-passage-verse", "task-description", "passage-note-body"].includes(String(target.dataset.editField ?? ""))) {
      return;
    }

    // Intent: keep read-only manuscript mirrors copyable while refusing paste-driven writes.
    if (target.readOnly === true || target.disabled === true) {
      event.preventDefault();
      return;
    }

    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string" || !pastedText.length) {
      return;
    }

    event.preventDefault();
    const normalizedText = pastedText.replace(/\r\n?/g, "\n");
    const { insertedWithNativeUndo, fallbackUsed } = insertPastedTextWithUndoFallback(target, normalizedText);
    editorInteractionLog.info("user-action", "editor.paste", "Inserted pasted text into an editor textarea.", {
      editField: String(target.dataset.editField ?? ""),
      sceneId: String(target.dataset.sceneId ?? ""),
      pastedCharacterCount: normalizedText.length,
      usedNativeUndoInsertion: insertedWithNativeUndo,
      fallbackUsed,
    });
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset.writingTargetField === "visibleMetric"
    ) {
      updateWritingTargetField(target);
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset.writingTargetField &&
      target.dataset.writingTargetField !== "visibleMetric"
    ) {
      updateWritingTargetField(target);
      renderHeader();
      renderWritingTargetWindow();
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.projectLibrarySelect !== undefined) {
      state.projectLibrarySelectionId = target.value;
      renderHeader();
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.draftProofSettingsRun !== undefined) {
      selectDraftProofSettingsRun(target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.revisionCategoryFilter !== undefined) {
      updateRevisionPanelFilter("categoryFilter", target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.revisionOriginFilter !== undefined) {
      updateRevisionPanelFilter("originFilter", target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.sidePanelFeatureToggle) {
      updateSidePanelFeatureVisibility(target.dataset.sidePanelFeatureToggle, target.checked);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.topPanelCardToggle) {
      updateTopPanelCardVisibility(target.dataset.topPanelCardToggle, target.checked);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.worldSpineLocationFilterKey !== undefined) {
      updateWorldSpineLocationFilter(target.dataset.worldSpineLocationFilterKey, target.checked);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.localAiSetting === "enabled") {
      state.localAiPrefs = normalizeLocalAiPrefs({
        ...state.localAiPrefs,
        enabled: target.checked,
      });
      writeStoredJson(EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs);
      persistCurrentProjectRecord();
      renderHeader();
      renderLocalAiPanel();
      renderManuscriptPanel();
      syncSceneDocumentLayout();
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.draftProofSetting === "backdropColor") {
      updateDraftProofBackdropColor(target.value, { rememberRecent: true });
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.draftProofSetting === "highlightIntensity") {
      updateDraftProofHighlightIntensity(target.dataset.draftProofHighlightTheme, target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.draftProofPresetIndex !== undefined) {
      updateDraftProofBackdropPreset(target.dataset.draftProofPresetIndex, target.value, {
        rememberRecent: true,
      });
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.highlightRgbChannel) {
      setHighlightCustomRgbPreference(target.dataset.highlightRgbChannel, target.value, {
        rememberRecent: true,
      });
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.editorPref) {
      state.editorPrefs = normalizeEditorPrefs({
        ...state.editorPrefs,
        [target.dataset.editorPref]: target.type === "checkbox" ? target.checked : target.value,
      });
      if (target.dataset.editorPref === "projectFileAutosaveEnabled" && target.checked !== true) {
        clearProjectFileAutosaveTimer();
      }
      if (target.dataset.editorPref === "grammarCheckEnabled" && target.checked !== true) {
        clearSceneEditorSpellcheckRefresh();
      }
      writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
      persistCurrentProjectRecord();
      if (target.dataset.editorPref === "projectFileAutosaveEnabled" && target.checked === true && state.projectFileAutosaveDirty) {
        queueProjectFileAutosave();
      }
      if (target.dataset.editorPref === "grammarCheckEnabled") {
        syncGrammarCheckPanelHeaderState();
        if (state.grammarCheckPanel?.open) {
          renderGrammarCheckPanel();
        }
      } else {
        renderHeader();
        renderManuscriptPanel();
      }
      syncSceneDocumentLayout();
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.spotifyPlaybackSeek !== undefined) {
      void seekSpotifyMusicPlayback(target.value);
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
    persistCurrentProjectRecord();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  });

  window.addEventListener("resize", () => {
    hideTaskSurfaces();
    syncSceneDocumentLayout();
    syncWorldbuildingEntryPopoverPosition();
    syncWorldbuildingCataloguePositionToViewport();
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }

    if (
      event.key === "Enter"
      && event.target instanceof HTMLInputElement
      && event.target.dataset.projectPackageField === "locationPath"
      && state.projectPackageDialog
    ) {
      event.preventDefault();
      void browseProjectPackageDialog(event.target.value);
      return;
    }

    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.editField === "chapter-title" &&
      (event.key === "Enter" || event.key === "Escape")
    ) {
      event.preventDefault();
      event.target.blur();
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

    if (state.manuscriptFind.open && event.key === "Enter" && event.target instanceof HTMLInputElement) {
      if (event.target.dataset.findField === "manuscript-find-query") {
        event.preventDefault();
        moveManuscriptFindMatch(event.shiftKey ? -1 : 1);
        return;
      }
    }

    if (state.manuscriptFind.open && event.key === "Escape") {
      event.preventDefault();
      closeManuscriptFind();
      return;
    }

    if (event.key === "Escape") {
      if (state.projectPackageDialog) {
        event.preventDefault();
        closeProjectPackageDialog();
        return;
      }
      if (state.keyboardShortcutSettingsWindowOpen) {
        closeKeyboardShortcutSettingsWindow();
        return;
      }
      if (state.draftProofSettingsWindowOpen) {
        closeDraftProofSettingsWindow();
        return;
      }
      if (state.localAiPanelOpen) {
        closeLocalAiPanel();
        return;
      }
      if (state.spotifyMusicPanelOpen) {
        closeSpotifyMusicPanel();
        return;
      }
      if (state.revisionWindowOpen) {
        closeRevisionWindow();
        return;
      }
      if (state.writingTargetWindowOpen) {
        closeWritingTargetWindow();
        return;
      }
      if (state.worldSpineContextMenu) {
        hideWorldSpineContextMenu();
        return;
      }
      if (state.worldbuildingCatalogueCategoryId) {
        closeWorldbuildingCatalogue();
        return;
      }
      if (state.worldbuildingStudioCategoryId) {
        closeWorldbuildingStudioForm();
        return;
      }
      if (state.highlightColorPaletteOpen) {
        closeHighlightColorPalette({ renderAfter: true });
        return;
      }
      hideFileMenu();
      hideProjectSettingsMenu();
      hideTaskSurfaces();
    }
  });
}

// Intent: identify commands that consume the current manuscript selection before browser focus can change.
function isManuscriptSelectionCommandTarget(target) {
  return Boolean(
    target instanceof Element &&
    target.closest('[data-action="toggle-inline-format"], [data-action="toggle-decoration-eraser"]')
  );
}

// Intent: make pending decoration buttons behave like paint tools over mouse-dragged manuscript text.
function beginPendingFormatDragSelection(textarea, event) {
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    !textarea.classList.contains("editor-document-input") ||
    event?.button !== 0
  ) {
    manuscriptPendingFormatDragSelectionSession = null;
    return;
  }

  const sceneId = String(textarea.dataset.sceneId ?? "").trim();
  const pendingFormatIds = getPendingManuscriptInlineFormatIds();
  const clearDecorations = isPendingManuscriptDecorationEraser();
  if (!sceneId) {
    manuscriptPendingFormatDragSelectionSession = null;
    return;
  }

  if (!pendingFormatIds.length && !clearDecorations) {
    manuscriptPendingFormatDragSelectionSession = null;
    return;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const selectionEnd = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
  manuscriptPendingFormatDragSelectionSession = {
    pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
    sceneId,
    formatIds: pendingFormatIds,
    clearDecorations,
    startOffset: Math.min(selectionStart, selectionEnd),
    endOffset: Math.max(selectionStart, selectionEnd),
  };
}

function consumePendingFormatDragSelection(event) {
  const session = manuscriptPendingFormatDragSelectionSession;
  if (!session) {
    return null;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (session.pointerId !== null && pointerId !== null && session.pointerId !== pointerId) {
    return null;
  }

  manuscriptPendingFormatDragSelectionSession = null;
  return session;
}

function cancelPendingFormatDragSelection(event = null) {
  if (!manuscriptPendingFormatDragSelectionSession) {
    return;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (
    manuscriptPendingFormatDragSelectionSession.pointerId !== null &&
    pointerId !== null &&
    manuscriptPendingFormatDragSelectionSession.pointerId !== pointerId
  ) {
    return;
  }

  manuscriptPendingFormatDragSelectionSession = null;
}

// Intent: make proof-read marking an explicit manuscript selection gesture rather than passive viewport tracking.
function beginDraftProofSelectionGesture(textarea, event) {
  const activeRun = getActiveDraftProofRunRecord();
  if (
    state.activePane !== "manuscript" ||
    !activeRun ||
    !(textarea instanceof HTMLTextAreaElement) ||
    !textarea.classList.contains("editor-document-input") ||
    event?.button !== 0
  ) {
    draftProofSelectionGesture = null;
    return;
  }

  const sceneId = String(textarea.dataset.sceneId ?? "").trim();
  if (!sceneId) {
    draftProofSelectionGesture = null;
    return;
  }

  draftProofSelectionGesture = {
    pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
    sceneId,
    mode: event.shiftKey === true ? "remove" : "add",
  };
  draftProofingLog.debug(
    "user-action",
    "draft-proof.selection-gesture.begin",
    "Started a proof-read selection gesture.",
    createDraftProofTextareaLogContext(textarea, {
      runId: activeRun.id,
      pointerId: draftProofSelectionGesture.pointerId,
      mode: draftProofSelectionGesture.mode,
      marksVisible: state.draftProofMarksVisible === true,
    }),
  );
}

function consumeDraftProofSelectionGesture(event) {
  const gesture = draftProofSelectionGesture;
  if (!gesture) {
    return null;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (gesture.pointerId !== null && pointerId !== null && gesture.pointerId !== pointerId) {
    draftProofingLog.debug("user-action", "draft-proof.selection-gesture.pointer-mismatch", "Ignored proof-read selection gesture for a different pointer.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      sceneId: gesture.sceneId,
      expectedPointerId: gesture.pointerId,
      actualPointerId: pointerId,
      mode: gesture.mode,
    });
    return null;
  }

  draftProofSelectionGesture = null;
  draftProofingLog.debug("user-action", "draft-proof.selection-gesture.end", "Finished a proof-read selection gesture.", {
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    sceneId: gesture.sceneId,
    pointerId,
    mode: gesture.mode,
  });
  return gesture;
}

function cancelDraftProofSelectionGesture(event = null) {
  const gesture = draftProofSelectionGesture;
  if (!gesture) {
    return;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (
    gesture.pointerId !== null &&
    pointerId !== null &&
    gesture.pointerId !== pointerId
  ) {
    return;
  }

  draftProofSelectionGesture = null;
  draftProofingLog.debug("user-action", "draft-proof.selection-gesture.cancel", "Cancelled a proof-read selection gesture.", {
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    sceneId: gesture.sceneId ?? "",
    pointerId,
    mode: gesture.mode ?? "",
  });
}

function applyPendingFormatDragSelection(session, activeTextarea = null) {
  const formatIds = Array.isArray(session?.formatIds)
    ? session.formatIds.filter((formatId) => isPendingManuscriptInlineFormat(formatId))
    : [];
  const clearDecorations = session?.clearDecorations === true && isPendingManuscriptDecorationEraser();
  if (!session || (!formatIds.length && !clearDecorations)) {
    return false;
  }

  const textarea = resolvePendingFormatDragSelectionTextarea(session, activeTextarea);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const selectionEnd = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
  const startOffset = Math.min(selectionStart, selectionEnd);
  const endOffset = Math.max(selectionStart, selectionEnd);
  if (
    endOffset <= startOffset ||
    (startOffset === session.startOffset && endOffset === session.endOffset)
  ) {
    return false;
  }

  updateSceneEditorSelectionSnapshotFromTextarea(textarea);
  const text = String(textarea.value ?? "");
  const sceneId = String(textarea.dataset.sceneId ?? "");
  const createSelection = () => ({
    sceneId,
    text,
    formatRanges: getSceneInlineFormatRanges(sceneId, text.length),
    startOffset,
    endOffset,
    collapsed: false,
    selectionSource: "drag",
  });

  if (clearDecorations) {
    const result = clearSelectedManuscriptDecorations({
      textarea,
      selectionOverride: createSelection(),
    });
    return result?.changed === true;
  }

  const shouldGroupDecorationHistory = formatIds.length > 1;
  const beforeGroupHistorySnapshot = shouldGroupDecorationHistory
    ? captureManuscriptMarkHistorySnapshotForScene(sceneId, text.length)
    : null;
  let applied = false;
  for (const formatId of formatIds) {
    const selection = createSelection();
    if (AUTHOR_MARK_DECORATION_FORMAT_IDS.has(formatId)) {
      const result = toggleAuthorMarkDecoration(formatId, {
        textarea,
        selectionOverride: selection,
        applyOnly: true,
        suppressHistory: shouldGroupDecorationHistory,
      });
      applied = result?.changed === true || applied;
      continue;
    }

    const result = executeManuscriptInlineFormatCommand(formatId, {
      textarea,
      selectionOverride: selection,
      applyOnly: true,
    });
    applied = result?.applied === true || applied;
  }
  if (shouldGroupDecorationHistory && applied) {
    state.manuscriptMarkHistory = pushManuscriptMarkHistoryEntry(
      state.manuscriptMarkHistory,
      createManuscriptMarkHistoryEntry({
        sceneId,
        formatId: createGroupedManuscriptMarkHistoryFormatId(formatIds),
        beforeSnapshot: beforeGroupHistorySnapshot,
        afterSnapshot: captureManuscriptMarkHistorySnapshotForScene(sceneId, text.length),
        selection: {
          startOffset,
          endOffset,
        },
        createdAt: new Date().toISOString(),
      }),
    );
  }
  return applied;
}

// Intent: make one paint-style decoration gesture appear as one editor undo step.
function createGroupedManuscriptMarkHistoryFormatId(formatIds = []) {
  const normalizedFormatIds = (Array.isArray(formatIds) ? formatIds : [])
    .map((formatId) => String(formatId ?? "").trim())
    .filter((formatId) => Boolean(INLINE_FORMATS[formatId]));
  return `group:${normalizedFormatIds.join("+") || "decorations"}`;
}

function applyDraftProofSelectionGesture(gesture, activeTextarea = null) {
  const activeRun = getActiveDraftProofRunRecord();
  if (!gesture || !activeRun) {
    if (gesture) {
      draftProofingLog.debug("user-action", "draft-proof.selection-gesture.skip", "Skipped proof-read selection gesture because no active run is available.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        sceneId: gesture.sceneId ?? "",
        mode: gesture.mode ?? "",
      });
    }
    return false;
  }

  const textarea = resolveDraftProofSelectionGestureTextarea(gesture, activeTextarea);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    draftProofingLog.warn("user-action", "draft-proof.selection-gesture.textarea-missing", "Could not resolve the textarea for a proof-read selection gesture.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      runId: activeRun.id,
      sceneId: gesture.sceneId ?? "",
      mode: gesture.mode ?? "",
    });
    return false;
  }

  return recordDraftProofCoverageFromTextarea(textarea, {
    mode: gesture.mode === "remove" ? "remove" : "add",
    source: gesture.mode === "remove" ? "selection-erase" : "selection-mark",
    persist: true,
  });
}

function resolveDraftProofSelectionGestureTextarea(gesture, activeTextarea = null) {
  const sceneId = String(gesture?.sceneId ?? "").trim();
  if (!sceneId) {
    return null;
  }

  if (
    activeTextarea instanceof HTMLTextAreaElement &&
    activeTextarea.classList.contains("editor-document-input") &&
    String(activeTextarea.dataset.sceneId ?? "").trim() === sceneId
  ) {
    return activeTextarea;
  }

  return document.querySelector(`.editor-document-input[data-scene-id="${CSS.escape(sceneId)}"]`);
}

function resolvePendingFormatDragSelectionTextarea(session, activeTextarea = null) {
  const sceneId = String(session?.sceneId ?? "").trim();
  if (!sceneId) {
    return null;
  }

  if (
    activeTextarea instanceof HTMLTextAreaElement &&
    activeTextarea.classList.contains("editor-document-input") &&
    String(activeTextarea.dataset.sceneId ?? "").trim() === sceneId
  ) {
    return activeTextarea;
  }

  return document.querySelector(`.editor-document-input[data-scene-id="${CSS.escape(sceneId)}"]`);
}

function getPendingManuscriptInlineFormatIds() {
  const inlineFormattingState = normalizeManuscriptInlineFormattingState(state.manuscriptInlineFormatting);
  return Object.keys(INLINE_FORMATS).filter((formatId) => inlineFormattingState.pendingFormats[formatId] === true);
}

function isPendingManuscriptDecorationEraser() {
  return isDecorationEraserPending(state.manuscriptInlineFormatting);
}

function isPendingManuscriptInlineFormat(formatId) {
  const normalizedFormatId = String(formatId ?? "").trim();
  if (!INLINE_FORMATS[normalizedFormatId]) {
    return false;
  }

  return normalizeManuscriptInlineFormattingState(
    state.manuscriptInlineFormatting,
  ).pendingFormats[normalizedFormatId] === true;
}

// Intent: keep drag-selected manuscript ranges available to toolbar commands.
function refreshSceneEditorSelectionStateFromActiveTextarea() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement) || !activeElement.classList.contains("editor-document-input")) {
    return null;
  }

  updateSceneEditorSelectionSnapshotFromTextarea(activeElement);
  syncSceneEditorWordCountReadouts(activeElement);
  updateInlineFormatToolbarState(activeElement);
  return activeElement;
}

// Intent: orchestrate slot rendering without letting individual panels own whole-app refresh order.
function render() {
  syncAppearanceMode({ reason: "render" });

  if (!state.shellReady) {
    renderShell();
    state.shellReady = true;
  }

  syncSidePanelsHiddenClass();
  syncLayoutWidths({ reason: "render" });
  renderHeader();
  renderProjectPackageDialog();
  renderBinderPanel();
  renderManuscriptPanel();
  renderConsolePanel();
  renderManuscriptFindPanel();
  renderWorldPanel();
  renderEntityPanel();
  renderDreamScapingPanel();
  renderTaskContextMenu();
  renderDeleteConfirmationDialog();
  renderWritingTargetWindow();
  renderRevisionWindow();
  renderDraftProofSettingsWindow();
  renderLocalAiPanel();
  renderKeyboardShortcutSettingsWindow();
  renderDictionaryLookupWindow();
  renderPaneVisibility();
  if (state.activePane === "manuscript" || state.activePane === "narration") {
    syncSceneDocumentLayout();
  }
  if (state.activePane === "narration") {
    syncNarrationTakeSelectionPreview();
  }
}

function renderShell() {
  appRoot.innerHTML = `
    <div id="hero-slot"></div>

    <main class="workspace-grid pane-section" data-pane-section="manuscript">
      <aside id="binder-slot" class="panel binder-panel"></aside>
      <div
        class="panel-resizer panel-resizer-left"
        data-resize-handle="binder"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize manuscript binder"
      ></div>
      <section id="manuscript-slot" class="panel manuscript-panel"></section>
      <div
        class="panel-resizer panel-resizer-right"
        data-resize-handle="console"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize issue console"
      ></div>
      <aside id="console-slot" class="panel console-panel"></aside>
    </main>

    <section class="world-grid pane-section" data-pane-section="world">
      <section id="world-slot" class="panel spine-panel"></section>
      <aside id="entity-slot" class="panel entity-panel"></aside>
    </section>

    <section class="ideation-grid pane-section" data-pane-section="world">
      <section id="dream-slot" class="panel dream-panel"></section>
    </section>

    <div id="task-menu-slot"></div>
    <div id="confirmation-slot"></div>
    <div id="find-slot"></div>
    <div id="grammar-check-slot"></div>
    <div id="writing-target-slot"></div>
    <div id="revision-window-slot"></div>
    <div id="draft-proof-settings-slot"></div>
    <div id="local-ai-panel-slot"></div>
    <div id="keyboard-shortcut-settings-slot"></div>
    <div id="dictionary-window-slot"></div>
    <div id="project-package-dialog-slot"></div>
  `;
}

function renderTaskContextMenu() {
  const slot = document.querySelector("#task-menu-slot");
  if (!slot) {
    return;
  }

  const spellcheckMenu = state.spellcheckContextMenu;
  if (spellcheckMenu) {
    slot.innerHTML = renderSpellcheckContextMenuHTML(spellcheckMenu, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    return;
  }

  const worldSpineMenu = state.worldSpineContextMenu;
  if (worldSpineMenu) {
    slot.innerHTML = renderWorldSpineWhitespaceContextMenuHTML(worldSpineMenu, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    return;
  }

  const binderMenu = state.binderContextMenu;
  if (binderMenu) {
    const menuWidth = binderMenu.kind === "scene" && binderMenu.worldSpineMetadataOpen === true ? 320 : 280;
    const menuHeight = binderMenu.kind === "scene" && binderMenu.worldSpineMetadataOpen === true ? 520 : 220;
    const left = Math.min(Math.max(8, binderMenu.x), Math.max(8, window.innerWidth - menuWidth));
    const top = Math.min(Math.max(8, binderMenu.y), Math.max(8, window.innerHeight - menuHeight));
    const title =
      binderMenu.kind === "chapter"
        ? `${String(binderMenu.chapterTitle ?? "").trim() || "Untitled chapter"}`
        : `${String(binderMenu.sceneTitle ?? "").trim() || "Untitled scene"}`;
    const detail =
      binderMenu.kind === "chapter"
        ? "Delete this chapter and every scene inside it."
        : "Delete this scene and its attached tasks and notes.";
    const scene = binderMenu.kind === "scene" ? getScene(binderMenu.sceneId) : null;
    const worldSpineMetadataHTML = binderMenu.kind === "scene"
      ? renderSceneWorldSpineMetadataMenuHTML(buildSceneWorldSpineMetadataMenuModel({
        scene,
        draft: state.sceneDrafts?.[binderMenu.sceneId] ?? null,
        expanded: binderMenu.worldSpineMetadataOpen === true,
        characterOptions: getWorldSpineCharacterPickerOptions(),
        customMetadataDefinitions: getCustomMetadataDefinitions(),
        pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
      }))
      : "";
    slot.innerHTML = `
      <div
        class="task-context-menu binder-context-menu ${binderMenu.worldSpineMetadataOpen ? "has-world-spine-form" : ""}"
        style="left:${left}px; top:${top}px;"
        role="menu"
        data-binder-menu
      >
        <p>${escapeHtml(title)}</p>
        ${worldSpineMetadataHTML}
        <button class="task-menu-item" data-action="${binderMenu.kind === "chapter" ? "delete-chapter" : "delete-scene"}" data-${binderMenu.kind}-id="${escapeHtml(binderMenu.kind === "chapter" ? binderMenu.chapterId : binderMenu.sceneId)}" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">−</span>
          <span>${escapeHtml(binderMenu.kind === "chapter" ? "Delete chapter" : "Delete scene")}</span>
        </button>
        <button class="task-menu-item" data-action="cancel-binder-context-menu" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">×</span>
          <span>Cancel</span>
        </button>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
    return;
  }

  const composer = state.taskComposer;
  if (composer) {
    const isPassageNoteComposer = composer.composerType === "passage-note";
    slot.innerHTML = renderTaskComposerHTML(composer, {
      width: window.innerWidth,
      height: window.innerHeight,
    }, {
      editorStyle: buildEditorStyle(),
      passageNotePlaceholder: isPassageNoteComposer ? getPassageNotePlaceholder(composer.noteType) : "",
    });

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

  slot.innerHTML = renderAnchoredRecordContextMenuHTML(menu, {
    width: window.innerWidth,
    height: window.innerHeight,
  }, {
    customMetadataDefinitions: getCustomMetadataDefinitions(),
  });
}

function getPassageNoteVerb(noteType) {
  return getPassageNoteDisplayLabel(noteType).toLowerCase();
}

function renderHeader() {
  const writingTargetSummary = buildWritingTargetSummary();
  const projectFileAutosaveConnected = hasProjectFileDestination();
  const projectFileDisplay = getProjectFileDisplayState();
  document.querySelector("#hero-slot").innerHTML = renderEditorChrome({
    state,
    workspace: state.workspace,
    writingTargetSummary,
    projectFileAutosaveConnected,
    projectFileDisplay,
  });
}

function renderProjectPackageDialog() {
  const slot = document.querySelector("#project-package-dialog-slot");
  if (!slot) return;
  slot.innerHTML = renderProjectPackageDialogHTML(state.projectPackageDialog);
}

function clearProjectPackageDialogDirectoryList() {
  const directoryList = document.querySelector(".project-package-dialog__browser");
  if (directoryList) directoryList.innerHTML = "<p>No child folders.</p>";
}

function closeProjectPackageDialog() {
  if (state.projectPackageDialog?.busy) return;
  state.projectPackageDialog = null;
  renderProjectPackageDialog();
}

async function browseProjectPackageDialog(path = "", { preferParentOfPackage = false } = {}) {
  if (!state.projectPackageDialog) return;
  state.projectPackageDialog = {
    ...state.projectPackageDialog,
    busy: true,
    errorMessage: "",
  };
  renderProjectPackageDialog();
  try {
    let result;
    try {
      result = await projectPersistenceService.browseDesktopProjectPackages(path);
    } catch (error) {
      if (!(preferParentOfPackage && path)) throw error;
      result = await projectPersistenceService.browseDesktopProjectPackages("");
    }
    if (preferParentOfPackage && result.isProjectPackage && result.parentPath) {
      result = await projectPersistenceService.browseDesktopProjectPackages(result.parentPath);
    }
    if (!state.projectPackageDialog) return;
    state.projectPackageDialog = applyProjectPackageBrowseResult(state.projectPackageDialog, result);
  } catch (error) {
    if (!state.projectPackageDialog) return;
    state.projectPackageDialog = {
      ...state.projectPackageDialog,
      busy: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
  renderProjectPackageDialog();
}

function openProjectPackageDialog(mode) {
  const projectTitle = mode === PROJECT_PACKAGE_DIALOG_MODES.NEW
    ? "Untitled Project"
    : state.projectTitle || state.workspace?.project?.title || "Untitled Project";
  state.projectPackageDialog = createProjectPackageDialogState({
    mode,
    projectTitle,
    sourceRoot: state.projectFilePath,
  });
  renderProjectPackageDialog();
  const initialPath = mode === PROJECT_PACKAGE_DIALOG_MODES.SAVE_AS && hasProjectFilePath(state.projectFilePath)
    ? state.projectFilePath
    : "";
  void browseProjectPackageDialog(initialPath, {
    preferParentOfPackage: mode === PROJECT_PACKAGE_DIALOG_MODES.SAVE_AS,
  });
}

// Intent: keep header menu interactions centralized until the chrome owns its own controller.
function toggleFileMenu() {
  state.fileMenuOpen = !state.fileMenuOpen;
  if (state.fileMenuOpen) {
    state.projectSettingsMenuOpen = false;
    state.developerOptionsMenuOpen = false;
  }
  renderHeader();
}

// Intent: keep project-level settings discoverable without putting destructive actions on the proof-read panel.
function toggleProjectSettingsMenu() {
  state.projectSettingsMenuOpen = !state.projectSettingsMenuOpen;
  if (state.projectSettingsMenuOpen) {
    state.fileMenuOpen = false;
    state.developerOptionsMenuOpen = false;
  }
  renderHeader();
}

// Intent: keep release-gated diagnostic setup controls grouped under the environment badge.
function toggleDeveloperOptionsMenu() {
  state.developerOptionsMenuOpen = !state.developerOptionsMenuOpen;
  if (state.developerOptionsMenuOpen) {
    state.fileMenuOpen = false;
    state.projectSettingsMenuOpen = false;
  }
  renderHeader();
}

function hideFileMenu() {
  if (!state.fileMenuOpen) {
    return;
  }

  state.fileMenuOpen = false;
  renderHeader();
}

function hideProjectSettingsMenu() {
  if (!state.projectSettingsMenuOpen) {
    return;
  }

  state.projectSettingsMenuOpen = false;
  renderHeader();
}

function hideDeveloperOptionsMenu() {
  if (!state.developerOptionsMenuOpen) {
    return;
  }

  state.developerOptionsMenuOpen = false;
  renderHeader();
}

function openDeveloperLogsWindow() {
  const targetUrl = new URL(DEVELOPER_LOG_WINDOW_PATH, window.location.href).toString();
  const logWindow = window.open(targetUrl, "abe-developer-logs");
  if (!logWindow) {
    state.projectFileStatus = "Developer logs window blocked by browser popup settings.";
    renderHeader();
    uiEventDispatcherLog.warn("user-action", "developer-logs.open-blocked", "Developer logs window was blocked.", {
      url: targetUrl,
    });
    return;
  }

  state.developerLogsWindowOpen = true;
  try {
    logWindow.focus();
  } catch {
    // Best-effort focus only.
  }
  uiEventDispatcherLog.info("user-action", "developer-logs.open", "Opened developer logs window.", {
    url: targetUrl,
  });
}

function isTextEditingTarget(target) {
  if (target instanceof HTMLTextAreaElement) {
    return target.disabled !== true && target.readOnly !== true;
  }

  if (!(target instanceof HTMLInputElement) || target.disabled || target.readOnly) {
    return false;
  }

  return [
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
    "date",
    "datetime-local",
    "month",
    "time",
    "week",
  ].includes(target.type);
}

function runNativeTextEditCommand(command) {
  if (typeof command !== "string" || !command) {
    return false;
  }

  if (typeof document.execCommand !== "function") {
    return false;
  }

  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

// Intent: let app-owned author marks participate in editor-scoped Ctrl+Z/Ctrl+Y before native text history runs.
function handleManuscriptMarkHistoryKeyboardShortcut(event, action) {
  const textarea = resolveManuscriptShortcutTextarea(event.target);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const previousHistory = state.manuscriptMarkHistory;
  const result = action === "redo"
    ? popManuscriptMarkHistoryRedo(previousHistory)
    : popManuscriptMarkHistoryUndo(previousHistory);
  if (!result.handled) {
    return false;
  }

  state.manuscriptMarkHistory = result.history;
  const applied = applyManuscriptMarkHistorySnapshot({
    entry: result.entry,
    snapshot: result.snapshot,
    direction: result.direction,
    textarea,
  });
  if (!applied) {
    state.manuscriptMarkHistory = previousHistory;
    return false;
  }

  event.preventDefault();
  hideFileMenu();
  return true;
}

// Intent: restore mark and compatibility-range state without changing manuscript text content.
function applyManuscriptMarkHistorySnapshot({
  entry = null,
  snapshot = null,
  direction = "undo",
  textarea = null,
} = {}) {
  const project = state.workspace?.project;
  const sceneId = String(entry?.sceneId ?? "").trim();
  const scene = getScene(sceneId);
  if (!project || !scene || !snapshot) {
    return false;
  }

  const textLength = textarea instanceof HTMLTextAreaElement && String(textarea.dataset.sceneId ?? "") === sceneId
    ? String(textarea.value ?? "").length
    : String(scene.editorText ?? "").length;
  const inlineFormatRanges = normalizeInlineFormatRanges(snapshot.inlineFormatRanges, textLength);
  project.marks = cloneValue(snapshot.marks);
  project.sequences = cloneValue(snapshot.sequences);
  updateSceneDraft(sceneId, (draft) => {
    draft.inlineFormatRanges = inlineFormatRanges;
  }, {
    reason: `manuscript-author-mark-${direction}`,
    markSessionActivity: false,
    immediate: true,
  });
  project.marks = cloneValue(snapshot.marks);
  project.sequences = cloneValue(snapshot.sequences);
  persistCurrentProjectRecord({
    changedSceneIds: [sceneId],
    domain: "manuscript",
    dirtyReason: "user-edit",
    source: "manuscriptMarkHistory",
  });
  const viewport = captureSceneEditorViewport(sceneId);
  syncSceneDocumentLayout({ skipSpellcheck: true });
  if (entry?.selection) {
    restoreSceneEditorViewportSelection(sceneId, viewport, entry.selection);
  } else {
    restoreSceneEditorViewport(sceneId, viewport);
  }
  updateInlineFormatToolbarState(textarea);
  editorInteractionLog.info("user-action", `manuscript.mark.${direction}`, `Applied manuscript mark ${direction}.`, {
    sceneId,
    format: entry?.formatId ?? "",
    startOffset: entry?.selection?.startOffset ?? null,
    endOffset: entry?.selection?.endOffset ?? null,
  });
  return true;
}

// Intent: keep paste insertion on the browser undo stack before falling back to scripted textarea writes.
function insertPastedTextWithUndoFallback(target, normalizedText) {
  // Intent: refuse scripted paste insertion when a shared editor surface is display-only.
  if (!(target instanceof HTMLTextAreaElement) || target.readOnly === true || target.disabled === true) {
    return {
      insertedWithNativeUndo: false,
      fallbackUsed: false,
    };
  }

  const activeElement = document.activeElement;
  if (activeElement !== target) {
    target.focus();
  }

  let insertedWithNativeUndo = false;
  try {
    if (typeof document.execCommand === "function") {
      insertedWithNativeUndo = document.execCommand("insertText", false, normalizedText) === true;
    }
  } catch {
    insertedWithNativeUndo = false;
  }

  if (insertedWithNativeUndo) {
    // Intent: ensure browser undo-preserving paste still reaches the draft-state mutation pipeline.
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      insertedWithNativeUndo: true,
      fallbackUsed: false,
    };
  }

  const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : target.value.length;
  const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
  target.setRangeText(normalizedText, selectionStart, selectionEnd, "end");
  target.dispatchEvent(new Event("input", { bubbles: true }));

  return {
    insertedWithNativeUndo: false,
    fallbackUsed: true,
  };
}

function handleGlobalKeyboardShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.isComposing) {
    return;
  }

  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

  if (key === "escape") {
    if (state.projectPackageDialog) {
      event.preventDefault();
      closeProjectPackageDialog();
      return;
    }
    if (state.keyboardShortcutSettingsWindowOpen) {
      event.preventDefault();
      closeKeyboardShortcutSettingsWindow();
      return;
    }

    if (state.revisionWindowOpen) {
      event.preventDefault();
      closeRevisionWindow();
      return;
    }

    if (state.writingTargetWindowOpen) {
      event.preventDefault();
      closeWritingTargetWindow();
      return;
    }

    if (state.localAiPanelOpen) {
      event.preventDefault();
      closeLocalAiPanel();
      return;
    }

    if (state.spotifyMusicPanelOpen) {
      event.preventDefault();
      closeSpotifyMusicPanel();
      return;
    }

    if (state.dictionaryLookup) {
      event.preventDefault();
      closeDictionaryWindow();
      return;
    }

    if (state.fileMenuOpen) {
      event.preventDefault();
      hideFileMenu();
      return;
    }

    if (state.developerOptionsMenuOpen) {
      event.preventDefault();
      hideDeveloperOptionsMenu();
    }

    return;
  }

  if (key === " " || key === "spacebar") {
    if (toggleVoiceRecordingPreviewWithSpacebar(event)) {
      return;
    }
  }

  const behaviorId = resolveKeyboardShortcutBehaviorIdForEvent(
    event,
    state.editorPrefs?.keyboardShortcuts,
  );
  if (!behaviorId) {
    return;
  }

  if (behaviorId === "inlineNote.commit") {
    if (
      event.target instanceof HTMLTextAreaElement &&
      ["inline-passage-note", "inline-passage-verse"].includes(event.target.dataset.editField)
    ) {
      event.preventDefault();
      commitInlinePassageNote();
    }
    return;
  }

  if (handleManuscriptInlineFormatKeyboardShortcut(event, behaviorId)) {
    return;
  }

  if (behaviorId === "manuscript.dictionaryLookup") {
    if (resolveManuscriptShortcutTextarea(event.target) instanceof HTMLTextAreaElement) {
      event.preventDefault();
      hideFileMenu();
      openDictionaryLookupFromShortcut(event);
    }
    return;
  }

  if (!isTextEditingTarget(event.target) && (behaviorId === "history.undo" || behaviorId === "history.redo")) {
    const handled = state.activePane === "world"
      ? behaviorId === "history.undo"
        ? undoWorldSpineInteraction()
        : redoWorldSpineInteraction()
      : behaviorId === "history.undo"
        ? undoBinderSceneMove()
        : redoBinderSceneMove();
    if (handled) {
      event.preventDefault();
      hideFileMenu();
      return;
    }
  }

  if (isTextEditingTarget(event.target)) {
    if (behaviorId === "history.undo") {
      if (handleManuscriptMarkHistoryKeyboardShortcut(event, "undo")) {
        return;
      }

      event.preventDefault();
      runNativeTextEditCommand("undo");
      return;
    }

    if (behaviorId === "history.redo") {
      if (handleManuscriptMarkHistoryKeyboardShortcut(event, "redo")) {
        return;
      }

      event.preventDefault();
      runNativeTextEditCommand("redo");
      return;
    }
  }

  if (behaviorId === "writingTargets.toggle") {
    event.preventDefault();
    hideFileMenu();
    closeRevisionWindow();
    closeLocalAiPanel();
    closeKeyboardShortcutSettingsWindow();
    closeSpotifyMusicPanel();
    toggleWritingTargetWindow();
    return;
  }

  if (behaviorId === "project.saveAs") {
    event.preventDefault();
    hideFileMenu();
    void saveCurrentProjectFileAs();
    return;
  }

  if (behaviorId === "project.load") {
    event.preventDefault();
    hideFileMenu();
    void loadProjectLibraryFromFile();
    return;
  }

  if (behaviorId === "project.developerLogs") {
    event.preventDefault();
    hideFileMenu();
    openDeveloperLogsWindow();
    return;
  }

  if (behaviorId === "project.save") {
    event.preventDefault();
    hideFileMenu();
    void saveCurrentProject();
    return;
  }

  if (behaviorId === "project.new") {
    event.preventDefault();
    hideFileMenu();
    createProject();
    return;
  }

  if (behaviorId === "project.openMenu") {
    event.preventDefault();
    hideFileMenu();
    openProjectPackageDialog(PROJECT_PACKAGE_DIALOG_MODES.OPEN);
    return;
  }

  if (behaviorId === "manuscript.find") {
    event.preventDefault();
    hideFileMenu();
    openManuscriptFind();
    return;
  }

  if (behaviorId === "pane.manuscript" || behaviorId === "pane.world" || behaviorId === "pane.narration" || behaviorId === "pane.voice") {
    event.preventDefault();
    hideFileMenu();
    closeKeyboardShortcutSettingsWindow();
    selectWorkspacePane({
      "pane.manuscript": "manuscript",
      "pane.world": "world",
      "pane.narration": "narration",
      "pane.voice": "voice",
    }[behaviorId]);
  }
}

// Intent: make manuscript decoration shortcuts behave like pressing the matching toolbar control.
function handleManuscriptInlineFormatKeyboardShortcut(event, behaviorId) {
  const formatId = MANUSCRIPT_INLINE_FORMAT_SHORTCUT_BEHAVIORS[behaviorId];
  if (!formatId) {
    return false;
  }

  const textarea = resolveManuscriptShortcutTextarea(event.target);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  event.preventDefault();
  hideFileMenu();
  toggleManuscriptInlineFormat(formatId);
  return true;
}

function resolveManuscriptShortcutTextarea(target) {
  if (
    target instanceof HTMLTextAreaElement &&
    target.classList.contains("editor-document-input")
  ) {
    return target;
  }

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.classList.contains("editor-document-input")
  ) {
    return activeElement;
  }

  return null;
}

function getTopPanelCustomizationContextFromContextMenu(target) {
  return getTopPanelCustomizationContextFromContextMenuTarget(target);
}

function openTopPanelCustomization(groupId = "", position = null) {
  hideTaskSurfaces();
  if (state.sidePanelCustomizationOpen) {
    closeSidePanelCustomization();
  }
  state.topPanelCustomizationOpen = true;
  state.topPanelCustomizationGroupId = String(groupId ?? "").trim();
  state.topPanelCustomizationPosition = clampTopPanelCustomizationPosition(position);
  renderHeader();
}

function closeTopPanelCustomization() {
  if (!state.topPanelCustomizationOpen) {
    return;
  }

  state.topPanelCustomizationOpen = false;
  state.topPanelCustomizationPosition = null;
  state.topPanelCustomizationGroupId = "";
  renderHeader();
}

function resetTopPanelCustomization(groupId = "") {
  setTopPanelCustomizationGroupVisibility(groupId, true, {
    dirtyReason: "top-panel-visibility-reset",
    source: "resetTopPanelCustomization",
  });
}

function hideTopPanelCustomizationGroup(groupId = "") {
  setTopPanelCustomizationGroupVisibility(groupId, false, {
    dirtyReason: "top-panel-visibility-hide-all",
    source: "hideTopPanelCustomizationGroup",
  });
}

// Intent: apply top-card bulk visibility through the same settings persistence path as one-card changes.
function setTopPanelCustomizationGroupVisibility(groupId = "", isVisible = true, options = {}) {
  const features = getTopPanelCustomizationFeatures({
    groupId,
    activePane: state.activePane,
  });
  let nextVisibility = createTopPanelVisibilityState(state.topPanelVisibility);
  for (const feature of features) {
    nextVisibility = setTopPanelCardVisible(nextVisibility, feature.id, isVisible, state.activePane);
  }
  state.topPanelVisibility = nextVisibility;
  persistTopPanelVisibilityState({
    dirtyReason: options.dirtyReason ?? "top-panel-visibility-bulk-updated",
    source: options.source ?? "setTopPanelCustomizationGroupVisibility",
  });
  uiEventDispatcherLog.info("user-action", "top-panel.visibility.bulk-updated", "Updated top panel group visibility.", {
    groupId: String(groupId ?? "").trim(),
    paneId: state.activePane,
    visible: isVisible === true,
    cardIds: features.map((feature) => feature.id),
  });
  renderHeader();
}

function hideTopPanelCard(cardId = "") {
  updateTopPanelCardVisibility(cardId, false, {
    dirtyReason: "top-panel-card-hidden",
    source: "hideTopPanelCard",
  });
}

function updateTopPanelCardVisibility(cardId = "", isVisible = true, options = {}) {
  state.topPanelVisibility = setTopPanelCardVisible(state.topPanelVisibility, cardId, isVisible, state.activePane);
  persistTopPanelVisibilityState({
    dirtyReason: options.dirtyReason ?? "top-panel-visibility-updated",
    source: options.source ?? "updateTopPanelCardVisibility",
  });
  uiEventDispatcherLog.info("user-action", "top-panel.visibility.updated", "Updated top panel card visibility.", {
    cardId: String(cardId ?? "").trim(),
    paneId: state.activePane,
    visible: isVisible === true,
  });
  renderHeader();
}

function persistTopPanelVisibilityState(options = {}) {
  state.topPanelVisibility = createTopPanelVisibilityState(state.topPanelVisibility);
  writeStoredJsonRaw(EDITOR_TOP_PANEL_VISIBILITY_KEY, state.topPanelVisibility);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "top-panel-visibility-updated",
    source: options.source ?? "persistTopPanelVisibilityState",
  });
}

function clampTopPanelCustomizationPosition(position = null) {
  const width = 300;
  const height = 320;
  const rawX = Number(position?.x);
  const rawY = Number(position?.y);
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);
  return {
    x: Math.max(8, Math.min(Number.isFinite(rawX) ? Math.round(rawX) : maxX, maxX)),
    y: Math.max(8, Math.min(Number.isFinite(rawY) ? Math.round(rawY) : 120, maxY)),
  };
}

function shouldOpenSidePanelCustomizationFromContextMenu(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  const consoleDockBody = target.closest(".console-dock-body");
  if (!(consoleDockBody instanceof HTMLElement)) {
    return false;
  }

  if (!(target.closest(".side-panel-body") instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-side-panel-customization]")) {
    return false;
  }

  // Intent: reserve existing item, button, and form context menus for their current feature behavior.
  if (target.closest("button, input, textarea, select, a, [role='button'], [data-action], .side-panel-tabs, .console-item, .task-item, .event-list, .entity-card, .node-card")) {
    return false;
  }

  return true;
}

function openSidePanelCustomization(position = null) {
  hideTaskSurfaces();
  if (state.topPanelCustomizationOpen) {
    closeTopPanelCustomization();
  }
  state.sidePanelCustomizationOpen = true;
  state.sidePanelCustomizationPosition = clampSidePanelCustomizationPosition(position);
  renderConsolePanel();
}

function closeSidePanelCustomization() {
  if (!state.sidePanelCustomizationOpen) {
    return;
  }

  state.sidePanelCustomizationOpen = false;
  state.sidePanelCustomizationPosition = null;
  renderConsolePanel();
}

function openCustomMetadataForm() {
  hideTaskSurfaces();
  closeSidePanelCustomization();
  state.customMetadataFormOpen = true;
  state.customMetadataFormError = "";
  renderConsolePanel();
  window.requestAnimationFrame(() => {
    const nameField = document.querySelector("[data-custom-metadata-name]");
    if (nameField instanceof HTMLInputElement) {
      nameField.focus();
      nameField.select();
    }
  });
}

function closeCustomMetadataForm() {
  if (!state.customMetadataFormOpen) {
    return;
  }

  state.customMetadataFormOpen = false;
  state.customMetadataFormError = "";
  renderConsolePanel();
}

async function saveCustomMetadataDefinitionFromForm() {
  const nameField = document.querySelector("[data-custom-metadata-name]");
  const colorField = document.querySelector("[data-custom-metadata-color]");
  const label = nameField instanceof HTMLInputElement ? nameField.value : "";
  if (!String(label ?? "").trim()) {
    state.customMetadataFormError = "Name the metadata tag before creating it.";
    renderConsolePanel();
    window.requestAnimationFrame(() => {
      const field = document.querySelector("[data-custom-metadata-name]");
      if (field instanceof HTMLInputElement) {
        field.focus();
      }
    });
    return;
  }

  let icon = null;
  try {
    const iconResult = await readCustomMetadataIconFromForm();
    if (iconResult.error) {
      state.customMetadataFormError = iconResult.error;
      renderConsolePanel();
      return;
    }
    icon = iconResult.icon;
  } catch {
    state.customMetadataFormError = "The metadata icon could not be read.";
    renderConsolePanel();
    return;
  }

  const result = createCustomMetadataDefinition({
    label,
    highlightColor: colorField instanceof HTMLInputElement ? colorField.value : DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR,
    ...(icon ? { icon } : {}),
  }, getCustomMetadataDefinitions());

  if (!result.definition) {
    state.customMetadataFormError = result.error === "icon-invalid"
      ? "Choose a PNG, JPG, WebP, or GIF icon under the metadata icon limit."
      : "Name the metadata tag before creating it.";
    renderConsolePanel();
    window.requestAnimationFrame(() => {
      const field = document.querySelector("[data-custom-metadata-name]");
      if (field instanceof HTMLInputElement) {
        field.focus();
      }
    });
    return;
  }

  state.customMetadataDefinitions = result.definitions;
  state.sidePanelVisibility = setSidePanelFeatureVisible(state.sidePanelVisibility, result.definition.id, true);
  state.sidePanelMode = result.definition.id;
  state.customMetadataFormOpen = false;
  state.customMetadataFormError = "";
  persistCustomMetadataDefinitionsState({
    dirtyReason: "custom-metadata-definition-created",
    source: "saveCustomMetadataDefinitionFromForm",
  });
  renderConsolePanel();
}

// Intent: read only small validated image uploads into project-local metadata definition icons.
async function readCustomMetadataIconFromForm() {
  const iconField = document.querySelector("[data-custom-metadata-icon]");
  if (!(iconField instanceof HTMLInputElement) || !iconField.files?.length) {
    return {
      icon: null,
      error: "",
    };
  }

  const file = iconField.files[0];
  const validationError = validateCustomMetadataIconFile(file);
  if (validationError) {
    return {
      icon: null,
      error: formatCustomMetadataIconUploadError(validationError),
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const icon = normalizeCustomMetadataIcon({
    dataUrl,
    mediaType: file.type,
    name: file.name,
    size: file.size,
  });
  return {
    icon,
    error: icon ? "" : "Choose a PNG, JPG, WebP, or GIF icon under the metadata icon limit.",
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "function") {
      reject(new Error("FileReader is unavailable."));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("The file could not be read."));
    });
    reader.readAsDataURL(file);
  });
}

async function readFileAsBase64(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("The file could not be read.");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

// Intent: keep metadata icon validation messages short enough for the compact console form.
function formatCustomMetadataIconUploadError(errorCode) {
  if (errorCode === "icon-too-large") {
    return `Choose an icon under ${Math.round(CUSTOM_METADATA_ICON_MAX_BYTES / 1024)} KB.`;
  }

  if (errorCode === "icon-empty") {
    return "Choose a non-empty image file for the metadata icon.";
  }

  return "Choose a PNG, JPG, WebP, or GIF image for the metadata icon.";
}

function persistCustomMetadataDefinitionsState(options = {}) {
  state.customMetadataDefinitions = getCustomMetadataDefinitions();
  state.sidePanelVisibility = createSidePanelVisibilityState(state.sidePanelVisibility, getMetadataSidePanelIds());
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "custom-metadata-definitions-updated",
    source: options.source ?? "persistCustomMetadataDefinitionsState",
  });
}

function resetSidePanelCustomization() {
  state.sidePanelVisibility = createSidePanelVisibilityState({}, getMetadataSidePanelIds());
  persistSidePanelVisibilityState();
  renderConsolePanel();
}

function updateSidePanelFeatureVisibility(panelId, isVisible) {
  state.sidePanelVisibility = setSidePanelFeatureVisible(state.sidePanelVisibility, panelId, isVisible);
  const resolvedPanelMode = resolveVisibleSidePanelMode(state.sidePanelMode, state.sidePanelVisibility, getMetadataSidePanelIds());
  if (resolvedPanelMode) {
    state.sidePanelMode = resolvedPanelMode;
  }
  persistSidePanelVisibilityState();
  renderConsolePanel();
}

function persistSidePanelVisibilityState() {
  state.sidePanelVisibility = createSidePanelVisibilityState(state.sidePanelVisibility, getMetadataSidePanelIds());
  writeStoredJsonRaw(EDITOR_SIDE_PANEL_VISIBILITY_KEY, state.sidePanelVisibility);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "side-panel-visibility-updated",
    source: "persistSidePanelVisibilityState",
  });
}

function clampSidePanelCustomizationPosition(position = null) {
  const width = 300;
  const height = 360;
  const rawX = Number(position?.x);
  const rawY = Number(position?.y);
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);
  return {
    x: Math.max(8, Math.min(Number.isFinite(rawX) ? Math.round(rawX) : maxX, maxX)),
    y: Math.max(8, Math.min(Number.isFinite(rawY) ? Math.round(rawY) : 120, maxY)),
  };
}

function syncSidePanelsHiddenClass() {
  appRoot.classList.toggle("is-side-panels-hidden", state.sidePanelsHidden === true);
}

// Intent: keep appearance mode as editor preference state while the resolved theme stays a render concern.
function setAppearanceModePreference(candidateMode) {
  const previousMode = normalizeEditorAppearanceMode(state.editorPrefs?.appearanceMode);
  const nextMode = normalizeEditorAppearanceMode(candidateMode, previousMode);
  if (nextMode === previousMode) {
    syncAppearanceMode({ reason: "appearance-mode-noop" });
    return;
  }

  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    appearanceMode: nextMode,
  });
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  syncAppearanceMode({ reason: "appearance-mode-preference" });
  renderHeader();
  renderDraftProofSettingsWindow();
  uiEventDispatcherLog.info("user-action", "appearance-mode.updated", "Updated editor appearance mode.", {
    previousMode,
    nextMode,
    resolvedTheme: resolveAppearanceTheme(nextMode),
  });
}

// Intent: apply the current theme to document-level attributes so feature styles can inherit tokens.
function syncAppearanceMode({ reason = "" } = {}) {
  const appearanceMode = normalizeEditorAppearanceMode(state.editorPrefs?.appearanceMode);
  const resolvedTheme = resolveAppearanceTheme(appearanceMode);
  document.documentElement.dataset.appearanceMode = appearanceMode;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  appRoot.dataset.appearanceMode = appearanceMode;
  appRoot.dataset.theme = resolvedTheme;
  appRoot.classList.toggle("is-dark-mode", resolvedTheme === "dark");
  appRoot.classList.toggle("is-light-mode", resolvedTheme !== "dark");

  if (reason && reason !== "render") {
    uiEventDispatcherLog.debug("render", "appearance-mode.sync", "Synchronized document appearance mode.", {
      reason,
      appearanceMode,
      resolvedTheme,
    });
  }
}

function resolveAppearanceTheme(appearanceMode) {
  const normalizedMode = normalizeEditorAppearanceMode(appearanceMode);
  if (normalizedMode === "dark") {
    return "dark";
  }

  if (normalizedMode === "system" && systemPrefersDarkMode()) {
    return "dark";
  }

  return "light";
}

function systemPrefersDarkMode() {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia(APPEARANCE_MODE_MEDIA_QUERY).matches === true;
  } catch {
    return false;
  }
}

function wireAppearanceModeSystemPreferenceListener() {
  if (appearanceModeMediaQueryList || typeof window.matchMedia !== "function") {
    return;
  }

  try {
    appearanceModeMediaQueryList = window.matchMedia(APPEARANCE_MODE_MEDIA_QUERY);
  } catch {
    appearanceModeMediaQueryList = null;
    return;
  }

  appearanceModeSystemPreferenceListener = () => {
    if (normalizeEditorAppearanceMode(state.editorPrefs?.appearanceMode) !== "system") {
      return;
    }

    syncAppearanceMode({ reason: "system-appearance-change" });
    renderDraftProofSettingsWindow();
  };

  if (typeof appearanceModeMediaQueryList.addEventListener === "function") {
    appearanceModeMediaQueryList.addEventListener("change", appearanceModeSystemPreferenceListener);
  } else if (typeof appearanceModeMediaQueryList.addListener === "function") {
    appearanceModeMediaQueryList.addListener(appearanceModeSystemPreferenceListener);
  }
}

function toggleSidePanelsHidden() {
  state.sidePanelsHidden = toggleSidePanelsHiddenState(state.sidePanelsHidden);
  persistSidePanelsHiddenState({
    dirtyReason: state.sidePanelsHidden ? "side-panels-hidden" : "side-panels-shown",
    source: "toggleSidePanelsHidden",
  });
  uiEventDispatcherLog.info("user-action", "layout.side-panels-hidden.toggled", "Toggled side-panel focus mode.", {
    hidden: state.sidePanelsHidden === true,
    paneId: state.activePane,
  });
  syncSidePanelsHiddenClass();
  renderHeader();
  syncLayoutWidths({ reason: "side-panels-hidden-toggle" });
  syncWorldSpinePanelLayout({ reason: "side-panels-hidden-toggle" });
  if (state.activePane === "manuscript" || state.activePane === "narration") {
    syncSceneDocumentLayout();
  }
}

function persistSidePanelsHiddenState(options = {}) {
  state.sidePanelsHidden = normalizeSidePanelsHiddenState(state.sidePanelsHidden);
  writeStoredJsonRaw(EDITOR_SIDE_PANELS_HIDDEN_KEY, state.sidePanelsHidden);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "side-panels-hidden-updated",
    source: options.source ?? "persistSidePanelsHiddenState",
  });
}

function toggleConsoleCollapse() {
  state.consoleDockCollapsed = !state.consoleDockCollapsed;
  persistConsoleDockCollapsedState(state.consoleDockCollapsed);
  syncLayoutWidths({ reason: "console-collapse" });
  renderConsolePanel();
}

function beginLayoutResize(handleId, event) {
  if (!(event instanceof PointerEvent)) {
    return;
  }

  layoutResizeSession = {
    handleId,
    startBinderPanelWidth: state.binderPanelWidth,
    startConsoleDockWidth: state.consoleDockWidth,
    moved: false,
  };
  document.body.classList.add("is-resizing-layout");
  syncLayoutWidths({ reason: "panel-resize-begin" });
  event.preventDefault();
}

function handleLayoutResizePointerMove(event) {
  if (!layoutResizeSession || !(event instanceof PointerEvent)) {
    return;
  }

  event.preventDefault();

  const workspace = document.querySelector(".workspace-grid");
  if (!(workspace instanceof HTMLElement)) {
    return;
  }

  const rect = workspace.getBoundingClientRect();
  const availableWidth = resolveWorkspaceGridAvailableWidth(rect.width);
  const currentConsoleWidth = state.consoleDockCollapsed
    ? CONSOLE_DOCK_COLLAPSED_WIDTH
    : state.consoleDockWidth;

  if (layoutResizeSession.handleId === "binder") {
    const maxBinderWidth = Math.max(
      MIN_BINDER_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - currentConsoleWidth,
    );
    state.binderPanelWidth = clampNumber(
      Math.round(event.clientX - rect.left),
      MIN_BINDER_PANEL_WIDTH,
      maxBinderWidth,
    );
    markLayoutResizeSessionMoved();
    syncLayoutWidths({ reason: "panel-resize-move" });
    return;
  }

  if (layoutResizeSession.handleId === "console" && !state.consoleDockCollapsed) {
    const maxConsoleWidth = Math.max(
      MIN_CONSOLE_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - state.binderPanelWidth,
    );
    state.consoleDockWidth = clampNumber(
      Math.round(rect.right - event.clientX),
      MIN_CONSOLE_PANEL_WIDTH,
      maxConsoleWidth,
    );
    markLayoutResizeSessionMoved();
    syncLayoutWidths({ reason: "panel-resize-move" });
  }
}

function endLayoutResize() {
  if (!layoutResizeSession) {
    return;
  }

  const completedSession = layoutResizeSession;
  layoutResizeSession = null;
  document.body.classList.remove("is-resizing-layout");
  layoutStateLog.debug("layout", "panel-layout.resize-end", "Ended manuscript side-panel resize session.", {
    handleId: completedSession.handleId,
    moved: completedSession.moved === true,
    startBinderPanelWidth: completedSession.startBinderPanelWidth,
    startConsoleDockWidth: completedSession.startConsoleDockWidth,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
  });
  syncLayoutWidths({
    persistProfile: completedSession.moved === true,
    reason: "panel-resize",
    handleId: completedSession.handleId,
  });
}

function markLayoutResizeSessionMoved() {
  // Intent: only explicit drag movement should persist a size profile.
  if (!layoutResizeSession) {
    return;
  }

  layoutResizeSession.moved =
    Math.abs(state.binderPanelWidth - layoutResizeSession.startBinderPanelWidth) > 1 ||
    Math.abs(state.consoleDockWidth - layoutResizeSession.startConsoleDockWidth) > 1;
}

function getWorldSpineLayoutSnapshot() {
  // Intent: pass the persisted World Spine rail widths into the feature renderer without letting it own app state.
  return {
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
  };
}

function beginWorldSpineLayoutResize(handleId, event) {
  // Intent: treat the World Spine event rail and manuscript pane as independently draggable fixed side panels.
  if (!(event instanceof PointerEvent) || !["event-rail", "manuscript-pane"].includes(handleId)) {
    return;
  }

  const workspace = document.querySelector("[data-world-spine-root]");
  if (!(workspace instanceof HTMLElement)) {
    return;
  }

  worldSpineLayoutResizeSession = {
    handleId,
    startEventRailWidth: state.worldSpineEventRailWidth,
    startManuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
    historyBefore: captureWorldSpineHistorySnapshot(),
    moved: false,
  };
  document.body.classList.add("is-resizing-layout", "is-resizing-world-spine-layout");
  syncWorldSpinePanelLayout({ reason: "world-spine-resize-begin" });
  event.preventDefault();
}

function handleWorldSpineLayoutResizePointerMove(event) {
  // Intent: resize only the grabbed fixed rail while keeping the central timeline usable.
  if (!worldSpineLayoutResizeSession || !(event instanceof PointerEvent)) {
    return;
  }

  event.preventDefault();
  const workspace = document.querySelector("[data-world-spine-root]");
  if (!(workspace instanceof HTMLElement)) {
    return;
  }

  const rect = workspace.getBoundingClientRect();
  const availableWidth = Math.max(0, rect.width - (PANEL_RESIZER_WIDTH * 2));
  if (worldSpineLayoutResizeSession.handleId === "event-rail") {
    const maxEventRailWidth = Math.max(
      MIN_WORLD_SPINE_EVENT_RAIL_WIDTH,
      availableWidth - MIN_WORLD_SPINE_TIMELINE_WIDTH - state.worldSpineManuscriptPaneWidth,
    );
    state.worldSpineEventRailWidth = clampNumber(
      Math.round(event.clientX - rect.left),
      MIN_WORLD_SPINE_EVENT_RAIL_WIDTH,
      maxEventRailWidth,
    );
    markWorldSpineLayoutResizeSessionMoved();
    syncWorldSpinePanelLayout({ reason: "world-spine-resize-move", handleId: "event-rail" });
    return;
  }

  if (worldSpineLayoutResizeSession.handleId === "manuscript-pane") {
    const maxManuscriptPaneWidth = Math.max(
      MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
      availableWidth - MIN_WORLD_SPINE_TIMELINE_WIDTH - state.worldSpineEventRailWidth,
    );
    state.worldSpineManuscriptPaneWidth = clampNumber(
      Math.round(rect.right - event.clientX),
      MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
      maxManuscriptPaneWidth,
    );
    markWorldSpineLayoutResizeSessionMoved();
    syncWorldSpinePanelLayout({ reason: "world-spine-resize-move", handleId: "manuscript-pane" });
  }
}

function endWorldSpineLayoutResize() {
  // Intent: persist World Spine side-panel settings only after the pointer drag actually changed a width.
  if (!worldSpineLayoutResizeSession) {
    return;
  }

  const completedSession = worldSpineLayoutResizeSession;
  worldSpineLayoutResizeSession = null;
  document.body.classList.remove("is-resizing-world-spine-layout");
  if (!layoutResizeSession) {
    document.body.classList.remove("is-resizing-layout");
  }
  layoutStateLog.debug("layout", "world-spine-panel-layout.resize-end", "Ended World Spine side-panel resize session.", {
    handleId: completedSession.handleId,
    moved: completedSession.moved === true,
    startEventRailWidth: completedSession.startEventRailWidth,
    startManuscriptPaneWidth: completedSession.startManuscriptPaneWidth,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
  });
  syncWorldSpinePanelLayout({
    persistProfile: completedSession.moved === true,
    reason: "world-spine-panel-resize",
    handleId: completedSession.handleId,
  });
  if (completedSession.moved === true) {
    pushWorldSpineHistoryChange(completedSession.historyBefore, {
      label: "Resized World Spine panels",
      dirtyReason: "world-spine-panel-resize",
      source: "endWorldSpineLayoutResize",
    });
    renderWorldPanel();
  }
}

function markWorldSpineLayoutResizeSessionMoved() {
  // Intent: avoid writing profile records for pointer taps that never resized a World Spine rail.
  if (!worldSpineLayoutResizeSession) {
    return;
  }

  worldSpineLayoutResizeSession.moved =
    Math.abs(state.worldSpineEventRailWidth - worldSpineLayoutResizeSession.startEventRailWidth) > 1 ||
    Math.abs(state.worldSpineManuscriptPaneWidth - worldSpineLayoutResizeSession.startManuscriptPaneWidth) > 1;
}

// Intent: render the binder as the navigable manuscript structure, not a flat document outline.
function renderBinderPanel() {
  const workspace = state.workspace;
  const chapters = groupScenesByChapter(state.scenes);
  const taskCountsByChapter = countRemainingTasksByChapter(state.manuscriptTasks);
  const activeProject = getActiveProjectRecord();
  const slot = document.querySelector("#binder-slot");
  if (!slot) {
    return;
  }

  const { scrollTop, scrollLeft } = slot;
  slot.innerHTML = `
    <div class="panel-heading manuscript-nav-heading">
      <p class="panel-kicker">Manuscript</p>
      <div class="panel-actions manuscript-nav-actions">
        <button class="tag-button panel-action-button" data-action="add-chapter">
          <span class="binder-nav-action-long">New chapter</span>
          <span class="binder-nav-action-short" aria-hidden="true">+C</span>
        </button>
        <button class="tag-button panel-action-button" data-action="add-scene">
          <span class="binder-nav-action-long">New scene</span>
          <span class="binder-nav-action-short" aria-hidden="true">+S</span>
        </button>
      </div>
    </div>
    <div class="binder-tree">
      ${chapters.map((chapter, index) => renderChapterNode(chapter, index + 1, taskCountsByChapter[chapter.chapterId] ?? 0)).join("")}
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
    ${renderSourceArchive(activeProject)}
  `;
  slot.scrollTop = scrollTop;
  slot.scrollLeft = scrollLeft;
}

function renderSourceArchive(projectRecord) {
  const archive = Array.isArray(projectRecord?.sourceArchive) ? projectRecord.sourceArchive : [];
  if (!archive.length) {
    return "";
  }

  return `
    <div class="source-archive">
      <div class="panel-heading split-heading">
        <p class="panel-kicker">Project sources</p>
        <h2>Project archive</h2>
      </div>
      <div class="source-archive-list">
        ${archive.map((item) => renderSourceArchiveItem(item)).join("")}
      </div>
    </div>
  `;
}

function renderSourceArchiveItem(item) {
  return `
    <article class="source-archive-item">
      <span class="source-archive-kind">${escapeHtml(formatImportSourceLabel(item.kind))}</span>
      <strong>${escapeHtml(item.title || "Untitled source item")}</strong>
      <span>${escapeHtml(item.binderPath || "Unknown location")}</span>
    </article>
  `;
}

function renderChapterNode(chapter, chapterNumber, taskCount) {
  const isCurrentChapter = getSelectedScene()?.chapterId === chapter.chapterId;
  const isCollapsed = isChapterCollapsed(chapter.chapterId);
  const isEditingChapterTitle = state.editingChapterTitleId === chapter.chapterId;
  const isDropStart =
    binderSceneDragState?.dropTarget?.type === "chapter-start" &&
    binderSceneDragState.dropTarget.chapterId === chapter.chapterId;
  const childrenId = `binder-chapter-scenes-${chapter.chapterId}`;
  const chapterNumberLabel = formatChapterNumberLabel(chapterNumber);
  const chapterDisplayTitle = formatChapterDisplayTitle(chapter.chapterTitle);
  const editableChapterTitle = getEditableChapterTitle(chapter.chapterTitle);
  return `
    <div class="binder-node binder-chapter ${isCollapsed ? "is-collapsed" : ""} ${isDropStart ? "is-drop-start" : ""}" data-binder-chapter-drop-id="${escapeHtml(chapter.chapterId)}">
      <div class="binder-chapter-row">
        <button
          class="binder-collapse-button"
          type="button"
          data-action="toggle-chapter-collapse"
          data-chapter-id="${escapeHtml(chapter.chapterId)}"
          aria-label="${escapeHtml(isCollapsed ? `Expand ${chapterDisplayTitle}` : `Collapse ${chapterDisplayTitle}`)}"
          aria-expanded="${isCollapsed ? "false" : "true"}"
          aria-controls="${escapeHtml(childrenId)}"
          title="${escapeHtml(isCollapsed ? "Expand chapter" : "Collapse chapter")}"
        >
          <span aria-hidden="true">${isCollapsed ? "▸" : "▾"}</span>
        </button>
        ${
          isEditingChapterTitle
            ? `
              <div
                class="binder-button binder-chapter-button ${isCurrentChapter ? "is-active" : ""} is-editing-chapter-title"
                data-action="select-chapter"
                data-chapter-id="${escapeHtml(chapter.chapterId)}"
              >
                <span class="binder-chapter-order">${escapeHtml(chapterNumberLabel)}</span>
                <input
                  class="inline-title-input binder-chapter-title-input"
                  type="text"
                  value="${escapeHtml(editableChapterTitle)}"
                  data-edit-field="chapter-title"
                  data-chapter-id="${escapeHtml(chapter.chapterId)}"
                  data-chapter-title-id="${escapeHtml(chapter.chapterId)}"
                  aria-label="Chapter title"
                />
                ${taskCount > 0 ? renderTaskBadge(taskCount, chapterDisplayTitle) : ""}
              </div>
            `
            : `
              <button
                class="binder-button binder-chapter-button ${isCurrentChapter ? "is-active" : ""}"
                type="button"
                data-action="select-chapter"
                data-chapter-id="${escapeHtml(chapter.chapterId)}"
              >
                <span class="binder-chapter-order">${escapeHtml(chapterNumberLabel)}</span>
                <span class="binder-chapter-title" data-chapter-title-id="${escapeHtml(chapter.chapterId)}">${escapeHtml(chapterDisplayTitle)}</span>
                ${taskCount > 0 ? renderTaskBadge(taskCount, chapterDisplayTitle) : ""}
              </button>
            `
        }
      </div>
      <div class="binder-children" id="${escapeHtml(childrenId)}" ${isCollapsed ? "hidden" : ""}>
        ${renderBinderSceneDropSlot(chapter.scenes[0], "before", chapter.chapterId)}
        ${chapter.scenes.map((scene, index) => `
          ${renderSceneNode(scene)}
          ${index === chapter.scenes.length - 1 ? renderBinderSceneDropSlot(scene, "after", chapter.chapterId) : ""}
        `).join("")}
      </div>
    </div>
  `;
}

// Intent: provide explicit drag landing zones between scenes so cross-chapter moves can target a concrete insertion point.
function renderBinderSceneDropSlot(scene, position, chapterId) {
  const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId : "";
  const sceneChapterId = typeof scene?.chapterId === "string" ? scene.chapterId : chapterId;
  if (!sceneId || !sceneChapterId) {
    return "";
  }

  return `
    <div
      class="binder-scene-drop-slot binder-scene-drop-slot-${escapeHtml(position)}"
      data-binder-scene-drop-slot-id="${escapeHtml(sceneId)}"
      data-binder-scene-drop-position="${escapeHtml(position)}"
      data-binder-scene-drop-chapter-id="${escapeHtml(sceneChapterId)}"
      aria-hidden="true"
    ></div>
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
  const isEditingSceneTitle = state.editingSceneTitleId === scene.sceneId;
  const canDragScene = isMovableScene(scene);
  const isDraggingScene = binderSceneDragState?.sourceSceneId === scene.sceneId;
  const isDropBefore =
    binderSceneDragState?.dropTarget?.type === "before" &&
    binderSceneDragState.dropTarget.sceneId === scene.sceneId;
  const isDropAfter =
    binderSceneDragState?.dropTarget?.type === "after" &&
    binderSceneDragState.dropTarget.sceneId === scene.sceneId;
  const sceneDisplayTitle = escapeHtml(scene.sceneTitle);
  return `
    <div class="binder-node binder-scene ${isDropBefore ? "is-drop-before" : ""} ${isDropAfter ? "is-drop-after" : ""}" data-binder-scene-drop-id="${escapeHtml(scene.sceneId)}">
      ${
        isEditingSceneTitle
          ? `
            <div
              class="binder-button binder-scene-button ${isCurrentScene ? "is-active" : ""} ${isDraggingScene ? "is-dragging" : ""} is-editing-scene-title"
              data-action="select-scene"
              data-scene-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-id="${escapeHtml(scene.sceneId)}"
            >
              <span class="binder-kind">scene</span>
              <input
                class="inline-title-input binder-scene-title-input"
                type="text"
                value="${sceneDisplayTitle}"
                data-edit-field="scene-title"
                data-scene-id="${escapeHtml(scene.sceneId)}"
                data-binder-scene-title-id="${escapeHtml(scene.sceneId)}"
                aria-label="Scene title"
              />
            </div>
          `
          : `
            <button
              class="binder-button binder-scene-button ${isCurrentScene ? "is-active" : ""} ${isDraggingScene ? "is-dragging" : ""}"
              type="button"
              data-action="select-scene"
              data-scene-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-id="${escapeHtml(scene.sceneId)}"
              data-scene-title-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-title-id="${escapeHtml(scene.sceneId)}"
              draggable="${canDragScene ? "true" : "false"}"
            >
              <span class="binder-kind">scene</span>
              <span data-binder-scene-title-id="${escapeHtml(scene.sceneId)}">${sceneDisplayTitle}</span>
            </button>
          `
      }
    </div>
  `;
}

// Intent: render the selected manuscript scene while scene-editing behavior is being extracted.
function renderManuscriptPanel() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  const editorMode = state.activePane === "narration" ? "narration" : "manuscript";
  const slot = document.querySelector("#manuscript-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = renderManuscriptPanelHTML({
    state,
    selectedScene,
    editorMode,
    grammarCheckSummary: buildGrammarCheckSummary(selectedScene, getCurrentSpellcheckLexicons()),
    projectIndex: getActiveProjectRecord()?.projectIndex ?? null,
    buildEditorStyle,
    getInlinePassageDraftAnchor,
    narrationPlaybackState: voiceRecordingPreviewController.getPlaybackState(),
    formatChapterDisplayTitle,
  });
  renderGrammarCheckPanel();
}

// Intent: render the right dock as metadata console or narration audio console for the active pane.
function renderConsolePanel() {
  const slot = document.querySelector("#console-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.classList.toggle("is-collapsed", state.consoleDockCollapsed);
  appRoot.classList.toggle("is-console-dock-collapsed", state.consoleDockCollapsed);
  const isNarrationConsole = state.activePane === "narration";
  const visiblePanelIds = isNarrationConsole
    ? [NARRATION_AUDIO_PANEL_ID]
    : syncSidePanelVisibilityRuntimeState();
  const consoleTitle = isNarrationConsole ? "Narration Console" : "Metadata Console";
  slot.innerHTML = `
    <div class="console-dock ${state.consoleDockCollapsed ? "is-collapsed" : ""}">
      <div class="console-dock-header">
        <p class="panel-kicker console-dock-title">${escapeHtml(consoleTitle)}</p>
        <button
          class="console-dock-toggle"
          type="button"
          data-action="toggle-console-collapse"
          aria-expanded="${state.consoleDockCollapsed ? "false" : "true"}"
          aria-label="${state.consoleDockCollapsed ? "Open right console" : "Collapse right console"}"
          title="${state.consoleDockCollapsed ? "Open right console" : "Collapse right console"}"
        >
          <span aria-hidden="true">${state.consoleDockCollapsed ? "◀" : "▶"}</span>
          <strong>${state.consoleDockCollapsed ? "Open" : "Hide"}</strong>
        </button>
      </div>
      <div class="console-dock-body">
        ${renderSidePanelTabs()}
        <div class="console-dock-scroll">
          ${visiblePanelIds.length
            ? renderVisibleSidePanelBody()
            : renderHiddenSidePanelOverviewHTML({
              features: getMetadataConsoleFeatures(),
              visibility: state.sidePanelVisibility,
              counts: getSidePanelFeatureCounts(),
            })}
        </div>
      </div>
      ${isNarrationConsole ? "" : renderSidePanelCustomizationSurface()}
    </div>
  `;
}

// Intent: keep manuscript find/replace state isolated from the editor text model.
function renderManuscriptFindPanel() {
  const slot = document.querySelector("#find-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const findState = state.manuscriptFind ?? {};
  if (!findState.open) {
    slot.innerHTML = "";
    return;
  }

  const panelModel = manuscriptFindController.buildPanelModel(findState);
  const focusedFindField =
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.closest("#find-slot")
      ? {
          field: document.activeElement.dataset.findField ?? "",
          selectionStart: document.activeElement.selectionStart,
          selectionEnd: document.activeElement.selectionEnd,
        }
      : null;

  if (state.manuscriptFind.activeIndex !== panelModel.activeIndex) {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      activeIndex: panelModel.activeIndex,
    };
  }

  syncManuscriptFindSlotPosition(slot, findState.position);
  slot.innerHTML = manuscriptFindController.renderPanelHTML(panelModel);

  if (focusedFindField?.field) {
    const field = slot.querySelector(`[data-find-field="${CSS.escape(focusedFindField.field)}"]`);
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      if (Number.isInteger(focusedFindField.selectionStart) && Number.isInteger(focusedFindField.selectionEnd)) {
        field.setSelectionRange(focusedFindField.selectionStart, focusedFindField.selectionEnd);
      }
    }
  }
}

function syncManuscriptFindSlotPosition(slot, position) {
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const left = Number(position?.left);
  const top = Number(position?.top);
  if (Number.isFinite(left) && Number.isFinite(top)) {
    slot.style.left = `${Math.round(left)}px`;
    slot.style.top = `${Math.round(top)}px`;
    slot.style.transform = "none";
    return;
  }

  slot.style.removeProperty("left");
  slot.style.removeProperty("top");
  slot.style.removeProperty("transform");
}

function setManuscriptFindPosition(left, top) {
  state.manuscriptFind = {
    ...state.manuscriptFind,
    position: {
      left: Math.round(left),
      top: Math.round(top),
    },
  };

  const slot = document.querySelector("#find-slot");
  syncManuscriptFindSlotPosition(slot, state.manuscriptFind.position);
}

function clampManuscriptFindPosition(left, top, width, height) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, window.innerWidth - safeWidth - 12);
  const maxTop = Math.max(minTop, window.innerHeight - safeHeight - 12);

  return {
    left: Math.min(Math.max(minLeft, left), maxLeft),
    top: Math.min(Math.max(minTop, top), maxTop),
  };
}

function handleManuscriptFindPointerDown(event) {
  if (!state.manuscriptFind.open || event.button !== 0) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const dragHandle = target?.closest("[data-manuscript-find-drag-handle]");
  if (!(dragHandle instanceof HTMLElement)) {
    return;
  }

  const slot = dragHandle.closest("#find-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const rect = slot.getBoundingClientRect();
  manuscriptFindDragState = {
    pointerId: event.pointerId,
    slot,
    dragHandle,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  slot.classList.add("is-dragging");
  event.preventDefault();
  if (typeof dragHandle.setPointerCapture === "function") {
    try {
      dragHandle.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures; the document-level move/end handlers still work.
    }
  }
}

function handleManuscriptFindPointerMove(event) {
  if (!manuscriptFindDragState || event.pointerId !== manuscriptFindDragState.pointerId) {
    return;
  }

  const nextLeft = event.clientX - manuscriptFindDragState.offsetX;
  const nextTop = event.clientY - manuscriptFindDragState.offsetY;
  const clamped = clampManuscriptFindPosition(
    nextLeft,
    nextTop,
    manuscriptFindDragState.width,
    manuscriptFindDragState.height,
  );

  setManuscriptFindPosition(clamped.left, clamped.top);
  event.preventDefault();
}

function handleManuscriptFindPointerEnd(event) {
  if (!manuscriptFindDragState || event.pointerId !== manuscriptFindDragState.pointerId) {
    return;
  }

  const { slot, dragHandle, pointerId } = manuscriptFindDragState;
  slot.classList.remove("is-dragging");
  if (typeof dragHandle.releasePointerCapture === "function") {
    try {
      dragHandle.releasePointerCapture(pointerId);
    } catch {
      // Ignore release failures.
    }
  }

  manuscriptFindDragState = null;
}

function renderGrammarCheckPanel(options = {}) {
  const slot = document.querySelector("#grammar-check-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  hideGrammarCheckSuggestionMenu();
  const grammarCheckState = state.grammarCheckPanel ?? {};
  if (!grammarCheckState.open) {
    slot.innerHTML = "";
    return;
  }

  const selectedScene = getSelectedScene() ?? state.scenes[0] ?? null;
  const selectedSceneTitle = selectedScene?.sceneTitle ? String(selectedScene.sceneTitle) : "Selected scene";
  const selectedSceneChapter = selectedScene?.chapterTitle
    ? formatChapterDisplayTitle(selectedScene.chapterTitle)
    : "Current chapter";
  const entries = buildGrammarCheckEntries(selectedScene, getCurrentSpellcheckLexicons(), options);
  const previousList = slot.querySelector("[data-grammar-check-list]");
  const previousScrollTop = previousList instanceof HTMLElement ? previousList.scrollTop : 0;
  const previousScrollLeft = previousList instanceof HTMLElement ? previousList.scrollLeft : 0;
  const selectionAnchorIndex = Number.isInteger(grammarCheckState.selectionAnchorIndex)
    ? grammarCheckState.selectionAnchorIndex
    : null;
  const selectionSet = new Set(
    Array.isArray(grammarCheckState.selectedWords)
      ? grammarCheckState.selectedWords.map((word) => normalizeSpellcheckWord(word)).filter(Boolean)
      : [],
  );
  const selectedCount = entries.filter((entry) => selectionSet.has(entry.normalizedWord)).length;
  const panelBounds = normalizeGrammarCheckPanelBounds(
    grammarCheckState.bounds ?? state.editorPrefs?.grammarCheckPanelBounds,
    { viewport: getGrammarCheckPanelViewport() },
  );
  if (panelBounds) {
    state.grammarCheckPanel = setGrammarCheckPanelBoundsState(state.grammarCheckPanel, panelBounds, {
      viewport: getGrammarCheckPanelViewport(),
    });
  }
  syncGrammarCheckSlotBounds(slot, panelBounds, grammarCheckState.position);
  slot.innerHTML = renderGrammarCheckPanelHTML({
    selectedSceneId: selectedScene?.sceneId ?? "",
    selectedSceneTitle,
    selectedSceneChapter,
    entries,
    selectedCount,
    selectionSet,
    selectionAnchorIndex,
  });

  const nextList = slot.querySelector("[data-grammar-check-list]");
  if (nextList instanceof HTMLElement) {
    nextList.scrollTop = previousScrollTop;
    nextList.scrollLeft = previousScrollLeft;
  }
}

function syncGrammarCheckSlotBounds(slot, bounds = null, position = null) {
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const normalizedBounds = normalizeGrammarCheckPanelBounds(bounds, {
    viewport: getGrammarCheckPanelViewport(),
  });
  const left = Number(normalizedBounds?.left ?? position?.left);
  const top = Number(normalizedBounds?.top ?? position?.top);
  if (Number.isFinite(left) && Number.isFinite(top)) {
    slot.style.left = `${Math.round(left)}px`;
    slot.style.top = `${Math.round(top)}px`;
    slot.style.right = "auto";
    slot.style.transform = "none";
    if (normalizedBounds) {
      slot.style.width = `${Math.round(normalizedBounds.width)}px`;
      slot.style.height = `${Math.round(normalizedBounds.height)}px`;
      slot.classList.add("is-sized");
    } else {
      slot.style.removeProperty("width");
      slot.style.removeProperty("height");
      slot.classList.remove("is-sized");
    }
    return;
  }

  slot.style.removeProperty("left");
  slot.style.removeProperty("top");
  slot.style.removeProperty("right");
  slot.style.removeProperty("transform");
  slot.style.removeProperty("width");
  slot.style.removeProperty("height");
  slot.classList.remove("is-sized");
}

// Intent: let alternate spelling suggestions escape the scrollable word list without changing panel data.
function positionGrammarCheckSuggestionMenu(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const primarySuggestion = target.querySelector(".grammar-check-item__suggestion-primary");
  const suggestionMenu = target.querySelector(".grammar-check-item__suggestion-menu");
  if (!(primarySuggestion instanceof HTMLElement) || !(suggestionMenu instanceof HTMLElement)) {
    return false;
  }

  const primaryRect = primarySuggestion.getBoundingClientRect();
  if (!primaryRect.width || !primaryRect.height) {
    return false;
  }

  const top = Math.max(8, Math.round(primaryRect.bottom - 1));
  const availableHeight = Math.max(88, Math.round(window.innerHeight - top - 8));
  const floatingMenu = ensureGrammarCheckSuggestionMenu();
  target.classList.add("is-menu-active");
  floatingMenu.innerHTML = suggestionMenu.innerHTML;
  floatingMenu.classList.add("is-open");
  floatingMenu.style.setProperty("--grammar-check-suggestion-menu-left", `${Math.round(primaryRect.left)}px`);
  floatingMenu.style.setProperty("--grammar-check-suggestion-menu-top", `${top}px`);
  floatingMenu.style.setProperty("--grammar-check-suggestion-menu-width", `${Math.ceil(primaryRect.width)}px`);
  floatingMenu.style.setProperty("--grammar-check-suggestion-menu-max-height", `${availableHeight}px`);
  return true;
}

function deactivateGrammarCheckSuggestionMenu(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.classList.remove("is-menu-active");
  hideGrammarCheckSuggestionMenu();
}

function ensureGrammarCheckSuggestionMenu() {
  const existingMenu = document.querySelector("[data-grammar-check-floating-suggestion-menu]");
  if (existingMenu instanceof HTMLElement) {
    return existingMenu;
  }

  const floatingMenu = document.createElement("div");
  floatingMenu.className = "grammar-check-item__suggestion-menu grammar-check-item__suggestion-menu--portal";
  floatingMenu.setAttribute("role", "menu");
  floatingMenu.setAttribute("data-grammar-check-floating-suggestion-menu", "");
  document.body.appendChild(floatingMenu);
  return floatingMenu;
}

function hideGrammarCheckSuggestionMenu() {
  document.querySelectorAll("[data-grammar-check-floating-suggestion-menu]").forEach((menu) => {
    menu.remove();
  });
  document.querySelectorAll("[data-grammar-check-suggestion].is-menu-active").forEach((target) => {
    target.classList.remove("is-menu-active");
  });
}

function getGrammarCheckPanelViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getCurrentGrammarCheckPanelBounds(slot = document.querySelector("#grammar-check-slot")) {
  const viewport = getGrammarCheckPanelViewport();
  if (slot instanceof HTMLElement) {
    const rect = slot.getBoundingClientRect();
    const rectBounds = normalizeGrammarCheckPanelBounds({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }, { viewport });
    if (rectBounds) {
      return rectBounds;
    }
  }

  return normalizeGrammarCheckPanelBounds(
    state.grammarCheckPanel?.bounds ?? state.editorPrefs?.grammarCheckPanelBounds,
    { viewport },
  );
}

function setGrammarCheckPanelBounds(bounds) {
  state.grammarCheckPanel = setGrammarCheckPanelBoundsState(state.grammarCheckPanel, bounds, {
    viewport: getGrammarCheckPanelViewport(),
  });

  const slot = document.querySelector("#grammar-check-slot");
  syncGrammarCheckSlotBounds(slot, state.grammarCheckPanel.bounds, state.grammarCheckPanel.position);
  hideGrammarCheckSuggestionMenu();
}

function setGrammarCheckPanelPosition(left, top) {
  const slot = document.querySelector("#grammar-check-slot");
  const currentBounds = getCurrentGrammarCheckPanelBounds(slot);
  state.grammarCheckPanel = setGrammarCheckPanelPositionState(state.grammarCheckPanel, left, top, {
    width: currentBounds?.width,
    height: currentBounds?.height,
    viewport: getGrammarCheckPanelViewport(),
  });

  syncGrammarCheckSlotBounds(slot, state.grammarCheckPanel.bounds, state.grammarCheckPanel.position);
  hideGrammarCheckSuggestionMenu();
}

function handleGrammarCheckPointerDown(event) {
  if (grammarCheckPanelResizeController.begin(event) === true) {
    return;
  }

  grammarCheckPanelDragController.begin(event);
}

function handleGrammarCheckPointerMove(event) {
  if (grammarCheckPanelResizeController.move(event) === true) {
    return;
  }

  grammarCheckPanelDragController.move(event);
}

function handleGrammarCheckPointerEnd(event) {
  const resized = grammarCheckPanelResizeController.end(event);
  const dragged = grammarCheckPanelDragController.end(event);
  if (resized || dragged) {
    persistGrammarCheckPanelBoundsPreference({
      dirtyReason: resized ? "grammar-check-panel-resized" : "grammar-check-panel-moved",
      source: resized ? "handleGrammarCheckResizeEnd" : "handleGrammarCheckDragEnd",
    });
  }
}

function persistGrammarCheckPanelBoundsPreference(options = {}) {
  const bounds = getCurrentGrammarCheckPanelBounds();
  if (!bounds) {
    return;
  }

  const previousBounds = JSON.stringify(normalizeGrammarCheckPanelBounds(state.editorPrefs?.grammarCheckPanelBounds));
  state.grammarCheckPanel = setGrammarCheckPanelBoundsState(state.grammarCheckPanel, bounds, {
    viewport: getGrammarCheckPanelViewport(),
  });
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    grammarCheckPanelBounds: state.grammarCheckPanel.bounds,
  });
  const nextBounds = JSON.stringify(state.editorPrefs.grammarCheckPanelBounds);
  if (previousBounds === nextBounds) {
    return;
  }

  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "grammar-check-panel-layout-updated",
    source: options.source ?? "persistGrammarCheckPanelBoundsPreference",
  });
}

function syncGrammarCheckPanelBoundsToViewport() {
  if (!state.grammarCheckPanel?.open) {
    return;
  }

  const bounds = getCurrentGrammarCheckPanelBounds();
  if (!bounds) {
    return;
  }

  state.grammarCheckPanel = setGrammarCheckPanelBoundsState(state.grammarCheckPanel, bounds, {
    viewport: getGrammarCheckPanelViewport(),
  });
  const slot = document.querySelector("#grammar-check-slot");
  syncGrammarCheckSlotBounds(slot, state.grammarCheckPanel.bounds, state.grammarCheckPanel.position);
}

function toggleGrammarCheckPanel() {
  state.activePane = "manuscript";
  state.grammarCheckPanel = toggleGrammarCheckPanelState(state.grammarCheckPanel);
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function closeGrammarCheckPanel() {
  if (!state.grammarCheckPanel?.open) {
    return;
  }

  state.grammarCheckPanel = closeGrammarCheckPanelState(state.grammarCheckPanel);
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function updateGrammarCheckPanelSelection(nextSelectedWords, selectionAnchorIndex = null) {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
  state.grammarCheckPanel = updateGrammarCheckPanelSelectionState(
    state.grammarCheckPanel,
    entries,
    nextSelectedWords,
    selectionAnchorIndex,
  );
  renderGrammarCheckPanel();
}

function toggleGrammarCheckPanelWordSelection(word, entryIndex = -1, isShiftKey = false) {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
  const result = toggleGrammarCheckPanelWordSelectionState(
    state.grammarCheckPanel,
    entries,
    word,
    entryIndex,
    isShiftKey,
  );
  if (!result.changed) {
    return;
  }

  state.grammarCheckPanel = result.state;
  renderGrammarCheckPanel();
  focusGrammarCheckEntry(result.selectedEntry);
}

function selectAllGrammarCheckPanelWords() {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
  updateGrammarCheckPanelSelection(entries.map((entry) => entry.normalizedWord), null);
}

function clearGrammarCheckPanelSelection() {
  updateGrammarCheckPanelSelection([], null);
}

function syncGrammarCheckPanelHeaderState() {
  const grammarControl = document.querySelector(".grammar-check-compact");
  if (!(grammarControl instanceof HTMLElement)) {
    return;
  }

  const button = grammarControl.querySelector(".grammar-check-compact__status");
  const checkbox = grammarControl.querySelector("[data-editor-pref='grammarCheckEnabled']");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const grammarCheckEnabled = state.editorPrefs.grammarCheckEnabled !== false;
  const grammarCheckPanelOpen = Boolean(state.grammarCheckPanel?.open);
  const selectedScene = getSelectedScene() ?? state.scenes[0] ?? null;
  const summary = grammarCheckEnabled
    ? (buildGrammarCheckSummary(selectedScene, getCurrentSpellcheckLexicons())?.label ?? "0 flagged words")
    : "Live off";

  button.setAttribute("aria-pressed", grammarCheckPanelOpen ? "true" : "false");
  button.title = grammarCheckPanelOpen ? "Close grammar check list" : "Open grammar check list";
  button.textContent = summary;

  if (checkbox instanceof HTMLInputElement) {
    checkbox.checked = grammarCheckEnabled;
  }
}

function addSelectedGrammarCheckWordsToProjectDictionary() {
  const selectedWords = Array.isArray(state.grammarCheckPanel?.selectedWords)
    ? state.grammarCheckPanel.selectedWords
    : [];
  if (!selectedWords.length) {
    return;
  }

  const editorBookmark = captureManuscriptEditorBookmark();
  const changed = addGrammarCheckWordsToProjectList("dictionaryWords", selectedWords);
  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    selectedWords: [],
    selectionAnchorIndex: null,
  };

  if (changed) {
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  } else {
    renderGrammarCheckPanel();
  }

  if (editorBookmark) {
    window.requestAnimationFrame(() => {
      restoreManuscriptEditorBookmark(editorBookmark);
    });
  }
}

// Intent: approve a single grammar-check row as project vocabulary without using selection state.
function addGrammarCheckPanelWordToProjectDictionary(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const grammarCheckTarget = target.closest("[data-grammar-check-word]");
  if (!(grammarCheckTarget instanceof HTMLElement)) {
    return;
  }

  const sourceWord = String(
    target.dataset.grammarCheckDictionaryWord ||
    grammarCheckTarget.dataset.grammarCheckWord ||
    "",
  ).trim();
  const normalizedWord = normalizeSpellcheckWord(sourceWord);
  if (!normalizedWord) {
    return;
  }

  const editorBookmark = captureManuscriptEditorBookmark();
  const changed = applyGrammarCheckWordsToProjectList("dictionaryWords", [sourceWord]);
  hideSpellcheckContextMenu();
  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    selectedWords: Array.isArray(state.grammarCheckPanel?.selectedWords)
      ? state.grammarCheckPanel.selectedWords.filter((word) => normalizeSpellcheckWord(word) !== normalizedWord)
      : [],
    selectionAnchorIndex: null,
  };

  if (changed) {
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  } else {
    renderGrammarCheckPanel();
  }

  if (editorBookmark) {
    window.requestAnimationFrame(() => {
      restoreManuscriptEditorBookmark(editorBookmark);
    });
  }
}

function focusGrammarCheckEntry(entry) {
  if (!entry) {
    return;
  }

  const scene = getSelectedScene() ?? state.scenes[0] ?? null;
  const targetSceneId = String(scene?.sceneId ?? "");
  if (!targetSceneId) {
    return;
  }

  const startOffset = Number(entry.firstIndex);
  const endOffset = Number.isInteger(startOffset) ? startOffset + String(entry.word ?? "").length : NaN;
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    return;
  }

  takeToSceneRange(targetSceneId, startOffset, endOffset, { behavior: "smooth" });
}

function openManuscriptFind() {
  const editorBookmark = captureManuscriptEditorBookmark();
  const selectionText = getCurrentManuscriptSelectionText();
  state.activePane = "manuscript";
  state.manuscriptFind = manuscriptFindController.open(state.manuscriptFind, selectionText);
  render();
  renderManuscriptFindPanel();
  window.requestAnimationFrame(() => {
    restoreManuscriptEditorBookmark(editorBookmark);
    const field = document.querySelector("[data-find-field='manuscript-find-query']");
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      field.select();
    }
  });
}

function closeManuscriptFind() {
  if (!state.manuscriptFind.open) {
    return;
  }

  state.manuscriptFind = manuscriptFindController.close(state.manuscriptFind);
  clearTextareaRuntimeSelectionPreview(resolveTextareaEditorHost(getEditorTextareaForScene(state.selectedSceneId)));
  renderManuscriptFindPanel();
  window.requestAnimationFrame(() => {
    focusTextareaEditorHost(resolveTextareaEditorHost(getEditorTextareaForScene(state.selectedSceneId)));
  });
}

function captureManuscriptEditorBookmark() {
  const activeElement = document.activeElement;
  const textarea =
    activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
      ? activeElement
      : getEditorTextareaForScene(state.selectedSceneId);

  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const bookmark = captureTextareaEditorHostBookmark(resolveTextareaEditorHost(textarea));
  return manuscriptSelectionController.createBookmark({
    sceneId: bookmark?.sceneId,
    startOffset: bookmark?.selectionStart,
    endOffset: bookmark?.selectionEnd,
    scrollTop: bookmark?.codeframeScrollTop,
    scrollLeft: bookmark?.codeframeScrollLeft,
  });
}

function restoreManuscriptEditorBookmark(bookmark) {
  if (!bookmark || typeof bookmark.sceneId !== "string" || !bookmark.sceneId.trim()) {
    return;
  }

  const textarea = getEditorTextareaForScene(bookmark.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  restoreTextareaEditorHostBookmark(resolveTextareaEditorHost(textarea), bookmark);
}

function updateManuscriptFindField(findField, value) {
  const normalizedField = String(findField ?? "").trim();
  if (!normalizedField) {
    return;
  }

  state.manuscriptFind = manuscriptFindController.updateField(state.manuscriptFind, normalizedField, value);
  renderManuscriptFindPanel();
}

function moveManuscriptFindMatch(delta) {
  const result = manuscriptFindController.moveMatch(state.manuscriptFind, delta);
  if (!result.match) {
    renderManuscriptFindPanel();
    return;
  }

  state.manuscriptFind = result.state;
  renderManuscriptFindPanel();
  focusManuscriptFindMatchProjection(result.match, { behavior: "smooth" });
}

function navigateManuscriptFindMatch(index) {
  const result = manuscriptFindController.selectMatch(state.manuscriptFind, index);
  if (!result.match) {
    renderManuscriptFindPanel();
    return;
  }

  state.manuscriptFind = result.state;
  renderManuscriptFindPanel();
  focusManuscriptFindMatchProjection(result.match, {
    behavior: "smooth",
  });
}

// Intent: render the active find result as a disposable search projection without changing manuscript data.
function focusManuscriptFindMatchProjection(match, options = {}) {
  const scene = getScene(match?.sceneId);
  if (!scene) {
    return false;
  }

  if (state.selectedSceneId !== scene.sceneId) {
    selectSceneById(scene.sceneId);
    window.requestAnimationFrame(() => {
      focusManuscriptFindMatchProjection(match, options);
    });
    return true;
  }

  const textarea = getEditorTextareaForScene(scene.sceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return false;
  }

  const projection = selectManuscriptProjections({
    sceneId: scene.sceneId,
    text: textarea.value,
    searchPreviews: [{
      id: `${state.manuscriptFind.query}:${match.startOffset}:${match.endOffset}`,
      sceneId: scene.sceneId,
      startOffset: match.startOffset,
      endOffset: match.endOffset,
    }],
    includeAuthorMarks: false,
    includeDraftProofing: false,
    includeDiagnostics: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  }).find((candidate) => candidate.channel === MANUSCRIPT_PROJECTION_CHANNELS.SEARCH) ?? null;
  if (!showTextareaRuntimeSelectionPreview(editorHost, projection)) {
    return false;
  }

  scrollTextareaEditorHostToOffset(editorHost, match.startOffset, options);
  return true;
}

function replaceManuscriptFindCurrent() {
  const replacementPlan = manuscriptFindController.buildCurrentReplacement(state.manuscriptFind);
  if (!replacementPlan) {
    renderManuscriptFindPanel();
    return;
  }

  if (!replacementPlan.changed) {
    moveManuscriptFindMatch(1);
    return;
  }

  updateSceneDraft(replacementPlan.sceneId, (draft) => {
    draft.editorText = replacementPlan.nextText;
    draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, replacementPlan.previousText, replacementPlan.nextText);
  }, {
    reason: "manuscript-find-replace",
    immediate: true,
  });
  const textarea = getEditorTextareaForScene(replacementPlan.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = replacementPlan.nextText;
  }
  syncRevisionPanel(replacementPlan.sceneId);
  syncSceneDocumentLayout();
  renderManuscriptFindPanel();
  moveManuscriptFindMatch(1);
}

function replaceManuscriptFindAll() {
  const replacementPlans = manuscriptFindController.buildAllReplacements(state.manuscriptFind);
  if (!replacementPlans.length) {
    renderManuscriptFindPanel();
    return;
  }

  for (const replacementPlan of replacementPlans) {
    updateSceneDraft(replacementPlan.sceneId, (draft) => {
      draft.editorText = replacementPlan.nextText;
      draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, replacementPlan.previousText, replacementPlan.nextText);
    }, {
      reason: "manuscript-find-replace-all",
      immediate: true,
    });
    const textarea = getEditorTextareaForScene(replacementPlan.sceneId);
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = replacementPlan.nextText;
    }
    syncRevisionPanel(replacementPlan.sceneId);
  }

  syncSceneDocumentLayout();
  state.manuscriptFind = {
    ...state.manuscriptFind,
    activeIndex: 0,
  };
  renderManuscriptFindPanel();
}

function handleManuscriptFindWheel(event) {
  if (!state.manuscriptFind.open) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("[data-manuscript-find-results]")) {
    return;
  }

  const matches = manuscriptFindController.getMatches(state.manuscriptFind.query);
  if (matches.length <= 1) {
    return;
  }

  event.preventDefault();
  moveManuscriptFindMatch(event.deltaY > 0 ? 1 : -1);
}

function getCurrentManuscriptSelectionText() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement)) {
    return "";
  }

  if (!activeElement.classList.contains("editor-document-input")) {
    return "";
  }

  return manuscriptSelectionController.getSelectedText({
    text: activeElement.value,
    startOffset: activeElement.selectionStart,
    endOffset: activeElement.selectionEnd,
  });
}

// Intent: reflect the shared inline command state without re-rendering the whole manuscript panel on caret moves.
function updateInlineFormatToolbarState(textarea = null) {
  const activeTextarea = textarea instanceof HTMLTextAreaElement
    ? textarea
    : document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null;
  const inlineFormattingState = normalizeManuscriptInlineFormattingState(state.manuscriptInlineFormatting);
  const text = activeTextarea instanceof HTMLTextAreaElement ? String(activeTextarea.value ?? "") : "";
  const offset = activeTextarea instanceof HTMLTextAreaElement && Number.isInteger(activeTextarea.selectionStart)
    ? activeTextarea.selectionStart
    : 0;
  const sceneId = activeTextarea instanceof HTMLTextAreaElement ? String(activeTextarea.dataset.sceneId ?? "") : "";
  const ranges = getSceneInlineFormatRanges(sceneId, text.length);

  for (const formatId of Object.keys(INLINE_FORMATS)) {
    const isPending = inlineFormattingState.pendingFormats[formatId] === true;
    const isDecorationSwitch = AUTHOR_MARK_DECORATION_FORMAT_IDS.has(formatId);
    const isActive = isDecorationSwitch
      ? isPending
      : isPending || isInlineFormatActiveAtOffset(ranges, offset, formatId);
    const button = document.querySelector(`[data-action="toggle-inline-format"][data-inline-format="${CSS.escape(formatId)}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
  }

  const eraserButton = document.querySelector('[data-action="toggle-decoration-eraser"]');
  if (eraserButton instanceof HTMLButtonElement) {
    const isEraserActive = inlineFormattingState.pendingClearDecorations === true;
    eraserButton.setAttribute("aria-pressed", isEraserActive ? "true" : "false");
    eraserButton.classList.toggle("is-active", isEraserActive);
  }
}

// Intent: keep visual manuscript styling as scene-draft metadata instead of embedding markup in the manuscript text.
function getSceneInlineFormatRanges(sceneId, textLength = Number.POSITIVE_INFINITY) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return [];
  }

  return normalizeInlineFormatRanges(state.sceneDrafts?.[sceneId]?.inlineFormatRanges, textLength);
}

// Intent: keep the scene-editor word-count readouts live while the user types or changes a text selection.
function syncSceneEditorWordCountReadouts(textarea = null) {
  const activeTextarea = textarea instanceof HTMLTextAreaElement
    ? textarea
    : document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null;
  if (!(activeTextarea instanceof HTMLTextAreaElement) || !activeTextarea.classList.contains("editor-document-input")) {
    return;
  }

  const sceneId = String(activeTextarea.dataset.sceneId ?? "");
  if (!sceneId) {
    return;
  }

  const activeProjectIndex = getActiveProjectRecord()?.projectIndex ?? null;
  const sceneShell = document.querySelector(`[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`);
  if (!(sceneShell instanceof HTMLElement)) {
    return;
  }

  const scene = getScene(sceneId);
  const liveSceneWordCount = countWords(String(activeTextarea.value ?? ""));
  const chapterId = String(scene?.chapterId ?? "");
  const sceneWordCount = liveSceneWordCount;
  const chapterWordCount = adjustChapterWordCountForLiveScene({
    projectIndex: activeProjectIndex,
    chapterId,
    sceneId,
    liveSceneWordCount,
  });
  const selectionWordCount = getSceneEditorSelectionWordCount(activeTextarea);

  const sceneWordCountNode = sceneShell.querySelector("[data-scene-editor-scene-word-count]");
  if (sceneWordCountNode instanceof HTMLElement) {
    sceneWordCountNode.textContent = `Scene words: ${formatSceneEditorWordCount(sceneWordCount)}`;
  }

  const chapterWordCountNode = sceneShell.querySelector("[data-scene-editor-chapter-word-count]");
  if (chapterWordCountNode instanceof HTMLElement) {
    chapterWordCountNode.textContent = `Chapter words: ${formatSceneEditorWordCount(chapterWordCount)}`;
  }

  const selectionWordCountNode = sceneShell.querySelector("[data-scene-editor-selection-word-count]");
  if (selectionWordCountNode instanceof HTMLElement) {
    selectionWordCountNode.textContent = formatSceneEditorSelectionWordCount(selectionWordCount);
  }
}

function getSceneEditorSelectionWordCount(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return 0;
  }

  const startOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const endOffset = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : startOffset;
  if (endOffset <= startOffset) {
    return 0;
  }

  return countWords(String(textarea.value ?? "").slice(startOffset, endOffset));
}

function getNarrationMetadataScene() {
  return getSelectedScene() ?? state.scenes[0] ?? null;
}

function getNarrationSavedTakeCountForSelectedScene() {
  const scene = getNarrationMetadataScene();
  return scene ? createNarrationRecordingPreviewsForScene(state, scene).length : 0;
}

function renderNarrationMetadataSidePanel() {
  // Intent: route narration workflow metadata into the right console while the text host stays script-focused.
  const scene = getNarrationMetadataScene();
  const selection = scene && state.narrationTakeSelection?.sceneId === scene.sceneId
    ? state.narrationTakeSelection
    : null;
  const session = state.narrationTakeSession ?? null;
  const recordings = scene ? createDisplayNarrationRecordingPreviewsForScene(scene) : [];
  return renderNarrationMetadataPanelHTML({
    scene,
    selection,
    session,
    recordings,
    followSettings: state.narrationFollowSettings,
    playbackState: voiceRecordingPreviewController.getPlaybackState(),
  });
}

// Intent: derive display-only saved-take labels from current manuscript geometry without changing durable anchors.
function createDisplayNarrationRecordingPreviewsForScene(scene) {
  return createNarrationRecordingPreviewsForScene(state, scene)
    .map((recording) => enrichNarrationRecordingDisplayLineRange(scene, recording));
}

function enrichNarrationRecordingDisplayLineRange(scene, recording) {
  const lineRange = resolveNarrationRecordingDisplayLineRange(scene, recording);
  if (!lineRange) {
    return recording;
  }

  return {
    ...recording,
    displayLineNumber: lineRange.startLineNumber,
    displayStartLineNumber: lineRange.startLineNumber,
    displayEndLineNumber: lineRange.endLineNumber,
  };
}

function resolveNarrationRecordingDisplayLineRange(scene, recording) {
  if (!scene || !recording) {
    return null;
  }

  const textarea = getEditorTextareaForScene(scene.sceneId);
  const sceneText = textarea instanceof HTMLTextAreaElement
    ? String(textarea.value ?? "")
    : String(scene.editorText ?? "");
  const startOffset = Number.isInteger(recording.startOffset)
    ? clampEditorOffset(recording.startOffset, sceneText.length)
    : null;
  const endOffset = Number.isInteger(recording.endOffset)
    ? clampEditorOffset(recording.endOffset, sceneText.length)
    : startOffset;
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  if (textarea instanceof HTMLTextAreaElement && textarea.clientWidth > 0) {
    const editorHost = resolveTextareaEditorHost(textarea);
    const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
    const sceneMetrics = buildSceneLineMetrics(
      state.scenes,
      charactersPerLine,
      { [scene.sceneId]: sceneText },
    ).find((candidate) => candidate.sceneId === scene.sceneId);
    const baseLineNumber = sceneMetrics?.startLineNumber ?? 1;
    const endReferenceOffset = Math.max(startOffset, Math.min(sceneText.length, endOffset) - 1);
    return {
      startLineNumber: baseLineNumber + resolveTextareaVisualLineIndexForOffset(editorHost, startOffset),
      endLineNumber: baseLineNumber + resolveTextareaVisualLineIndexForOffset(editorHost, endReferenceOffset),
    };
  }

  const charactersPerLine = resolveNarrationRecordingFallbackCharactersPerLine();
  const sceneMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    { [scene.sceneId]: sceneText },
  ).find((candidate) => candidate.sceneId === scene.sceneId);
  const baseLineNumber = sceneMetrics?.startLineNumber ?? 1;
  return {
    startLineNumber: baseLineNumber + estimateTextareaVisualLineBeforeOffset(sceneText, startOffset, charactersPerLine),
    endLineNumber: baseLineNumber + estimateTextareaVisualLineBeforeOffset(sceneText, Math.max(startOffset, endOffset - 1), charactersPerLine),
  };
}

function resolveNarrationRecordingFallbackCharactersPerLine() {
  const editorWidth = Number(state.editorPrefs?.editorWidth);
  const fontSize = Number(state.editorPrefs?.fontSize);
  const contentWidth = Number.isFinite(editorWidth) && editorWidth > 0 ? editorWidth : 760;
  const resolvedFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18;
  const approximateCharacterWidth = Math.max(6, resolvedFontSize * 0.56);
  return Math.max(8, Math.floor(contentWidth / approximateCharacterWidth));
}

function renderSidePanelTabs() {
  if (state.activePane === "narration") {
    return renderSidePanelTabsHTML({
      activePanelId: NARRATION_AUDIO_PANEL_ID,
      visiblePanelIds: [NARRATION_AUDIO_PANEL_ID],
      counts: {
        [NARRATION_AUDIO_PANEL_ID]: getNarrationSavedTakeCountForSelectedScene(),
      },
      features: [{
        id: NARRATION_AUDIO_PANEL_ID,
        label: "Audio",
      }],
      showCreateButton: false,
    });
  }

  return renderSidePanelTabsHTML({
    activePanelId: state.sidePanelMode,
    visiblePanelIds: getVisibleSidePanelIds(state.sidePanelVisibility, getMetadataSidePanelIds()),
    counts: getSidePanelFeatureCounts(),
    features: getMetadataConsoleFeatures(),
    showCreateButton: true,
  });
}

function handleSidePanelTabsWheel(event) {
  const target = event.target instanceof Element ? event.target : null;
  const tabs = target?.closest("[data-side-panel-tabs]");
  if (!(tabs instanceof HTMLElement)) {
    return;
  }

  const canScroll = tabs.scrollWidth > tabs.clientWidth + 1;
  if (!canScroll) {
    return;
  }

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ? event.deltaX
    : event.deltaY;
  if (!delta) {
    return;
  }

  tabs.scrollLeft += delta;
  event.preventDefault();
}

function renderVisibleSidePanelBody() {
  const activeSidePanelId = state.activePane === "narration"
    ? NARRATION_AUDIO_PANEL_ID
    : state.sidePanelMode;
  const bodyHtml = state.activePane === "narration"
    ? renderNarrationMetadataSidePanel()
    : state.sidePanelMode === "issues"
    ? renderIssuePanelBody()
    : renderPassageNotePanel(state.sidePanelMode);
  return `
    <div class="side-panel-body" data-active-side-panel="${escapeHtml(activeSidePanelId)}">
      ${bodyHtml}
    </div>
  `;
}

function renderSidePanelCustomizationSurface() {
  return `
    ${renderSidePanelCustomizationPopoverHTML({
    open: state.sidePanelCustomizationOpen,
    position: state.sidePanelCustomizationPosition,
    visibility: state.sidePanelVisibility,
    counts: getSidePanelFeatureCounts(),
      features: getMetadataConsoleFeatures(),
    })}
    ${renderCustomMetadataFormHTML({
      open: state.customMetadataFormOpen,
      draft: {
        highlightColor: DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR,
      },
      error: state.customMetadataFormError,
    })}
  `;
}

function getSidePanelFeatureCounts() {
  const subgroupCounts = getMetadataSubgroupNoteCountsByGroup();
  const counts = {
    issues: getOpenManuscriptTasks().length,
    inspiration: state.passageNotes.filter((note) => note.noteType === "inspiration").length + (subgroupCounts.inspiration ?? 0),
    research: state.passageNotes.filter((note) => note.noteType === "research").length + (subgroupCounts.research ?? 0),
  };
  for (const definition of getCustomMetadataDefinitions()) {
    counts[definition.id] = state.passageNotes.filter((note) => note.noteType === definition.id).length + (subgroupCounts[definition.id] ?? 0);
  }
  return counts;
}

function getMetadataSubgroupNoteCountsByGroup() {
  return countMetadataSubgroupNotesByGroup(state.metadataSubgroups, getMetadataSubgroupGroupIds());
}

function syncSidePanelVisibilityRuntimeState() {
  state.customMetadataDefinitions = getCustomMetadataDefinitions();
  state.metadataSubgroups = normalizeMetadataSubgroups(state.metadataSubgroups, getMetadataSubgroupGroupIds());
  const panelIds = getMetadataSidePanelIds();
  state.sidePanelVisibility = createSidePanelVisibilityState(state.sidePanelVisibility, panelIds);
  if (!panelIds.includes(state.sidePanelMode)) {
    state.sidePanelMode = "issues";
  }

  const visiblePanelIds = getVisibleSidePanelIds(state.sidePanelVisibility, panelIds);
  const resolvedPanelMode = resolveVisibleSidePanelMode(state.sidePanelMode, state.sidePanelVisibility, panelIds);
  if (resolvedPanelMode) {
    state.sidePanelMode = resolvedPanelMode;
  }
  return visiblePanelIds;
}

function getCustomMetadataDefinitions() {
  state.customMetadataDefinitions = normalizeCustomMetadataDefinitions(state.customMetadataDefinitions);
  return state.customMetadataDefinitions;
}

function getMetadataConsoleFeatures() {
  return [
    ...SIDE_PANEL_FEATURES,
    ...buildCustomMetadataSidePanelFeatures(getCustomMetadataDefinitions()),
  ];
}

function getMetadataSidePanelIds() {
  return getMetadataConsoleFeatures().map((feature) => feature.id);
}

function getMetadataSubgroupGroupIds(customDefinitions = getCustomMetadataDefinitions()) {
  return [
    "inspiration",
    "research",
    ...normalizeCustomMetadataDefinitions(customDefinitions).map((definition) => definition.id),
  ];
}

function isPassageNoteSidePanelMode(panelId) {
  const normalizedPanelId = String(panelId ?? "").trim();
  return normalizedPanelId === "inspiration" ||
    normalizedPanelId === "research" ||
    getCustomMetadataDefinitions().some((definition) => definition.id === normalizedPanelId);
}

function getPassageNoteDisplayLabel(noteType) {
  return getMetadataNoteLabel(noteType, getCustomMetadataDefinitions());
}

function getCustomMetadataDefinitionFields(noteType) {
  const definition = findCustomMetadataDefinition(getCustomMetadataDefinitions(), noteType);
  return definition
    ? {
        metadataDefinitionId: definition.id,
        metadataLabel: definition.label,
        metadataHighlightColor: definition.highlightColor,
      }
    : {};
}

function renderIssuePanelBody() {
  const workspace = state.workspace;
  const openTasks = getOpenManuscriptTasks();

  return `
    ${renderTaskChapterList(openTasks)}
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Event Pinning</p>
      <h2>Major Story Beats</h2>
    </div>
    <div class="event-list">
      ${workspace.project.eventTags.map((eventTag) => renderEvent(eventTag)).join("")}
    </div>
  `;
}

function getOpenManuscriptTasks() {
  // Intent: use one task source for both the side-panel tab badge and the task console heading.
  return selectOpenManuscriptTasks(state.manuscriptTasks);
}

function renderPassageNotePanel(noteType) {
  const metadataSubgroupsHtml = renderMetadataSubgroupPanelHTML({
    groupId: noteType,
    subgroups: selectMetadataSubgroupsByGroupId(
      state.metadataSubgroups,
      noteType,
      getMetadataSubgroupGroupIds(),
    ),
    selectedNoteId: state.selectedMetadataSubgroupNoteId ?? "",
  });
  const panelModel = buildPassageNotePanelModel(
    state.passageNotes,
    noteType,
    groupScenesByChapter(state.scenes),
    {
      customMetadataDefinitions: getCustomMetadataDefinitions(),
    },
  );
  return renderPassageNotePanelHTML(panelModel, {
    selectedNoteId: state.selectedPassageNoteId,
    previewNoteId: state.taskPreview?.taskId,
    collapsedChapterIds: state.collapsedConsoleChapterIds?.[noteType],
    metadataSubgroupsHtml,
    formatChapterTitle: formatChapterDisplayTitle,
  });
}

function buildRevisionPanelModel() {
  return revisionPanelController.buildPanelModel(state.revisionState, state.revisionPanelState);
}

function getRevisionSessionCount() {
  return Array.isArray(state.revisionState?.sessions) ? state.revisionState.sessions.length : 0;
}

// Intent: render the standalone revisions window from the revision feature model without moving domain state into the shell.
function renderRevisionWindow() {
  const slot = document.querySelector("#revision-window-slot");
  if (!slot) {
    return;
  }

  slot.innerHTML = state.revisionWindowOpen
    ? renderRevisionWindowHTML(buildRevisionPanelModel())
    : "";
}

// Intent: keep the standalone revision window refreshed while preserving the shared revision model.
function renderRevisionWindowSurface({ renderChrome = false } = {}) {
  if (state.revisionWindowOpen) {
    renderRevisionWindow();
  }
  if (renderChrome) {
    renderHeader();
  }
}

function toggleRevisionWindow() {
  if (state.revisionWindowOpen) {
    closeRevisionWindow();
    return;
  }

  closeWritingTargetWindow();
  closeDraftProofSettingsWindow();
  closeLocalAiPanel();
  closeKeyboardShortcutSettingsWindow();
  closeSpotifyMusicPanel();
  ensureSelectedRevisionSession();
  state.revisionWindowOpen = true;
  revisionServiceLog.info("user-action", "revision.window.open", "Opened revisions window.", {
    projectId: state.activeProjectId ?? "",
    sessionCount: getRevisionSessionCount(),
  });
  renderHeader();
  renderRevisionWindow();
}

function closeRevisionWindow() {
  if (!state.revisionWindowOpen) {
    return;
  }

  state.revisionWindowOpen = false;
  revisionServiceLog.info("user-action", "revision.window.close", "Closed revisions window.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderRevisionWindow();
}

// Intent: render project-owned proof-read settings without moving durable run data into the chrome.
function renderDraftProofSettingsWindow() {
  const slot = document.querySelector("#draft-proof-settings-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = state.draftProofSettingsWindowOpen
    ? renderDraftProofSettingsWindowHTML({
        draftProofing: state.draftProofing,
        clearConfirmationArmed: state.draftProofClearConfirmationArmed,
        selectedRunId: state.draftProofSettingsSelectedRunId,
        activeTheme: resolveAppearanceTheme(state.editorPrefs?.appearanceMode),
      })
    : "";
}

function openDraftProofSettingsWindow() {
  if (state.draftProofSettingsWindowOpen) {
    renderDraftProofSettingsWindow();
    return;
  }

  closeWritingTargetWindow();
  closeRevisionWindow();
  closeLocalAiPanel();
  closeKeyboardShortcutSettingsWindow();
  closeSpotifyMusicPanel();
  state.draftProofSettingsWindowOpen = true;
  state.draftProofClearConfirmationArmed = false;
  state.draftProofSettingsSelectedRunId = resolveDraftProofSettingsRunId(
    state.draftProofing,
    state.draftProofSettingsSelectedRunId,
  );
  editorInteractionLog.info("user-action", "draft-proof.settings.open", "Opened proof-read settings.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderDraftProofSettingsWindow();
}

function closeDraftProofSettingsWindow() {
  if (!state.draftProofSettingsWindowOpen) {
    return;
  }

  state.draftProofSettingsWindowOpen = false;
  state.draftProofClearConfirmationArmed = false;
  state.draftProofSettingsSelectedRunId = "";
  editorInteractionLog.info("user-action", "draft-proof.settings.close", "Closed proof-read settings.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderDraftProofSettingsWindow();
}

// Intent: render desktop-backed Local AI model settings without giving browser code filesystem ownership.
function renderLocalAiPanel() {
  const slot = document.querySelector("#local-ai-panel-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = state.localAiPanelOpen
    ? renderLocalAiPanelHTML({
        localAiPrefs: state.localAiPrefs,
        modelLibrary: state.localAiModelLibrary,
        modelRootDraft: state.localAiModelRootDraft,
        statusMessage: state.localAiModelLibraryStatus,
        loading: state.localAiModelLibraryLoading,
      })
    : "";
}

async function openLocalAiPanel() {
  if (state.localAiPanelOpen) {
    renderLocalAiPanel();
    return;
  }

  closeWritingTargetWindow();
  closeRevisionWindow();
  closeDraftProofSettingsWindow();
  closeKeyboardShortcutSettingsWindow();
  closeSpotifyMusicPanel();
  state.localAiPanelOpen = true;
  editorInteractionLog.info("user-action", "local-ai.panel.open", "Opened Local AI model panel.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderLocalAiPanel();
  await refreshLocalAiModelLibrary();
}

function closeLocalAiPanel() {
  if (!state.localAiPanelOpen) {
    return;
  }

  state.localAiPanelOpen = false;
  state.localAiModelLibraryStatus = "";
  editorInteractionLog.info("user-action", "local-ai.panel.close", "Closed Local AI model panel.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderLocalAiPanel();
}

// Intent: render project-owned shortcut preferences without moving command execution into the window module.
function renderKeyboardShortcutSettingsWindow() {
  const slot = document.querySelector("#keyboard-shortcut-settings-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = state.keyboardShortcutSettingsWindowOpen
    ? renderKeyboardShortcutSettingsWindowHTML({
        settings: state.editorPrefs?.keyboardShortcuts,
        captureBehaviorId: state.keyboardShortcutCaptureBehaviorId,
        statusMessage: state.keyboardShortcutSettingsStatus,
      })
    : "";
}

// Intent: render the transient dictionary lookup window without persisting lookup state into projects.
function renderDictionaryLookupWindow() {
  const slot = document.querySelector("#dictionary-window-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = renderDictionaryWindowHTML(state.dictionaryLookup, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

function openDictionaryLookup(context = null, source = "contextmenu") {
  const lookupContext = buildDictionaryLookupContext({
    ...context,
    source,
  });
  if (!lookupContext) {
    return false;
  }

  const requestId = state.dictionaryLookupRequestId + 1;
  state.dictionaryLookupRequestId = requestId;
  clearSpellcheckHoverMenuHideTimer();
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.worldSpineContextMenu = null;
  state.dictionaryLookup = {
    ...lookupContext,
    status: "loading",
    entry: null,
    matchedWord: "",
    errorMessage: "",
  };
  renderTaskContextMenu();
  renderDictionaryLookupWindow();
  void resolveDictionaryLookupRequest(requestId, lookupContext);
  editorInteractionLog.info("user-action", "dictionary.lookup.open", "Opened dictionary lookup.", {
    word: lookupContext.word,
    sceneId: lookupContext.sceneId,
    source: lookupContext.source,
  });
  return true;
}

async function resolveDictionaryLookupRequest(requestId, lookupContext) {
  try {
    const lexicon = await ensureEnglishDefinitionLexicon();
    const result = await lookupEnglishDefinition(lexicon, lookupContext.normalizedWord);
    if (requestId !== state.dictionaryLookupRequestId || !state.dictionaryLookup) {
      return;
    }

    state.dictionaryLookup = {
      ...state.dictionaryLookup,
      status: result?.entry ? "found" : "not-found",
      entry: result?.entry ?? null,
      matchedWord: result?.matchedWord ?? "",
      errorMessage: "",
    };
    renderDictionaryLookupWindow();
  } catch (error) {
    if (requestId !== state.dictionaryLookupRequestId || !state.dictionaryLookup) {
      return;
    }

    state.dictionaryLookup = {
      ...state.dictionaryLookup,
      status: "error",
      entry: null,
      matchedWord: "",
      errorMessage: error instanceof Error ? error.message : "Dictionary definitions could not be loaded.",
    };
    renderDictionaryLookupWindow();
    editorInteractionLog.warn("user-action", "dictionary.lookup.error", "Dictionary lookup failed.", {
      word: lookupContext.word,
      error: state.dictionaryLookup.errorMessage,
    });
  }
}

function closeDictionaryWindow() {
  if (!state.dictionaryLookup) {
    return;
  }

  state.dictionaryLookup = null;
  state.dictionaryLookupRequestId += 1;
  renderDictionaryLookupWindow();
  editorInteractionLog.info("user-action", "dictionary.lookup.close", "Closed dictionary lookup.", {
    projectId: state.activeProjectId ?? "",
  });
}

function openDictionaryLookupFromMenuTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return openDictionaryLookup({
    word: target.dataset.dictionaryWord ?? "",
    normalizedWord: target.dataset.dictionaryNormalizedWord ?? "",
    sceneId: target.dataset.dictionarySceneId ?? "",
    startOffset: Number(target.dataset.dictionaryStartOffset),
    endOffset: Number(target.dataset.dictionaryEndOffset),
    x: Number(target.dataset.dictionaryX),
    y: Number(target.dataset.dictionaryY),
  }, "contextmenu");
}

function openDictionaryLookupFromShortcut(event) {
  const textarea = resolveManuscriptShortcutTextarea(event?.target);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const rect = textarea.getBoundingClientRect();
  const context = buildDictionaryShortcutContext(textarea, {
    x: Math.round(rect.left + Math.min(rect.width - 24, Math.max(24, rect.width * 0.58))),
    y: Math.round(rect.top + 76),
  });
  return openDictionaryLookup(context, "shortcut");
}

function openKeyboardShortcutSettingsWindow() {
  if (state.keyboardShortcutSettingsWindowOpen) {
    renderKeyboardShortcutSettingsWindow();
    return;
  }

  closeWritingTargetWindow();
  closeRevisionWindow();
  closeDraftProofSettingsWindow();
  closeLocalAiPanel();
  closeSpotifyMusicPanel();
  state.keyboardShortcutSettingsWindowOpen = true;
  state.keyboardShortcutCaptureBehaviorId = "";
  state.keyboardShortcutSettingsStatus = "";
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    keyboardShortcuts: normalizeKeyboardShortcutSettings(state.editorPrefs?.keyboardShortcuts),
  });
  editorInteractionLog.info("user-action", "keyboard-shortcuts.settings.open", "Opened keyboard shortcut settings.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderKeyboardShortcutSettingsWindow();
}

function closeKeyboardShortcutSettingsWindow() {
  if (!state.keyboardShortcutSettingsWindowOpen) {
    return;
  }

  state.keyboardShortcutSettingsWindowOpen = false;
  state.keyboardShortcutCaptureBehaviorId = "";
  state.keyboardShortcutSettingsStatus = "";
  editorInteractionLog.info("user-action", "keyboard-shortcuts.settings.close", "Closed keyboard shortcut settings.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderKeyboardShortcutSettingsWindow();
}

// Intent: start one explicit capture target so ordinary typing never rewrites the keymap.
function startKeyboardShortcutCapture(behaviorId) {
  const behavior = getKeyboardShortcutBehavior(behaviorId);
  if (!behavior) {
    state.keyboardShortcutSettingsStatus = "Shortcut behavior unavailable.";
    renderKeyboardShortcutSettingsWindow();
    return;
  }

  state.keyboardShortcutCaptureBehaviorId = behavior.id;
  state.keyboardShortcutSettingsStatus = `Capturing ${behavior.label}.`;
  renderKeyboardShortcutSettingsWindow();
  window.requestAnimationFrame(() => {
    const input = document.querySelector(`[data-keyboard-shortcut-input="${CSS.escape(behavior.id)}"]`);
    if (input instanceof HTMLInputElement) {
      input.focus({ preventScroll: true });
      input.select();
    }
  });
}

// Intent: consume keypresses while capture mode is active before global shortcuts or feature controllers see them.
function handleKeyboardShortcutCapture(event) {
  const behaviorId = state.keyboardShortcutCaptureBehaviorId;
  if (!behaviorId) {
    return false;
  }

  const behavior = getKeyboardShortcutBehavior(behaviorId);
  const result = captureKeyboardShortcutFromEvent(event);
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }

  if (!behavior) {
    state.keyboardShortcutCaptureBehaviorId = "";
    state.keyboardShortcutSettingsStatus = "Shortcut behavior unavailable.";
    renderKeyboardShortcutSettingsWindow();
    return true;
  }

  if (result.status === "pending") {
    return true;
  }

  if (result.status === "cancelled") {
    state.keyboardShortcutCaptureBehaviorId = "";
    state.keyboardShortcutSettingsStatus = result.message;
    renderKeyboardShortcutSettingsWindow();
    return true;
  }

  if (result.status === "invalid") {
    state.keyboardShortcutSettingsStatus = result.message;
    renderKeyboardShortcutSettingsWindow();
    return true;
  }

  const conflict = findKeyboardShortcutConflict(
    state.editorPrefs?.keyboardShortcuts,
    behavior.id,
    result.shortcut,
  );
  if (conflict) {
    state.keyboardShortcutSettingsStatus = `${result.shortcut} is already assigned to ${conflict.label}.`;
    renderKeyboardShortcutSettingsWindow();
    return true;
  }

  setKeyboardShortcutPreference(behavior.id, result.shortcut, {
    statusMessage: `${behavior.label} set to ${result.shortcut}.`,
    dirtyReason: "keyboard-shortcut-updated",
  });
  state.keyboardShortcutCaptureBehaviorId = "";
  renderKeyboardShortcutSettingsWindow();
  return true;
}

// Intent: persist shortcut mutations through editorPrefs so project-file saves carry user keymaps.
function setKeyboardShortcutPreference(behaviorId, shortcut, options = {}) {
  const behavior = getKeyboardShortcutBehavior(behaviorId);
  if (!behavior) {
    state.keyboardShortcutSettingsStatus = "Shortcut behavior unavailable.";
    renderKeyboardShortcutSettingsWindow();
    return false;
  }

  const result = setKeyboardShortcutBinding(state.editorPrefs?.keyboardShortcuts, behavior.id, shortcut);
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    keyboardShortcuts: result.settings,
  });
  state.keyboardShortcutSettingsStatus = options.statusMessage ?? `${behavior.label} shortcut updated.`;
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "keyboard-shortcuts-updated",
    source: "setKeyboardShortcutPreference",
  });
  editorInteractionLog.info("user-action", "keyboard-shortcuts.settings.update", "Updated keyboard shortcut binding.", {
    projectId: state.activeProjectId ?? "",
    behaviorId: behavior.id,
    shortcut: result.settings.bindings[behavior.id] ?? "",
    changed: result.changed,
  });
  return result.changed;
}

// Intent: clear a single behavior while keeping the rest of the project keymap intact.
function clearKeyboardShortcutBinding(behaviorId) {
  const behavior = getKeyboardShortcutBehavior(behaviorId);
  if (!behavior) {
    state.keyboardShortcutSettingsStatus = "Shortcut behavior unavailable.";
    renderKeyboardShortcutSettingsWindow();
    return;
  }

  state.keyboardShortcutCaptureBehaviorId = "";
  setKeyboardShortcutPreference(behavior.id, "", {
    statusMessage: `${behavior.label} unassigned.`,
    dirtyReason: "keyboard-shortcut-cleared",
  });
  renderKeyboardShortcutSettingsWindow();
}

// Intent: restore one behavior default unless another customized binding already owns that key.
function resetKeyboardShortcutPreference(behaviorId) {
  const behavior = getKeyboardShortcutBehavior(behaviorId);
  if (!behavior) {
    state.keyboardShortcutSettingsStatus = "Shortcut behavior unavailable.";
    renderKeyboardShortcutSettingsWindow();
    return;
  }

  const conflict = findKeyboardShortcutConflict(
    state.editorPrefs?.keyboardShortcuts,
    behavior.id,
    behavior.defaultShortcut,
  );
  if (conflict) {
    state.keyboardShortcutSettingsStatus = `${behavior.defaultShortcut} is already assigned to ${conflict.label}.`;
    state.keyboardShortcutCaptureBehaviorId = "";
    renderKeyboardShortcutSettingsWindow();
    return;
  }

  const result = resetKeyboardShortcutBinding(state.editorPrefs?.keyboardShortcuts, behavior.id);
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    keyboardShortcuts: result.settings,
  });
  state.keyboardShortcutCaptureBehaviorId = "";
  state.keyboardShortcutSettingsStatus = `${behavior.label} reset to ${behavior.defaultShortcut}.`;
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "keyboard-shortcut-reset",
    source: "resetKeyboardShortcutPreference",
  });
  renderKeyboardShortcutSettingsWindow();
}

// Intent: restore all built-in bindings as one explicit user-settings action.
function resetAllKeyboardShortcutPreferences() {
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    keyboardShortcuts: resetKeyboardShortcutSettings(),
  });
  state.keyboardShortcutCaptureBehaviorId = "";
  state.keyboardShortcutSettingsStatus = "Shortcuts reset.";
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "keyboard-shortcuts-reset",
    source: "resetAllKeyboardShortcutPreferences",
  });
  renderKeyboardShortcutSettingsWindow();
}

async function refreshLocalAiModelLibrary() {
  if (!state.localAiPanelOpen) {
    return;
  }

  state.localAiModelLibraryLoading = true;
  state.localAiModelLibraryStatus = "Scanning model folders";
  renderLocalAiPanel();
  const result = await localAiModelLibraryClient.loadModelLibrary();
  applyLocalAiModelLibraryResult(result, {
    successMessage: "Model folders scanned",
  });
}

async function saveLocalAiModelSettings() {
  if (!state.localAiPanelOpen) {
    return;
  }

  const modelRoot = state.localAiModelRootDraft || state.localAiModelLibrary?.modelRoot || "";
  state.localAiModelLibraryLoading = true;
  state.localAiModelLibraryStatus = "Saving model folder";
  renderLocalAiPanel();
  const result = await localAiModelLibraryClient.saveModelSettings({
    modelRoot,
    executionMode: "local-only",
  });
  applyLocalAiModelLibraryResult(result, {
    successMessage: "Model folder saved",
  });
}

async function ensureLocalAiModelFolders() {
  if (!state.localAiPanelOpen) {
    return;
  }

  const modelRoot = state.localAiModelRootDraft || state.localAiModelLibrary?.modelRoot || "";
  state.localAiModelLibraryLoading = true;
  state.localAiModelLibraryStatus = "Creating model folders";
  renderLocalAiPanel();
  const result = await localAiModelLibraryClient.ensureModelFolders({
    modelRoot,
    executionMode: "local-only",
  });
  applyLocalAiModelLibraryResult(result, {
    successMessage: "Model folders ready",
  });
}

function applyLocalAiModelLibraryResult(result, {
  successMessage,
} = {}) {
  // Intent: keep desktop bridge failures visible in the panel without blocking other editor workflows.
  state.localAiModelLibraryLoading = false;
  if (!result?.ok) {
    state.localAiModelLibraryStatus = result?.message ?? "Local AI model library unavailable";
    renderLocalAiPanel();
    return;
  }

  state.localAiModelLibrary = result.modelLibrary ?? state.localAiModelLibrary;
  state.localAiModelRootDraft = state.localAiModelLibrary?.modelRoot ?? state.localAiModelRootDraft;
  state.localAiModelLibraryStatus = successMessage ?? "Local AI model library updated";
  renderLocalAiPanel();
}

// Intent: keep Spotify as a top-chrome integration surface without making it a Metadata Console mode.
function renderSpotifyMusicSurface() {
  renderHeader();
  syncSpotifyPlaybackProgressDom({ preserveActiveSeek: false });
  syncSpotifyPlaybackPositionTicker();
}

function toggleSpotifyMusicPanel() {
  if (state.spotifyMusicPanelOpen) {
    closeSpotifyMusicPanel();
    return;
  }

  openSpotifyMusicPanel();
}

function openSpotifyMusicPanel() {
  if (state.spotifyMusicPanelOpen) {
    renderSpotifyMusicSurface();
    return;
  }

  hideFileMenu();
  hideProjectSettingsMenu();
  hideDeveloperOptionsMenu();
  closeWritingTargetWindow();
  closeRevisionWindow();
  closeDraftProofSettingsWindow();
  closeLocalAiPanel();
  closeKeyboardShortcutSettingsWindow();
  state.spotifyMusicPanelOpen = true;
  spotifyMusicLog.info("user-action", "spotify.panel.open", "Opened Spotify music panel.", {
    projectId: state.activeProjectId ?? "",
  });
  renderSpotifyMusicSurface();
}

function closeSpotifyMusicPanel() {
  if (!state.spotifyMusicPanelOpen) {
    return;
  }

  state.spotifyMusicPanelOpen = false;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    accountMenuOpen: false,
  });
  spotifyMusicLog.info("user-action", "spotify.panel.close", "Closed Spotify music panel.", {
    projectId: state.activeProjectId ?? "",
  });
  renderSpotifyMusicSurface();
}

// Intent: keep Spotify account state machine-local so queue access never becomes project data.
function initializeSpotifyMusicState() {
  const storedClientId = loadStoredString(SPOTIFY_MUSIC_CLIENT_ID_STORAGE_KEY) ?? "";
  const desktopClientId = String(state.spotifyMusicDesktopClientId ?? "").trim();
  const clientId = storedClientId || desktopClientId;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    clientId,
    clientIdDraft: state.spotifyMusic?.clientIdDraft || clientId,
    clientIdSource: storedClientId ? "manual" : desktopClientId ? "desktop" : "",
    redirectUri: spotifyMusicService.resolveRedirectUri(window.location.href),
    token: spotifyMusicService.getStoredToken(),
  });
}

function hydrateSpotifyMusicPlaybackFromStoredSnapshot() {
  const resumeState = spotifyMusicService.getStoredPlaybackState();
  if (!resumeState?.currentTrack?.uri || !state.spotifyMusic?.token?.accessToken) {
    return null;
  }

  const title = resumeState.currentTrack.title || "track";
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackCurrentTrack: resumeState.currentTrack,
    playbackCurrentPlaylist: resumeState.currentPlaylist,
    playbackContextUri: resumeState.contextUri,
    playbackPaused: resumeState.paused,
    playbackPositionMs: resumeState.positionMs,
    playbackDurationMs: resumeState.durationMs,
    playbackStateUpdatedAt: resumeState.savedAt,
    playbackStatus: resumeState.paused
      ? `Ready to resume ${title}.`
      : `Restoring ${title} after refresh...`,
  });
  return resumeState;
}

function createSpotifyMusicPlaybackSnapshotCandidate() {
  const spotifyState = state.spotifyMusic ?? {};
  const currentTrack = spotifyState.playbackCurrentTrack;
  if (!currentTrack?.uri) {
    return null;
  }

  const savedAt = Date.now();
  const lastStateAt = Math.max(0, Math.round(Number(spotifyState.playbackStateUpdatedAt) || 0));
  const durationMs = Math.max(0, Math.round(Number(
    spotifyState.playbackDurationMs
    || currentTrack.durationMs
  ) || 0));
  const basePositionMs = Math.max(0, Math.round(Number(spotifyState.playbackPositionMs) || 0));
  const elapsedMs = spotifyState.playbackPaused === true || !lastStateAt
    ? 0
    : Math.max(0, savedAt - lastStateAt);
  const estimatedPositionMs = basePositionMs + elapsedMs;
  const positionMs = durationMs > 0
    ? Math.min(estimatedPositionMs, durationMs)
    : estimatedPositionMs;

  return {
    playbackCurrentTrack: currentTrack,
    playbackCurrentPlaylist: spotifyState.playbackCurrentPlaylist,
    playbackContextUri: spotifyState.playbackContextUri,
    playbackPaused: spotifyState.playbackPaused === true,
    playbackPositionMs: positionMs,
    playbackDurationMs: durationMs,
    playbackStateUpdatedAt: savedAt,
  };
}

function persistSpotifyMusicPlaybackSnapshot({ reason = "runtime" } = {}) {
  const snapshot = createSpotifyMusicPlaybackSnapshotCandidate();
  if (!snapshot) {
    return null;
  }

  const savedState = spotifyMusicService.savePlaybackState(snapshot);
  if (savedState && reason !== "pagehide") {
    spotifyMusicLog.debug("file-access", "spotify.playback.snapshot.save", "Stored Spotify playback resume point.", {
      positionMs: savedState.positionMs,
      reason,
      trackUri: savedState.trackUri,
    });
  }
  return savedState;
}

async function restoreSpotifyMusicPlaybackFromStoredSnapshot({
  force = false,
  openPanel = false,
  reason = "runtime",
} = {}) {
  const resumeState = spotifyMusicService.getStoredPlaybackState();
  if (!resumeState?.currentTrack?.uri) {
    return {
      ok: false,
      skipped: true,
      message: "No saved Spotify playback point.",
    };
  }
  if (!force && resumeState.paused === true) {
    return {
      ok: false,
      skipped: true,
      message: "Spotify playback was paused before refresh.",
    };
  }

  if (openPanel) {
    state.spotifyMusicPanelOpen = true;
  }

  const title = resumeState.currentTrack.title || "track";
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackCurrentTrack: resumeState.currentTrack,
    playbackCurrentPlaylist: resumeState.currentPlaylist,
    playbackContextUri: resumeState.contextUri,
    playbackPaused: resumeState.paused,
    playbackPositionMs: resumeState.positionMs,
    playbackDurationMs: resumeState.durationMs,
    playbackStatus: `Restoring ${title}...`,
  });
  renderSpotifyMusicSurface();

  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return tokenResult;
  }
  if (!spotifyMusicService.hasPlaybackScope(tokenResult.token)) {
    const message = "Reconnect Spotify to grant in-app playback.";
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: message,
    });
    renderSpotifyMusicSurface();
    return {
      ok: false,
      message,
    };
  }

  const playerResult = await startSpotifyInAppPlayer({
    openPanel,
    statusText: "Reconnecting ABE player...",
  });
  if (!playerResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: playerResult.message,
    });
    renderSpotifyMusicSurface();
    return playerResult;
  }

  const contextUri = String(resumeState.contextUri || resumeState.playlistUri || "").trim();
  const result = contextUri.startsWith("spotify:playlist:")
    ? await spotifyMusicService.startPlaylistPlayback({
      accessToken: tokenResult.token.accessToken,
      deviceId: playerResult.deviceId,
      playlistUri: contextUri,
      positionMs: resumeState.positionMs,
      trackUri: resumeState.trackUri,
    })
    : await spotifyMusicService.startTrackPlayback({
      accessToken: tokenResult.token.accessToken,
      deviceId: playerResult.deviceId,
      positionMs: resumeState.positionMs,
      trackUri: resumeState.trackUri,
    });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackCurrentTrack: resumeState.currentTrack,
    playbackCurrentPlaylist: resumeState.currentPlaylist,
    playbackContextUri: contextUri,
    playbackPaused: result.ok ? false : state.spotifyMusic.playbackPaused,
    playbackPositionMs: resumeState.positionMs,
    playbackDurationMs: resumeState.durationMs,
    playbackReady: result.ok || state.spotifyMusic.playbackReady,
    playbackDeviceId: playerResult.deviceId,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.ok ? `Resumed ${title}.` : result.message,
  });
  if (result.ok) {
    persistSpotifyMusicPlaybackSnapshot({ reason: `restore-${reason}` });
  }
  spotifyMusicLog.info("user-action", "spotify.playback.restore", "Restored Spotify playback after refresh.", {
    ok: result.ok === true,
    reason,
    trackUri: resumeState.trackUri,
  });
  renderSpotifyMusicSurface();
  return result;
}

async function completeSpotifyAuthorizationFromCurrentLocation() {
  initializeSpotifyMusicState();
  if (!spotifyMusicService.hasAuthorizationResponse(window.location.href)) {
    return;
  }

  state.spotifyMusicPanelOpen = true;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    authBusy: true,
    authStatus: "Connecting Spotify...",
  });
  const result = await spotifyMusicService.exchangeAuthorizationCode({
    clientId: state.spotifyMusic.clientId,
    redirectUri: state.spotifyMusic.redirectUri,
    href: window.location.href,
  });
  const profileResult = result.ok
    ? await spotifyMusicService.loadCurrentUserProfile({
      accessToken: result.token.accessToken,
    })
    : null;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    token: result.ok ? result.token : null,
    currentUserId: profileResult?.ok ? profileResult.userId : state.spotifyMusic.currentUserId,
    currentUserDisplayName: profileResult?.ok ? profileResult.displayName : state.spotifyMusic.currentUserDisplayName,
    currentUserImageUrl: profileResult?.ok ? profileResult.imageUrl : state.spotifyMusic.currentUserImageUrl,
    currentUserExternalUrl: profileResult?.ok ? profileResult.externalUrl : state.spotifyMusic.currentUserExternalUrl,
    authBusy: false,
    authStatus: result.message,
  });
  if (result.cleanUrl && window.history?.replaceState) {
    window.history.replaceState({}, document.title, result.cleanUrl);
  }
  spotifyMusicLog.info("user-action", "spotify.authorization.callback", "Handled Spotify authorization callback.", {
    ok: result.ok === true,
    handled: result.handled === true,
  });
}

async function refreshSpotifyMusicProfileFromCurrentToken() {
  if (!state.spotifyMusic?.token?.accessToken) {
    return;
  }

  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    return;
  }

  const profileResult = await spotifyMusicService.loadCurrentUserProfile({
    accessToken: tokenResult.token.accessToken,
  });
  if (!profileResult.ok) {
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    currentUserId: profileResult.userId,
    currentUserDisplayName: profileResult.displayName,
    currentUserImageUrl: profileResult.imageUrl,
    currentUserExternalUrl: profileResult.externalUrl,
  });
}

function updateSpotifyClientIdDraft(value) {
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    clientIdDraft: value,
    authStatus: "",
  });
}

function updateSpotifySearchQuery(value) {
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    query: value,
    sourceMode: "search",
    searchStatus: "",
  });
}

function setSpotifyMusicSource(sourceMode) {
  const normalizedSourceMode = sourceMode === "playlists" ? "playlists" : "search";
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: normalizedSourceMode,
    searchStatus: "",
    playlistStatus: "",
  });
  renderSpotifyMusicSurface();

  // Intent: make the playlist surface useful on first open without persisting library data to the project.
  if (
    normalizedSourceMode === "playlists"
    && state.spotifyMusic.playlistResults.length === 0
    && !state.spotifyMusic.playlistBusy
  ) {
    void loadSpotifyMusicPlaylists();
  }
}

function saveSpotifyClientId() {
  const clientId = String(state.spotifyMusic?.clientIdDraft ?? "").trim();
  const desktopClientId = String(state.spotifyMusicDesktopClientId ?? "").trim();
  const resolvedClientId = clientId || desktopClientId;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    clientId: resolvedClientId,
    clientIdDraft: clientId || resolvedClientId,
    clientIdSource: clientId ? "manual" : desktopClientId ? "desktop" : "",
    authStatus: resolvedClientId ? "Spotify app ID ready." : "Spotify app setup required before sign-in.",
  });
  writeStoredJsonRaw(SPOTIFY_MUSIC_CLIENT_ID_STORAGE_KEY, clientId);
  renderSpotifyMusicSurface();
}

async function connectSpotifyMusicAccount() {
  saveSpotifyClientId();
  state.spotifyMusicPanelOpen = true;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    authBusy: true,
    authStatus: "Opening Spotify...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.beginAuthorization({
    clientId: state.spotifyMusic.clientId,
    redirectUri: state.spotifyMusic.redirectUri,
  });
  if (!result.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      authBusy: false,
      authStatus: result.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  spotifyMusicLog.info("user-action", "spotify.authorization.start", "Redirecting to Spotify authorization.", {
    scope: result.scope,
  });
  window.location.assign(result.authorizationUrl);
}

function disconnectSpotifyMusicAccount() {
  spotifyMusicService.clearToken();
  spotifyMusicService.clearPlaybackState();
  spotifyMusicService.disconnectWebPlayback();
  stopSpotifyPlaybackPositionTicker();
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    token: null,
    currentUserId: "",
    currentUserDisplayName: "",
    currentUserImageUrl: "",
    currentUserExternalUrl: "",
    accountMenuOpen: false,
    searchResults: [],
    playlistResults: [],
    playlistTrackResults: [],
    selectedPlaylistId: "",
    selectedPlaylistName: "",
    queueHistory: [],
    authStatus: "Spotify disconnected.",
    searchStatus: "",
    playlistStatus: "",
    tempoStatus: "",
    queueStatus: "",
    playbackStatus: "",
    playbackDeviceId: "",
    playbackReady: false,
    playbackConnecting: false,
    playbackBusyPlaylistUri: "",
    playbackCurrentTrack: null,
    playbackCurrentPlaylist: null,
    playbackContextUri: "",
    playbackPositionMs: 0,
    playbackDurationMs: 0,
    playbackStateUpdatedAt: 0,
    playbackControlBusy: false,
  });
  renderSpotifyMusicSurface();
}

function toggleSpotifyMusicAccountMenu() {
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    accountMenuOpen: !state.spotifyMusic?.accountMenuOpen,
  });
  renderSpotifyMusicSurface();
}

async function searchSpotifyMusicTracks() {
  state.spotifyMusicPanelOpen = true;
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      searchStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: "search",
    searchBusy: true,
    searchStatus: "Searching Spotify...",
    tempoStatus: "",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.searchTracks({
    accessToken: tokenResult.token.accessToken,
    query: state.spotifyMusic.query,
  });
  const tempoResult = result.ok
    ? await spotifyMusicService.enrichTracksWithTempo({
      accessToken: tokenResult.token.accessToken,
      tracks: result.tracks,
    })
    : null;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    searchBusy: false,
    searchResults: result.ok ? tempoResult.tracks : state.spotifyMusic.searchResults,
    searchStatus: result.message,
    tempoStatus: tempoResult?.message ?? state.spotifyMusic.tempoStatus,
  });
  spotifyMusicLog.info("user-action", "spotify.search", "Searched Spotify tracks.", {
    ok: result.ok === true,
    queryLength: state.spotifyMusic.query.length,
    trackCount: result.tracks?.length ?? 0,
    tempoReady: tempoResult?.tempoReference?.count ?? 0,
  });
  renderSpotifyMusicSurface();
}

async function loadSpotifyMusicPlaylists() {
  state.spotifyMusicPanelOpen = true;
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      sourceMode: "playlists",
      playlistStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  if (!spotifyMusicService.hasPlaylistScope(tokenResult.token)) {
    const message = "Reconnect Spotify to grant playlist browsing.";
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      sourceMode: "playlists",
      playlistStatus: message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    accountMenuOpen: false,
    sourceMode: "playlists",
    playlistBusy: true,
    playlistStatus: "Loading Spotify playlists...",
  });
  renderSpotifyMusicSurface();
  const profileResult = await spotifyMusicService.loadCurrentUserProfile({
    accessToken: tokenResult.token.accessToken,
  });
  const result = await spotifyMusicService.loadPlaylists({
    accessToken: tokenResult.token.accessToken,
    currentUserId: profileResult.userId,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: "playlists",
    currentUserId: profileResult.ok ? profileResult.userId : state.spotifyMusic.currentUserId,
    currentUserDisplayName: profileResult.ok ? profileResult.displayName : state.spotifyMusic.currentUserDisplayName,
    currentUserImageUrl: profileResult.ok ? profileResult.imageUrl : state.spotifyMusic.currentUserImageUrl,
    currentUserExternalUrl: profileResult.ok ? profileResult.externalUrl : state.spotifyMusic.currentUserExternalUrl,
    playlistBusy: false,
    playlistResults: result.ok ? result.playlists : state.spotifyMusic.playlistResults,
    playlistStatus: result.ok && result.playlists.some((playlist) => playlist.canReadTracks === false)
      ? `${result.message} Some followed playlists are limited by Spotify.`
      : result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playlists.load", "Loaded Spotify playlists.", {
    ok: result.ok === true,
    playlistCount: result.playlists?.length ?? 0,
    limitedCount: result.playlists?.filter((playlist) => playlist.canReadTracks === false).length ?? 0,
  });
  renderSpotifyMusicSurface();
}

async function loadSpotifyMusicPlaylistTracks(playlistId) {
  state.spotifyMusicPanelOpen = true;
  const selectedPlaylist = state.spotifyMusic.playlistResults.find((playlist) => playlist.id === playlistId) ?? null;
  if (selectedPlaylist?.canReadTracks === false) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      sourceMode: "playlists",
      selectedPlaylistId: playlistId,
      selectedPlaylistName: selectedPlaylist.title,
      playlistTrackResults: [],
      playlistStatus: SPOTIFY_LIMITED_PLAYLIST_MESSAGE,
    });
    renderSpotifyMusicSurface();
    return;
  }

  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      sourceMode: "playlists",
      playlistStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  if (!spotifyMusicService.hasPlaylistScope(tokenResult.token)) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      sourceMode: "playlists",
      playlistStatus: "Reconnect Spotify to grant playlist browsing.",
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: "playlists",
    selectedPlaylistId: playlistId,
    selectedPlaylistName: selectedPlaylist?.title ?? state.spotifyMusic.selectedPlaylistName,
    playlistTracksBusy: true,
    playlistStatus: selectedPlaylist ? `Loading ${selectedPlaylist.title}...` : "Loading playlist tracks...",
    tempoStatus: "",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.loadPlaylistTracks({
    accessToken: tokenResult.token.accessToken,
    playlistId,
  });
  const tempoResult = result.ok
    ? await spotifyMusicService.enrichTracksWithTempo({
      accessToken: tokenResult.token.accessToken,
      tracks: result.tracks,
    })
    : null;
  const limitedPlaylist = !result.ok && isSpotifyLimitedPlaylistResponse(result.message);
  const playlistResults = limitedPlaylist
    ? markSpotifyPlaylistTracksLimited(state.spotifyMusic.playlistResults, playlistId)
    : state.spotifyMusic.playlistResults;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: "playlists",
    selectedPlaylistId: playlistId,
    selectedPlaylistName: selectedPlaylist?.title ?? state.spotifyMusic.selectedPlaylistName,
    playlistTracksBusy: false,
    playlistResults,
    playlistTrackResults: result.ok ? tempoResult.tracks : limitedPlaylist ? [] : state.spotifyMusic.playlistTrackResults,
    playlistStatus: normalizeSpotifyPlaylistFailureMessage(result.message),
    tempoStatus: tempoResult?.message ?? state.spotifyMusic.tempoStatus,
  });
  spotifyMusicLog.info("user-action", "spotify.playlists.tracks", "Loaded Spotify playlist tracks.", {
    ok: result.ok === true,
    playlistId,
    trackCount: result.tracks?.length ?? 0,
    tempoReady: tempoResult?.tempoReference?.count ?? 0,
    limited: limitedPlaylist,
  });
  renderSpotifyMusicSurface();
}

async function analyzeSpotifyVisibleTrackTempo() {
  state.spotifyMusicPanelOpen = true;
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      tempoStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  const sourceMode = state.spotifyMusic.sourceMode === "playlists" ? "playlists" : "search";
  const tracks = sourceMode === "playlists"
    ? state.spotifyMusic.playlistTrackResults
    : state.spotifyMusic.searchResults;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    tempoBusy: true,
    tempoStatus: "Analyzing tempo...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.enrichTracksWithTempo({
    accessToken: tokenResult.token.accessToken,
    tracks,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    tempoBusy: false,
    searchResults: sourceMode === "search" ? result.tracks : state.spotifyMusic.searchResults,
    playlistTrackResults: sourceMode === "playlists" ? result.tracks : state.spotifyMusic.playlistTrackResults,
    tempoStatus: result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.tempo.analyze", "Analyzed visible Spotify track tempos.", {
    ok: result.ok === true,
    sourceMode,
    trackCount: result.tracks?.length ?? 0,
    tempoReady: result.tempoReference?.count ?? 0,
  });
  renderSpotifyMusicSurface();
}

function findSpotifyMusicTrackByUri(trackUri) {
  const normalizedTrackUri = String(trackUri ?? "").trim();
  if (!normalizedTrackUri) {
    return null;
  }

  return [
    ...state.spotifyMusic.searchResults,
    ...state.spotifyMusic.playlistTrackResults,
    ...state.spotifyMusic.queueHistory,
  ].find((candidate) => candidate.uri === normalizedTrackUri) ?? null;
}

function isSpotifyLimitedPlaylistResponse(message) {
  return /forbidden|own or collaborate|only exposes tracks/i.test(String(message ?? ""));
}

function normalizeSpotifyPlaylistFailureMessage(message) {
  return isSpotifyLimitedPlaylistResponse(message)
    ? SPOTIFY_LIMITED_PLAYLIST_MESSAGE
    : String(message ?? "").trim();
}

function markSpotifyPlaylistTracksLimited(playlists = [], playlistId = "") {
  const normalizedPlaylistId = String(playlistId ?? "").trim();
  return (Array.isArray(playlists) ? playlists : []).map((playlist) => {
    if (playlist?.id !== normalizedPlaylistId) {
      return playlist;
    }

    return {
      ...playlist,
      canReadTracks: false,
    };
  });
}

async function startSpotifyInAppPlayer({
  statusText = "Starting ABE player...",
} = {}) {
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return tokenResult;
  }

  if (!spotifyMusicService.hasPlaybackScope(tokenResult.token)) {
    const message = "Reconnect Spotify to grant in-app playback.";
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: message,
    });
    renderSpotifyMusicSurface();
    return {
      ok: false,
      message,
    };
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackConnecting: true,
    playbackStatus: statusText,
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.connectWebPlayback({
    accessToken: tokenResult.token.accessToken,
    onEvent: handleSpotifyWebPlaybackEvent,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackConnecting: false,
    playbackReady: result.ok,
    playbackDeviceId: result.ok ? result.deviceId : state.spotifyMusic.playbackDeviceId,
    playbackStatus: result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playback.player", "Started Spotify Web Playback player.", {
    ok: result.ok === true,
    hasDeviceId: Boolean(result.deviceId),
  });
  renderSpotifyMusicSurface();
  syncSpotifyPlaybackPositionTicker({ resetClock: true });
  return result;
}

function updateSpotifyPlaybackSeekDraft(value) {
  spotifyPlaybackPositionSyncedAtMs = Date.now();
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackPositionMs: Math.max(0, Math.round(Number(value) || 0)),
    playbackStateUpdatedAt: spotifyPlaybackPositionSyncedAtMs,
  });
  syncSpotifyPlaybackProgressDom({ preserveActiveSeek: false });
}

// Intent: keep the compact player progress moving while Spotify is playing even when the SDK only emits occasional snapshots.
function syncSpotifyPlaybackPositionTicker({
  resetClock = false,
} = {}) {
  if (resetClock || !spotifyPlaybackPositionSyncedAtMs) {
    spotifyPlaybackPositionSyncedAtMs = Date.now();
  }

  if (!shouldAdvanceSpotifyPlaybackPosition()) {
    stopSpotifyPlaybackPositionTicker();
    return;
  }

  if (spotifyPlaybackPositionTickerId !== null) {
    return;
  }

  spotifyPlaybackPositionTickerId = window.setInterval(
    advanceSpotifyPlaybackPositionTick,
    SPOTIFY_PLAYBACK_POSITION_TICK_MS,
  );
}

function stopSpotifyPlaybackPositionTicker() {
  if (spotifyPlaybackPositionTickerId === null) {
    spotifyPlaybackPositionSyncedAtMs = 0;
    return;
  }

  window.clearInterval(spotifyPlaybackPositionTickerId);
  spotifyPlaybackPositionTickerId = null;
  spotifyPlaybackPositionSyncedAtMs = 0;
}

function shouldAdvanceSpotifyPlaybackPosition() {
  const spotifyMusic = state.spotifyMusic ?? {};
  const durationMs = Math.max(0, Number(spotifyMusic.playbackDurationMs) || 0);
  const positionMs = Math.max(0, Number(spotifyMusic.playbackPositionMs) || 0);
  return Boolean(
    spotifyMusic.playbackReady === true
    && spotifyMusic.playbackPaused !== true
    && spotifyMusic.playbackControlBusy !== true
    && durationMs > 0
    && positionMs < durationMs
  );
}

function advanceSpotifyPlaybackPositionTick() {
  if (!shouldAdvanceSpotifyPlaybackPosition()) {
    stopSpotifyPlaybackPositionTicker();
    return;
  }

  if (isSpotifyPlaybackSeekInputActive()) {
    spotifyPlaybackPositionSyncedAtMs = Date.now();
    return;
  }

  const nowMs = Date.now();
  const elapsedMs = Math.max(0, nowMs - (spotifyPlaybackPositionSyncedAtMs || nowMs));
  if (elapsedMs < 250) {
    return;
  }

  const durationMs = Math.max(0, Number(state.spotifyMusic.playbackDurationMs) || 0);
  const currentPositionMs = Math.max(0, Number(state.spotifyMusic.playbackPositionMs) || 0);
  const nextPositionMs = Math.min(durationMs, currentPositionMs + elapsedMs);
  spotifyPlaybackPositionSyncedAtMs = nowMs;
  if (Math.round(nextPositionMs) === Math.round(currentPositionMs)) {
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackPositionMs: nextPositionMs,
    playbackStateUpdatedAt: nowMs,
  });
  syncSpotifyPlaybackProgressDom();
  if (nextPositionMs >= durationMs) {
    stopSpotifyPlaybackPositionTicker();
  }
}

function isSpotifyPlaybackSeekInputActive() {
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLInputElement && activeElement.dataset.spotifyPlaybackSeek !== undefined;
}

function syncSpotifyPlaybackProgressDom({
  preserveActiveSeek = true,
} = {}) {
  const spotifyMusic = createDefaultSpotifyMusicPanelState(state.spotifyMusic);
  const durationMs = Math.max(0, Number(spotifyMusic.playbackDurationMs) || 0);
  const positionMs = Math.min(Math.max(0, Number(spotifyMusic.playbackPositionMs) || 0), Math.max(durationMs, 0));
  const canSeek = spotifyMusic.playbackReady === true && spotifyMusic.playbackControlBusy !== true && durationMs > 0;
  document.querySelectorAll("[data-spotify-playback-position-label]").forEach((element) => {
    element.textContent = formatSpotifyPlaybackTimeLabel(positionMs);
  });
  document.querySelectorAll("[data-spotify-playback-duration-label]").forEach((element) => {
    element.textContent = formatSpotifyPlaybackTimeLabel(durationMs);
  });
  document.querySelectorAll("[data-spotify-playback-seek]").forEach((element) => {
    if (!(element instanceof HTMLInputElement)) {
      return;
    }
    if (preserveActiveSeek && element === document.activeElement) {
      return;
    }
    element.max = String(Math.max(durationMs, 1));
    element.value = String(Math.round(positionMs));
    element.disabled = !canSeek;
  });
}

async function toggleSpotifyMusicPlayback() {
  if (!state.spotifyMusic.playbackReady) {
    const storedResumeState = spotifyMusicService.getStoredPlaybackState();
    if (storedResumeState?.currentTrack?.uri) {
      const restoreResult = await restoreSpotifyMusicPlaybackFromStoredSnapshot({
        force: true,
        openPanel: true,
        reason: "manual-toggle",
      });
      if (restoreResult.ok) {
        return;
      }
    }

    const playerResult = await startSpotifyInAppPlayer();
    if (!playerResult.ok) {
      return;
    }
  }

  const previousPaused = state.spotifyMusic.playbackPaused === true;
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: true,
    playbackStatus: previousPaused ? "Resuming Spotify playback..." : "Pausing Spotify playback...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.togglePlayback();
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: false,
    playbackPaused: result.ok ? !previousPaused : state.spotifyMusic.playbackPaused,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playback.toggle", "Sent Spotify play/pause command.", {
    ok: result.ok === true,
    previousPaused,
  });
  renderSpotifyMusicSurface();
  persistSpotifyMusicPlaybackSnapshot({ reason: "toggle" });
  syncSpotifyPlaybackPositionTicker({ resetClock: true });
}

async function skipSpotifyMusicPlayback(direction) {
  if (!state.spotifyMusic.playbackReady) {
    const playerResult = await startSpotifyInAppPlayer();
    if (!playerResult.ok) {
      return;
    }
  }

  const normalizedDirection = direction === "previous" ? "previous" : "next";
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: true,
    playbackStatus: normalizedDirection === "previous" ? "Returning to previous track..." : "Skipping to next track...",
  });
  renderSpotifyMusicSurface();
  const result = normalizedDirection === "previous"
    ? await spotifyMusicService.previousTrack()
    : await spotifyMusicService.nextTrack();
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: false,
    playbackPositionMs: result.ok ? 0 : state.spotifyMusic.playbackPositionMs,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.message,
  });
  spotifyMusicLog.info("user-action", `spotify.playback.${normalizedDirection}`, "Sent Spotify track-skip command.", {
    ok: result.ok === true,
  });
  renderSpotifyMusicSurface();
  syncSpotifyPlaybackPositionTicker({ resetClock: true });
}

async function seekSpotifyMusicPlayback(value) {
  const positionMs = Math.max(0, Math.round(Number(value) || 0));
  spotifyPlaybackPositionSyncedAtMs = Date.now();
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: true,
    playbackPositionMs: positionMs,
    playbackStateUpdatedAt: spotifyPlaybackPositionSyncedAtMs,
    playbackStatus: "Seeking Spotify playback...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.seekPlayback({ positionMs });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackControlBusy: false,
    playbackPositionMs: result.ok ? result.positionMs : state.spotifyMusic.playbackPositionMs,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playback.seek", "Sent Spotify seek command.", {
    ok: result.ok === true,
    positionMs,
  });
  renderSpotifyMusicSurface();
  persistSpotifyMusicPlaybackSnapshot({ reason: "seek" });
  syncSpotifyPlaybackPositionTicker({ resetClock: true });
}

async function playSpotifyMusicTrack(trackUri) {
  state.spotifyMusicPanelOpen = true;
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  const track = findSpotifyMusicTrackByUri(trackUri);
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    accountMenuOpen: false,
    playbackBusyTrackUri: trackUri,
    playbackStatus: "Preparing ABE player...",
  });
  renderSpotifyMusicSurface();

  const playerResult = await startSpotifyInAppPlayer();
  if (!playerResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackBusyTrackUri: "",
      playbackStatus: playerResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackBusyTrackUri: trackUri,
    playbackStatus: "Starting track in ABE...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.startTrackPlayback({
    accessToken: tokenResult.token.accessToken,
    deviceId: playerResult.deviceId,
    trackUri,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackBusyTrackUri: "",
    playbackCurrentTrack: result.ok && track ? track : state.spotifyMusic.playbackCurrentTrack,
    playbackCurrentPlaylist: result.ok ? null : state.spotifyMusic.playbackCurrentPlaylist,
    playbackContextUri: result.ok ? "" : state.spotifyMusic.playbackContextUri,
    playbackPaused: false,
    playbackPositionMs: 0,
    playbackDurationMs: result.ok && track?.durationMs ? track.durationMs : state.spotifyMusic.playbackDurationMs,
    playbackReady: true,
    playbackDeviceId: playerResult.deviceId,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.ok && track ? `Playing ${track.title || "track"} in ABE.` : result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playback.track", "Sent Spotify in-app playback command.", {
    ok: result.ok === true,
    trackUri,
    trackTitle: track?.title ?? "",
  });
  renderSpotifyMusicSurface();
  if (result.ok) {
    persistSpotifyMusicPlaybackSnapshot({ reason: "track-play" });
  }
}

async function playSpotifyMusicPlaylist(playlistUriOrId) {
  state.spotifyMusicPanelOpen = true;
  const selectedPlaylist = state.spotifyMusic.playlistResults.find((playlist) => (
    playlist.uri === playlistUriOrId
    || playlist.id === playlistUriOrId
  )) ?? null;
  const playlistUri = selectedPlaylist?.uri || String(playlistUriOrId ?? "").trim();
  const playlistId = selectedPlaylist?.id ?? "";
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    sourceMode: "playlists",
    selectedPlaylistId: playlistId || state.spotifyMusic.selectedPlaylistId,
    selectedPlaylistName: selectedPlaylist?.title ?? state.spotifyMusic.selectedPlaylistName,
    playbackCurrentPlaylist: selectedPlaylist ?? state.spotifyMusic.playbackCurrentPlaylist,
    playbackContextUri: playlistUri,
    playbackBusyPlaylistUri: playlistUri,
    playbackStatus: "Preparing ABE player...",
    playlistStatus: selectedPlaylist?.canReadTracks === false
      ? SPOTIFY_LIMITED_PLAYLIST_MESSAGE
      : state.spotifyMusic.playlistStatus,
  });
  renderSpotifyMusicSurface();

  const playerResult = await startSpotifyInAppPlayer();
  if (!playerResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackBusyPlaylistUri: "",
      playbackStatus: playerResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    playbackBusyPlaylistUri: playlistUri,
    playbackStatus: "Starting playlist in ABE...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.startPlaylistPlayback({
    accessToken: tokenResult.token.accessToken,
    deviceId: playerResult.deviceId,
    playlistUri,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    selectedPlaylistId: playlistId || state.spotifyMusic.selectedPlaylistId,
    selectedPlaylistName: selectedPlaylist?.title ?? state.spotifyMusic.selectedPlaylistName,
    playbackBusyPlaylistUri: "",
    playbackCurrentPlaylist: result.ok && selectedPlaylist ? selectedPlaylist : state.spotifyMusic.playbackCurrentPlaylist,
    playbackCurrentTrack: result.ok ? null : state.spotifyMusic.playbackCurrentTrack,
    playbackContextUri: result.ok ? playlistUri : state.spotifyMusic.playbackContextUri,
    playbackPaused: false,
    playbackPositionMs: 0,
    playbackDurationMs: 0,
    playbackReady: true,
    playbackDeviceId: playerResult.deviceId,
    playbackStateUpdatedAt: Date.now(),
    playbackStatus: result.ok && selectedPlaylist
      ? `Playing ${selectedPlaylist.title || "playlist"} in ABE.`
      : result.message,
  });
  spotifyMusicLog.info("user-action", "spotify.playback.playlist", "Sent Spotify playlist playback command.", {
    ok: result.ok === true,
    playlistTitle: selectedPlaylist?.title ?? "",
    playlistUri,
  });
  renderSpotifyMusicSurface();
  if (result.ok && selectedPlaylist?.id && selectedPlaylist.canReadTracks !== false) {
    void loadSpotifyMusicPlaylistTracks(selectedPlaylist.id);
  }
}

async function queueSpotifyMusicTrack(trackUri) {
  state.spotifyMusicPanelOpen = true;
  const tokenResult = await ensureSpotifyMusicToken();
  if (!tokenResult.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      queueStatus: tokenResult.message,
    });
    renderSpotifyMusicSurface();
    return;
  }

  const track = findSpotifyMusicTrackByUri(trackUri);
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    queueBusyTrackUri: trackUri,
    queueStatus: "Queueing track...",
  });
  renderSpotifyMusicSurface();
  const result = await spotifyMusicService.queueTrack({
    accessToken: tokenResult.token.accessToken,
    trackUri,
  });
  state.spotifyMusic = createDefaultSpotifyMusicPanelState({
    ...state.spotifyMusic,
    queueBusyTrackUri: "",
    queueStatus: result.message,
    queueHistory: result.ok && track
      ? [track, ...state.spotifyMusic.queueHistory].slice(0, 8)
      : state.spotifyMusic.queueHistory,
  });
  spotifyMusicLog.info("user-action", "spotify.queue", "Sent Spotify queue command.", {
    ok: result.ok === true,
    trackUri,
    trackTitle: track?.title ?? "",
  });
  renderSpotifyMusicSurface();
}

function handleSpotifyWebPlaybackEvent(event = {}) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (event.type === "ready") {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackDeviceId: event.deviceId,
      playbackDeviceName: event.deviceName,
      playbackReady: true,
      playbackConnecting: false,
      playbackStatus: "ABE player ready.",
    });
    renderSpotifyMusicSurface();
    return;
  }

  if (event.type === "not_ready") {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackDeviceId: "",
      playbackReady: false,
      playbackStatus: event.message || "ABE player went offline.",
    });
    renderSpotifyMusicSurface();
    return;
  }

  if (event.type === "error" || event.type === "autoplay_failed") {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackStatus: event.message || "Spotify player error.",
      playbackConnecting: false,
    });
    renderSpotifyMusicSurface();
    return;
  }

  if (event.type === "state_changed") {
    const visibleTrack = event.currentTrack?.uri ? findSpotifyMusicTrackByUri(event.currentTrack.uri) : null;
    const currentTrack = visibleTrack
      ? { ...event.currentTrack, ...visibleTrack }
      : event.currentTrack?.uri ? event.currentTrack : state.spotifyMusic.playbackCurrentTrack;
    const title = currentTrack?.title || "";
    const stateChangedAt = Date.now();
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      playbackCurrentTrack: currentTrack,
      playbackContextUri: event.contextUri || state.spotifyMusic.playbackContextUri,
      playbackPaused: event.paused === true,
      playbackPositionMs: event.positionMs,
      playbackDurationMs: event.durationMs || currentTrack?.durationMs || state.spotifyMusic.playbackDurationMs,
      playbackStateUpdatedAt: stateChangedAt,
      playbackStatus: title
        ? event.paused === true ? `Paused ${title}.` : `Playing ${title}.`
        : state.spotifyMusic.playbackStatus,
    });
    spotifyPlaybackPositionSyncedAtMs = stateChangedAt;
    renderSpotifyMusicSurface();
    persistSpotifyMusicPlaybackSnapshot({ reason: "sdk-state" });
    syncSpotifyPlaybackPositionTicker({ resetClock: true });
  }
}

async function ensureSpotifyMusicToken() {
  const result = await spotifyMusicService.ensureFreshToken({
    clientId: state.spotifyMusic?.clientId ?? "",
    token: state.spotifyMusic?.token,
  });
  if (result.ok) {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      token: result.token,
      authStatus: result.refreshed ? "Spotify connection refreshed." : state.spotifyMusic.authStatus,
    });
  } else {
    state.spotifyMusic = createDefaultSpotifyMusicPanelState({
      ...state.spotifyMusic,
      token: null,
      authStatus: result.message,
    });
  }
  return result;
}

function renderDeleteConfirmationDialog() {
  const slot = document.querySelector("#confirmation-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const dialog = state.deleteConfirmationDialog;
  if (!dialog) {
    slot.innerHTML = "";
    return;
  }

  slot.innerHTML = renderDeleteConfirmationDialogHTML(dialog, state.deleteConfirmationPreferences);
}

function loadDeleteConfirmationPreferences() {
  return createDeleteConfirmationPreferences(readStoredJson(EDITOR_DELETE_CONFIRMATIONS_KEY));
}

function persistDeleteConfirmationPreferences() {
  writeStoredJsonRaw(
    EDITOR_DELETE_CONFIRMATIONS_KEY,
    createDeleteConfirmationPreferences(state.deleteConfirmationPreferences),
  );
}

function requestDeletePassageNoteFromPanel(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  const preferenceKey = "passageNotes";
  if (Boolean(state.deleteConfirmationPreferences?.[preferenceKey])) {
    return performPassageNoteDeletion(noteId);
  }

  state.deleteConfirmationDialog = {
    kind: "passage-note",
    noteId: note.id,
    preferenceKey,
    title: `Delete ${getPassageNoteDisplayLabel(note.noteType).toLowerCase()} note?`,
    message: `Delete "${note.title || `${getPassageNoteDisplayLabel(note.noteType)} note`}"?\n\nThis removes the note from the side panel and clears any active preview.`,
  };
  renderDeleteConfirmationDialog();
  return true;
}

function confirmDeleteConfirmationDialog() {
  const dialog = state.deleteConfirmationDialog;
  if (!dialog) {
    return false;
  }

  if (Boolean(state.deleteConfirmationPreferences?.[dialog.preferenceKey])) {
    persistDeleteConfirmationPreferences();
  }

  state.deleteConfirmationDialog = null;
  renderDeleteConfirmationDialog();

  if (dialog.kind === "passage-note") {
    return performPassageNoteDeletion(dialog.noteId);
  }

  return false;
}

function cancelDeleteConfirmationDialog() {
  if (!state.deleteConfirmationDialog) {
    return false;
  }

  state.deleteConfirmationDialog = null;
  renderDeleteConfirmationDialog();
  return true;
}

function toggleDeleteConfirmationPreference(preferenceKey, checked) {
  const normalizedKey = preferenceKey === "tasks" ? "tasks" : "passageNotes";
  state.deleteConfirmationPreferences = {
    ...(state.deleteConfirmationPreferences ?? createDeleteConfirmationPreferences()),
    [normalizedKey]: Boolean(checked),
  };
  persistDeleteConfirmationPreferences();
}

function performPassageNoteDeletion(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  const wasSelected = state.selectedPassageNoteId === note.id;
  const wasPreviewing = state.taskPreview?.taskId === note.id;
  const viewport = captureSceneEditorViewport(note.sceneId);
  const sameSceneReplacementNote = state.passageNotes.find(
    (candidate) =>
      candidate.id !== note.id &&
      candidate.noteType === note.noteType &&
      candidate.sceneId === note.sceneId,
  ) ?? null;

  const deletion = anchoredRecordService.deletePassageNote(note.id, {
    dirtyReason: `${note.noteType}-note-deleted`,
    source: "performPassageNoteDeletion",
  });
  if (!deletion) {
    return false;
  }

  if (wasPreviewing) {
    clearTaskAnchorPreview({ restoreSelection: false });
  }

  if (sameSceneReplacementNote && wasSelected) {
    selectPassageNote(sameSceneReplacementNote.id);
    return true;
  }

  if (wasSelected) {
    state.selectedPassageNoteId = null;
  }

  renderConsolePanel();
  if (wasPreviewing || wasSelected) {
    window.requestAnimationFrame(() => {
      restoreSceneEditorViewport(note.sceneId, viewport);
    });
  }
  return true;
}

function addMetadataSubgroupForPanel(groupId, parentSubgroupId = "") {
  const supportedGroupIds = getMetadataSubgroupGroupIds();
  const normalizedGroupId = String(groupId ?? "").trim();
  if (!isSupportedMetadataSubgroupGroupId(normalizedGroupId, supportedGroupIds)) {
    return false;
  }

  const result = createMetadataSubgroup({
    groupId: normalizedGroupId,
    parentSubgroupId,
  }, state.metadataSubgroups, supportedGroupIds);
  if (!result.subgroup) {
    return false;
  }

  state.metadataSubgroups = result.subgroups;
  state.sidePanelMode = normalizedGroupId;
  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-created",
    source: "addMetadataSubgroupForPanel",
  });
  renderConsolePanel();
  focusMetadataSubgroupTitle(result.subgroup.id);
  return true;
}

function removeMetadataSubgroup(subgroupId) {
  const existingSubgroup = getMetadataSubgroupRecord(subgroupId);
  if (!existingSubgroup) {
    return false;
  }

  state.metadataSubgroups = deleteMetadataSubgroup(
    state.metadataSubgroups,
    subgroupId,
    getMetadataSubgroupGroupIds(),
  );

  state.selectedMetadataSubgroupNoteId = null;
  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-deleted",
    source: "removeMetadataSubgroup",
  });
  renderConsolePanel();
  return true;
}

function addMetadataSubgroupNote(subgroupId) {
  const result = createMetadataSubgroupNote({
    subgroupId,
  }, state.metadataSubgroups, getMetadataSubgroupGroupIds());
  if (!result.note) {
    return false;
  }

  state.metadataSubgroups = result.subgroups;
  state.selectedMetadataSubgroupNoteId = result.note.id;
  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-note-created",
    source: "addMetadataSubgroupNote",
  });
  renderConsolePanel();
  focusMetadataSubgroupNoteBody(subgroupId, result.note.id);
  return true;
}

function removeMetadataSubgroupNote(subgroupId, noteId) {
  state.metadataSubgroups = deleteMetadataSubgroupNote(
    state.metadataSubgroups,
    subgroupId,
    noteId,
    getMetadataSubgroupGroupIds(),
  );
  if (state.selectedMetadataSubgroupNoteId === noteId) {
    state.selectedMetadataSubgroupNoteId = null;
  }
  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-note-deleted",
    source: "removeMetadataSubgroupNote",
  });
  renderConsolePanel();
  return true;
}

function updateMetadataSubgroupTitle(subgroupId, title) {
  state.metadataSubgroups = updateMetadataSubgroup(
    state.metadataSubgroups,
    subgroupId,
    { title },
    getMetadataSubgroupGroupIds(),
  );
  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-renamed",
    source: "updateMetadataSubgroupTitle",
  });
}

function updateMetadataSubgroupNoteTitle(subgroupId, noteId, title) {
  updateMetadataSubgroupNoteFields(subgroupId, noteId, {
    title,
  }, "metadata-folder-note-title-edited", "updateMetadataSubgroupNoteTitle");
}

function updateMetadataSubgroupNoteBody(subgroupId, noteId, body) {
  updateMetadataSubgroupNoteFields(subgroupId, noteId, {
    body,
  }, "metadata-folder-note-body-edited", "updateMetadataSubgroupNoteBody");
}

function pointMetadataSubgroupNoteToCurrentSelection(subgroupId, noteId) {
  const anchor = getCurrentMetadataSubgroupSelectionAnchor();
  if (!anchor) {
    return false;
  }

  updateMetadataSubgroupNoteFields(subgroupId, noteId, {
    anchor,
  }, "metadata-folder-note-anchor-pointed", "pointMetadataSubgroupNoteToCurrentSelection");
  state.selectedMetadataSubgroupNoteId = noteId;
  renderConsolePanel();
  return true;
}

function clearMetadataSubgroupNoteAnchor(subgroupId, noteId) {
  updateMetadataSubgroupNoteFields(subgroupId, noteId, {
    anchor: null,
  }, "metadata-folder-note-anchor-cleared", "clearMetadataSubgroupNoteAnchor");
  state.selectedMetadataSubgroupNoteId = noteId;
  renderConsolePanel();
  return true;
}

function openMetadataSubgroupNoteAnchor(subgroupId, noteId) {
  const subgroup = getMetadataSubgroupRecord(subgroupId);
  const note = findMetadataSubgroupNote(
    state.metadataSubgroups,
    subgroupId,
    noteId,
    getMetadataSubgroupGroupIds(),
  );
  if (!note?.anchor) {
    return false;
  }

  state.sidePanelMode = subgroup?.groupId ?? state.sidePanelMode;
  state.selectedMetadataSubgroupNoteId = note.id;
  selectWorkspacePane("manuscript");
  renderConsolePanel();
  return takeToSceneRange(note.anchor.sceneId, note.anchor.startOffset, note.anchor.endOffset, {
    behavior: "smooth",
  });
}

function updateMetadataSubgroupNoteFields(subgroupId, noteId, patch, dirtyReason, source) {
  state.metadataSubgroups = updateMetadataSubgroupNote(
    state.metadataSubgroups,
    subgroupId,
    noteId,
    patch,
    getMetadataSubgroupGroupIds(),
  );
  persistMetadataSubgroupsState({
    dirtyReason,
    source,
  });
}

function persistMetadataSubgroupsState(options = {}) {
  state.metadataSubgroups = normalizeMetadataSubgroups(
    state.metadataSubgroups,
    getMetadataSubgroupGroupIds(),
  );
  persistCurrentProjectRecord({
    domain: "metadata-folders",
    dirtyReason: options.dirtyReason ?? "metadata-folder-updated",
    source: options.source ?? "persistMetadataSubgroupsState",
  });
}

function getMetadataSubgroupRecord(subgroupId) {
  return findMetadataSubgroup(
    state.metadataSubgroups,
    subgroupId,
    getMetadataSubgroupGroupIds(),
  );
}

// Intent: allow loose anchored metadata notes to become folder notes while preserving their manuscript anchor.
function movePassageNoteIntoMetadataFolder(noteId, subgroupId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  const subgroup = getMetadataSubgroupRecord(subgroupId);
  if (!note || !subgroup || subgroup.groupId !== note.noteType) {
    return false;
  }

  const folderNoteInput = createMetadataSubgroupNoteInputFromPassageNote(note, subgroup.id);
  if (!folderNoteInput) {
    return false;
  }

  const result = createMetadataSubgroupNote(
    folderNoteInput,
    state.metadataSubgroups,
    getMetadataSubgroupGroupIds(),
  );
  if (!result.note) {
    return false;
  }

  const wasSelected = state.selectedPassageNoteId === note.id;
  const wasPreviewing = state.taskPreview?.taskId === note.id;
  const viewport = captureSceneEditorViewport(note.sceneId);
  state.metadataSubgroups = result.subgroups;
  state.selectedMetadataSubgroupNoteId = result.note.id;
  state.sidePanelMode = subgroup.groupId;

  const deletion = anchoredRecordService.deletePassageNote(note.id, {
    dirtyReason: `${note.noteType}-note-moved-to-folder`,
    source: "movePassageNoteIntoMetadataFolder",
  });
  if (!deletion) {
    return false;
  }

  if (wasPreviewing) {
    clearTaskAnchorPreview({ restoreSelection: false });
  }

  if (wasSelected) {
    state.selectedPassageNoteId = null;
  }

  persistMetadataSubgroupsState({
    dirtyReason: "metadata-folder-note-imported",
    source: "movePassageNoteIntoMetadataFolder",
  });
  renderConsolePanel();
  focusMetadataSubgroupNoteBody(subgroup.id, result.note.id);
  if (wasPreviewing || wasSelected) {
    window.requestAnimationFrame(() => {
      restoreSceneEditorViewport(note.sceneId, viewport);
    });
  }
  return true;
}

// Intent: bridge native drag/drop events into folder-note moves without storing drag state in the project record.
function handleMetadataFolderDragStart(event) {
  const target = event.target instanceof Element ? event.target : null;
  const sourceItem = target?.closest(".passage-note-item[data-note-id]");
  if (!(sourceItem instanceof HTMLElement) || isEditableDragSource(target)) {
    return;
  }

  const note = state.passageNotes.find((candidate) => candidate.id === sourceItem.dataset.noteId);
  if (!note) {
    return;
  }

  metadataFolderDragState = {
    noteId: note.id,
    noteType: note.noteType,
    sourceElement: sourceItem,
  };
  sourceItem.classList.add("is-dragging");
  sourceItem.setAttribute("aria-grabbed", "true");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-abe-passage-note-id", note.id);
    event.dataTransfer.setData("text/plain", note.id);
  }
}

function handleMetadataFolderDragOver(event) {
  if (!metadataFolderDragState) {
    return;
  }

  const dropTarget = resolveMetadataFolderDropTarget(event);
  if (!dropTarget) {
    clearMetadataFolderDropTargets();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "none";
    }
    return;
  }

  event.preventDefault();
  clearMetadataFolderDropTargets(dropTarget);
  dropTarget.classList.add("is-drop-target");
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleMetadataFolderDrop(event) {
  if (!metadataFolderDragState) {
    return;
  }

  const dropTarget = resolveMetadataFolderDropTarget(event);
  if (!dropTarget) {
    resetMetadataFolderDragState();
    return;
  }

  event.preventDefault();
  const noteId = metadataFolderDragState.noteId ||
    event.dataTransfer?.getData("application/x-abe-passage-note-id") ||
    event.dataTransfer?.getData("text/plain") ||
    "";
  movePassageNoteIntoMetadataFolder(noteId, dropTarget.dataset.metadataSubgroupId);
  resetMetadataFolderDragState();
}

function handleMetadataFolderDragLeave(event) {
  if (!metadataFolderDragState) {
    return;
  }

  const dropTarget = resolveMetadataFolderDropTarget(event);
  const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (dropTarget && (!relatedTarget || !dropTarget.contains(relatedTarget))) {
    dropTarget.classList.remove("is-drop-target");
  }
}

function handleMetadataFolderDragEnd() {
  if (metadataFolderDragState) {
    resetMetadataFolderDragState();
  }
}

function resolveMetadataFolderDropTarget(event) {
  const target = event.target instanceof Element ? event.target : null;
  const dropTarget = target?.closest("[data-metadata-folder-drop-target]");
  if (!(dropTarget instanceof HTMLElement) || !metadataFolderDragState) {
    return null;
  }

  const note = state.passageNotes.find((candidate) => candidate.id === metadataFolderDragState.noteId);
  const subgroup = getMetadataSubgroupRecord(dropTarget.dataset.metadataSubgroupId);
  if (!note || !subgroup || subgroup.groupId !== note.noteType || dropTarget.dataset.metadataGroupId !== subgroup.groupId) {
    return null;
  }

  return dropTarget;
}

function resetMetadataFolderDragState() {
  if (metadataFolderDragState?.sourceElement instanceof HTMLElement) {
    metadataFolderDragState.sourceElement.classList.remove("is-dragging");
    metadataFolderDragState.sourceElement.removeAttribute("aria-grabbed");
  }
  clearMetadataFolderDropTargets();
  metadataFolderDragState = null;
}

function clearMetadataFolderDropTargets(except = null) {
  document.querySelectorAll(".metadata-subgroup-card.is-drop-target").forEach((node) => {
    if (node !== except) {
      node.classList.remove("is-drop-target");
    }
  });
}

function isEditableDragSource(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement ||
    Boolean(target?.closest("button"));
}

function getCurrentMetadataSubgroupSelectionAnchor() {
  const sceneId = typeof state.selectedSceneId === "string" ? state.selectedSceneId.trim() : "";
  const scene = sceneId ? getScene(sceneId) : null;
  if (!scene) {
    return null;
  }

  const textarea = getEditorTextareaForScene(scene.sceneId);
  const editorText = getCurrentSceneEditorText(scene.sceneId, scene.editorText ?? "");
  const liveStart = Number.isInteger(textarea?.selectionStart) ? textarea.selectionStart : null;
  const liveEnd = Number.isInteger(textarea?.selectionEnd) ? textarea.selectionEnd : null;
  const cachedSelection = state.sceneEditorSelectionSnapshot?.sceneId === scene.sceneId
    ? state.sceneEditorSelectionSnapshot
    : null;
  const startOffset = liveStart !== null && liveEnd !== null && liveEnd > liveStart
    ? liveStart
    : cachedSelection?.startOffset;
  const endOffset = liveStart !== null && liveEnd !== null && liveEnd > liveStart
    ? liveEnd
    : cachedSelection?.endOffset;
  const range = manuscriptSelectionController.trimTextRange(editorText, startOffset, endOffset, true);
  if (!range) {
    return null;
  }

  return {
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle ?? "",
    chapterId: scene.chapterId ?? "",
    chapterTitle: scene.chapterTitle ?? "",
    selectedText: range.selectedText,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    createdAt: new Date().toISOString(),
  };
}

function focusMetadataSubgroupTitle(subgroupId) {
  window.requestAnimationFrame(() => {
    const field = document.querySelector(
      `[data-edit-field="metadata-subgroup-title"][data-metadata-subgroup-id="${CSS.escape(String(subgroupId ?? ""))}"]`,
    );
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  });
}

function focusMetadataSubgroupNoteBody(subgroupId, noteId) {
  window.requestAnimationFrame(() => {
    const field = document.querySelector(
      `[data-edit-field="metadata-subgroup-note-body"][data-metadata-subgroup-id="${CSS.escape(String(subgroupId ?? ""))}"][data-metadata-note-id="${CSS.escape(String(noteId ?? ""))}"]`,
    );
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    }
  });
}

// Intent: reopen the inline passage-note bubble with an existing note already seeded.
function openPassageNoteEditorFromPanel(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  state.inlinePassageDraft = {
    sceneId: note.sceneId,
    noteType: note.noteType,
    metadataDefinitionId: note.metadataDefinitionId ?? "",
    metadataLabel: note.metadataLabel ?? getPassageNoteDisplayLabel(note.noteType),
    metadataHighlightColor: note.metadataHighlightColor ?? "",
    selectedText: String(note.selectedText ?? ""),
    startOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    endOffset: Number.isInteger(note.endOffset) ? note.endOffset : 0,
    anchorStartOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    seededSelection: true,
    typedStartOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    typedEndOffset: Number.isInteger(note.endOffset) ? note.endOffset : 0,
    body: String(note.body ?? ""),
    typedText: String(note.selectedText ?? ""),
    editingNoteId: note.id,
    x: 110,
    y: 40,
  };
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.taskContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
  if (state.selectedSceneId !== note.sceneId) {
    selectSceneById(note.sceneId);
  }
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const field = document.querySelector("[data-edit-field='inline-passage-note']");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });
  return true;
}

function formatImportSourceLabel(source) {
  if (typeof source !== "string" || !source.trim()) {
    return "";
  }

  if (source === "manual") {
    return "Manual";
  }

  if (source === "source-research") {
    return "Research";
  }

  if (source === "source-front-matter") {
    return "Front matter";
  }

  if (source === "source-comment") {
    return "Imported task";
  }

  if (source === "source-comment-note") {
    return "Imported note";
  }

  if (source === "source-asset") {
    return "Asset";
  }

  if (source === "meta") {
    return "Project meta";
  }

  if (source === "trash") {
    return "Archive item";
  }

  if (source === "image") {
    return "Image";
  }

  if (source === "pdf") {
    return "PDF";
  }

  return source
    .replace(/^source-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderTaskChapterList(tasks) {
  const panelModel = buildTaskPanelModel(tasks, groupScenesByChapter(state.scenes));
  return renderTaskPanelHTML(panelModel, {
    selectedTaskId: state.selectedTaskId,
    previewTaskId: state.taskPreview?.taskId,
    collapsedChapterIds: state.collapsedConsoleChapterIds?.issueTasks,
    formatChapterTitle: formatChapterDisplayTitle,
  });
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

function formatChapterNumberLabel(chapterNumber) {
  const normalizedNumber = Number.isInteger(chapterNumber) && chapterNumber > 0 ? chapterNumber : 1;
  return `Chapter ${normalizedNumber}`;
}

function formatChapterDisplayTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  if (!value) {
    return "Untitled chapter";
  }

  const stripped = value.replace(/^(?:new\s+)?chapter\s+\d+\s*[:\-–—]?\s*/i, "").trim();
  return stripped || "Untitled chapter";
}

// Intent: render the World Spine from a feature-owned chronological node-map model.
function buildWorldSpineModelForState() {
  return buildWorldSpineTimelineModel({
    workspace: state.workspace,
    scenes: buildWorldSpineSceneRecordsForState(),
    selectedNodeId: state.selectedNodeId,
    selectedBlockId: state.selectedBlockId,
    customMetadataDefinitions: getCustomMetadataDefinitions(),
  });
}

// Intent: keep World Spine renders on draft-overlay scene/event metadata instead of stale loaded scene mirrors.
function buildWorldSpineSceneRecordsForState() {
  return buildSceneRecords(
    state.workspace,
    buildSceneDraftsWithLoadedSceneStoreBodies(),
    state.structureDrafts,
  );
}

// Intent: give pointer/scroll hit-testing the same location-filter fit projection as the rendered timeline.
function buildWorldSpineViewportModelForState() {
  return createWorldSpineLocationFilterViewportModel(
    buildWorldSpineModelForState(),
    state.worldSpineLocationFilter,
  );
}

function renderWorldPanel() {
  const slot = document.querySelector("#world-slot");
  if (!slot) {
    return;
  }

  const previousTimelineScroll = slot.querySelector("[data-world-spine-timeline-scroll]");
  const previousManuscriptScroll = slot.querySelector("[data-world-spine-manuscript-scroll]");
  const timelineScrollLeft = previousTimelineScroll instanceof HTMLElement
    ? previousTimelineScroll.scrollLeft
    : state.worldSpineTimelineScrollLeft;
  const manuscriptScrollTop = previousManuscriptScroll instanceof HTMLElement
    ? previousManuscriptScroll.scrollTop
    : state.worldSpineManuscriptScrollTop;

  const worldSpineModel = buildWorldSpineModelForState();
  const catalogueScope = buildWorldbuildingCatalogueScopeForState(worldSpineModel);
  const relatedCards = buildWorldbuildingRelatedCatalogueCardsModel({
    world: state.workspace?.world ?? {},
    catalogueScope,
  });

  slot.innerHTML = renderWorldSpinePanelHTML(worldSpineModel, {
    layout: getWorldSpineLayoutSnapshot(),
    implicationComposer: state.worldSpineImplicationComposer,
    history: getWorldSpineHistoryRenderState(),
    timelineZoom: worldSpineController.getTimelineZoom(),
    rightPaneMode: state.worldSpineRightPaneMode,
    relatedCards,
    relatedCardExpandedKey: state.worldSpineRelatedCardExpandedKey,
    sublocationComposer: state.worldSpineSublocationComposer,
    locationFilter: state.worldSpineLocationFilter,
    locationFilterOpen: state.worldSpineLocationFilterOpen,
    unplacedDockCollapsed: state.worldSpineUnplacedDockCollapsed,
  });
  window.requestAnimationFrame(() => {
    syncWorldSpinePanelLayout({ reason: "world-panel-render" });
    restoreWorldSpineScrollPositions({
      timelineScrollLeft,
      manuscriptScrollTop,
    });
    worldSpineController.syncAfterRender();
    focusWorldSpineImplicationComposer();
  });
}

function getWorldSpineHistoryRenderState() {
  return {
    canUndo: canUndoWorldSpineHistory(state.worldSpineHistory) || canUndoBinderSceneMoveHistory(),
    canRedo: canRedoWorldSpineHistory(state.worldSpineHistory) || canRedoBinderSceneMoveHistory(),
  };
}

// Intent: capture the World Spine state that author-facing graph, pinning, and layout actions can mutate.
function captureWorldSpineHistorySnapshot() {
  const project = state.workspace?.project ?? {};
  return {
    world: cloneValue(state.workspace?.world ?? {}),
    projectEventTags: cloneValue(project.eventTags ?? []),
    projectSequences: cloneValue(project.sequences ?? {}),
    projectStats: cloneValue(project.stats ?? {}),
    projectLines: cloneValue(project.lines ?? []),
    sceneDrafts: cloneValue(state.sceneDrafts ?? {}),
    structureDrafts: cloneValue(state.structureDrafts ?? {}),
    selectedNodeId: state.selectedNodeId ?? "",
    selectedBlockId: state.selectedBlockId ?? "",
    selectedIssueId: state.selectedIssueId ?? null,
    selectedEntityId: state.selectedEntityId ?? null,
    worldSpineEventRailWidth: state.worldSpineEventRailWidth,
    worldSpineManuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
    worldSpinePanelLayoutProfiles: cloneValue(state.worldSpinePanelLayoutProfiles ?? {}),
    worldSpineTimelineScrollLeft: state.worldSpineTimelineScrollLeft,
    worldSpineManuscriptScrollTop: state.worldSpineManuscriptScrollTop,
    timelineZoom: worldSpineController.getTimelineZoom(),
  };
}

function pushWorldSpineHistoryChange(beforeSnapshot, { label = "", dirtyReason = "", source = "", afterSnapshot = null } = {}) {
  state.worldSpineHistory = pushWorldSpineHistoryEntry(state.worldSpineHistory, {
    id: createWorldSpineHistoryEntryId(),
    label,
    dirtyReason,
    source,
    before: beforeSnapshot,
    after: afterSnapshot ?? captureWorldSpineHistorySnapshot(),
  });
}

function createWorldSpineHistoryEntryId() {
  const history = createWorldSpineHistoryState(state.worldSpineHistory);
  const nextIndex = history.undoStack.length + history.redoStack.length + 1;
  return `world-spine-history-${String(nextIndex).padStart(4, "0")}-${Date.now()}`;
}

// Intent: restore a history snapshot through the same render and persistence boundaries as normal World Spine edits.
function applyWorldSpineHistorySnapshot(snapshot, { entry = null, direction = "undo" } = {}) {
  if (!snapshot || typeof snapshot !== "object" || !state.workspace?.project) {
    return false;
  }

  state.workspace.world = cloneValue(snapshot.world ?? {});
  state.workspace.project = {
    ...state.workspace.project,
    eventTags: cloneValue(snapshot.projectEventTags ?? []),
    sequences: cloneValue(snapshot.projectSequences ?? {}),
    stats: cloneValue(snapshot.projectStats ?? state.workspace.project.stats ?? {}),
    lines: cloneValue(snapshot.projectLines ?? state.workspace.project.lines ?? []),
  };
  state.sceneDrafts = cloneValue(snapshot.sceneDrafts ?? {});
  state.structureDrafts = cloneValue(snapshot.structureDrafts ?? createStructureDrafts());
  setWorldSpineSelectedNodeId(snapshot.selectedNodeId || null);
  state.selectedBlockId = snapshot.selectedBlockId || null;
  state.selectedIssueId = snapshot.selectedIssueId || null;
  state.selectedEntityId = snapshot.selectedEntityId || null;
  if (Number.isFinite(Number(snapshot.worldSpineEventRailWidth))) {
    state.worldSpineEventRailWidth = Number(snapshot.worldSpineEventRailWidth);
  }
  if (Number.isFinite(Number(snapshot.worldSpineManuscriptPaneWidth))) {
    state.worldSpineManuscriptPaneWidth = Number(snapshot.worldSpineManuscriptPaneWidth);
  }
  state.worldSpinePanelLayoutProfiles = normalizeWorldSpineLayoutProfiles(snapshot.worldSpinePanelLayoutProfiles);
  state.worldSpineTimelineScrollLeft = Math.max(0, Number(snapshot.worldSpineTimelineScrollLeft) || 0);
  state.worldSpineManuscriptScrollTop = Math.max(0, Number(snapshot.worldSpineManuscriptScrollTop) || 0);
  if (Number.isFinite(Number(snapshot.timelineZoom))) {
    worldSpineController.setTimelineZoom(Number(snapshot.timelineZoom));
  }
  state.worldSpineImplicationComposer = null;
  state.worldbuildingStudioCategoryId = "";
  state.worldbuildingCatalogueCategoryId = "";
  state.worldbuildingCataloguePosition = null;
  state.worldbuildingCatalogueBounds = null;
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  clearWorldbuildingCatalogueEditState();

  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  writeStoredJsonRaw(EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY, state.worldSpinePanelLayoutProfiles);
  writeStoredJsonRaw(EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY, state.worldSpineEventRailWidth);
  writeStoredJsonRaw(EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY, state.worldSpineManuscriptPaneWidth);
  refreshScenes();
  persistCurrentProjectRecord({
    domain: "world-spine-history",
    dirtyReason: `world-spine-history-${direction}`,
    source: entry?.source || "applyWorldSpineHistorySnapshot",
  });
  render();
  return true;
}

function undoWorldSpineInteraction() {
  const previousHistory = state.worldSpineHistory;
  const result = undoWorldSpineHistory(state.worldSpineHistory);
  if (!result.snapshot) {
    return undoBinderSceneMove();
  }

  state.worldSpineHistory = result.history;
  if (!applyWorldSpineHistorySnapshot(result.snapshot, result)) {
    state.worldSpineHistory = previousHistory;
    return false;
  }
  return true;
}

function redoWorldSpineInteraction() {
  const previousHistory = state.worldSpineHistory;
  const result = redoWorldSpineHistory(state.worldSpineHistory);
  if (!result.snapshot) {
    return redoBinderSceneMove();
  }

  state.worldSpineHistory = result.history;
  if (!applyWorldSpineHistorySnapshot(result.snapshot, result)) {
    state.worldSpineHistory = previousHistory;
    return false;
  }
  return true;
}

function restoreWorldSpineScrollPositions({ timelineScrollLeft = 0, manuscriptScrollTop = 0 } = {}) {
  const timelineScroll = document.querySelector("[data-world-spine-timeline-scroll]");
  const manuscriptScroll = document.querySelector("[data-world-spine-manuscript-scroll]");
  const scrollTargetNodeId = state.worldSpineScrollTargetNodeId;
  const scrollTargetLocationKey = state.worldSpineScrollTargetLocationKey;
  const passageTargetBlockId = state.worldSpinePassageScrollTargetBlockId;

  if (timelineScroll instanceof HTMLElement) {
    timelineScroll.scrollLeft = Math.max(0, Number(timelineScrollLeft) || 0);
  }
  if (manuscriptScroll instanceof HTMLElement) {
    manuscriptScroll.scrollTop = Math.max(0, Number(manuscriptScrollTop) || 0);
  }

  if (scrollTargetNodeId) {
    worldSpineController.scrollNodeIntoView(scrollTargetNodeId, { behavior: "smooth" });
    state.worldSpineScrollTargetNodeId = "";
  } else if (scrollTargetLocationKey) {
    worldSpineController.scrollLocationIntoView(scrollTargetLocationKey, { behavior: "smooth" });
    state.worldSpineScrollTargetLocationKey = "";
  }
  if (passageTargetBlockId) {
    worldSpineController.scrollPassageIntoView(passageTargetBlockId, { behavior: "smooth" });
    state.worldSpinePassageScrollTargetBlockId = "";
  }
}

function renderEntityPanel() {
  // Intent: keep the permanent World inspector hidden while node details live in temporary detail cards.
  const slot = document.querySelector("#entity-slot");
  if (slot) {
    slot.innerHTML = "";
  }
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
  const studioModel = buildWorldbuildingStudioModel({
    world: workspace.world,
    projectCharacters: workspace.project?.characters ?? [],
    activeCategoryId: state.worldbuildingStudioCategoryId,
    editingItemId: state.worldbuildingEditingCatalogueItemId,
    editingItemKind: state.worldbuildingEditingCatalogueItemKind,
    catalogueCategoryId: state.worldbuildingCatalogueCategoryId,
    cataloguePosition: state.worldbuildingCataloguePosition,
    catalogueBounds: state.worldbuildingCatalogueBounds,
    catalogueSelectedItemId: state.worldbuildingCatalogueSelectedItemId,
    catalogueSelectedItemKind: state.worldbuildingCatalogueSelectedItemKind,
    catalogueScope: buildWorldbuildingCatalogueScopeForState(),
    status: state.worldbuildingStudioStatus,
  });

  document.querySelector("#dream-slot").innerHTML = `
    <div class="panel-heading dream-panel-heading">
      <div class="dream-panel-title">
        <p class="panel-kicker">Dream Scaping</p>
        <h2>Story-Fit Ideation</h2>
      </div>
      <div class="dream-worldbuilding-lane" aria-label="World Spine quick add">
        ${renderWorldbuildingStudioHTML(studioModel)}
      </div>
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
  syncWorldbuildingEntryPopoverPortal();
  syncWorldbuildingCataloguePortal();
  syncWorldbuildingCataloguePositionToViewport();
  syncWorldbuildingEntryPopoverPosition();
}

// Intent: offer character-name pickers from project characters and structured World Spine character records.
function getWorldSpineCharacterPickerOptions() {
  return buildWorldSpineCharacterOptions({
    projectCharacters: state.workspace?.project?.characters ?? [],
    world: state.workspace?.world ?? {},
  });
}

// Intent: feed form quick-reference lists from structured project and World Spine catalogue indexes.
function getWorldSpinePickerOptionSetsForState() {
  return buildWorldSpinePickerOptionSets({
    projectCharacters: state.workspace?.project?.characters ?? [],
    world: state.workspace?.world ?? {},
  });
}

// Intent: pass the selected World Spine event/scene context into the catalogue renderer without persisting derived counts.
function buildWorldbuildingCatalogueScopeForState(worldSpineModel = null) {
  const selectedNodeId = String(state.selectedNodeId ?? "").trim();
  if (!selectedNodeId) {
    return null;
  }

  const node = worldSpineModel
    ? findWorldSpineNode(worldSpineModel, selectedNodeId)
    : getWorldSpineTimelineNode(selectedNodeId);
  if (!node) {
    return null;
  }

  const scene = node.sceneId ? getScene(node.sceneId) : null;
  const sceneText = scene
    ? [
        scene.sceneSynopsis,
        scene.editorText,
        ...(Array.isArray(scene.blocks) ? scene.blocks.map((block) => block?.text) : []),
      ].filter(Boolean).join(" ")
    : "";

  return {
    nodeId: node.id,
    sourceId: node.sourceId,
    level: node.level,
    kind: node.kind,
    typeLabel: node.typeLabel,
    title: node.title,
    summary: node.summary,
    sceneId: node.sceneId,
    chapterId: node.chapterId,
    sceneTitle: node.sceneTitle,
    chapterTitle: node.chapterTitle,
    primaryBlockId: node.primaryBlockId,
    location: node.location,
    mainLocation: node.locationRowLabel || node.location,
    locationRowLabel: node.locationRowLabel,
    sublocation: node.sublocationLabel || node.sublocation,
    linkedLocations: node.linkedLocations,
    date: node.date,
    time: node.time,
    people: node.people,
    sceneBeats: node.sceneBeats,
    criticalEvents: node.criticalEvents,
    linkedEntityNames: node.linkedEntityNames,
    customMetadata: node.customMetadata,
    lineNumbers: node.lineNumbers,
    searchText: sceneText,
    label: node.typeLabel ? `${node.typeLabel}: ${node.title}` : node.title,
  };
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

function getNarrationTakeSelectionForScene(sceneId) {
  const scene = getScene(sceneId);
  const selection = selectNarrationTakeSelectionForScene(scene, {
    currentSelection: state.narrationTakeSelection,
    selectedBlockId: state.selectedBlockId,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    getSceneBlockRanges,
  });
  return enrichNarrationSelectionDisplayLine(scene, selection);
}

function updateNarrationTakeSelectionFromTextarea(textarea, inlinePosition = null) {
  if (state.narrationTakeSession?.status === "recording") {
    return state.narrationTakeSelection;
  }

  const rawSelection = resolveNarrationTakeSelectionFromTextarea(textarea, inlinePosition);
  const selection = rawSelection
    ? enrichNarrationSelectionDisplayLine(getScene(rawSelection.sceneId), rawSelection)
    : null;
  if (!selection) {
    return null;
  }

  const currentSelectionKey = state.narrationTakeSelection
    ? `${state.narrationTakeSelection.sceneId}:${state.narrationTakeSelection.blockId}:${state.narrationTakeSelection.startOffset}:${state.narrationTakeSelection.endOffset}:${state.narrationTakeSelection.displayLineNumber ?? ""}:${state.narrationTakeSelection.selectedText}`
    : "";
  const nextSelectionKey = `${selection.sceneId}:${selection.blockId}:${selection.startOffset}:${selection.endOffset}:${selection.displayLineNumber ?? ""}:${selection.selectedText}`;

  state.narrationTakeSelection = selection;
  syncSelectionFromBlock(selection.blockId);

  if (currentSelectionKey !== nextSelectionKey) {
    renderManuscriptPanel();
    renderConsolePanel();
    syncSceneDocumentLayout();
    syncNarrationTakeSelectionPreview();
  }

  return selection;
}

function clearNarrationTakeSelection() {
  cancelNarrationFollowPreviewFrame();
  state.narrationTakeSelection = null;
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
  resetNarrationFollowTrackingRuntime();
}

function setNarrationTakeSession(session) {
  const previousSession = state.narrationTakeSession;
  state.narrationTakeSession = session;
  if (previousSession?.status === "recording" && session?.status === "recording") {
    syncNarrationSessionPanelValues(session);
    requestNarrationTakeSelectionPreviewSync();
    return;
  }

  cancelNarrationFollowPreviewFrame();
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
  syncNarrationTakeSelectionPreview();
}

function syncNarrationSessionPanelValues(session) {
  const panel = document.querySelector(".narration-metadata-panel");
  if (!(panel instanceof HTMLElement)) {
    renderConsolePanel();
    return;
  }

  setNarrationPanelText(panel, "[data-narration-status-value]", `Recording ${session?.elapsedLabel ?? "0:00"}`);
  setNarrationPanelText(panel, "[data-narration-tracker-value]", session?.trackerStatus || "Speech tracker idle");
  setNarrationPanelText(panel, "[data-narration-engine-value]", session?.speechProviderLabel || session?.speechProviderId || "");
  setNarrationPanelText(panel, "[data-narration-live-transcript]", resolveNarrationPanelLiveTranscript(session));
  setNarrationPanelText(panel, "[data-narration-whisper-transcript]", resolveNarrationPanelWhisperTranscript(session));
}

function setNarrationPanelText(panel, selector, value) {
  const element = panel.querySelector(selector);
  if (element instanceof HTMLElement) {
    element.textContent = String(value ?? "");
  }
}

function resolveNarrationPanelLiveTranscript(session) {
  const transcript = String(
    session?.liveTranscript ??
    session?.speechSnapshot?.changedTranscript ??
    (session?.status === "recording" ? session?.transcript : "") ??
    "",
  ).trim();
  return transcript || "Waiting for local speech...";
}

function resolveNarrationPanelWhisperTranscript(session) {
  const transcript = String(
    session?.cleanupTranscript ??
    (session?.status === "recording" ? "" : session?.transcript) ??
    "",
  ).trim();
  return transcript || "Runs after stop.";
}

function toggleNarrationFollowScrollPreference() {
  const result = toggleNarrationFollowScroll(state.narrationFollowSettings);
  state.narrationFollowSettings = result.settings;
  writeStoredJsonRaw(EDITOR_NARRATION_FOLLOW_SETTINGS_KEY, result.settings);
  narrationFollowTrackerLog.info("user-action", "narration-follow.scroll-toggle", "Toggled narration follow scroll.", {
    followScrollEnabled: result.settings.followScrollEnabled,
    liveHighlightEnabled: result.settings.liveHighlightEnabled,
    changed: result.changed,
  });
  renderConsolePanel();
  syncNarrationTakeSelectionPreview();
}

// Intent: hide or restore narration-mode manuscript overlays while keeping saved take data unchanged.
function toggleNarrationManuscriptDecorationPreference() {
  const result = toggleNarrationManuscriptDecorations(state.narrationFollowSettings);
  state.narrationFollowSettings = result.settings;
  writeStoredJsonRaw(EDITOR_NARRATION_FOLLOW_SETTINGS_KEY, result.settings);
  narrationFollowTrackerLog.info("user-action", "narration-follow.decorations-toggle", "Toggled narration manuscript decorations.", {
    followScrollEnabled: result.settings.followScrollEnabled,
    liveHighlightEnabled: result.settings.liveHighlightEnabled,
    manuscriptDecorationsVisible: result.settings.manuscriptDecorationsVisible,
    narrationDecorationsVisible: result.settings.narrationDecorationsVisible,
    changed: result.changed,
  });
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
  syncNarrationTakeSelectionPreview();
}

// Intent: hide or restore saved-take and live-follow narration paint while preserving manuscript diagnostics.
function toggleNarrationDecorationPreference() {
  const result = toggleNarrationDecorations(state.narrationFollowSettings);
  state.narrationFollowSettings = result.settings;
  writeStoredJsonRaw(EDITOR_NARRATION_FOLLOW_SETTINGS_KEY, result.settings);
  narrationFollowTrackerLog.info("user-action", "narration-follow.narration-decorations-toggle", "Toggled narration passage decorations.", {
    followScrollEnabled: result.settings.followScrollEnabled,
    liveHighlightEnabled: result.settings.liveHighlightEnabled,
    manuscriptDecorationsVisible: result.settings.manuscriptDecorationsVisible,
    narrationDecorationsVisible: result.settings.narrationDecorationsVisible,
    changed: result.changed,
  });
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
  syncNarrationTakeSelectionPreview();
}

// Intent: reset live follow pacing as one unit so scroll speed does not leak between scenes or sessions.
function resetNarrationFollowTrackingRuntime() {
  cancelNarrationFollowPreviewFrame();
  cancelNarrationFollowViewportPulse();
  narrationViewportTracker?.reset();
  narrationReadingRateTracker?.reset();
  narrationFollowViewportMetricsCache.clear();
}

// Intent: keep follow scrolling moving between uneven ASR updates without inventing durable cursor state.
function scheduleNarrationFollowViewportPulse() {
  if (narrationFollowViewportPulseTimerId != null) {
    return;
  }

  narrationFollowViewportPulseTimerId = window.setTimeout(() => {
    narrationFollowViewportPulseTimerId = null;
    const liveFollowSelection = state.narrationTakeSession?.status === "recording"
      ? state.narrationTakeSession?.followSelection
      : null;
    if (
      state.activePane !== "narration" ||
      state.narrationFollowSettings?.followScrollEnabled === false ||
      !liveFollowSelection
    ) {
      return;
    }

    const textarea = getEditorTextareaForScene(liveFollowSelection.sceneId);
    const editorHost = resolveTextareaEditorHost(textarea);
    if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
      return;
    }

    const displayFollowSelection = createDisplayNarrationFollowSelection(liveFollowSelection, textarea.value);
    if (paceNarrationFollowViewport(editorHost, displayFollowSelection ?? liveFollowSelection)) {
      scheduleNarrationFollowViewportPulse();
    }
  }, 120);
}

function cancelNarrationFollowViewportPulse() {
  if (narrationFollowViewportPulseTimerId == null) {
    return;
  }

  window.clearTimeout(narrationFollowViewportPulseTimerId);
  narrationFollowViewportPulseTimerId = null;
}

function cancelNarrationFollowPreviewFrame() {
  if (narrationFollowPreviewFrameId == null) {
    return;
  }

  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(narrationFollowPreviewFrameId);
  }
  narrationFollowPreviewFrameId = null;
}

// Intent: coalesce bursty interim ASR results into the latest live follow position before repainting the overlay.
function requestNarrationTakeSelectionPreviewSync() {
  if (narrationFollowPreviewFrameId != null) {
    return;
  }

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    syncNarrationTakeSelectionPreview();
    return;
  }

  narrationFollowPreviewFrameId = window.requestAnimationFrame(() => {
    narrationFollowPreviewFrameId = null;
    syncNarrationTakeSelectionPreview();
  });
}

// Intent: compensate for browser speech-recognition result lag while keeping persisted follow anchors unmodified.
function createDisplayNarrationFollowSelection(selection, text = "") {
  return createNarrationFollowLeadSelection(selection, text);
}

// Intent: keep the armed narration verse or live follow match visible after scene rerenders.
function syncNarrationTakeSelectionPreview() {
  cancelNarrationFollowPreviewFrame();
  if (state.activePane !== "narration") {
    resetNarrationFollowTrackingRuntime();
    return;
  }

  const liveFollowSelection = state.narrationTakeSession?.status === "recording"
    ? state.narrationTakeSession?.followSelection
    : null;
  const baseSelection = liveFollowSelection ?? state.narrationTakeSelection;
  const textarea = getEditorTextareaForScene(baseSelection?.sceneId ?? state.selectedSceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return;
  }
  const displayFollowSelection = liveFollowSelection
    ? createDisplayNarrationFollowSelection(liveFollowSelection, textarea.value)
    : null;
  const selection = displayFollowSelection ?? baseSelection;

  if (!selection || selection.sceneId !== editorHost.sceneId) {
    clearTextareaRuntimeSelectionPreview(editorHost);
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
    resetNarrationFollowTrackingRuntime();
    return;
  }

  const previewSelections = displayFollowSelection
    ? createNarrationFollowPreviewSelections(displayFollowSelection, textarea.value)
    : selection;
  const projections = selectManuscriptProjections({
    sceneId: editorHost.sceneId,
    text: textarea.value,
    narrationSelection: previewSelections,
    includeAuthorMarks: false,
    includeDraftProofing: false,
    includeDiagnostics: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  }).filter((candidate) => candidate.channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  const primaryProjection = projections.find((projection) => projection.styleToken === "narration-follow-current")
    ?? projections[0]
    ?? null;
  if (displayFollowSelection) {
    clearTextareaRuntimeSelectionPreview(editorHost);
    if (
      state.narrationFollowSettings?.liveHighlightEnabled !== false &&
      !areNarrationDecorationsSuppressed()
    ) {
      renderTextareaNarrationFollowLayer(editorHost, {
        sceneId: editorHost.sceneId,
        text: textarea.value,
        projections,
      });
    } else {
      clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
    }
    if (state.narrationFollowSettings?.followScrollEnabled !== false) {
      if (paceNarrationFollowViewport(editorHost, displayFollowSelection)) {
        scheduleNarrationFollowViewportPulse();
      }
    } else {
      cancelNarrationFollowViewportPulse();
      narrationViewportTrackerLog.debug("viewport", "narration-follow.viewport-disabled", "Skipped narration follow viewport movement because follow scroll is disabled.", {
        sceneId: editorHost.sceneId,
        blockId: displayFollowSelection.blockId ?? "",
        trackingStartOffset: displayFollowSelection.trackingStartOffset ?? null,
        trackingEndOffset: displayFollowSelection.trackingEndOffset ?? null,
      });
    }
  } else {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
    showTextareaRuntimeSelectionPreview(editorHost, primaryProjection, {
      focus: false,
      scroll: false,
      behavior: "auto",
    });
    resetNarrationFollowTrackingRuntime();
  }
}

// Intent: split live follow paint into cumulative read coverage and the newest spoken words.
function createNarrationFollowPreviewSelections(selection, text = "") {
  if (!selection || typeof selection !== "object") {
    return [];
  }

  const textLength = String(text ?? "").length;
  const coverageStartOffset = Number.isInteger(selection.startOffset)
    ? selection.startOffset
    : selection.blockStartOffset;
  const coverageEndOffset = Number.isInteger(selection.coverageEndOffset)
    ? selection.coverageEndOffset
    : Number.isInteger(selection.trackingEndOffset)
      ? selection.trackingEndOffset
      : selection.endOffset;
  const trackingStartOffset = Number.isInteger(selection.trackingStartOffset)
    ? selection.trackingStartOffset
    : selection.startOffset;
  const trackingEndOffset = Number.isInteger(selection.trackingEndOffset)
    ? selection.trackingEndOffset
    : selection.endOffset;
  const previews = [];
  if (
    Number.isInteger(coverageStartOffset) &&
    Number.isInteger(coverageEndOffset) &&
    coverageStartOffset >= 0 &&
    coverageEndOffset > coverageStartOffset &&
    coverageEndOffset <= textLength
  ) {
    previews.push({
      ...selection,
      id: `${selection.id ?? "narration-follow"}:read:${coverageStartOffset}:${coverageEndOffset}`,
      startOffset: coverageStartOffset,
      endOffset: coverageEndOffset,
      styleToken: "narration-follow-read",
    });
  }

  if (
    Number.isInteger(trackingStartOffset) &&
    Number.isInteger(trackingEndOffset) &&
    trackingStartOffset >= 0 &&
    trackingEndOffset > trackingStartOffset &&
    trackingEndOffset <= textLength
  ) {
    previews.push({
      ...selection,
      id: `${selection.id ?? "narration-follow"}:current:${trackingStartOffset}:${trackingEndOffset}`,
      startOffset: trackingStartOffset,
      endOffset: trackingEndOffset,
      styleToken: "narration-follow-current",
    });
  }

  return previews.length ? previews : [selection];
}

// Intent: use the live tracking span as the viewport target so long cumulative take ranges do not pull the reader backward.
function getNarrationFollowViewportOffset(selection) {
  return resolveNarrationFollowViewportOffsets(selection).startOffset;
}

function paceNarrationFollowViewport(editorHost, selection) {
  if (!(editorHost?.textarea instanceof HTMLTextAreaElement) || !selection || !narrationViewportTracker) {
    return false;
  }

  const codeframe = editorHost.textarea.closest(".scene-editor-codeframe");
  if (!(codeframe instanceof HTMLElement)) {
    return false;
  }

  const { charactersPerLine, lineHeight } = getTextareaEditorHostWrapMetrics(editorHost);
  const viewportMetrics = narrationFollowViewportMetricsCache.resolveMetrics({
    text: editorHost.textarea.value,
    charactersPerLine,
  });
  const body = editorHost.textarea.closest(".editor-document-body");
  const bodyStyle = body instanceof HTMLElement ? window.getComputedStyle(body) : null;
  const paddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || "0") : 0;
  const startOffset = getNarrationFollowViewportOffset(selection);
  const visualLineIndex = resolveTextareaVisualLineIndexForOffset(editorHost, startOffset);
  const viewportOffsets = resolveNarrationFollowViewportOffsets(selection);
  const trackingEndOffset = viewportOffsets.endOffset;
  const nowMs = Date.now();
  const narrationWordIndex = viewportMetrics.countWordsBeforeOffset(trackingEndOffset);
  const readingRate = narrationReadingRateTracker?.update({
    sceneId: editorHost.sceneId,
    wordIndex: narrationWordIndex,
    averageWordsPerLine: viewportMetrics.averageWordsPerLine,
    nowMs,
  }) ?? null;
  const targetTop = Math.max(
    0,
    Math.min(
      Math.max(0, codeframe.scrollHeight - codeframe.clientHeight),
      paddingTop + visualLineIndex * lineHeight - codeframe.clientHeight * 0.42,
    ),
  );
  const viewportCenterLineIndex = Math.max(
    0,
    Math.floor((codeframe.scrollTop + codeframe.clientHeight / 2 - paddingTop) / lineHeight),
  );
  const plan = narrationViewportTracker.planScroll({
    sceneId: editorHost.sceneId,
    matchedLineIndex: visualLineIndex,
    currentScrollTop: codeframe.scrollTop,
    targetScrollTop: targetTop,
    viewportCenterLineIndex,
    lineHeight,
    readingRateLinesPerMinute: readingRate?.linesPerMinute ?? null,
    readingRateContext: readingRate,
    nowMs,
  });

  if (!plan.shouldScroll) {
    narrationViewportTrackerLog.debug("viewport", "narration-follow.viewport-noop", "Narration follow viewport did not need movement.", {
      sceneId: editorHost.sceneId,
      blockId: selection.blockId ?? "",
      trackingStartOffset: selection.trackingStartOffset ?? null,
      trackingEndOffset: selection.trackingEndOffset ?? null,
      startOffset: selection.startOffset ?? null,
      endOffset: selection.endOffset ?? null,
      visualLineIndex,
      currentScrollTop: codeframe.scrollTop,
      targetScrollTop: targetTop,
      viewportCenterLineIndex,
      readingRate,
      plan,
    });
    return false;
  }

  narrationViewportTrackerLog.debug("viewport", "narration-follow.viewport-scroll", "Applied narration follow viewport movement.", {
    sceneId: editorHost.sceneId,
    blockId: selection.blockId ?? "",
    trackingStartOffset: selection.trackingStartOffset ?? null,
    trackingEndOffset: selection.trackingEndOffset ?? null,
    startOffset: selection.startOffset ?? null,
    endOffset: selection.endOffset ?? null,
    visualLineIndex,
    scrollHeight: codeframe.scrollHeight,
    clientHeight: codeframe.clientHeight,
    currentScrollTop: codeframe.scrollTop,
    targetScrollTop: targetTop,
    viewportCenterLineIndex,
    readingRate,
    plan,
  });
  codeframe.scrollTo({
    top: plan.scrollTop,
    behavior: "auto",
  });
  return true;
}

function resolveNarrationVisibleTextRangeForScene(sceneId) {
  const textarea = getEditorTextareaForScene(sceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return null;
  }

  const codeframe = textarea.closest(".scene-editor-codeframe");
  if (!(codeframe instanceof HTMLElement)) {
    return null;
  }

  const { charactersPerLine, lineHeight } = getTextareaEditorHostWrapMetrics(editorHost);
  const body = textarea.closest(".editor-document-body");
  const bodyStyle = body instanceof HTMLElement ? window.getComputedStyle(body) : null;
  const paddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || "0") : 0;
  const visibleRange = estimateNarrationVisibleTextRange({
    text: textarea.value,
    scrollTop: codeframe.scrollTop,
    clientHeight: codeframe.clientHeight,
    lineHeight,
    paddingTop,
    charactersPerLine,
  });

  narrationFollowTrackerLog.debug(
    "alignment",
    "narration-follow.viewport-range",
    "Resolved narration follow search viewport from the manuscript scroll position.",
    {
      sceneId,
      scrollTop: codeframe.scrollTop,
      clientHeight: codeframe.clientHeight,
      lineHeight,
      charactersPerLine,
      paddingTop,
      visibleRange,
    },
  );
  return visibleRange;
}

function getNarrationSelectionLineNumber(selection) {
  const displayLineNumber = Number(selection?.displayLineNumber);
  if (Number.isInteger(displayLineNumber) && displayLineNumber > 0) {
    return displayLineNumber;
  }

  const lineNumber = Number(selection?.lineNumber);
  return Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null;
}

function enrichNarrationSelectionDisplayLine(scene, selection) {
  if (!scene || !selection) {
    return selection ?? null;
  }

  const textarea = getEditorTextareaForScene(scene.sceneId);
  const offset = Number.isInteger(selection.startOffset)
    ? selection.startOffset
    : Number.isInteger(selection.caretOffset)
      ? selection.caretOffset
      : null;
  const displayLineNumber = textarea instanceof HTMLTextAreaElement && Number.isInteger(offset)
    ? getSceneEditorSelectionLineNumber(textarea, scene, offset)
    : null;

  if (!Number.isInteger(displayLineNumber) || displayLineNumber < 1) {
    return selection;
  }

  return {
    ...selection,
    displayLineNumber,
  };
}

function formatNarrationFollowDisplayStatus(selection, fallbackStatus = "Speech tracker listening") {
  if (!selection) {
    return fallbackStatus;
  }

  const lineNumber = getNarrationSelectionLineNumber(selection);
  const confidence = Number(selection.confidence);
  if (!Number.isFinite(confidence)) {
    return lineNumber ? `Tracking line ${lineNumber}` : fallbackStatus;
  }

  const confidenceLabel = `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
  const lineLabel = lineNumber ? `line ${lineNumber}` : "current verse";
  return confidence >= 0.7
    ? `Tracking ${lineLabel} · ${confidenceLabel}`
    : `Recovering near ${lineLabel} · ${confidenceLabel}`;
}

function resolveNarrationFollowMatchForTranscript({ transcript, runtime, speechSnapshot = null }) {
  const sceneId = runtime?.selection?.sceneId ?? runtime?.followSelection?.sceneId ?? "";
  const viewportRange = resolveNarrationVisibleTextRangeForScene(sceneId);
  const follow = narrationFollowAlignmentService.alignTranscript({
    transcript,
    changedTranscript: speechSnapshot?.changedTranscript ?? runtime?.liveChangedTranscript ?? "",
    runtime,
    viewportRange,
  });
  const scene = getScene(follow?.followSelection?.sceneId ?? runtime?.selection?.sceneId ?? "");
  const matchedSelection = follow?.followSelection
    ? enrichNarrationSelectionDisplayLine(scene, follow.followSelection)
    : null;
  const followSelection = matchedSelection
    ? enrichNarrationSelectionDisplayLine(scene, mergeNarrationFollowSelectionRange(scene, runtime?.followSelection, matchedSelection))
    : null;
  const displayLineNumber = getNarrationSelectionLineNumber(followSelection);
  const match = follow?.match
    ? {
      ...follow.match,
      displayLineNumber: displayLineNumber ?? follow.match.displayLineNumber,
    }
    : null;
  const trackerStatus = followSelection && follow?.status === "tracking"
    ? formatNarrationFollowDisplayStatus(followSelection, follow.trackerStatus)
    : followSelection && follow?.status === "recovering"
      ? displayLineNumber
        ? `Speech tracker recovering near line ${displayLineNumber}`
        : follow.trackerStatus
      : follow?.trackerStatus;

  return {
    ...follow,
    trackerStatus,
    followSelection,
    match,
  };
}

function mergeNarrationFollowSelectionRange(scene, previousSelection, nextSelection) {
  if (!scene || !previousSelection || !nextSelection) {
    return nextSelection;
  }

  if (
    previousSelection.sceneId !== nextSelection.sceneId ||
    previousSelection.blockId !== nextSelection.blockId ||
    !Number.isInteger(previousSelection.startOffset) ||
    !Number.isInteger(previousSelection.endOffset) ||
    !Number.isInteger(nextSelection.startOffset) ||
    !Number.isInteger(nextSelection.endOffset)
  ) {
    return nextSelection;
  }

  const startOffset = Math.min(previousSelection.startOffset, nextSelection.startOffset);
  const endOffset = Math.max(previousSelection.endOffset, nextSelection.endOffset);
  if (startOffset === nextSelection.startOffset && endOffset === nextSelection.endOffset) {
    return nextSelection;
  }

  const selectedText = String(scene.editorText ?? "").slice(startOffset, endOffset) || nextSelection.selectedText;
  return {
    ...nextSelection,
    id: `narration-follow:${scene.sceneId}:${nextSelection.blockId}:${startOffset}:${endOffset}`,
    selectedText,
    verseText: selectedText,
    startOffset,
    endOffset,
    trackingStartOffset: Number.isInteger(nextSelection.trackingStartOffset)
      ? nextSelection.trackingStartOffset
      : nextSelection.startOffset,
    trackingEndOffset: Number.isInteger(nextSelection.trackingEndOffset)
      ? nextSelection.trackingEndOffset
      : nextSelection.endOffset,
  };
}

function resolveNarrationTakeSelectionFromTextarea(textarea, inlinePosition = null) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const sceneId = typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId : "";
  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const contextRange = getEditorContextRange(textarea);
  const caretOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const caretRange = resolveNarrationCaretLineRange(textarea, scene, caretOffset);
  return resolveNarrationTakeSelectionFromTextInput({
    scene,
    contextRange,
    caretOffset,
    caretRange,
    inlinePosition,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    findSceneBlockAtOffset,
    getSceneBlockRanges,
  });
}

function resolveNarrationCaretLineRange(textarea, scene, caretOffset) {
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !scene || !editorHost) {
    return null;
  }

  const blockRange = findSceneBlockAtOffset(scene, caretOffset);
  if (!blockRange?.blockId) {
    return null;
  }

  const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
  const visualLineIndex = resolveTextareaVisualLineIndexForOffset(editorHost, caretOffset);
  const visualLineStart = visualLineIndex <= 0
    ? 0
    : findTextareaOffsetForVisualLineEnd(textarea.value, visualLineIndex - 1, charactersPerLine);
  const visualLineEnd = findTextareaOffsetForVisualLineEnd(textarea.value, visualLineIndex, charactersPerLine);
  const startOffset = Math.max(blockRange.startOffset, Math.min(visualLineStart, blockRange.endOffset));
  const endOffset = Math.max(startOffset, Math.min(visualLineEnd, blockRange.endOffset));
  const selectedText = String(textarea.value ?? "").slice(startOffset, endOffset).trim();
  if (!selectedText || !/[\p{L}\p{N}]/u.test(selectedText)) {
    return null;
  }

  return {
    blockId: blockRange.blockId,
    startOffset,
    endOffset,
    selectedText,
    visualLineIndex,
  };
}

function buildNarrationTakeSelection(scene, block, blockRange, inlinePosition = null, startOffset = null, endOffset = null, selectedText = null) {
  const selection = buildNarrationTakeSelectionRecord(scene, block, {
    blockRange,
    inlinePosition,
    startOffset,
    endOffset,
    selectedText,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
  });
  return enrichNarrationSelectionDisplayLine(scene, selection);
}

function getSceneBlockRanges(scene) {
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < scene.blocks.length; index += 1) {
    const block = scene.blocks[index];
    const text = String(block.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      ...block,
      text,
      startOffset,
      endOffset,
    });
    offset = endOffset + (index < scene.blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

function findSceneBlockAtOffset(scene, offset) {
  if (!scene || !Array.isArray(scene.blocks) || !scene.blocks.length) {
    return null;
  }

  const ranges = getSceneBlockRanges(scene);
  const normalizedOffset = Math.max(0, Math.min(Number(offset) || 0, String(scene.editorText ?? "").length));
  const separatorIndex = ranges.findIndex((range, index) => {
    if (index <= 0) {
      return false;
    }
    const previousRange = ranges[index - 1];
    return normalizedOffset > previousRange.endOffset && normalizedOffset < range.startOffset;
  });
  if (separatorIndex >= 0) {
    const separatorMatch = ranges[separatorIndex];
    const previousRange = ranges[separatorIndex - 1] ?? null;
    const separatorMidpoint = previousRange
      ? previousRange.endOffset + Math.ceil((separatorMatch.startOffset - previousRange.endOffset) / 2)
      : separatorMatch.startOffset;
    return normalizedOffset >= separatorMidpoint ? separatorMatch : previousRange ?? separatorMatch;
  }

  const directMatch = ranges.find((range) => normalizedOffset >= range.startOffset && normalizedOffset <= range.endOffset);
  if (directMatch) {
    return directMatch;
  }

  let priorMatch = ranges[0];
  for (const range of ranges) {
    if (range.startOffset <= normalizedOffset) {
      priorMatch = range;
    } else {
      break;
    }
  }

  return priorMatch;
}

function createNarrationTakeSession(selection, options = {}) {
  return createNarrationTakeSessionRecord(selection, options, {
    clone: cloneValue,
  });
}

function updateNarrationTakeSessionFromRuntime(overrides = {}) {
  if (!narrationRecordingRuntime) {
    return;
  }

  const elapsedLabel = formatNarrationRecordingElapsedLabel(
    Date.now() - narrationRecordingRuntime.startedAtMs,
  );
  setNarrationTakeSession(createNarrationTakeSession(narrationRecordingRuntime.selection, {
    status: overrides.status ?? "recording",
    trackerStatus: overrides.trackerStatus ?? narrationRecordingRuntime.trackerStatus,
    transcript: overrides.transcript ?? narrationRecordingRuntime.transcript,
    liveTranscript: overrides.liveTranscript ?? narrationRecordingRuntime.liveTranscript ?? narrationRecordingRuntime.transcript,
    liveChangedTranscript: overrides.liveChangedTranscript ?? narrationRecordingRuntime.liveChangedTranscript ?? narrationRecordingRuntime.speechSnapshot?.changedTranscript ?? "",
    liveTranscriptUpdatedAt: overrides.liveTranscriptUpdatedAt ?? narrationRecordingRuntime.liveTranscriptUpdatedAt ?? narrationRecordingRuntime.speechSnapshot?.receivedAt ?? "",
    cleanupTranscript: overrides.cleanupTranscript ?? narrationRecordingRuntime.cleanupTranscript ?? "",
    elapsedLabel: overrides.elapsedLabel ?? elapsedLabel,
    recordingId: overrides.recordingId ?? narrationRecordingRuntime.recordingId,
    mediaPath: overrides.mediaPath ?? narrationRecordingRuntime.mediaPath,
    speechProviderId: overrides.speechProviderId ?? narrationRecordingRuntime.speechProviderId,
    speechProviderLabel: overrides.speechProviderLabel ?? narrationRecordingRuntime.speechProviderLabel,
    speechProviderKind: overrides.speechProviderKind ?? narrationRecordingRuntime.speechProviderKind,
    startedAtMs: overrides.startedAtMs ?? narrationRecordingRuntime.startedAtMs,
    sceneId: overrides.sceneId ?? narrationRecordingRuntime.selection?.sceneId,
    sceneTitle: overrides.sceneTitle ?? narrationRecordingRuntime.selection?.sceneTitle,
    chapterId: overrides.chapterId ?? narrationRecordingRuntime.selection?.chapterId,
    chapterTitle: overrides.chapterTitle ?? narrationRecordingRuntime.selection?.chapterTitle,
    blockId: overrides.blockId ?? narrationRecordingRuntime.selection?.blockId,
    followSelection: overrides.followSelection ?? narrationRecordingRuntime.followSelection,
    followMatch: overrides.followMatch ?? narrationRecordingRuntime.followMatch,
    speechSnapshot: overrides.speechSnapshot ?? narrationRecordingRuntime.speechSnapshot,
  }));
}

function refreshNarrationRecordingSession() {
  if (!narrationRecordingRuntime || state.narrationTakeSession?.status !== "recording") {
    return;
  }

  const elapsedLabel = formatNarrationRecordingElapsedLabel(
    Date.now() - narrationRecordingRuntime.startedAtMs,
  );
  if (state.narrationTakeSession.elapsedLabel === elapsedLabel) {
    return;
  }

  updateNarrationTakeSessionFromRuntime({ elapsedLabel });
}

async function startNarrationRecording(sceneId = state.selectedSceneId) {
  resetNarrationFollowTrackingRuntime();
  await narrationRecordingCommandService.startRecording(sceneId);
}

async function stopNarrationRecording() {
  await narrationRecordingCommandService.stopRecording();
}

function startNarrationCleanupTranscript(runtime) {
  if (typeof runtime?.speechRecognition?.finalizeTranscript !== "function") {
    return null;
  }

  try {
    return Promise.resolve(runtime.speechRecognition.finalizeTranscript());
  } catch (error) {
    return Promise.reject(error);
  }
}

// Intent: let stop/save release the recording UI while Whisper cleanup finishes and patches the saved take later.
function attachNarrationCleanupTranscript(recordingId, selection, cleanupTranscriptPromise) {
  if (!recordingId || !cleanupTranscriptPromise || typeof cleanupTranscriptPromise.then !== "function") {
    return;
  }

  cleanupTranscriptPromise
    .then((transcript) => {
      const cleanupTranscript = String(transcript ?? "").replace(/\s+/g, " ").trim();
      const existingRecord = voiceRecordingService.getById(recordingId);
      if (!existingRecord) {
        return;
      }

      const updatedRecord = cleanupTranscript
        ? applyNarrationCleanupTranscriptToRecord(existingRecord, cleanupTranscript)
        : existingRecord;
      if (cleanupTranscript) {
        voiceRecordingService.upsert(updatedRecord);
        if (state.narrationRecordingReview?.recordingId === recordingId) {
          state.narrationRecordingReview = createNarrationRecordingReviewState(updatedRecord, {
            currentTimeSeconds: state.narrationRecordingReview.currentTimeSeconds,
            durationSeconds: state.narrationRecordingReview.durationSeconds,
            waveformZoom: state.narrationRecordingReview.waveformZoom,
            selection: state.narrationRecordingReview.selection,
          });
          renderManuscriptPanel();
          syncSceneDocumentLayout();
          syncNarrationRecordingReviewDom(recordingId);
        }
        void processNarrationRecordingTranscriptAlignment(recordingId, {
          force: true,
        });
      }

      if (state.narrationTakeSession?.recordingId === recordingId) {
        setNarrationTakeSession(createNarrationTakeSession(selection ?? state.narrationTakeSelection, {
          ...state.narrationTakeSession,
          status: "paused",
          trackerStatus: cleanupTranscript
            ? "Whisper cleanup stored."
            : "Whisper cleanup finished without a replacement transcript.",
          transcript: state.narrationTakeSession.transcript || cleanupTranscript || "",
          cleanupTranscript: cleanupTranscript || state.narrationTakeSession.cleanupTranscript || "",
          recordingId,
          mediaPath: updatedRecord.mediaPath ?? state.narrationTakeSession.mediaPath,
          startedAtMs: Date.parse(state.narrationTakeSession.startedAt) || Date.now(),
        }));
      }

      if (cleanupTranscript) {
        persistCurrentProjectRecord({
          domain: "voice-recordings",
          dirtyReason: "narration-whisper-cleanup-complete",
          source: "attachNarrationCleanupTranscript",
          skipProjectFileAutosave: true,
          markWorkingState: true,
        });
        void saveCurrentProject();
      }

      reportBrowserLog("info", "voice-recording", "Narration Whisper cleanup finished.", {
        recordingId,
        transcriptLength: cleanupTranscript.length,
      });
    })
    .catch((error) => {
      if (state.narrationTakeSession?.recordingId === recordingId) {
        setNarrationTakeSession(createNarrationTakeSession(selection ?? state.narrationTakeSelection, {
          ...state.narrationTakeSession,
          status: "paused",
          trackerStatus: "Whisper cleanup failed; saved take audio is still available.",
          recordingId,
          startedAtMs: Date.parse(state.narrationTakeSession.startedAt) || Date.now(),
        }));
      }
      reportBrowserLog("error", "voice-recording", "Narration Whisper cleanup failed.", {
        error,
        recordingId,
      });
    });
}

async function finalizeNarrationRecording(recordingId, stopError = null) {
  let runtime = narrationRecordingRuntime;
  if (!runtime || runtime.recordingId !== recordingId) {
    return;
  }

  const cleanupTranscriptPromise = startNarrationCleanupTranscript(runtime);
  runtime = {
    ...runtime,
    trackerStatus: "Narration take saved. Whisper cleanup running in background...",
    transcript: runtime.transcript || runtime.liveTranscript || "",
  };

  narrationRecordingRuntime = null;
  resetNarrationFollowTrackingRuntime();
  const { finalRecord, selection, sessionOptions } = await narrationRecordingFinalizationService.finalizeRuntime(runtime, {
    stopError,
  });

  voiceRecordingService.upsert(finalRecord);
  const cleanupPending = Boolean(cleanupTranscriptPromise);
  setNarrationTakeSession(createNarrationTakeSession(selection, {
    ...sessionOptions,
    trackerStatus: finalRecord.status === "saved" && cleanupPending
      ? "Narration take saved. Whisper cleanup running in background..."
      : sessionOptions.trackerStatus,
    cleanupTranscript: cleanupPending ? "" : sessionOptions.cleanupTranscript,
  }));
  persistCurrentProjectRecord({ skipProjectFileAutosave: true });
  void saveCurrentProject();
  attachNarrationCleanupTranscript(finalRecord.id, selection, cleanupTranscriptPromise);
}

async function abortNarrationRecordingStart(selection, error, stream = null) {
  const runtime = narrationRecordingRuntime;
  narrationRecordingRuntime = null;
  resetNarrationFollowTrackingRuntime();
  narrationRecordingRuntimeService.cleanupRuntime(runtime, {
    additionalStream: stream,
  });

  const message = error instanceof Error ? error.message : String(error);
  setNarrationTakeSession(createNarrationTakeSession(selection, {
    status: "paused",
    trackerStatus: message || "Unable to start the narration take.",
  }));
  reportBrowserLog("error", "voice-recording", "Narration recording could not start.", {
    error,
    sceneId: selection?.sceneId ?? null,
    blockId: selection?.blockId ?? null,
  });
}

// Intent: capture actual browser media state for saved-take playback diagnostics.
function createVoiceRecordingPlaybackLogSnapshot(playbackState = voiceRecordingPreviewController.getPlaybackState()) {
  const audio = voiceRecordingPreviewController.getPreviewAudio();
  const previewUrl = voiceRecordingPreviewController.getPreviewUrl();
  const audioCurrentTimeSeconds = Number(audio?.currentTime);
  const audioDurationSeconds = Number(audio?.duration);
  const audioReadyState = Number(audio?.readyState);
  const audioNetworkState = Number(audio?.networkState);
  return {
    recordingId: typeof playbackState?.recordingId === "string" ? playbackState.recordingId : "",
    status: typeof playbackState?.status === "string" ? playbackState.status : "",
    active: playbackState?.active === true,
    stateCurrentTimeSeconds: Number.isFinite(Number(playbackState?.currentTimeSeconds))
      ? Number(playbackState.currentTimeSeconds)
      : null,
    stateDurationSeconds: Number.isFinite(Number(playbackState?.durationSeconds))
      ? Number(playbackState.durationSeconds)
      : null,
    audioCurrentTimeSeconds: Number.isFinite(audioCurrentTimeSeconds) ? audioCurrentTimeSeconds : null,
    audioDurationSeconds: Number.isFinite(audioDurationSeconds) ? audioDurationSeconds : null,
    audioPaused: typeof audio?.paused === "boolean" ? audio.paused : null,
    audioEnded: typeof audio?.ended === "boolean" ? audio.ended : null,
    audioReadyState: Number.isFinite(audioReadyState) ? audioReadyState : null,
    audioNetworkState: Number.isFinite(audioNetworkState) ? audioNetworkState : null,
    objectUrlActive: Boolean(previewUrl),
  };
}

// Intent: add a once-per-second playhead trace while saved-take playback is active.
function syncVoiceRecordingPlaybackTelemetry(playbackState, eventType = "") {
  const normalizedStatus = typeof playbackState?.status === "string" ? playbackState.status : "";
  if (playbackState?.active === true && ["loading", "playing"].includes(normalizedStatus)) {
    startVoiceRecordingPlaybackTelemetry(playbackState, eventType);
    return;
  }

  if (voiceRecordingPlaybackTelemetryTimerId) {
    stopVoiceRecordingPlaybackTelemetry(playbackState, eventType || normalizedStatus || "inactive");
  }
}

function startVoiceRecordingPlaybackTelemetry(playbackState, eventType = "") {
  if (
    voiceRecordingPlaybackTelemetryTimerId ||
    typeof window === "undefined" ||
    typeof window.setInterval !== "function"
  ) {
    return;
  }

  voiceRecordingPlaybackTelemetryStartedAtMs = Date.now();
  reportBrowserLog("info", "voice-recording", "Saved take playback telemetry started.", {
    eventType,
    ...createVoiceRecordingPlaybackLogSnapshot(playbackState),
  });
  voiceRecordingPlaybackTelemetryTimerId = window.setInterval(() => {
    const currentPlaybackState = voiceRecordingPreviewController.getPlaybackState();
    const elapsedMs = Date.now() - voiceRecordingPlaybackTelemetryStartedAtMs;
    reportBrowserLog("info", "voice-recording", "Saved take playback position.", {
      timerElapsedSeconds: Math.round(elapsedMs / 100) / 10,
      ...createVoiceRecordingPlaybackLogSnapshot(currentPlaybackState),
    });
  }, VOICE_RECORDING_PLAYBACK_LOG_INTERVAL_MS);
}

function stopVoiceRecordingPlaybackTelemetry(playbackState, eventType = "") {
  if (!voiceRecordingPlaybackTelemetryTimerId) {
    return;
  }

  window.clearInterval(voiceRecordingPlaybackTelemetryTimerId);
  voiceRecordingPlaybackTelemetryTimerId = null;
  const elapsedMs = voiceRecordingPlaybackTelemetryStartedAtMs
    ? Date.now() - voiceRecordingPlaybackTelemetryStartedAtMs
    : 0;
  voiceRecordingPlaybackTelemetryStartedAtMs = 0;
  reportBrowserLog("info", "voice-recording", "Saved take playback telemetry stopped.", {
    eventType,
    timerElapsedSeconds: Math.round(elapsedMs / 100) / 10,
    ...createVoiceRecordingPlaybackLogSnapshot(playbackState),
  });
}

function logVoiceRecordingPlaybackStateChange(playbackState, eventType = "") {
  if (eventType === "timeupdate") {
    return;
  }

  reportBrowserLog("info", "voice-recording", "Saved take playback state changed.", {
    eventType,
    ...createVoiceRecordingPlaybackLogSnapshot(playbackState),
  });
}

function logNarrationRecordingReviewWordClick(target, event) {
  const rect = typeof target?.getBoundingClientRect === "function"
    ? target.getBoundingClientRect()
    : null;
  reportBrowserLog("info", "voice-recording", "Saved take review word clicked.", {
    recordingId: target?.dataset?.recordingId ?? "",
    wordIndex: Number.isFinite(Number(target?.dataset?.reviewWordIndex))
      ? Number(target.dataset.reviewWordIndex)
      : null,
    requestedTimeSeconds: Number.isFinite(Number(target?.dataset?.reviewWordTime))
      ? Number(target.dataset.reviewWordTime)
      : null,
    wordText: String(target?.textContent ?? "").trim(),
    clientX: Number.isFinite(Number(event?.clientX)) ? Number(event.clientX) : null,
    clientY: Number.isFinite(Number(event?.clientY)) ? Number(event.clientY) : null,
    viewportWidth: typeof window !== "undefined" ? window.innerWidth : null,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : null,
    targetRect: rect
      ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      : null,
    playbackBefore: createVoiceRecordingPlaybackLogSnapshot(),
  });
}

function logNarrationRecordingReviewSliderSeek(target) {
  reportBrowserLog("info", "voice-recording", "Saved take review slider seek requested.", {
    recordingId: target?.dataset?.recordingId ?? "",
    requestedTimeSeconds: Number.isFinite(Number(target?.value)) ? Number(target.value) : null,
    minSeconds: Number.isFinite(Number(target?.min)) ? Number(target.min) : null,
    maxSeconds: Number.isFinite(Number(target?.max)) ? Number(target.max) : null,
    playbackBefore: createVoiceRecordingPlaybackLogSnapshot(),
  });
}

// Intent: cache decoded oscillogram peaks only for live review rendering; project records keep media references only.
function setNarrationRecordingWaveformState(recordingId, waveformState) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId) {
    return;
  }

  state.narrationRecordingWaveforms = {
    ...(state.narrationRecordingWaveforms && typeof state.narrationRecordingWaveforms === "object"
      ? state.narrationRecordingWaveforms
      : {}),
    [normalizedRecordingId]: waveformState,
  };
  syncNarrationRecordingReviewDom(normalizedRecordingId);
}

async function loadNarrationRecordingWaveform(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId) {
    return null;
  }

  const existingWaveform = state.narrationRecordingWaveforms?.[normalizedRecordingId];
  if (
    existingWaveform?.status === VOICE_RECORDING_WAVEFORM_STATUS.LOADING ||
    existingWaveform?.status === VOICE_RECORDING_WAVEFORM_STATUS.READY ||
    existingWaveform?.status === VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE
  ) {
    return existingWaveform;
  }

  const recording = voiceRecordingService.getById(normalizedRecordingId);
  if (!recording || recording.status !== "saved" || !recording.mediaPath) {
    const unavailableState = createVoiceRecordingWaveformState({
      recordingId: normalizedRecordingId,
      status: VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE,
      durationSeconds: Number(recording?.durationMs ?? 0) / 1000,
      reason: "recording-unavailable",
    });
    setNarrationRecordingWaveformState(normalizedRecordingId, unavailableState);
    return unavailableState;
  }

  setNarrationRecordingWaveformState(normalizedRecordingId, createVoiceRecordingWaveformState({
    recordingId: normalizedRecordingId,
    status: VOICE_RECORDING_WAVEFORM_STATUS.LOADING,
    durationSeconds: Number(recording.durationMs ?? 0) / 1000,
  }));

  try {
    const { blob } = await narrationMediaService.loadMediaBlob({
      filePath: recording.mediaPath,
      mediaMimeType: recording.mediaMimeType,
    });
    const waveformState = await voiceRecordingWaveformService.loadWaveform(blob, {
      recordingId: normalizedRecordingId,
    });
    const currentRecording = voiceRecordingService.getById(normalizedRecordingId);
    if (!currentRecording) {
      return waveformState;
    }

    const durationSeconds = waveformState.durationSeconds || Number(currentRecording.durationMs ?? 0) / 1000;
    const nextWaveformState = createVoiceRecordingWaveformState({
      ...waveformState,
      durationSeconds,
    });
    setNarrationRecordingWaveformState(normalizedRecordingId, nextWaveformState);
    reportBrowserLog("info", "voice-recording", "Saved take oscillogram prepared.", {
      recordingId: normalizedRecordingId,
      peakCount: nextWaveformState.peaks.length,
      status: nextWaveformState.status,
      reason: nextWaveformState.reason,
    });
    return nextWaveformState;
  } catch (error) {
    const errorState = createVoiceRecordingWaveformState({
      recordingId: normalizedRecordingId,
      status: VOICE_RECORDING_WAVEFORM_STATUS.ERROR,
      durationSeconds: Number(recording.durationMs ?? 0) / 1000,
      reason: "media-load-failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    setNarrationRecordingWaveformState(normalizedRecordingId, errorState);
    reportBrowserLog("warn", "voice-recording", "Saved take oscillogram could not load media.", {
      error,
      recordingId: normalizedRecordingId,
      mediaPath: recording.mediaPath,
    });
    return errorState;
  }
}

// Intent: process a saved take's real audio into durable transcript word timings when the review is opened.
async function processNarrationRecordingTranscriptAlignment(recordingId, {
  force = false,
} = {}) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId) {
    return null;
  }

  return narrationRecordingTranscriptAlignmentJobService.start(normalizedRecordingId, { force });
}

async function runNarrationRecordingTranscriptAlignmentJob(recordingId, {
  force = false,
} = {}) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  const recording = voiceRecordingService.getById(normalizedRecordingId);
  if (!shouldRefreshNarrationRecordingTranscriptAlignment(recording, { force })) {
    return recording?.transcriptAlignment ?? null;
  }

  try {
    const { blob } = await narrationMediaService.loadMediaBlob({
      filePath: recording.mediaPath,
      mediaMimeType: recording.mediaMimeType,
    });
    const currentRecord = voiceRecordingService.getById(normalizedRecordingId);
    if (!shouldRefreshNarrationRecordingTranscriptAlignment(currentRecord, { force })) {
      return currentRecord?.transcriptAlignment ?? null;
    }

    const transcriptAlignment = await narrationRecordingTranscriptAlignmentService.alignRecording(currentRecord, blob);
    const latestRecord = voiceRecordingService.getById(normalizedRecordingId);
    if (!latestRecord || latestRecord.transcript !== currentRecord.transcript) {
      return null;
    }

    const updatedRecord = {
      ...latestRecord,
      transcriptAlignment,
      updatedAt: transcriptAlignment.processedAt || new Date().toISOString(),
    };
    voiceRecordingService.upsert(updatedRecord);
    if (state.narrationRecordingReview?.recordingId === normalizedRecordingId) {
      state.narrationRecordingReview = createNarrationRecordingReviewState(updatedRecord, {
        currentTimeSeconds: state.narrationRecordingReview.currentTimeSeconds,
        durationSeconds: state.narrationRecordingReview.durationSeconds,
        waveformZoom: state.narrationRecordingReview.waveformZoom,
        selection: state.narrationRecordingReview.selection,
      });
      renderManuscriptPanel();
      syncSceneDocumentLayout();
      syncNarrationRecordingReviewDom(normalizedRecordingId);
    }

    persistCurrentProjectRecord({
      domain: "voice-recordings",
      dirtyReason: "narration-recording-transcript-alignment-complete",
      source: "processNarrationRecordingTranscriptAlignment",
      skipProjectFileAutosave: true,
      markWorkingState: true,
    });
    void saveCurrentProject({
      waitForNarrationRecordingTranscriptAlignment: false,
    });
    reportBrowserLog("info", "voice-recording", "Saved take transcript word timing alignment stored.", {
      recordingId: normalizedRecordingId,
      wordCount: transcriptAlignment.wordTimings?.length ?? 0,
      segmentCount: transcriptAlignment.speechSegments?.length ?? 0,
      providerId: transcriptAlignment.providerId,
    });
    return transcriptAlignment;
  } catch (error) {
    reportBrowserLog("warn", "voice-recording", "Saved take transcript word timing alignment could not be prepared.", {
      error,
      recordingId: normalizedRecordingId,
      mediaPath: recording.mediaPath,
    });
    return null;
  }
}

function setNarrationRecordingWaveformZoom(recordingId, value) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId || state.narrationRecordingReview?.recordingId !== normalizedRecordingId) {
    return;
  }

  const recording = voiceRecordingService.getById(normalizedRecordingId);
  if (!recording) {
    return;
  }

  state.narrationRecordingReview = createNarrationRecordingReviewState(recording, {
    currentTimeSeconds: state.narrationRecordingReview.currentTimeSeconds,
    durationSeconds: state.narrationRecordingReview.durationSeconds || Number(recording.durationMs ?? 0) / 1000,
    waveformZoom: value,
    selection: state.narrationRecordingReview.selection,
  });
  reportBrowserLog("info", "voice-recording", "Saved take oscillogram zoom changed.", {
    recordingId: normalizedRecordingId,
    waveformZoom: state.narrationRecordingReview.waveformZoom,
  });
  syncNarrationRecordingReviewDom(normalizedRecordingId);
}

function resolveNarrationRecordingWaveformTimeFromPointer(target, event) {
  const startTimeSeconds = Math.max(0, Number(target?.dataset?.waveformStart) || 0);
  const endTimeSeconds = Math.max(startTimeSeconds, Number(target?.dataset?.waveformEnd) || startTimeSeconds);
  const rect = typeof target?.getBoundingClientRect === "function"
    ? target.getBoundingClientRect()
    : null;
  if (!rect || !Number.isFinite(Number(event?.clientX)) || rect.width <= 0 || endTimeSeconds <= startTimeSeconds) {
    return startTimeSeconds;
  }

  const ratio = Math.max(0, Math.min(1, (Number(event.clientX) - rect.left) / rect.width));
  return startTimeSeconds + ((endTimeSeconds - startTimeSeconds) * ratio);
}

function beginNarrationRecordingWaveformSelectionGesture(clickTarget, event) {
  const waveformTarget = clickTarget instanceof Element
    ? clickTarget.closest("[data-narration-review-waveform]")
    : null;
  if (!(waveformTarget instanceof HTMLElement) || event?.button !== 0) {
    narrationRecordingWaveformSelectionGesture = null;
    return false;
  }

  const recordingId = typeof waveformTarget.dataset.recordingId === "string" && waveformTarget.dataset.recordingId.trim()
    ? waveformTarget.dataset.recordingId.trim()
    : "";
  if (!recordingId) {
    narrationRecordingWaveformSelectionGesture = null;
    return false;
  }

  narrationRecordingWaveformSelectionGesture = {
    pointerId: Number.isInteger(event.pointerId) ? event.pointerId : null,
    recordingId,
    target: waveformTarget,
    startClientX: Number.isFinite(Number(event.clientX)) ? Number(event.clientX) : null,
    startTimeSeconds: resolveNarrationRecordingWaveformTimeFromPointer(waveformTarget, event),
  };
  return true;
}

function handleNarrationRecordingWaveformSelectionPointerEnd(event) {
  const gesture = narrationRecordingWaveformSelectionGesture;
  if (!gesture) {
    return;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (gesture.pointerId !== null && pointerId !== null && pointerId !== gesture.pointerId) {
    return;
  }

  narrationRecordingWaveformSelectionGesture = null;
  const clientX = Number.isFinite(Number(event?.clientX)) ? Number(event.clientX) : null;
  const movedPixels = clientX !== null && gesture.startClientX !== null
    ? Math.abs(clientX - gesture.startClientX)
    : 0;
  if (movedPixels < 6) {
    return;
  }

  narrationRecordingWaveformSuppressClick = true;
  window.setTimeout(() => {
    narrationRecordingWaveformSuppressClick = false;
  }, 0);
  event.preventDefault();

  const target = gesture.target instanceof HTMLElement
    ? gesture.target
    : event.target instanceof Element
      ? event.target.closest("[data-narration-review-waveform]")
      : null;
  const endTimeSeconds = target instanceof HTMLElement
    ? resolveNarrationRecordingWaveformTimeFromPointer(target, event)
    : gesture.startTimeSeconds;
  selectNarrationRecordingReviewWaveformRange(
    gesture.recordingId,
    gesture.startTimeSeconds,
    endTimeSeconds,
  );
}

function cancelNarrationRecordingWaveformSelectionGesture(event = null) {
  if (!narrationRecordingWaveformSelectionGesture) {
    return;
  }

  const pointerId = Number.isInteger(event?.pointerId) ? event.pointerId : null;
  if (
    narrationRecordingWaveformSelectionGesture.pointerId !== null &&
    pointerId !== null &&
    narrationRecordingWaveformSelectionGesture.pointerId !== pointerId
  ) {
    return;
  }

  narrationRecordingWaveformSelectionGesture = null;
}

function selectNarrationRecordingReviewWaveformRange(recordingId, startTimeSeconds, endTimeSeconds) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  const recording = voiceRecordingService.getById(normalizedRecordingId);
  const scene = getScene(recording?.sceneId);
  if (!recording || !scene) {
    return;
  }

  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview?.durationSeconds) || Number(recording.durationMs ?? 0) / 1000,
  );
  const selection = createNarrationRecordingReviewSelection({
    recording,
    scene,
    startTimeSeconds,
    endTimeSeconds,
    durationSeconds,
    source: "waveform",
  });
  if (!selection) {
    reportBrowserLog("warn", "voice-recording", "Saved take oscillogram selection could not resolve to manuscript words.", {
      recordingId: normalizedRecordingId,
      startTimeSeconds,
      endTimeSeconds,
    });
    return;
  }

  applyNarrationRecordingReviewSelection(recording, selection, {
    source: "waveform",
  });
}

function selectNarrationRecordingReviewWordRange(target) {
  const recordingId = typeof target?.dataset?.recordingId === "string" && target.dataset.recordingId.trim()
    ? target.dataset.recordingId.trim()
    : "";
  const recording = voiceRecordingService.getById(recordingId);
  const scene = getScene(recording?.sceneId);
  if (!recording || !scene) {
    return;
  }

  const wordIndex = Number(target?.dataset?.reviewWordIndex);
  const wordStartTime = Number(target?.dataset?.reviewWordTime);
  const wordEndTime = Number(target?.dataset?.reviewWordEndTime);
  if (!Number.isInteger(wordIndex) || !Number.isFinite(wordStartTime) || !Number.isFinite(wordEndTime)) {
    reportBrowserLog("warn", "voice-recording", "Saved take review word selection lacked transcript timing.", {
      recordingId,
      wordText: String(target?.textContent ?? "").trim(),
    });
    return;
  }

  const activeModel = createActiveNarrationRecordingReviewModel(recordingId);
  const transcriptWords = Array.isArray(activeModel?.transcriptWords) ? activeModel.transcriptWords : [];
  const clickedWord = transcriptWords.find((word) => word?.index === wordIndex) ?? {
    index: wordIndex,
    text: String(target?.textContent ?? "").trim(),
    timeSeconds: wordStartTime,
    endTimeSeconds: wordEndTime,
  };
  const previousSelection = state.narrationRecordingReview?.recordingId === recordingId
    ? state.narrationRecordingReview.selection
    : null;
  const previousStartWordIndex = Number.isInteger(previousSelection?.startWordIndex)
    ? previousSelection.startWordIndex
    : wordIndex;
  const previousEndWordIndex = Number.isInteger(previousSelection?.endWordIndex)
    ? previousSelection.endWordIndex
    : wordIndex;
  const selectionStartWordIndex = Math.min(previousStartWordIndex, previousEndWordIndex, wordIndex);
  const selectionEndWordIndex = Math.max(previousStartWordIndex, previousEndWordIndex, wordIndex);
  const selectedWords = transcriptWords
    .filter((word) => Number.isInteger(word?.index) && word.index >= selectionStartWordIndex && word.index <= selectionEndWordIndex)
    .sort((left, right) => left.index - right.index);
  const firstSelectedWord = selectedWords[0] ?? clickedWord;
  const lastSelectedWord = selectedWords[selectedWords.length - 1] ?? clickedWord;
  const selectionStartTime = Number.isFinite(Number(firstSelectedWord?.timeSeconds))
    ? Number(firstSelectedWord.timeSeconds)
    : wordStartTime;
  const selectionEndTime = Number.isFinite(Number(lastSelectedWord?.endTimeSeconds))
    ? Number(lastSelectedWord.endTimeSeconds)
    : Number(lastSelectedWord?.timeSeconds);
  const selectedText = selectedWords.length
    ? selectedWords.map((word) => String(word?.text ?? "").trim()).filter(Boolean).join(" ")
    : String(clickedWord?.text ?? target?.textContent ?? "").trim();
  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview?.durationSeconds) || Number(recording.durationMs ?? 0) / 1000,
  );
  const selection = createNarrationRecordingReviewSelection({
    recording,
    scene,
    startTimeSeconds: selectionStartTime,
    endTimeSeconds: selectionEndTime > selectionStartTime ? selectionEndTime : wordEndTime,
    durationSeconds,
    source: "word",
    selectedText,
    startWordIndex: selectionStartWordIndex,
    endWordIndex: selectionEndWordIndex,
  });
  if (!selection) {
    return;
  }

  applyNarrationRecordingReviewSelection(recording, selection, {
    source: "word",
  });
}

function applyNarrationRecordingReviewSelection(recording, selection, {
  source = "word",
} = {}) {
  const recordingId = typeof recording?.id === "string" && recording.id.trim() ? recording.id.trim() : "";
  if (!recordingId || !selection) {
    return;
  }

  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview?.durationSeconds) || Number(recording.durationMs ?? 0) / 1000,
  );
  state.narrationRecordingReview = createNarrationRecordingReviewState(recording, {
    currentTimeSeconds: Math.min(selection.startTimeSeconds ?? state.narrationRecordingReview?.currentTimeSeconds ?? 0, durationSeconds),
    durationSeconds,
    waveformZoom: state.narrationRecordingReview?.waveformZoom,
    selection,
  });

  const selectionRecord = createNarrationTakeSelectionFromReviewSelection(recording, selection);
  if (selectionRecord) {
    state.narrationTakeSelection = selectionRecord;
    state.selectedSceneId = selectionRecord.sceneId;
    state.activeEditorSceneId = selectionRecord.sceneId;
    state.selectedBlockId = selectionRecord.blockId;
  }

  reportBrowserLog("info", "voice-recording", "Saved take review re-record range selected.", {
    recordingId,
    source,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
    startTimeSeconds: selection.startTimeSeconds,
    endTimeSeconds: selection.endTimeSeconds,
    selectedTextLength: selection.selectedText.length,
  });
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
  syncNarrationTakeSelectionPreview();
}

function logNarrationRecordingReviewWaveformClick(target, event, requestedTimeSeconds, resolvedTimeSeconds = requestedTimeSeconds) {
  const rect = typeof target?.getBoundingClientRect === "function"
    ? target.getBoundingClientRect()
    : null;
  reportBrowserLog("info", "voice-recording", "Saved take oscillogram seek requested.", {
    recordingId: target?.dataset?.recordingId ?? "",
    requestedTimeSeconds,
    resolvedTimeSeconds,
    speechAlignedSnapApplied: Math.abs((Number(resolvedTimeSeconds) || 0) - (Number(requestedTimeSeconds) || 0)) > 0.001,
    waveformStartSeconds: Number.isFinite(Number(target?.dataset?.waveformStart))
      ? Number(target.dataset.waveformStart)
      : null,
    waveformEndSeconds: Number.isFinite(Number(target?.dataset?.waveformEnd))
      ? Number(target.dataset.waveformEnd)
      : null,
    clientX: Number.isFinite(Number(event?.clientX)) ? Number(event.clientX) : null,
    targetRect: rect
      ? {
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      }
      : null,
    playbackBefore: createVoiceRecordingPlaybackLogSnapshot(),
  });
}

async function seekNarrationRecordingReviewWaveform(target, event) {
  const recordingId = typeof target?.dataset?.recordingId === "string" && target.dataset.recordingId.trim()
    ? target.dataset.recordingId.trim()
    : "";
  if (!recordingId) {
    return;
  }

  const requestedTimeSeconds = resolveNarrationRecordingWaveformTimeFromPointer(target, event);
  const recording = voiceRecordingService.getById(recordingId);
  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview?.durationSeconds) || Number(recording?.durationMs ?? 0) / 1000,
  );
  const resolvedTimeSeconds = resolveNarrationRecordingAlignedSeekTime({
    transcriptAlignment: recording?.transcriptAlignment,
    requestedTimeSeconds,
    durationSeconds,
  });
  logNarrationRecordingReviewWaveformClick(target, event, requestedTimeSeconds, resolvedTimeSeconds);
  seekNarrationRecordingReview(recordingId, resolvedTimeSeconds);

  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  if (
    playbackState.recordingId === recordingId &&
    (playbackState.status === "playing" || playbackState.status === "loading")
  ) {
    return;
  }

  await playVoiceRecordingPreview(recordingId, {
    source: "waveform-seek",
  });
}

async function previewVoiceRecording(recordingId) {
  const plan = openVoiceRecordingReviewForRecordingId(recordingId);
  await playVoiceRecordingPreview(recordingId, {
    openedReview: Boolean(plan),
  });
}

async function playVoiceRecordingPreview(recordingId, logContext = {}) {
  const startTimeSeconds = resolveNarrationRecordingPreviewStartTime(recordingId);
  reportBrowserLog("info", "voice-recording", "Saved take preview requested.", {
    recordingId,
    startTimeSeconds,
    ...logContext,
    playbackBefore: createVoiceRecordingPlaybackLogSnapshot(),
  });
  const result = await voiceRecordingActionService.previewRecording(recordingId, {
    startTimeSeconds,
  });
  if (!result?.ok) {
    reportBrowserLog("warn", "voice-recording", "Voice recording preview was unavailable.", {
      recordingId,
      reason: result?.reason ?? "unknown",
      ...logContext,
      playbackAfter: createVoiceRecordingPlaybackLogSnapshot(),
    });
    return;
  }

  reportBrowserLog("info", "voice-recording", "Saved take preview request finished.", {
    recordingId: result.recording?.id ?? recordingId,
    startTimeSeconds,
    stalePlayback: result.playback?.stale === true,
    ...logContext,
    playbackAfter: createVoiceRecordingPlaybackLogSnapshot(result.playback?.playbackState),
  });
}

function stopVoiceRecordingPreview(recordingId = "") {
  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  const playbackBeforeSnapshot = createVoiceRecordingPlaybackLogSnapshot(playbackState);
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  const mismatch = Boolean(normalizedRecordingId && playbackState.recordingId && normalizedRecordingId !== playbackState.recordingId);
  if (normalizedRecordingId && playbackState.recordingId && normalizedRecordingId !== playbackState.recordingId) {
    reportBrowserLog("warn", "voice-recording", "Saved take stop requested for a different active recording; stopping active preview.", {
      requestedRecordingId: normalizedRecordingId,
      activeRecordingId: playbackState.recordingId,
      playbackBefore: playbackBeforeSnapshot,
    });
  }

  const stoppedState = voiceRecordingPreviewController.stopPreview();
  reportBrowserLog("info", "voice-recording", "Saved take preview stop finished.", {
    requestedRecordingId: normalizedRecordingId,
    activeRecordingIdBefore: playbackState.recordingId,
    mismatch,
    playbackBefore: playbackBeforeSnapshot,
    playbackAfter: createVoiceRecordingPlaybackLogSnapshot(stoppedState),
  });
}

function pauseVoiceRecordingPreview(recordingId = "", {
  source = "transport",
} = {}) {
  const playbackBeforeSnapshot = createVoiceRecordingPlaybackLogSnapshot();
  const pausedState = voiceRecordingPreviewController.pausePreview({
    recordingId,
  });
  reportBrowserLog("info", "voice-recording", "Saved take preview pause requested.", {
    source,
    requestedRecordingId: recordingId,
    playbackBefore: playbackBeforeSnapshot,
    playbackAfter: createVoiceRecordingPlaybackLogSnapshot(pausedState),
  });
  return pausedState;
}

async function resumeVoiceRecordingPreview(recordingId = "", {
  source = "transport",
} = {}) {
  const playbackBeforeSnapshot = createVoiceRecordingPlaybackLogSnapshot();
  try {
    const resumedState = await voiceRecordingPreviewController.resumePreview({
      recordingId,
    });
    reportBrowserLog("info", "voice-recording", "Saved take preview resume requested.", {
      source,
      requestedRecordingId: recordingId,
      playbackBefore: playbackBeforeSnapshot,
      playbackAfter: createVoiceRecordingPlaybackLogSnapshot(resumedState),
    });
    return resumedState;
  } catch (error) {
    reportBrowserLog("warn", "voice-recording", "Saved take preview resume failed.", {
      error,
      source,
      requestedRecordingId: recordingId,
      playbackBefore: playbackBeforeSnapshot,
      playbackAfter: createVoiceRecordingPlaybackLogSnapshot(),
    });
    return voiceRecordingPreviewController.getPlaybackState();
  }
}

function toggleVoiceRecordingPreviewWithSpacebar(event) {
  if (isTextEditingTarget(event?.target)) {
    return false;
  }

  const target = event?.target instanceof Element ? event.target : null;
  if (target?.closest("[contenteditable='true']")) {
    return false;
  }

  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  if (!playbackState.recordingId || !["loading", "playing", "paused"].includes(playbackState.status)) {
    return false;
  }

  event.preventDefault();
  hideFileMenu();
  if (playbackState.status === "paused") {
    void resumeVoiceRecordingPreview(playbackState.recordingId, {
      source: "spacebar",
    });
    return true;
  }

  pauseVoiceRecordingPreview(playbackState.recordingId, {
    source: "spacebar",
  });
  return true;
}

// Intent: delete saved narration takes through media and recording services, then persist the project snapshot.
async function deleteVoiceRecording(recordingId) {
  const result = await voiceRecordingActionService.deleteRecording(recordingId);
  if (!result?.ok) {
    reportBrowserLog("warn", "voice-recording", "Voice recording delete could not complete.", {
      recordingId,
      reason: result?.reason ?? "unknown",
    });
    return;
  }

  if (state.narrationTakeSession?.recordingId === result.recording?.id) {
    setNarrationTakeSession(createNarrationTakeSession(state.narrationTakeSelection, {
      status: "paused",
      trackerStatus: "Narration take deleted.",
    }));
  }

  if (state.narrationRecordingReview?.recordingId === result.recording?.id) {
    state.narrationRecordingReview = null;
  }
  if (state.narrationRecordingPreviewId === result.recording?.id) {
    state.narrationRecordingPreviewId = null;
  }
  if (voiceRecordingPreviewController.getPlaybackState().recordingId === result.recording?.id) {
    voiceRecordingPreviewController.stopPreview();
  }

  persistCurrentProjectRecord({
    domain: "voice-recordings",
    dirtyReason: "voice-recording-deleted",
    source: "deleteVoiceRecording",
    skipProjectFileAutosave: true,
    markWorkingState: true,
  });
  render();
  void saveCurrentProject();

  reportBrowserLog("info", "voice-recording", "Deleted a narration recording.", {
    recordingId: result.recording?.id ?? recordingId,
    mediaPath: result.recording?.mediaPath ?? null,
    mediaRemoved: result.mediaResult?.removed === true,
  });
}

// Intent: start a replacement take only from the author-selected review subrange while keeping the old take available.
async function rerecordVoiceRecordingSelection(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId) {
    return;
  }

  if (narrationRecordingRuntime || state.narrationTakeSession?.status === "recording" || state.narrationTakeSession?.status === "finalizing") {
    reportBrowserLog("warn", "voice-recording", "Re-record request ignored because another narration take is active.", {
      recordingId: normalizedRecordingId,
      activeRecordingId: narrationRecordingRuntime?.recordingId ?? state.narrationTakeSession?.recordingId ?? "",
      activeStatus: state.narrationTakeSession?.status ?? "",
    });
    return;
  }

  const plan = voiceRecordingActionService.planRecordingVerseNavigation(normalizedRecordingId);
  if (!plan.ok) {
    reportBrowserLog("warn", "voice-recording", "Re-record request could not resolve the saved take anchor.", {
      recordingId: normalizedRecordingId,
      reason: plan.reason ?? "unknown",
    });
    return;
  }

  if (state.narrationRecordingReview?.recordingId !== normalizedRecordingId) {
    openVoiceRecordingReviewForRecordingId(normalizedRecordingId);
    reportBrowserLog("info", "voice-recording", "Re-record selection request opened the saved take review first.", {
      recordingId: normalizedRecordingId,
    });
    return;
  }

  const selection = createNarrationTakeSelectionFromReviewSelection(
    plan.recording,
    state.narrationRecordingReview.selection,
  );
  if (!selection) {
    openVoiceRecordingReview(plan.recording);
    reportBrowserLog("warn", "voice-recording", "Re-record request needs a selected word or oscillogram range.", {
      recordingId: normalizedRecordingId,
      sceneId: plan.sceneId,
      selectedBlockId: plan.selectedBlockId,
    });
    return;
  }

  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  if (playbackState.recordingId) {
    stopVoiceRecordingPreview(playbackState.recordingId);
  }

  openNarrationRecordingReview(plan.recording);
  state.selectedIssueId = null;
  state.activePane = "narration";
  state.selectedSceneId = plan.sceneId;
  state.activeEditorSceneId = plan.sceneId;
  state.selectedBlockId = selection.blockId ?? plan.selectedBlockId;
  state.narrationTakeSelection = selection;
  render();

  const scheduleScroll = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (callback) => callback();
  scheduleScroll(() => {
    takeToSceneRange(plan.sceneId, selection.startOffset, selection.endOffset, { behavior: "smooth" });
    syncNarrationTakeSelectionPreview();
  });

  reportBrowserLog("info", "voice-recording", "Starting selected re-record take from saved take review range.", {
    sourceRecordingId: normalizedRecordingId,
    sceneId: selection.sceneId,
    blockId: selection.blockId,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
  });
  await startNarrationRecording(plan.sceneId);
}

function goToVoiceRecordingVerse(recordingId) {
  openVoiceRecordingReviewForRecordingId(recordingId);
}

// Intent: preview a saved take's manuscript coverage from the Audio tab without selecting or scrolling the editor.
function previewNarrationRecordingAnchor(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim()
    ? recordingId.trim()
    : "";
  if (!normalizedRecordingId || state.activePane !== "narration") {
    return false;
  }

  const plan = voiceRecordingActionService.planRecordingVerseNavigation(normalizedRecordingId);
  if (!plan.ok) {
    return false;
  }

  state.narrationRecordingPreviewId = normalizedRecordingId;
  syncNarrationRecordingPreviewCards(normalizedRecordingId);
  syncNarrationRecordingPreviewLayer(plan.sceneId);
  return true;
}

function clearNarrationRecordingAnchorPreview(recordingId = "") {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim()
    ? recordingId.trim()
    : "";
  if (
    normalizedRecordingId &&
    state.narrationRecordingPreviewId &&
    state.narrationRecordingPreviewId !== normalizedRecordingId
  ) {
    return false;
  }

  const previousRecordingId = state.narrationRecordingPreviewId;
  if (!previousRecordingId) {
    syncNarrationRecordingPreviewCards("");
    return false;
  }

  const plan = voiceRecordingActionService.planRecordingVerseNavigation(previousRecordingId);
  state.narrationRecordingPreviewId = null;
  syncNarrationRecordingPreviewCards("");
  syncNarrationRecordingPreviewLayer(plan.ok ? plan.sceneId : state.selectedSceneId);
  return true;
}

function syncNarrationRecordingPreviewCards(recordingId = "") {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim()
    ? recordingId.trim()
    : "";
  document.querySelectorAll("[data-narration-recording-preview-id]").forEach((element) => {
    if (element instanceof HTMLElement) {
      element.classList.toggle(
        "is-previewing",
        normalizedRecordingId && element.dataset.narrationRecordingPreviewId === normalizedRecordingId,
      );
    }
  });
}

function syncNarrationRecordingPreviewLayer(sceneId) {
  const normalizedSceneId = typeof sceneId === "string" && sceneId.trim()
    ? sceneId.trim()
    : "";
  if (!normalizedSceneId) {
    return false;
  }

  const textarea = getEditorTextareaForScene(normalizedSceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return false;
  }

  syncNarrationRecordingLayer(editorHost, normalizedSceneId);
  return true;
}

function openVoiceRecordingReviewForRecordingId(recordingId) {
  const plan = voiceRecordingActionService.planRecordingVerseNavigation(recordingId);
  if (!plan.ok) {
    return null;
  }

  const selection = createNarrationTakeSelectionFromRecordingPlan(plan);
  openNarrationRecordingReview(plan.recording);

  state.selectedIssueId = null;
  state.activePane = "narration";
  state.selectedSceneId = plan.sceneId;
  state.activeEditorSceneId = plan.sceneId;
  state.selectedBlockId = selection?.blockId ?? plan.selectedBlockId;
  state.narrationTakeSelection = selection;
  render();

  const scheduleScroll = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (callback) => callback();
  scheduleScroll(() => {
    const startOffset = Number.isInteger(selection?.startOffset) ? selection.startOffset : plan.startOffset;
    const endOffset = Number.isInteger(selection?.endOffset) ? selection.endOffset : plan.endOffset;
    takeToSceneRange(plan.sceneId, startOffset, endOffset, { behavior: "smooth" });
    syncNarrationTakeSelectionPreview();
  });
  return plan;
}

function openNarrationRecordingReview(recording) {
  const recordingId = typeof recording?.id === "string" && recording.id.trim() ? recording.id.trim() : "";
  if (!recordingId) {
    state.narrationRecordingReview = null;
    return null;
  }

  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  const playbackApplies = playbackState.recordingId === recordingId;
  const reviewApplies = state.narrationRecordingReview?.recordingId === recordingId;
  const currentTimeSeconds = playbackApplies
    ? playbackState.currentTimeSeconds
    : reviewApplies
      ? state.narrationRecordingReview.currentTimeSeconds
      : 0;
  const durationSeconds = playbackApplies && playbackState.durationSeconds > 0
    ? playbackState.durationSeconds
    : reviewApplies && state.narrationRecordingReview.durationSeconds > 0
      ? state.narrationRecordingReview.durationSeconds
    : Math.max(0, Number(recording.durationMs ?? 0) / 1000);
  state.narrationRecordingReview = createNarrationRecordingReviewState(recording, {
    currentTimeSeconds,
    durationSeconds,
    waveformZoom: reviewApplies ? state.narrationRecordingReview.waveformZoom : 1,
    selection: reviewApplies ? state.narrationRecordingReview.selection : null,
  });
  void loadNarrationRecordingWaveform(recordingId);
  void processNarrationRecordingTranscriptAlignment(recordingId);
  return state.narrationRecordingReview;
}

function closeNarrationRecordingReview(recordingId = "") {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (normalizedRecordingId && state.narrationRecordingReview?.recordingId !== normalizedRecordingId) {
    return;
  }

  state.narrationRecordingReview = null;
  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function resolveNarrationRecordingPreviewStartTime(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId || state.narrationRecordingReview?.recordingId !== normalizedRecordingId) {
    return 0;
  }

  const recording = voiceRecordingService.getById(normalizedRecordingId);
  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview.durationSeconds) || Number(recording?.durationMs ?? 0) / 1000,
  );
  const currentTimeSeconds = Math.max(0, Number(state.narrationRecordingReview.currentTimeSeconds) || 0);
  return durationSeconds > 0 && currentTimeSeconds >= durationSeconds - 0.25
    ? 0
    : currentTimeSeconds;
}

function seekNarrationRecordingReview(recordingId, value) {
  const recording = voiceRecordingService.getById(recordingId);
  if (!recording) {
    return;
  }

  const durationSeconds = Math.max(
    0,
    Number(state.narrationRecordingReview?.durationSeconds) || Number(recording.durationMs ?? 0) / 1000,
  );
  const requestedTimeSeconds = Math.max(0, Number(value) || 0);
  const currentTimeSeconds = durationSeconds > 0
    ? Math.min(requestedTimeSeconds, durationSeconds)
    : requestedTimeSeconds;
  state.narrationRecordingReview = createNarrationRecordingReviewState(recording, {
    currentTimeSeconds,
    durationSeconds,
    waveformZoom: state.narrationRecordingReview?.waveformZoom,
    selection: state.narrationRecordingReview?.selection,
  });

  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  const playbackBeforeSnapshot = createVoiceRecordingPlaybackLogSnapshot(playbackState);
  let seekPlaybackState = playbackState;
  if (playbackState.recordingId === recording.id) {
    seekPlaybackState = voiceRecordingPreviewController.seekPreview(currentTimeSeconds, {
      recordingId: recording.id,
    });
  }

  reportBrowserLog("info", "voice-recording", "Saved take review seek applied.", {
    recordingId: recording.id,
    requestedTimeSeconds,
    currentTimeSeconds,
    durationSeconds,
    activeAudioMatched: playbackState.recordingId === recording.id,
    playbackBefore: playbackBeforeSnapshot,
    playbackAfter: createVoiceRecordingPlaybackLogSnapshot(seekPlaybackState),
  });

  syncNarrationRecordingReviewDom(recording.id);
}

async function seekNarrationRecordingReviewWord(recordingId, value) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId) {
    return;
  }

  seekNarrationRecordingReview(normalizedRecordingId, value);
  const playbackState = voiceRecordingPreviewController.getPlaybackState();
  if (
    playbackState.recordingId === normalizedRecordingId &&
    (playbackState.status === "playing" || playbackState.status === "loading")
  ) {
    reportBrowserLog("info", "voice-recording", "Saved take word seek reused active playback.", {
      recordingId: normalizedRecordingId,
      requestedTimeSeconds: Number.isFinite(Number(value)) ? Number(value) : null,
      playbackAfterSeek: createVoiceRecordingPlaybackLogSnapshot(playbackState),
    });
    return;
  }

  reportBrowserLog("info", "voice-recording", "Saved take word seek starting playback from cursor.", {
    recordingId: normalizedRecordingId,
    requestedTimeSeconds: Number.isFinite(Number(value)) ? Number(value) : null,
    playbackBeforeStart: createVoiceRecordingPlaybackLogSnapshot(playbackState),
  });
  await playVoiceRecordingPreview(normalizedRecordingId, {
    source: "word-seek",
  });
}

function handleVoiceRecordingPlaybackStateChange(playbackState, eventType = "") {
  syncVoiceRecordingPlaybackTelemetry(playbackState, eventType);
  logVoiceRecordingPlaybackStateChange(playbackState, eventType);
  const recordingId = typeof playbackState?.recordingId === "string" && playbackState.recordingId.trim()
    ? playbackState.recordingId.trim()
    : "";
  if (!recordingId) {
    if (["loading", "playing", "paused", "resume-loading", "resumed", "stopped", "ended", "error"].includes(eventType)) {
      renderConsolePanel();
    }
    return;
  }

  if (state.narrationRecordingReview?.recordingId === recordingId) {
    const recording = voiceRecordingService.getById(recordingId);
    if (recording) {
      state.narrationRecordingReview = createNarrationRecordingReviewState(recording, {
        currentTimeSeconds: playbackState.currentTimeSeconds,
        durationSeconds: playbackState.durationSeconds || state.narrationRecordingReview.durationSeconds,
        waveformZoom: state.narrationRecordingReview.waveformZoom,
        selection: state.narrationRecordingReview.selection,
      });
    }
  }

  if (["loading", "playing", "paused", "resume-loading", "resumed", "stopped", "ended", "error"].includes(eventType)) {
    renderConsolePanel();
    if (state.narrationRecordingReview?.recordingId === recordingId) {
      renderManuscriptPanel();
      syncSceneDocumentLayout();
    }
  }

  syncNarrationRecordingReviewDom(recordingId);
}

function syncNarrationRecordingReviewDom(recordingId) {
  const model = createActiveNarrationRecordingReviewModel(recordingId);
  if (!model) {
    return;
  }
  logNarrationRecordingReviewCursorFallback(model);

  const reviewElement = getNarrationRecordingReviewElement(model.recordingId);
  if (!(reviewElement instanceof HTMLElement)) {
    return;
  }

  const currentTimeElement = reviewElement.querySelector("[data-narration-review-current-time]");
  if (currentTimeElement instanceof HTMLElement) {
    currentTimeElement.textContent = model.currentTimeLabel;
  }

  const durationElement = reviewElement.querySelector("[data-narration-review-duration]");
  if (durationElement instanceof HTMLElement) {
    durationElement.textContent = model.durationLabel;
  }

  const progressElement = reviewElement.querySelector("[data-narration-review-progress]");
  if (progressElement instanceof HTMLElement) {
    progressElement.textContent = `${model.progressPercent}%`;
  }

  const seekInput = reviewElement.querySelector("[data-narration-review-seek]");
  if (seekInput instanceof HTMLInputElement) {
    seekInput.max = String(Math.max(0, model.durationSeconds));
    seekInput.value = String(model.currentTimeSeconds);
  }

  const waveformPanel = reviewElement.querySelector("[data-narration-review-waveform-panel]");
  if (waveformPanel instanceof HTMLElement) {
    waveformPanel.outerHTML = renderNarrationRecordingReviewWaveformHTML(model);
  }

  const transcriptElement = reviewElement.querySelector("[data-narration-review-transcript]");
  if (transcriptElement instanceof HTMLElement) {
    const previousScrollTop = transcriptElement.scrollTop;
    transcriptElement.innerHTML = renderNarrationRecordingReviewTranscriptHTML(model);
    transcriptElement.scrollTop = previousScrollTop;
  }
}

// Intent: surface when the saved-take review cursor is driven by duration ratio instead of the stored word map.
function logNarrationRecordingReviewCursorFallback(model) {
  const resolution = model?.cursor?.timingResolution;
  const recordingId = typeof model?.recordingId === "string" ? model.recordingId : "";
  if (!resolution?.usedDurationFallback) {
    if (narrationRecordingReviewCursorFallbackLogKey.startsWith(`${recordingId}:`)) {
      narrationRecordingReviewCursorFallbackLogKey = "";
    }
    return;
  }

  const firstTimedWord = createNarrationRecordingCursorTimedWordLogSnapshot(resolution.firstTimedWord);
  const lastTimedWord = createNarrationRecordingCursorTimedWordLogSnapshot(resolution.lastTimedWord);
  const logKey = [
    recordingId,
    resolution.reason,
    resolution.resolvedWordIndex,
    firstTimedWord?.startTimeSeconds ?? "",
    lastTimedWord?.endTimeSeconds ?? "",
  ].join(":");
  if (logKey === narrationRecordingReviewCursorFallbackLogKey) {
    return;
  }
  narrationRecordingReviewCursorFallbackLogKey = logKey;

  const recording = voiceRecordingService.getById(recordingId);
  const alignment = recording?.transcriptAlignment && typeof recording.transcriptAlignment === "object"
    ? recording.transcriptAlignment
    : null;
  const provider = alignment?.wordTimingProvider && typeof alignment.wordTimingProvider === "object"
    ? alignment.wordTimingProvider
    : null;
  reportBrowserLog("warn", "voice-recording", "Saved take review cursor used duration fallback instead of aligned word timing.", {
    recordingId,
    reason: resolution.reason,
    strategy: resolution.strategy,
    currentTimeSeconds: Number.isFinite(Number(resolution.currentTimeSeconds)) ? Number(resolution.currentTimeSeconds) : null,
    durationSeconds: Number.isFinite(Number(model.durationSeconds)) ? Number(model.durationSeconds) : null,
    fallbackRatio: Number.isFinite(Number(resolution.fallbackRatio)) ? Number(resolution.fallbackRatio) : null,
    resolvedWordIndex: Number.isInteger(resolution.resolvedWordIndex) ? resolution.resolvedWordIndex : null,
    resolvedWordText: resolution.resolvedWordText ?? "",
    resolvedWordTimingSource: resolution.resolvedWordTimingSource ?? "",
    timedWordCount: Number.isFinite(Number(resolution.timedWordCount)) ? Number(resolution.timedWordCount) : null,
    providerTimedWordCount: Number.isFinite(Number(resolution.providerTimedWordCount)) ? Number(resolution.providerTimedWordCount) : null,
    timingSourceCounts: resolution.timingSourceCounts ?? {},
    firstTimedWord,
    lastTimedWord,
    alignmentProviderId: alignment?.providerId ?? "",
    alignmentSource: alignment?.source ?? "",
    alignmentStatus: alignment?.status ?? "",
    alignmentWordCount: Number.isFinite(Number(alignment?.wordCount)) ? Number(alignment.wordCount) : null,
    wordTimingProviderStatus: provider?.status ?? "",
    wordTimingProviderRecognizedWordCount: Number.isFinite(Number(provider?.recognizedWordCount)) ? Number(provider.recognizedWordCount) : null,
    wordTimingProviderMatchedWordCount: Number.isFinite(Number(provider?.matchedWordCount)) ? Number(provider.matchedWordCount) : null,
    wordTimingProviderMatchRatio: Number.isFinite(Number(provider?.matchRatio)) ? Number(provider.matchRatio) : null,
    recordingDurationMs: Number.isFinite(Number(recording?.durationMs)) ? Number(recording.durationMs) : null,
  });
}

// Intent: keep cursor fallback logs concise while preserving the timing boundary that caused the fallback.
function createNarrationRecordingCursorTimedWordLogSnapshot(word) {
  if (!word || typeof word !== "object") {
    return null;
  }
  return {
    index: Number.isInteger(word.index) ? word.index : null,
    text: typeof word.text === "string" ? word.text : "",
    startTimeSeconds: Number.isFinite(Number(word.timeSeconds)) ? Number(word.timeSeconds) : null,
    endTimeSeconds: Number.isFinite(Number(word.endTimeSeconds)) ? Number(word.endTimeSeconds) : null,
    timingSource: typeof word.timingSource === "string" ? word.timingSource : "",
  };
}

function createActiveNarrationRecordingReviewModel(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId || state.narrationRecordingReview?.recordingId !== normalizedRecordingId) {
    return null;
  }

  const recording = voiceRecordingService.getById(normalizedRecordingId);
  if (!recording) {
    return null;
  }
  const scene = getScene(recording.sceneId);
  const displayRecording = enrichNarrationRecordingDisplayLineRange(scene, recording);

  return createNarrationRecordingReviewModel({
    recording: displayRecording,
    scene,
    reviewState: state.narrationRecordingReview,
    playbackState: voiceRecordingPreviewController.getPlaybackState(),
    waveformState: state.narrationRecordingWaveforms?.[normalizedRecordingId] ?? null,
  });
}

function getNarrationRecordingReviewElement(recordingId) {
  const normalizedRecordingId = typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
  if (!normalizedRecordingId || typeof CSS === "undefined" || typeof CSS.escape !== "function") {
    return null;
  }

  return document.querySelector(
    `[data-narration-recording-review][data-recording-id="${CSS.escape(normalizedRecordingId)}"]`,
  );
}

function createNarrationTakeSelectionFromRecordingPlan(plan) {
  const scene = getScene(plan?.sceneId);
  if (!scene) {
    return null;
  }

  const blockRanges = getSceneBlockRanges(scene);
  const sceneText = String(scene.editorText ?? "");
  const maxOffset = Math.max(sceneText.length, ...blockRanges.map((range) => range.endOffset), 0);
  const startOffset = Number.isInteger(plan.startOffset)
    ? Math.max(0, Math.min(plan.startOffset, maxOffset))
    : 0;
  const endOffset = Number.isInteger(plan.endOffset) && plan.endOffset > startOffset
    ? Math.max(startOffset, Math.min(plan.endOffset, maxOffset))
    : startOffset;
  const block = findSceneBlockAtOffset(scene, startOffset)
    ?? scene.blocks?.find((candidate) => candidate.blockId === plan.selectedBlockId)
    ?? scene.blocks?.[0]
    ?? null;
  if (!block) {
    return null;
  }

  const blockRange = blockRanges.find((candidate) => candidate.blockId === block.blockId) ?? null;
  const selectedText = sceneText.slice(startOffset, endOffset).trim() || String(block.text ?? "").trim();
  return buildNarrationTakeSelection(scene, block, blockRange, null, startOffset, endOffset, selectedText);
}

function createNarrationTakeSelectionFromReviewSelection(recording, reviewSelection) {
  const scene = getScene(recording?.sceneId);
  if (!scene || !reviewSelection) {
    return null;
  }

  const blockRanges = getSceneBlockRanges(scene);
  const sceneText = String(scene.editorText ?? "");
  const maxOffset = Math.max(sceneText.length, ...blockRanges.map((range) => range.endOffset), 0);
  const startOffset = Number.isInteger(reviewSelection.startOffset)
    ? Math.max(0, Math.min(reviewSelection.startOffset, maxOffset))
    : null;
  const endOffset = Number.isInteger(reviewSelection.endOffset) && startOffset !== null && reviewSelection.endOffset > startOffset
    ? Math.max(startOffset, Math.min(reviewSelection.endOffset, maxOffset))
    : null;
  if (startOffset === null || endOffset === null || endOffset <= startOffset) {
    return null;
  }

  const block = findSceneBlockAtOffset(scene, startOffset)
    ?? scene.blocks?.find((candidate) => candidate.blockId === recording?.blockId)
    ?? scene.blocks?.[0]
    ?? null;
  if (!block) {
    return null;
  }

  const blockRange = blockRanges.find((candidate) => candidate.blockId === block.blockId) ?? null;
  const selectedText = String(reviewSelection.selectedText ?? "").trim() || sceneText.slice(startOffset, endOffset).trim();
  if (!selectedText) {
    return null;
  }

  return buildNarrationTakeSelection(scene, block, blockRange, null, startOffset, endOffset, selectedText);
}

// Intent: keep the highlight colour picker as a floating editor menu while the selected colour remains a user preference.
function getHighlightColorButtonTarget(target) {
  return target instanceof Element
    ? target.closest('[data-highlight-color-trigger], [data-action="toggle-inline-format"][data-inline-format="highlight"]')
    : null;
}

function scheduleHighlightColorPaletteHoverOpen(button) {
  clearHighlightColorHoverTimer();
  if (!(button instanceof HTMLElement)) {
    return;
  }

  highlightColorHoverTimer = window.setTimeout(() => {
    openHighlightColorPalette(button);
  }, 1000);
}

function clearHighlightColorHoverTimer() {
  if (highlightColorHoverTimer === null) {
    return;
  }

  window.clearTimeout(highlightColorHoverTimer);
  highlightColorHoverTimer = null;
}

function toggleHighlightColorPalette(button) {
  clearHighlightColorHoverTimer();
  if (state.highlightColorPaletteOpen) {
    closeHighlightColorPalette({ renderAfter: true });
    return;
  }

  openHighlightColorPalette(button);
}

function openHighlightColorPalette(button = null) {
  clearHighlightColorHoverTimer();
  state.highlightColorPaletteOpen = true;
  state.highlightColorPalettePosition = resolveHighlightColorPalettePosition(button);
  hideTaskContextMenu();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function closeHighlightColorPalette(options = {}) {
  if (!state.highlightColorPaletteOpen) {
    return;
  }

  state.highlightColorPaletteOpen = false;
  state.highlightColorPalettePosition = null;
  if (options.renderAfter === true) {
    renderManuscriptPanel();
    syncSceneDocumentLayout();
    return;
  }

  document.querySelector("[data-highlight-color-palette]")?.remove();
  const highlightButton = document.querySelector('[data-action="toggle-inline-format"][data-inline-format="highlight"]');
  if (highlightButton instanceof HTMLButtonElement) {
    highlightButton.setAttribute("aria-expanded", "false");
  }
}

function resolveHighlightColorPalettePosition(button) {
  const sceneShell = button instanceof HTMLElement
    ? button.closest(".scene-editor-shell")
    : null;
  if (!(button instanceof HTMLElement) || !(sceneShell instanceof HTMLElement)) {
    return { left: 12, top: 84 };
  }

  const buttonRect = button.getBoundingClientRect();
  const shellRect = sceneShell.getBoundingClientRect();
  const estimatedPaletteWidth = Math.min(360, Math.max(280, shellRect.width - 24));
  const leftLimit = Math.max(12, shellRect.width - estimatedPaletteWidth - 12);
  const left = Math.max(12, Math.min(buttonRect.left - shellRect.left, leftLimit));
  const top = Math.max(12, buttonRect.bottom - shellRect.top + 8);
  return {
    left,
    top,
  };
}

function setHighlightColorPreference(colorId) {
  const previousHighlightColorId = state.editorPrefs.highlightColorId;
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    highlightColorId: String(colorId ?? ""),
  });
  closeHighlightColorPalette();
  persistHighlightColorPreference("highlight-colour-updated", "setHighlightColorPreference");
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  editorInteractionLog.info("user-action", "manuscript.highlight-colour.changed", "Changed user highlight colour.", {
    highlightColorId: state.editorPrefs.highlightColorId,
    changed: previousHighlightColorId !== state.editorPrefs.highlightColorId,
  });
}

// Intent: restore a committed custom swatch through the normal highlight preference path without duplicating it.
function setHighlightRecentCustomColorPreference(index) {
  const recentCustomColors = normalizeHighlightRecentCustomColors(state.editorPrefs.highlightRecentCustomColors);
  const recentIndex = Number(index);
  if (!Number.isInteger(recentIndex) || recentIndex < 0 || recentIndex >= recentCustomColors.length) {
    return;
  }

  const previousHighlightColorId = state.editorPrefs.highlightColorId;
  const previousRecentColors = JSON.stringify(recentCustomColors);
  const selectedRgb = recentCustomColors[recentIndex];
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    highlightColorId: CUSTOM_HIGHLIGHT_COLOR_ID,
    highlightCustomRgb: selectedRgb,
    highlightRecentCustomColors: addRecentHighlightCustomColor(recentCustomColors, selectedRgb),
  });
  closeHighlightColorPalette();
  persistHighlightColorPreference("highlight-custom-recent-selected", "setHighlightRecentCustomColorPreference");
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  editorInteractionLog.info("user-action", "manuscript.highlight-colour.custom-recent-selected", "Selected a recent custom highlight colour.", {
    recentIndex,
    highlightColorId: state.editorPrefs.highlightColorId,
    changed: previousHighlightColorId !== state.editorPrefs.highlightColorId ||
      previousRecentColors !== JSON.stringify(state.editorPrefs.highlightRecentCustomColors),
  });
}

function setHighlightCustomRgbPreference(channel, value, options = {}) {
  const normalizedChannel = ["red", "green", "blue"].includes(channel)
    ? channel
    : "";
  if (!normalizedChannel) {
    return;
  }

  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    highlightColorId: CUSTOM_HIGHLIGHT_COLOR_ID,
    highlightCustomRgb: {
      ...state.editorPrefs.highlightCustomRgb,
      [normalizedChannel]: value,
    },
  });
  if (options.rememberRecent === true) {
    state.editorPrefs = normalizeEditorPrefs({
      ...state.editorPrefs,
      highlightRecentCustomColors: addRecentHighlightCustomColor(
        state.editorPrefs.highlightRecentCustomColors,
        state.editorPrefs.highlightCustomRgb,
      ),
    });
  }
  persistHighlightColorPreference("highlight-custom-rgb-updated", "setHighlightCustomRgbPreference");
  if (options.rememberRecent === true) {
    renderManuscriptPanel();
    syncSceneDocumentLayout();
    return;
  }

  syncHighlightColorPreferenceDom();
}

function persistHighlightColorPreference(dirtyReason, source) {
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason,
    source,
  });
}

function syncHighlightColorPreferenceDom() {
  const highlightColor = resolveHighlightColorOption(
    state.editorPrefs.highlightColorId,
    state.editorPrefs.highlightCustomRgb,
  );
  for (const editorFrame of document.querySelectorAll("[data-scene-editor]")) {
    if (editorFrame instanceof HTMLElement) {
      editorFrame.setAttribute("style", buildEditorStyle());
    }
  }

  const highlightButton = document.querySelector('[data-highlight-color-trigger]');
  if (highlightButton instanceof HTMLElement) {
    highlightButton.style.setProperty("--highlight-button-color", highlightColor.color);
    highlightButton.style.setProperty("--highlight-button-outline", highlightColor.outline);
    highlightButton.setAttribute("aria-expanded", state.highlightColorPaletteOpen ? "true" : "false");
  }

  const palette = document.querySelector("[data-highlight-color-palette]");
  if (!(palette instanceof HTMLElement)) {
    return;
  }

  const customColor = resolveHighlightColorOption(CUSTOM_HIGHLIGHT_COLOR_ID, state.editorPrefs.highlightCustomRgb);
  const recentCustomColors = normalizeHighlightRecentCustomColors(state.editorPrefs.highlightRecentCustomColors);
  for (const swatch of palette.querySelectorAll("[data-highlight-color-id]")) {
    if (!(swatch instanceof HTMLElement)) {
      continue;
    }
    const recentIndex = Number(swatch.dataset.highlightCustomRgbIndex);
    const isRecentCustomSwatch = swatch.dataset.highlightCustomRgbIndex !== undefined &&
      Number.isInteger(recentIndex);
    const isActive = isRecentCustomSwatch
      ? state.editorPrefs.highlightColorId === CUSTOM_HIGHLIGHT_COLOR_ID &&
        areHighlightCustomColorsEqual(customColor.rgb, recentCustomColors[recentIndex])
      : swatch.dataset.highlightColorId === state.editorPrefs.highlightColorId;
    swatch.classList.toggle("is-active", isActive);
    swatch.setAttribute("aria-checked", isActive ? "true" : "false");
    if (!isRecentCustomSwatch && swatch.dataset.highlightColorId === CUSTOM_HIGHLIGHT_COLOR_ID) {
      swatch.style.setProperty("--highlight-swatch-color", customColor.color);
      swatch.style.setProperty("--highlight-swatch-outline", customColor.outline);
    }
  }

  for (const [channel, value] of Object.entries(customColor.rgb)) {
    const input = palette.querySelector(`[data-highlight-rgb-channel="${CSS.escape(channel)}"]`);
    if (input instanceof HTMLInputElement) {
      input.value = String(value);
    }
    const output = palette.querySelector(`[data-highlight-rgb-output="${CSS.escape(channel)}"]`);
    if (output instanceof HTMLOutputElement) {
      output.value = String(value);
      output.textContent = String(value);
    }
  }

  const preview = palette.querySelector("[data-highlight-rgb-preview]");
  if (preview instanceof HTMLElement) {
    preview.style.setProperty("--highlight-swatch-color", customColor.color);
    preview.style.setProperty("--highlight-swatch-outline", customColor.outline);
  }
  const label = palette.querySelector("[data-highlight-rgb-label]");
  if (label instanceof HTMLElement) {
    label.textContent = `rgb(${customColor.rgb.red}, ${customColor.rgb.green}, ${customColor.rgb.blue})`;
  }
}

// Intent: translate editor preferences into CSS variables without mutating manuscript data.
function buildEditorStyle() {
  const highlightColor = resolveHighlightColorOption(
    state.editorPrefs.highlightColorId,
    state.editorPrefs.highlightCustomRgb,
  );
  return [
    `--editor-content-width:${state.editorPrefs.editorWidth}px`,
    `--editor-font-size:${state.editorPrefs.fontSize}px`,
    `--editor-line-height:${state.editorPrefs.lineHeight}`,
    `--editor-font-stack:${getFontStack()}`,
    `--editor-highlight-color:${highlightColor.color}`,
    `--editor-highlight-outline:${highlightColor.outline}`,
  ].join("; ");
}

function getFontStack() {
  return FONT_OPTIONS.find((option) => option.id === state.editorPrefs.fontFamilyId)?.stack
    ?? FONT_OPTIONS[0].stack;
}

function syncSceneDocumentLayout(options = {}) {
  const editor = document.querySelector("[data-scene-editor]");
  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const editorHost = resolveTextareaEditorHost(editor);
  const textarea = editorHost?.textarea;
  const gutter = editor.querySelector("[data-editor-gutter]");
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    !(gutter instanceof HTMLElement) ||
    !editorHost
  ) {
    return;
  }
  const selectedSceneId = editor.dataset.sceneEditor ?? "";

  textarea.style.height = "0px";
  const scrollHeight = textarea.scrollHeight;
  textarea.style.height = `${scrollHeight}px`;

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight || "0");
  const paddingTop = parseFloat(style.paddingTop || "0");
  const paddingBottom = parseFloat(style.paddingBottom || "0");
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const contentWidth = resolveTextareaEditorHostContentWidth({
    clientWidth: textarea.clientWidth,
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
  });
  const charactersPerLine = Math.max(
    8,
    Math.floor(contentWidth / approximateCharacterWidth),
  );
  const sceneLineMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    selectedSceneId ? { [selectedSceneId]: textarea.value } : {},
  );
  const selectedSceneMetrics = sceneLineMetrics.find((candidate) => candidate.sceneId === selectedSceneId);
  const visualLineCount = resolveMeasuredEditorGutterLineCount({
    scrollHeight,
    lineHeight,
    paddingTop,
    paddingBottom,
    fallbackLineCount: selectedSceneMetrics?.lineCount,
  });
  const lineStartNumber = selectedSceneMetrics?.startLineNumber ?? 1;

  gutter.innerHTML = Array.from({ length: visualLineCount }, (_, index) => `
    <span class="editor-gutter-line">${lineStartNumber + index}</span>
  `).join("");
  syncManuScriptInfographicLane(editorHost, selectedSceneId, {
    charactersPerLine,
    visualLineCount,
  });
  syncDraftProofLayer(editorHost, selectedSceneId);
  syncNarrationRecordingLayer(editorHost, selectedSceneId);
  syncNarrationFollowLayer(editorHost, selectedSceneId);
  syncInlineFormatLayer(editorHost);
  syncDiagnosticLayer(editorHost, selectedSceneId);
  if (state.editorPrefs.grammarCheckEnabled === false || areNarrationManuscriptDecorationsSuppressed()) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
  } else if (options.skipSpellcheck === true) {
    syncTextareaSpellcheckTypingState(editorHost, options.activeTypingWordRange);
  } else {
    syncSpellcheckLayer(editorHost, selectedSceneId, options);
  }
  syncInlinePassageDraftLayout();
}

// Intent: rebuild ManuScriptInfographicLane icons from durable task, research, world, and custom metadata anchors without storing visual state.
function syncManuScriptInfographicLane(editorHost, sceneId, {
  charactersPerLine,
  visualLineCount,
} = {}) {
  const scene = getScene(sceneId);
  const visible = state.editorPrefs?.manuScriptInfographicLaneVisible !== false;
  if (!scene || !visible || !(editorHost?.textarea instanceof HTMLTextAreaElement)) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.MANU_SCRIPT_INFOGRAPHIC_LANE);
    return;
  }

  renderTextareaManuScriptInfographicLane(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      sceneId,
      text: editorHost.textarea.value,
      manuScriptInfographicLanePreviews: createManuScriptInfographicLanePreviewsForScene({ state, scene }),
      includeAuthorMarks: false,
      includeDraftProofing: false,
      includeDiagnostics: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: false,
      includeSpellcheck: false,
    }),
  }, {
    charactersPerLine,
    visualLineCount,
  });
}

// Intent: centralize the narration-only overlay preference so post-render layer syncs match initial HTML rendering.
function areNarrationManuscriptDecorationsSuppressed() {
  return state.activePane === "narration" &&
    state.narrationFollowSettings?.manuscriptDecorationsVisible === false;
}

// Intent: keep saved-take and live-follow paint controllable without suppressing manuscript diagnostics.
function areNarrationDecorationsSuppressed() {
  return state.activePane === "narration" &&
    state.narrationFollowSettings?.narrationDecorationsVisible === false;
}

// Intent: rebuild draft proof-read coverage visuals from durable run coverage without persisting overlays.
function syncDraftProofLayer(editorHost, sceneId) {
  const scene = getScene(sceneId);
  const hasTextarea = editorHost?.textarea instanceof HTMLTextAreaElement;
  const marksVisible = state.draftProofMarksVisible === true;
  if (state.activePane !== "manuscript" || !scene || !marksVisible || !hasTextarea) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.DRAFT_PROOF);
    logDraftProofLayerSync({
      phase: "clear",
      sceneId,
      reason: state.activePane !== "manuscript"
        ? "inactive-pane"
        : !scene
          ? "missing-scene"
          : !marksVisible
            ? "markers-hidden"
            : "missing-textarea",
      editorHost,
      projections: [],
      rendered: false,
    });
    return;
  }

  const projections = selectManuscriptProjections({
    sceneId,
    text: editorHost.textarea.value,
    draftProofing: state.draftProofing,
    includeAuthorMarks: false,
    includeDraftProofing: true,
    includeDiagnostics: false,
    includeAnchoredRecords: false,
    includeRuntimeSelections: false,
    includeSpellcheck: false,
  });
  const rendered = renderTextareaDraftProofLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    draftProofBackdropColor: state.draftProofing?.settings?.backdropColor ?? "",
    projections,
  });
  logDraftProofLayerSync({
    phase: "render",
    sceneId,
    editorHost,
    projections,
    rendered,
  });
}

// Intent: keep proof-read overlay diagnostics count-based and stable enough for repeated visual test runs.
function logDraftProofLayerSync({
  phase = "render",
  sceneId = "",
  reason = "",
  editorHost = null,
  projections = [],
  rendered = false,
} = {}) {
  if (!draftProofingLog.isEnabled()) {
    return;
  }

  const textarea = editorHost?.textarea instanceof HTMLTextAreaElement ? editorHost.textarea : null;
  const projectionRanges = createDraftProofProjectionRangeLog(projections);
  const context = createDraftProofTextareaLogContext(textarea, {
    sceneId: sceneId || editorHost?.sceneId || "",
    runId: getCurrentDraftProofRunRecord()?.id ?? "",
    phase,
    reason,
    rendered,
    activePane: state.activePane,
    marksVisible: state.draftProofMarksVisible === true,
    projectionCount: projectionRanges.length,
    projectionRanges,
  });
  const signature = [
    phase,
    context.sceneId,
    reason,
    rendered ? "rendered" : "not-rendered",
    context.activePane,
    context.marksVisible ? "visible" : "hidden",
    context.textLength,
    context.textareaClientWidth,
    context.textareaScrollHeight,
    context.contentWidth,
    projectionRanges.map((range) => `${range.startOffset}-${range.endOffset}`).join("|"),
  ].join(":");
  if (signature === draftProofLayerLogSignature) {
    return;
  }

  draftProofLayerLogSignature = signature;
  draftProofingLog.debug(
    "render",
    phase === "clear" ? "draft-proof.layer.clear" : "draft-proof.layer.render",
    phase === "clear" ? "Cleared the proof-read overlay layer." : "Rendered the proof-read overlay layer.",
    context,
  );
}

// Intent: record manuscript viewport metrics without storing manuscript text in developer logs.
function createDraftProofTextareaLogContext(textarea, extra = {}) {
  const sceneId = String(extra.sceneId ?? textarea?.dataset?.sceneId ?? "").trim();
  const scene = sceneId ? getScene(sceneId) : null;
  const textLength = textarea instanceof HTMLTextAreaElement ? String(textarea.value ?? "").length : 0;
  const selectionStart = textarea instanceof HTMLTextAreaElement && Number.isInteger(textarea.selectionStart)
    ? textarea.selectionStart
    : null;
  const selectionEnd = textarea instanceof HTMLTextAreaElement && Number.isInteger(textarea.selectionEnd)
    ? textarea.selectionEnd
    : selectionStart;
  const startOffset = Number.isInteger(extra.startOffset)
    ? extra.startOffset
    : selectionStart;
  const endOffset = Number.isInteger(extra.endOffset)
    ? extra.endOffset
    : selectionEnd;
  const codeframe = textarea instanceof HTMLTextAreaElement
    ? textarea.closest(".scene-editor-codeframe")
    : null;
  const rect = textarea instanceof HTMLTextAreaElement
    ? textarea.getBoundingClientRect()
    : null;
  const style = textarea instanceof HTMLTextAreaElement
    ? window.getComputedStyle(textarea)
    : null;
  const contentWidth = textarea instanceof HTMLTextAreaElement
    ? resolveTextareaEditorHostContentWidth({
        clientWidth: textarea.clientWidth,
        paddingLeft: style?.paddingLeft,
        paddingRight: style?.paddingRight,
      })
    : 0;
  const startLineNumber = textarea instanceof HTMLTextAreaElement && Number.isInteger(startOffset)
    ? getSceneEditorSelectionLineNumber(textarea, scene, startOffset)
    : null;
  const endLineNumber = textarea instanceof HTMLTextAreaElement && Number.isInteger(endOffset)
    ? getSceneEditorSelectionLineNumber(textarea, scene, endOffset)
    : null;

  return {
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    sceneId,
    chapterId: scene?.chapterId ?? "",
    sceneTitle: scene?.sceneTitle ?? "",
    textLength,
    selectionStart,
    selectionEnd,
    startOffset,
    endOffset,
    selectedCharacterCount: Number.isInteger(startOffset) && Number.isInteger(endOffset)
      ? Math.max(0, endOffset - startOffset)
      : 0,
    startLineNumber,
    endLineNumber,
    selectionDirection: textarea instanceof HTMLTextAreaElement ? textarea.selectionDirection ?? "" : "",
    textareaClientWidth: textarea instanceof HTMLTextAreaElement ? Math.round(textarea.clientWidth) : 0,
    textareaClientHeight: textarea instanceof HTMLTextAreaElement ? Math.round(textarea.clientHeight) : 0,
    textareaScrollHeight: textarea instanceof HTMLTextAreaElement ? Math.round(textarea.scrollHeight) : 0,
    textareaOffsetHeight: textarea instanceof HTMLTextAreaElement ? Math.round(textarea.offsetHeight) : 0,
    textareaTop: rect ? Math.round(rect.top) : null,
    textareaLeft: rect ? Math.round(rect.left) : null,
    textareaWidth: rect ? Math.round(rect.width) : null,
    textareaHeight: rect ? Math.round(rect.height) : null,
    codeframeScrollTop: codeframe instanceof HTMLElement ? Math.round(codeframe.scrollTop) : null,
    codeframeClientHeight: codeframe instanceof HTMLElement ? Math.round(codeframe.clientHeight) : null,
    codeframeScrollHeight: codeframe instanceof HTMLElement ? Math.round(codeframe.scrollHeight) : null,
    contentWidth: Math.round(contentWidth),
    paddingLeft: style?.paddingLeft ?? "",
    paddingRight: style?.paddingRight ?? "",
    paddingTop: style?.paddingTop ?? "",
    paddingBottom: style?.paddingBottom ?? "",
    fontSize: style?.fontSize ?? "",
    lineHeight: style?.lineHeight ?? "",
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

// Intent: summarize projection spans for debugging without exposing manuscript text.
function createDraftProofProjectionRangeLog(projections = []) {
  return (Array.isArray(projections) ? projections : [])
    .slice(0, 12)
    .map((projection) => ({
      id: projection?.id ?? "",
      startOffset: Number.isInteger(projection?.startOffset) ? projection.startOffset : null,
      endOffset: Number.isInteger(projection?.endOffset) ? projection.endOffset : null,
      runId: projection?.sourceRef?.recordId ?? "",
      styleToken: projection?.styleToken ?? "",
    }));
}

function countDraftProofCoverageSpans(spans = []) {
  return Array.isArray(spans) ? spans.length : 0;
}

function countDraftProofCoveredCharacters(spans = []) {
  return (Array.isArray(spans) ? spans : []).reduce((total, span) => {
    const startOffset = Number(span?.startOffset);
    const endOffset = Number(span?.endOffset);
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
      return total;
    }

    return total + Math.max(0, Math.floor(endOffset) - Math.floor(startOffset));
  }, 0);
}

// Intent: rebuild saved narration take coverage as render-only manuscript highlights in narration mode.
function syncNarrationRecordingLayer(editorHost, sceneId) {
  const scene = getScene(sceneId);
  if (
    state.activePane !== "narration" ||
    areNarrationDecorationsSuppressed() ||
    !scene ||
    !(editorHost?.textarea instanceof HTMLTextAreaElement)
  ) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_RECORDING);
    return;
  }

  renderTextareaNarrationRecordingLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      sceneId,
      text: editorHost.textarea.value,
      narrationRecordingPreviews: createNarrationRecordingPreviewsForScene(state, scene),
      includeAuthorMarks: false,
      includeDraftProofing: false,
      includeDiagnostics: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: true,
      includeSpellcheck: false,
    }),
  });
}

// Intent: repaint live read coverage plus the current spoken span while scroll stays separate.
function syncNarrationFollowLayer(editorHost, sceneId) {
  const liveFollowSelection = state.narrationTakeSession?.status === "recording"
    ? state.narrationTakeSession?.followSelection
    : null;
  if (
    state.activePane !== "narration" ||
    areNarrationDecorationsSuppressed() ||
    state.narrationFollowSettings?.liveHighlightEnabled === false ||
    !liveFollowSelection ||
    liveFollowSelection.sceneId !== sceneId ||
    !(editorHost?.textarea instanceof HTMLTextAreaElement)
  ) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
    return;
  }

  const previewSelections = createNarrationFollowPreviewSelections(liveFollowSelection, editorHost.textarea.value);
  const projections = selectManuscriptProjections({
    sceneId,
    text: editorHost.textarea.value,
    narrationSelection: previewSelections,
    includeAuthorMarks: false,
    includeDraftProofing: false,
    includeDiagnostics: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  }).filter((candidate) => candidate.channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW);
  renderTextareaNarrationFollowLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections,
  });
}

// Intent: defer the current overlay limitation to the textarea host while richer hosts remain possible.
function syncInlineFormatLayer(editorHost) {
  const sceneId = String(editorHost?.sceneId ?? "");
  const scene = getScene(sceneId);
  if (
    areNarrationManuscriptDecorationsSuppressed() ||
    !scene ||
    !(editorHost?.textarea instanceof HTMLTextAreaElement)
  ) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
    return;
  }

  renderTextareaAuthorMarkLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      projectId: state.workspace?.project?.id ?? "",
      sceneId,
      text: editorHost.textarea.value,
      sceneBlocks: scene.blocks,
      manuscriptMarks: state.workspace?.project?.marks,
      inlineFormatRanges: getSceneInlineFormatRanges(sceneId, editorHost.textarea.value.length),
      includeDraftProofing: false,
      includeDiagnostics: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: false,
      includeSpellcheck: false,
    }),
  });
}

// Intent: rebuild diagnostic visuals from durable issue anchors and current text without persisting overlays.
function syncDiagnosticLayer(editorHost, sceneId) {
  const scene = getScene(sceneId);
  if (areNarrationManuscriptDecorationsSuppressed() || !scene) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
    return;
  }

  renderTextareaDiagnosticLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      projectId: state.workspace?.project?.id ?? "",
      sceneId,
      text: editorHost.textarea.value,
      sceneBlocks: scene.blocks,
      diagnosticIssues: state.workspace?.project?.issues,
      includeAuthorMarks: false,
      includeDraftProofing: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: false,
      includeSpellcheck: false,
    }),
  });
}

const sceneEditorTypingRefreshState = {
  frameId: null,
  sceneId: "",
  editorText: "",
  activeTypingWordRange: null,
  layout: false,
  revisionPanel: false,
  grammarPanel: false,
  consoleCard: false,
  inlinePassageStatus: false,
};

function scheduleSceneEditorTypingRefresh(sceneId, editorText, options = {}) {
  sceneEditorTypingRefreshState.sceneId = sceneId;
  sceneEditorTypingRefreshState.editorText = editorText;
  sceneEditorTypingRefreshState.activeTypingWordRange = options.activeTypingWordRange ?? null;
  sceneEditorTypingRefreshState.layout = true;
  sceneEditorTypingRefreshState.revisionPanel = options.revisionPanel !== false;
  sceneEditorTypingRefreshState.grammarPanel = options.grammarPanel !== false;
  sceneEditorTypingRefreshState.consoleCard = options.consoleCard !== false;
  sceneEditorTypingRefreshState.inlinePassageStatus = options.inlinePassageStatus !== false;

  if (sceneEditorTypingRefreshState.frameId !== null) {
    return;
  }

  sceneEditorTypingRefreshState.frameId = window.requestAnimationFrame(() => {
    sceneEditorTypingRefreshState.frameId = null;
    const {
      sceneId: pendingSceneId,
      editorText: pendingEditorText,
      activeTypingWordRange,
      layout,
      revisionPanel,
      grammarPanel,
      consoleCard,
      inlinePassageStatus,
    } = sceneEditorTypingRefreshState;

    sceneEditorTypingRefreshState.layout = false;
    sceneEditorTypingRefreshState.revisionPanel = false;
    sceneEditorTypingRefreshState.grammarPanel = false;
    sceneEditorTypingRefreshState.consoleCard = false;
    sceneEditorTypingRefreshState.inlinePassageStatus = false;
    sceneEditorTypingRefreshState.activeTypingWordRange = null;

    if (layout) {
      syncSceneDocumentLayout({ skipSpellcheck: true });
    }
    syncSceneEditorWordCountReadouts(getEditorTextareaForScene(pendingSceneId));
    if (revisionPanel) {
      syncRevisionPanel(pendingSceneId);
    }
    if (consoleCard) {
      updateFocusedLineCard();
    }
    if (inlinePassageStatus) {
      updateInlinePassageDraftStatus(pendingEditorText);
    }
  });
}

function scheduleSceneEditorSpellcheckRefresh(sceneId) {
  spellcheckRefreshController.schedule(sceneId, {
    enabled: state.editorPrefs.grammarCheckEnabled !== false,
  });
}

function flushSceneEditorSpellcheckRefresh(sceneId) {
  if (state.editorPrefs.grammarCheckEnabled === false) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!editorHost) {
    return;
  }

  const activeTypingWordRange = getEditorTypingSpellcheckRange(textarea);
  syncSceneDocumentLayout({
    activeTypingWordRange,
  });
  renderGrammarCheckPanel({
    activeTypingWordRange,
  });
}

function clearSceneEditorSpellcheckRefresh() {
  spellcheckRefreshController.clear();
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
    buildSceneDraftsWithLoadedSceneStoreBodies(),
    state.structureDrafts,
  );
}

// Intent: render and row-mutate metadata-only drafts without losing retained split-storage scene bodies.
function buildSceneDraftsWithLoadedSceneStoreBodies(sceneDrafts = state.sceneDrafts) {
  const projectSceneStore = getActiveLoadedProjectSceneStore();
  if (!projectSceneStore) {
    return sceneDrafts;
  }

  const mergedDrafts = {};
  for (const [sceneId, sceneRecord] of Object.entries(projectSceneStore)) {
    if (sceneRecord && typeof sceneRecord === "object" && !Array.isArray(sceneRecord)) {
      mergedDrafts[sceneId] = cloneValue(sceneRecord);
    }
  }

  const runtimeDrafts = sceneDrafts && typeof sceneDrafts === "object" && !Array.isArray(sceneDrafts)
    ? sceneDrafts
    : {};
  for (const [sceneId, draft] of Object.entries(runtimeDrafts)) {
    mergedDrafts[sceneId] = mergeSceneDraftWithLoadedSceneStoreBody(sceneId, draft);
  }

  return mergedDrafts;
}

function mergeSceneDraftWithLoadedSceneStoreBody(sceneId = "", draft = null) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const runtimeDraft = draft && typeof draft === "object" && !Array.isArray(draft)
    ? cloneValue(draft)
    : null;
  if (!normalizedSceneId || !runtimeDraft || sceneDraftHasSubstantiveBody(runtimeDraft)) {
    return runtimeDraft;
  }

  const storedDraft = getActiveLoadedProjectSceneStore()?.[normalizedSceneId];
  if (!sceneDraftHasSubstantiveBody(storedDraft)) {
    return runtimeDraft;
  }

  return {
    ...cloneValue(storedDraft),
    ...runtimeDraft,
    editorText: typeof storedDraft.editorText === "string" ? storedDraft.editorText : "",
    blocks: Array.isArray(storedDraft.blocks) ? cloneValue(storedDraft.blocks) : [],
  };
}

function getActiveLoadedProjectSceneStore() {
  const projectId = String(state.workspace?.project?.id ?? state.activeProjectId ?? "").trim();
  if (!projectId) {
    return null;
  }

  const projectSceneStore = state.loadedProjectSceneStore?.[projectId];
  return projectSceneStore && typeof projectSceneStore === "object" && !Array.isArray(projectSceneStore)
    ? projectSceneStore
    : null;
}

// Intent: prefer the desktop project file on boot; browser cache is only a temporary compatibility fallback.
async function loadInitialProjectLibrary(desktopSettings = null) {
  const explicitDesktopProjectFilePath = resolveProjectFilePath(desktopSettings?.lastProjectFilePath);
  const hasExplicitDesktopProjectFilePath =
    desktopSettings?.lastProjectFilePathExplicit === true &&
    hasProjectFilePath(explicitDesktopProjectFilePath);
  const storedLibrary = normalizeProjectLibrarySnapshot(projectService.loadProjectLibrarySnapshot());
  const storedActiveProjectId = projectRepository.loadActiveProjectId();
  const legacyProjectId =
    storedLibrary.activeProjectId ??
    storedActiveProjectId ??
    null;
  const legacyState = hasExplicitDesktopProjectFilePath ? null : loadLegacyProjectState(legacyProjectId);
  const remoteSeedLibrary = await Promise.race([
    loadDesktopProjectLibrarySeed(),
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), DESKTOP_PROJECT_LIBRARY_BOOT_TIMEOUT_MS);
    }),
  ]);
  const bundledSeedLibrary = remoteSeedLibrary ? null : loadBundledProjectLibrarySeed();
  const workspaceSeedLibrary = remoteSeedLibrary || bundledSeedLibrary || await loadWorkspaceFallbackProjectLibrarySeed();
  const seedLibrary = workspaceSeedLibrary;
  const shouldPreferBrowserCache = shouldPreferBrowserCacheProjectLibraryOnBoot({
    storedLibrary,
    seedLibrary,
    storedActiveProjectId,
    explicitProjectFilePath: hasExplicitDesktopProjectFilePath ? explicitDesktopProjectFilePath : "",
  });
  if (shouldPreferBrowserCache) {
    const activeProjectId = resolveActiveProjectId(
      storedActiveProjectId,
      storedLibrary,
    );
    const persistedLibrary = projectService.saveProjectLibrarySnapshot({
      activeProjectId,
      projects: storedLibrary.projects,
      sceneStore: storedLibrary.sceneStore ?? {},
    });
    return {
      ...persistedLibrary,
      sceneStore: storedLibrary.sceneStore ?? {},
      usedBrowserCacheFallback: true,
      ignoredDesktopProjectFilePath: hasExplicitDesktopProjectFilePath ? explicitDesktopProjectFilePath : "",
    };
  }

  const shouldDeferToDesktopProjectFile = hasExplicitDesktopProjectFilePath;
  const mergedLibrary = mergeProjectLibrarySnapshots(storedLibrary, seedLibrary, legacyState);
  const activeProjectId = resolveActiveProjectId(
    storedActiveProjectId,
    mergedLibrary,
  );
  const library = {
    activeProjectId,
    projects: mergedLibrary.projects,
    sceneStore: mergedLibrary.sceneStore ?? {},
  };

  if (shouldDeferToDesktopProjectFile) {
    return library;
  }

  const persistedLibrary = projectService.saveProjectLibrarySnapshot(library);
  return {
    ...persistedLibrary,
    sceneStore: library.sceneStore,
  };
}

function loadBundledProjectLibrarySeed() {
  const bundledSeed = window.__ABE_SERVA_VITAE_PROJECT_LIBRARY__;
  if (!bundledSeed || typeof bundledSeed !== "object") {
    return null;
  }

  return normalizeProjectLibrarySnapshot(bundledSeed);
}

async function loadDesktopProjectLibrarySeed() {
  const projectLibraryResponse = await fetchJsonFromDesktopApi("/api/project-library");
  if (projectLibraryResponse.ok) {
    return normalizeProjectLibrarySnapshot(projectLibraryResponse.value);
  }

  reportBrowserLog("warn", "project-library", "Unable to load the project library seed.", {
    error: projectLibraryResponse.error,
    attemptedUrls: projectLibraryResponse.attemptedUrls,
  });
  console.warn("Unable to load the saved project library seed.", projectLibraryResponse.error);

  return null;
}

async function loadWorkspaceFallbackProjectLibrarySeed() {
  const workspaceResponse = await fetchJsonFromDesktopApi("/api/workspace");
  if (!workspaceResponse.ok) {
    reportBrowserLog("error", "workspace", "Workspace request failed.", {
      error: workspaceResponse.error,
      attemptedUrls: workspaceResponse.attemptedUrls,
    });
    throw workspaceResponse.error ?? new Error("Workspace request failed.");
  }

  const workspace = workspaceResponse.value;
  return {
    activeProjectId: workspace?.project?.id ?? null,
    projects: [
      createProjectLibraryRecordFromWorkspace(workspace, {
        source: "workspace-fallback",
        createdAt: workspace?.generatedAt,
        updatedAt: workspace?.generatedAt,
      }),
    ],
  };
}

async function fetchJsonFromDesktopApi(pathname, requestOptions = {}) {
  const attemptedUrls = [];
  const baseUrls = getDesktopApiBaseUrls();

  const method = typeof requestOptions.method === "string" ? requestOptions.method.toUpperCase() : "GET";
  const bodyValue = requestOptions.body;
  let lastError = null;
  fileAccessBridgeLog.debug("file-access", "desktop-api.request", "Dispatching desktop API request.", {
    pathname,
    method,
    hasBody: bodyValue !== undefined,
  });

  for (const baseUrl of baseUrls) {
    const url = new URL(pathname, baseUrl).toString();
    if (attemptedUrls.includes(url)) {
      continue;
    }
    attemptedUrls.push(url);

    try {
      const headers = {};
      let body;
      if (bodyValue !== undefined) {
        headers["Content-Type"] = "application/json";
        body = typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue);
        fileAccessBridgeLog.debug("validation", "json.stringify.request-body", "Serialized desktop API request body.", {
          pathname,
          method,
          bodyLength: typeof body === "string" ? body.length : 0,
        });
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
      });
      fileAccessBridgeLog.debug("file-access", "desktop-api.response", "Received desktop API response.", {
        pathname,
        method,
        url,
        status: response.status,
      });
      const responseText = await response.text();
      const parsedResponse = responseText ? parseJsonResponseBody(responseText) : null;
      if (!response.ok) {
        throw new Error(
          typeof parsedResponse === "object" && parsedResponse && typeof parsedResponse.message === "string"
            ? parsedResponse.message
            : `Request failed with status ${response.status}.`,
        );
      }

      return {
        ok: true,
        value: parsedResponse,
        attemptedUrls,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      fileAccessBridgeLog.warn("file-access", "desktop-api.retry", "Desktop API request failed at one host; trying next.", {
        pathname,
        method,
        url,
        error,
      });
      reportBrowserLog("warn", "api", `Unable to load ${pathname} from ${url}.`, {
        error,
        url,
      });
    }
  }

  return {
    ok: false,
    error: lastError ?? new Error(`Unable to load ${pathname} from the desktop API.`),
    attemptedUrls,
  };
}

function getDesktopApiBaseUrls() {
  const baseUrls = [];
  const origin = typeof window.location.origin === "string" && /^https?:\/\//.test(window.location.origin)
    ? window.location.origin
    : "";
  for (const baseUrl of [origin, "http://127.0.0.1:4310", "http://localhost:4310"]) {
    if (baseUrl && !baseUrls.includes(baseUrl)) {
      baseUrls.push(baseUrl);
    }
  }
  return baseUrls;
}

function parseJsonResponseBody(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    fileAccessBridgeLog.debug("validation", "json.parse.response", "Parsed JSON response body.", {
      length: responseText.length,
    });
    return parsed;
  } catch (error) {
    fileAccessBridgeLog.warn("validation", "json.parse.failed", "Response body was not valid JSON; returning raw text.", {
      length: responseText.length,
      error,
    });
    return responseText;
  }
}

function loadLegacyProjectState(projectId = null) {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim() ? projectId.trim() : "";
  return {
    sceneDrafts: loadSceneDrafts(),
    structureDrafts: loadStructureDrafts(),
    templateDrafts: loadTemplateDrafts(),
    manuscriptTasks: loadManuscriptTasks(),
    passageNotes: loadPassageNotes(),
    metadataSubgroups: [],
    draftProofing: createDefaultDraftProofingState(),
    activePane: normalizeWorkspacePaneId(state.activePane),
    editorPrefs: loadEditorPrefs(),
    localAiPrefs: loadLocalAiPrefs(),
    projectTitle: loadProjectTitle(state.workspace?.project?.title ?? ""),
    projectSourcePath: loadStoredString(EDITOR_PROJECT_SOURCE_PATH_KEY) ?? "",
    binderPanelWidth: loadStoredNumber(EDITOR_BINDER_WIDTH_KEY, DEFAULT_BINDER_PANEL_WIDTH),
    consoleDockWidth: loadStoredNumber(EDITOR_CONSOLE_WIDTH_KEY, DEFAULT_CONSOLE_PANEL_WIDTH),
    panelResizerLayoutProfiles: normalizePanelResizerLayoutProfiles(
      readStoredJson(EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY),
    ),
    worldSpineEventRailWidth: loadStoredNumber(
      EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY,
      DEFAULT_WORLD_SPINE_EVENT_RAIL_WIDTH,
    ),
    worldSpineManuscriptPaneWidth: loadStoredNumber(
      EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY,
      DEFAULT_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
    ),
    worldSpinePanelLayoutProfiles: normalizeWorldSpineLayoutProfiles(
      readStoredJson(EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY),
    ),
    worldSpineRightPaneMode: normalizeWorldSpineRightPaneMode(),
    worldSpineUnplacedDockCollapsed: false,
    worldSpineLocationFilter: createDefaultWorldSpineLocationFilterState(),
    consoleDockCollapsed: readStoredJson(EDITOR_RIGHT_DOCK_COLLAPSED_KEY) === true,
    sidePanelsHidden: normalizeSidePanelsHiddenState(readStoredJson(EDITOR_SIDE_PANELS_HIDDEN_KEY)),
    sidePanelVisibility: createSidePanelVisibilityState(readStoredJson(EDITOR_SIDE_PANEL_VISIBILITY_KEY)),
    topPanelVisibility: createTopPanelVisibilityState(readStoredJson(EDITOR_TOP_PANEL_VISIBILITY_KEY)),
    customMetadataDefinitions: [],
    collapsedChapterIds: normalizedProjectId ? loadCollapsedChapterIds(normalizedProjectId) : [],
    collapsedConsoleChapterIds: normalizedProjectId ? loadCollapsedConsoleChapterIds(normalizedProjectId) : {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    },
    projectFilePath: loadStoredString(EDITOR_PROJECT_FILE_PATH_KEY) ?? "",
    writingTargetState: null,
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: "",
    writingTargetCalendarMonthKey: "",
  };
}

function mergeProjectRecords(storedRecord, seedRecord, legacyState = null) {
  const storedProjectSettings = storedRecord?.projectSettings && typeof storedRecord.projectSettings === "object" && !Array.isArray(storedRecord.projectSettings)
    ? storedRecord.projectSettings
    : {};
  const seedProjectSettings = seedRecord?.projectSettings && typeof seedRecord.projectSettings === "object" && !Array.isArray(seedRecord.projectSettings)
    ? seedRecord.projectSettings
    : {};
  const seedWorkspace = seedRecord?.workspace && typeof seedRecord.workspace === "object" && !Array.isArray(seedRecord.workspace)
    ? cloneValue(seedRecord.workspace)
    : {};
  const storedWorkspace = storedRecord?.workspace && typeof storedRecord.workspace === "object" && !Array.isArray(storedRecord.workspace)
    ? cloneValue(storedRecord.workspace)
    : {};
  const metadataSubgroupGroupIds = getMetadataSubgroupGroupIds([
    ...normalizeCustomMetadataDefinitions(seedProjectSettings.customMetadataDefinitions),
    ...normalizeCustomMetadataDefinitions(storedProjectSettings.customMetadataDefinitions),
  ]);
  const seedProjectFilePath = normalizeProjectFilePath(seedProjectSettings.projectFilePath);
  const storedProjectFilePath = normalizeProjectFilePath(storedProjectSettings.projectFilePath);
  // Intent: preserve the active cached destination so the bundled seed cannot retarget refresh to the repo-root project file.
  const mergedProjectFilePath = storedProjectFilePath || seedProjectFilePath;
  const mergedWorkspace = {
    ...seedWorkspace,
    ...storedWorkspace,
  };
  if (seedWorkspace.project || storedWorkspace.project) {
    mergedWorkspace.project = {
      ...(seedWorkspace.project && typeof seedWorkspace.project === "object" ? seedWorkspace.project : {}),
      ...(storedWorkspace.project && typeof storedWorkspace.project === "object" ? storedWorkspace.project : {}),
      id: seedRecord.id,
      title: seedRecord.title,
    };
  }
  if (seedWorkspace.selectionDefaults || storedWorkspace.selectionDefaults) {
    mergedWorkspace.selectionDefaults = {
      ...(seedWorkspace.selectionDefaults && typeof seedWorkspace.selectionDefaults === "object" ? seedWorkspace.selectionDefaults : {}),
      ...(storedWorkspace.selectionDefaults && typeof storedWorkspace.selectionDefaults === "object" ? storedWorkspace.selectionDefaults : {}),
    };
  }
  const merged = {
    ...cloneValue(seedRecord),
    ...cloneValue(storedRecord),
    id: seedRecord.id,
    title: seedRecord.title,
    source: seedRecord.source ?? storedRecord.source,
    createdAt: seedRecord.createdAt ?? storedRecord.createdAt,
    updatedAt: storedRecord.updatedAt ?? seedRecord.updatedAt,
    workspace: mergedWorkspace,
    sceneDrafts: storedRecord.sceneDrafts ?? seedRecord.sceneDrafts ?? legacyState?.sceneDrafts ?? {},
    structureDrafts: storedRecord.structureDrafts ?? seedRecord.structureDrafts ?? legacyState?.structureDrafts ?? createStructureDrafts(),
    templateDrafts: storedRecord.templateDrafts ?? seedRecord.templateDrafts ?? legacyState?.templateDrafts ?? createTemplateDrafts(),
    manuscriptTasks: mergeProjectLibraryItemsById(storedRecord.manuscriptTasks, seedRecord.manuscriptTasks, { clone: cloneValue }),
    passageNotes: mergeProjectLibraryItemsById(storedRecord.passageNotes, seedRecord.passageNotes, { clone: cloneValue }),
    metadataSubgroups: mergeMetadataSubgroupsById(storedRecord.metadataSubgroups, seedRecord.metadataSubgroups, metadataSubgroupGroupIds),
    draftProofing: normalizeDraftProofingState(storedRecord.draftProofing ?? seedRecord.draftProofing ?? legacyState?.draftProofing),
    sourceArchive: cloneValue(seedRecord.sourceArchive ?? storedRecord.sourceArchive ?? []),
    importReport: cloneValue(seedRecord.importReport ?? storedRecord.importReport ?? {}),
    editorPrefs: normalizeEditorPrefs(storedRecord.editorPrefs ?? seedRecord.editorPrefs ?? legacyState?.editorPrefs),
    localAiPrefs: normalizeLocalAiPrefs(storedRecord.localAiPrefs ?? seedRecord.localAiPrefs ?? legacyState?.localAiPrefs),
  };
  const mergedRevisionState =
    getPersistableRevisionProjectState(storedRecord.revisions) ??
    getPersistableRevisionProjectState(seedRecord.revisions);
  if (mergedRevisionState) {
    merged.revisions = mergedRevisionState;
  }

  merged.projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate({
      ...cloneValue(seedRecord),
      ...cloneValue(storedRecord),
      projectSettings: {
        ...cloneValue(seedProjectSettings),
        ...cloneValue(storedProjectSettings),
        sidePanelsHidden: storedProjectSettings.sidePanelsHidden ?? seedProjectSettings.sidePanelsHidden ?? legacyState?.sidePanelsHidden,
        topPanelVisibility: storedProjectSettings.topPanelVisibility ?? seedProjectSettings.topPanelVisibility ?? legacyState?.topPanelVisibility,
        projectFilePath: mergedProjectFilePath,
      },
    }),
    seedRecord.id,
    getProjectRecordWordCountForSettings({
      workspace: merged.workspace,
      sceneDrafts: merged.sceneDrafts,
      projectIndex: storedRecord?.projectIndex ?? seedRecord?.projectIndex ?? null,
    }),
    new Date(),
  );
  merged.editorPrefs = cloneValue(merged.projectSettings.editorPrefs);
  merged.localAiPrefs = cloneValue(merged.projectSettings.localAiPrefs);

  if (merged.workspace?.project && typeof merged.workspace.project === "object") {
    merged.workspace.project = {
      ...merged.workspace.project,
      id: seedRecord.id,
      title: seedRecord.title,
    };
  }
  merged.schemaVersion = Number(storedRecord?.schemaVersion ?? seedRecord?.schemaVersion) || PROJECT_SCHEMA_VERSION;
  const persistedProjectIndex = storedRecord?.projectIndex ?? seedRecord?.projectIndex ?? null;
  merged.projectIndex = buildProjectIndexForRecord(merged, persistedProjectIndex);

  return merged;
}

async function reconnectProjectFileDestinationOnBoot(desktopSettings = null) {
  await projectPersistenceService.restoreLastOpenedProject(desktopSettings);
}

function createDefaultProjectSettingsSnapshot(currentWordCount = 0, now = new Date()) {
  return {
    editorPrefs: createDefaultEditorPrefs(),
    localAiPrefs: createDefaultLocalAiPrefs(),
    spellcheck: createDefaultSpellcheckProjectSettings(),
    activePane: normalizeWorkspacePaneId(),
    binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
    consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
    userSettingPanelResizerLeftPercent: null,
    userSettingPanelResizerRightPercent: null,
    panelResizerLayoutProfiles: {},
    worldSpineEventRailWidth: DEFAULT_WORLD_SPINE_EVENT_RAIL_WIDTH,
    worldSpineManuscriptPaneWidth: DEFAULT_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
    worldSpinePanelLayoutProfiles: {},
    worldSpineRightPaneMode: normalizeWorldSpineRightPaneMode(),
    worldSpineUnplacedDockCollapsed: false,
    worldSpineLocationFilter: createDefaultWorldSpineLocationFilterState(),
    consoleDockCollapsed: false,
    sidePanelsHidden: false,
    sidePanelVisibility: createSidePanelVisibilityState(),
    topPanelVisibility: createTopPanelVisibilityState(),
    customMetadataDefinitions: [],
    collapsedChapterIds: [],
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(),
    projectFilePath: "",
    projectSourcePath: "",
    writingTargetState: createDefaultWritingTargetRecord(currentWordCount, now),
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: getLocalDateKey(now),
    writingTargetCalendarMonthKey: getWritingTargetMonthKey(now),
  };
}

function normalizeProjectSettingsSnapshot(candidate, projectId = "", currentWordCount = 0, now = new Date()) {
  const normalizedCandidate = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const defaults = createDefaultProjectSettingsSnapshot(currentWordCount, now);
  const writingTargetStore = projectId ? readWritingTargetStore() : {};
  const projectWritingTarget =
    typeof projectId === "string" && projectId.trim()
      ? writingTargetStore[projectId]
      : null;
  const writingTargetState = normalizeWritingTargetRecord(
    normalizedCandidate.writingTargetState ?? projectWritingTarget ?? defaults.writingTargetState,
    currentWordCount,
    now,
  );
  const writingTargetViewMode = ["month", "week", "list"].includes(normalizedCandidate.writingTargetViewMode)
    ? normalizedCandidate.writingTargetViewMode
    : defaults.writingTargetViewMode;
  const selectedDateKey = isWritingTargetDateKey(normalizedCandidate.writingTargetSelectedDateKey)
    ? normalizedCandidate.writingTargetSelectedDateKey
    : defaults.writingTargetSelectedDateKey;
  const calendarMonth = parseWritingTargetMonthKey(normalizedCandidate.writingTargetCalendarMonthKey);

  return {
    editorPrefs: normalizeEditorPrefs(normalizedCandidate.editorPrefs ?? defaults.editorPrefs),
    localAiPrefs: normalizeLocalAiPrefs(normalizedCandidate.localAiPrefs ?? defaults.localAiPrefs),
    activePane: normalizeWorkspacePaneId(normalizedCandidate.activePane ?? defaults.activePane),
    binderPanelWidth: clampNumber(
      normalizedCandidate.binderPanelWidth ?? defaults.binderPanelWidth,
      MIN_BINDER_PANEL_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    consoleDockWidth: clampNumber(
      normalizedCandidate.consoleDockWidth ?? defaults.consoleDockWidth,
      MIN_CONSOLE_PANEL_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    userSettingPanelResizerLeftPercent: normalizePanelResizerPercent(
      normalizedCandidate.userSettingPanelResizerLeftPercent ?? defaults.userSettingPanelResizerLeftPercent,
    ),
    userSettingPanelResizerRightPercent: normalizePanelResizerPercent(
      normalizedCandidate.userSettingPanelResizerRightPercent ?? defaults.userSettingPanelResizerRightPercent,
    ),
    panelResizerLayoutProfiles: normalizePanelResizerLayoutProfiles(
      normalizedCandidate.panelResizerLayoutProfiles ?? defaults.panelResizerLayoutProfiles,
    ),
    worldSpineEventRailWidth: clampNumber(
      normalizedCandidate.worldSpineEventRailWidth ?? defaults.worldSpineEventRailWidth,
      MIN_WORLD_SPINE_EVENT_RAIL_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    worldSpineManuscriptPaneWidth: clampNumber(
      normalizedCandidate.worldSpineManuscriptPaneWidth ?? defaults.worldSpineManuscriptPaneWidth,
      MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    worldSpinePanelLayoutProfiles: normalizeWorldSpineLayoutProfiles(
      normalizedCandidate.worldSpinePanelLayoutProfiles ?? defaults.worldSpinePanelLayoutProfiles,
    ),
    worldSpineRightPaneMode: normalizeWorldSpineRightPaneMode(
      normalizedCandidate.worldSpineRightPaneMode ?? defaults.worldSpineRightPaneMode,
    ),
    worldSpineUnplacedDockCollapsed: typeof normalizedCandidate.worldSpineUnplacedDockCollapsed === "boolean"
      ? normalizedCandidate.worldSpineUnplacedDockCollapsed
      : defaults.worldSpineUnplacedDockCollapsed,
    worldSpineLocationFilter: normalizeWorldSpineLocationFilterState(
      normalizedCandidate.worldSpineLocationFilter ?? defaults.worldSpineLocationFilter,
    ),
    consoleDockCollapsed: typeof normalizedCandidate.consoleDockCollapsed === "boolean"
      ? normalizedCandidate.consoleDockCollapsed
      : defaults.consoleDockCollapsed,
    sidePanelsHidden: normalizeSidePanelsHiddenState(
      normalizedCandidate.sidePanelsHidden ?? defaults.sidePanelsHidden,
    ),
    sidePanelVisibility: createSidePanelVisibilityState(
      normalizedCandidate.sidePanelVisibility ?? defaults.sidePanelVisibility,
      normalizeCustomMetadataDefinitions(normalizedCandidate.customMetadataDefinitions ?? defaults.customMetadataDefinitions)
        .map((definition) => definition.id),
    ),
    topPanelVisibility: createTopPanelVisibilityState(
      normalizedCandidate.topPanelVisibility ?? defaults.topPanelVisibility,
    ),
    customMetadataDefinitions: normalizeCustomMetadataDefinitions(
      normalizedCandidate.customMetadataDefinitions ?? defaults.customMetadataDefinitions,
    ),
    collapsedChapterIds: normalizeCollapsedChapterIds(
      normalizedCandidate.collapsedChapterIds ?? defaults.collapsedChapterIds,
    ),
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(
      normalizedCandidate.collapsedConsoleChapterIds ?? defaults.collapsedConsoleChapterIds,
    ),
    // Intent: preserve the canonical project-file destination so refreshes can recover the last saved path.
    projectFilePath: normalizeProjectFilePath(
      normalizedCandidate.projectFilePath ?? defaults.projectFilePath,
    ),
    projectSourcePath: normalizeProjectFilePath(normalizedCandidate.projectSourcePath ?? defaults.projectSourcePath),
    writingTargetState,
    writingTargetViewMode,
    writingTargetSelectedDateKey: selectedDateKey,
    writingTargetCalendarMonthKey: calendarMonth
      ? getWritingTargetMonthKey(calendarMonth)
      : defaults.writingTargetCalendarMonthKey,
    spellcheck: normalizeSpellcheckProjectSettings(normalizedCandidate.spellcheck ?? defaults.spellcheck),
  };
}

function buildProjectSettingsCandidate(candidate) {
  const projectSettings = candidate?.projectSettings && typeof candidate.projectSettings === "object" && !Array.isArray(candidate.projectSettings)
    ? candidate.projectSettings
    : {};

  return {
    editorPrefs: projectSettings.editorPrefs ?? candidate?.editorPrefs,
    localAiPrefs: projectSettings.localAiPrefs ?? candidate?.localAiPrefs,
    activePane: projectSettings.activePane ?? candidate?.activePane,
    binderPanelWidth: projectSettings.binderPanelWidth ?? candidate?.binderPanelWidth,
    consoleDockWidth: projectSettings.consoleDockWidth ?? candidate?.consoleDockWidth,
    userSettingPanelResizerLeftPercent: projectSettings.userSettingPanelResizerLeftPercent ?? candidate?.userSettingPanelResizerLeftPercent,
    userSettingPanelResizerRightPercent: projectSettings.userSettingPanelResizerRightPercent ?? candidate?.userSettingPanelResizerRightPercent,
    panelResizerLayoutProfiles: projectSettings.panelResizerLayoutProfiles ?? candidate?.panelResizerLayoutProfiles,
    worldSpineEventRailWidth: projectSettings.worldSpineEventRailWidth ?? candidate?.worldSpineEventRailWidth,
    worldSpineManuscriptPaneWidth: projectSettings.worldSpineManuscriptPaneWidth ?? candidate?.worldSpineManuscriptPaneWidth,
    worldSpinePanelLayoutProfiles: projectSettings.worldSpinePanelLayoutProfiles ?? candidate?.worldSpinePanelLayoutProfiles,
    worldSpineRightPaneMode: projectSettings.worldSpineRightPaneMode ?? candidate?.worldSpineRightPaneMode,
    worldSpineUnplacedDockCollapsed: projectSettings.worldSpineUnplacedDockCollapsed ?? candidate?.worldSpineUnplacedDockCollapsed,
    worldSpineLocationFilter: projectSettings.worldSpineLocationFilter ?? candidate?.worldSpineLocationFilter,
    consoleDockCollapsed: projectSettings.consoleDockCollapsed ?? candidate?.consoleDockCollapsed,
    sidePanelsHidden: projectSettings.sidePanelsHidden ?? candidate?.sidePanelsHidden,
    sidePanelVisibility: projectSettings.sidePanelVisibility ?? candidate?.sidePanelVisibility,
    topPanelVisibility: projectSettings.topPanelVisibility ?? candidate?.topPanelVisibility,
    customMetadataDefinitions: projectSettings.customMetadataDefinitions ?? candidate?.customMetadataDefinitions,
    collapsedChapterIds: projectSettings.collapsedChapterIds ?? candidate?.collapsedChapterIds,
    collapsedConsoleChapterIds: projectSettings.collapsedConsoleChapterIds ?? candidate?.collapsedConsoleChapterIds,
    projectFilePath: projectSettings.projectFilePath ?? candidate?.projectFilePath,
    projectSourcePath: projectSettings.projectSourcePath ?? candidate?.projectSourcePath,
    writingTargetState: projectSettings.writingTargetState ?? candidate?.writingTargetState,
    writingTargetViewMode: projectSettings.writingTargetViewMode ?? candidate?.writingTargetViewMode,
    writingTargetSelectedDateKey: projectSettings.writingTargetSelectedDateKey ?? candidate?.writingTargetSelectedDateKey,
    writingTargetCalendarMonthKey: projectSettings.writingTargetCalendarMonthKey ?? candidate?.writingTargetCalendarMonthKey,
    spellcheck: projectSettings.spellcheck ?? candidate?.spellcheck,
  };
}

function createProjectSettingsSnapshotFromState({
  currentWordCount = getCurrentManuscriptWordCount(),
  now = new Date(),
} = {}) {
  const projectId = state.workspace?.project?.id ?? state.activeProjectId ?? "";
  // Persist canonical writing-target state only; draft edits stay in UI state until explicitly committed.
  const writingTargetState = state.writingTargetState
    ? cloneValue(state.writingTargetState)
    : createDefaultWritingTargetRecord(currentWordCount, now);
  logWritingTargetMetricCheckpoint("metric.project-settings-snapshot", {
    projectId,
    currentWordCount,
    writingTargetLoaded: state.writingTargetState != null,
    writingTargetHistoryEntries: Array.isArray(writingTargetState?.history) ? writingTargetState.history.length : 0,
    writingTargetDailyBaselineWordCount: writingTargetState?.dailyBaselineWordCount ?? 0,
    writingTargetDailyBaselineDateKey: writingTargetState?.dailyBaselineDateKey ?? "",
  });

  return normalizeProjectSettingsSnapshot(
    {
      editorPrefs: cloneValue(state.editorPrefs),
      localAiPrefs: cloneValue(state.localAiPrefs),
      activePane: normalizeWorkspacePaneId(state.activePane),
      binderPanelWidth: state.binderPanelWidth,
      consoleDockWidth: state.consoleDockWidth,
      userSettingPanelResizerLeftPercent: state.userSettingPanelResizerLeftPercent,
      userSettingPanelResizerRightPercent: state.userSettingPanelResizerRightPercent,
      panelResizerLayoutProfiles: cloneValue(state.panelResizerLayoutProfiles),
      worldSpineEventRailWidth: state.worldSpineEventRailWidth,
      worldSpineManuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
      worldSpinePanelLayoutProfiles: cloneValue(state.worldSpinePanelLayoutProfiles),
      worldSpineRightPaneMode: state.worldSpineRightPaneMode,
      worldSpineUnplacedDockCollapsed: state.worldSpineUnplacedDockCollapsed,
      worldSpineLocationFilter: cloneValue(state.worldSpineLocationFilter),
      consoleDockCollapsed: state.consoleDockCollapsed,
      sidePanelsHidden: state.sidePanelsHidden,
      sidePanelVisibility: cloneValue(state.sidePanelVisibility),
      topPanelVisibility: cloneValue(state.topPanelVisibility),
      customMetadataDefinitions: cloneValue(state.customMetadataDefinitions),
      collapsedChapterIds: cloneValue(state.collapsedChapterIds),
      collapsedConsoleChapterIds: cloneValue(state.collapsedConsoleChapterIds),
      projectFilePath: state.projectFilePath,
      projectSourcePath: state.projectSourcePath,
      writingTargetState,
      writingTargetViewMode: state.writingTargetViewMode,
      writingTargetSelectedDateKey: state.writingTargetSelectedDateKey,
      writingTargetCalendarMonthKey: state.writingTargetCalendarMonthKey,
      spellcheck: cloneValue(state.spellcheckProjectSettings),
    },
    projectId,
    currentWordCount,
    now,
  );
}

function createProjectLibraryRecordFromState(options = {}) {
  return projectRuntimeRecordStateService.createProjectRecordFromRuntimeState(options);
}

function createRevisionPanelStateForProject(revisionState) {
  const normalized = normalizeRevisionProjectState(revisionState);
  return {
    query: "",
    categoryFilter: "all",
    originFilter: "all",
    selectedSessionId: normalized.activeSessionId || normalized.sessions[0]?.metadata?.id || "",
    showFullDiff: false,
    statusMessage: "",
  };
}

function applyProjectRecord(record) {
  projectActivationController.applyProjectRecord(record);
}

function activateProjectRecord(record, options = {}) {
  const beforeRender = options.beforeRender;
  anchorIdleValidationScheduler.clearAll();
  projectActivationController.activateProjectRecord(record, {
    ...options,
    beforeRender: () => {
      if (typeof beforeRender === "function") {
        beforeRender();
      }
      validateAnchoredRecordsForLoadedProject({
        source: options.reason ? `activateProjectRecord.${options.reason}` : "activateProjectRecord",
      });
    },
  });
}

function createBinderSceneMoveHistoryState() {
  return {
    undoStack: [],
    redoStack: [],
  };
}

function cloneBinderSceneGroups(sceneGroups) {
  return Array.isArray(sceneGroups)
    ? sceneGroups.map((group) => ({
        ...group,
        lines: Array.isArray(group?.lines) ? [...group.lines] : [],
      }))
    : [];
}

function captureSceneSelectionDefaultsForSave() {
  const selectedSceneId = typeof state.selectedSceneId === "string" ? state.selectedSceneId.trim() : "";
  const textarea = selectedSceneId ? getEditorTextareaForScene(selectedSceneId) : null;
  const scene = selectedSceneId ? getScene(selectedSceneId) : null;
  const liveSelection = textarea instanceof HTMLTextAreaElement
    ? captureSceneEditorSelectionSnapshotFromTextarea(textarea)
    : null;
  const snapshot =
    state.sceneEditorSelectionSnapshot &&
    state.sceneEditorSelectionSnapshot.sceneId === selectedSceneId
      ? state.sceneEditorSelectionSnapshot
      : null;

  return manuscriptSelectionController.resolveSelectionDefaultsForSave({
    selectedBlockId: state.selectedBlockId ?? "",
    scene,
    liveSelection,
    cachedSelection: snapshot,
    fallbackStartOffset: Number.isInteger(textarea?.selectionStart) ? textarea.selectionStart : 0,
    fallbackEndOffset: Number.isInteger(textarea?.selectionEnd) ? textarea.selectionEnd : textarea?.selectionStart,
  });
}

// Intent: persist the current inline passage composer so a reload can reopen the same note draft.
function captureInlinePassageDraftDefaultsForSave() {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return null;
  }

  return {
    sceneId: typeof draft.sceneId === "string" ? draft.sceneId : "",
    noteType: isSupportedPassageNoteType(draft.noteType) ? draft.noteType : "inspiration",
    metadataDefinitionId: typeof draft.metadataDefinitionId === "string" ? draft.metadataDefinitionId : "",
    metadataLabel: typeof draft.metadataLabel === "string" ? draft.metadataLabel : "",
    metadataHighlightColor: typeof draft.metadataHighlightColor === "string" ? draft.metadataHighlightColor : "",
    selectedText: String(draft.selectedText ?? ""),
    startOffset: Number.isInteger(draft.startOffset) ? draft.startOffset : null,
    endOffset: Number.isInteger(draft.endOffset) ? draft.endOffset : null,
    anchorStartOffset: Number.isInteger(draft.anchorStartOffset) ? draft.anchorStartOffset : null,
    seededSelection: Boolean(draft.seededSelection),
    typedStartOffset: Number.isInteger(draft.typedStartOffset) ? draft.typedStartOffset : null,
    typedEndOffset: Number.isInteger(draft.typedEndOffset) ? draft.typedEndOffset : null,
    body: String(draft.body ?? ""),
    typedText: String(draft.typedText ?? ""),
    editingNoteId: typeof draft.editingNoteId === "string" ? draft.editingNoteId : "",
    x: Number.isFinite(draft.x) ? draft.x : 110,
    y: Number.isFinite(draft.y) ? draft.y : 40,
  };
}

function normalizeSceneSelectionDefaults(candidate, scene) {
  return manuscriptSelectionController.normalizeSavedSceneSelection(candidate, scene);
}

// Intent: restore the inline passage composer only when the project explicitly saved one.
function normalizeInlinePassageDraftDefaults(candidate, scene) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const noteType = isSupportedPassageNoteType(candidate.noteType) ? candidate.noteType : "";
  const sceneId = typeof candidate.sceneId === "string" && candidate.sceneId.trim()
    ? candidate.sceneId.trim()
    : scene?.sceneId ?? "";
  if (!noteType || !sceneId) {
    return null;
  }

  const sceneLength = scene?.editorText?.length ?? 0;
  const startOffset = Number.isInteger(candidate.startOffset)
    ? clampEditorOffset(candidate.startOffset, sceneLength)
    : 0;
  const endOffset = Number.isInteger(candidate.endOffset)
    ? clampEditorOffset(candidate.endOffset, sceneLength)
    : startOffset;
  const anchorStartOffset = Number.isInteger(candidate.anchorStartOffset)
    ? clampEditorOffset(candidate.anchorStartOffset, sceneLength)
    : startOffset;

  return {
    sceneId,
    noteType,
    metadataDefinitionId: typeof candidate.metadataDefinitionId === "string" ? candidate.metadataDefinitionId : "",
    metadataLabel: typeof candidate.metadataLabel === "string" ? candidate.metadataLabel : "",
    metadataHighlightColor: typeof candidate.metadataHighlightColor === "string" ? candidate.metadataHighlightColor : "",
    selectedText: String(candidate.selectedText ?? ""),
    startOffset,
    endOffset,
    anchorStartOffset,
    seededSelection: Boolean(candidate.seededSelection),
    typedStartOffset: Number.isInteger(candidate.typedStartOffset)
      ? clampEditorOffset(candidate.typedStartOffset, sceneLength)
      : null,
    typedEndOffset: Number.isInteger(candidate.typedEndOffset)
      ? clampEditorOffset(candidate.typedEndOffset, sceneLength)
      : null,
    body: String(candidate.body ?? ""),
    typedText: String(candidate.typedText ?? ""),
    editingNoteId: typeof candidate.editingNoteId === "string" ? candidate.editingNoteId : "",
    x: Number.isFinite(candidate.x) ? candidate.x : 110,
    y: Number.isFinite(candidate.y) ? candidate.y : 40,
  };
}

function restoreSceneSelectionRange(selection) {
  const sceneId = typeof state.selectedSceneId === "string" ? state.selectedSceneId.trim() : "";
  if (!sceneId) {
    return;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!editorHost) {
    return;
  }

  const lineNumber = Number.isInteger(selection?.lineNumber)
    ? Math.max(1, selection.lineNumber)
    : null;
  const startOffset = Number.isInteger(selection?.startOffset)
    ? clampEditorOffset(selection.startOffset, textarea.value.length)
    : null;
  const endOffset = Number.isInteger(selection?.endOffset)
    ? clampEditorOffset(selection.endOffset, textarea.value.length)
    : startOffset;
  const blockId = typeof selection?.blockId === "string" && selection.blockId.trim()
    ? selection.blockId
    : "";

  if (lineNumber) {
    const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
    const sceneMetrics = buildSceneLineMetrics(
      state.scenes,
      charactersPerLine,
      { [scene.sceneId]: textarea.value },
    ).find((candidate) => candidate.sceneId === scene.sceneId);
    const relativeLineNumber = Math.max(0, lineNumber - (sceneMetrics?.startLineNumber ?? lineNumber));
    const lineEndOffset = findTextareaOffsetForVisualLineEnd(
      textarea.value,
      relativeLineNumber,
      charactersPerLine,
    );
    const lineBlock = scene.blocks.find((candidate) => candidate.lineNumber === lineNumber) ?? null;
    const resolvedBlock =
      lineBlock
      ?? findSceneBlockAtOffset(scene, lineEndOffset)
      ?? scene.blocks.find((candidate) => candidate.blockId === blockId)
      ?? scene.blocks[0]
      ?? null;
    if (resolvedBlock) {
      state.selectedBlockId = resolvedBlock.blockId;
    }

    selectTextareaEditorHostRange(editorHost, lineEndOffset, lineEndOffset, {
      behavior: "auto",
      focus: true,
      scroll: true,
    });
    return;
  }

  if (startOffset === null || endOffset === null) {
    const targetBlock =
      blockId
        ? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? null
        : Number.isInteger(selection?.lineNumber)
          ? scene.blocks.find((candidate) => candidate.lineNumber === selection.lineNumber) ?? null
          : null;
    if (targetBlock) {
      const blockRange = getSceneBlockRanges(scene).find((candidate) => candidate.blockId === targetBlock.blockId) ?? null;
      const targetOffset = blockRange?.endOffset ?? targetBlock.text.length;
      state.selectedBlockId = targetBlock.blockId;
      selectTextareaEditorHostRange(editorHost, targetOffset, targetOffset, {
        behavior: "auto",
        focus: true,
        scroll: true,
      });
      return;
    }

    const block = blockId
      ? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? null
      : scene.blocks[0] ?? null;
    if (block) {
      state.selectedBlockId = block.blockId;
      return;
    }
    return;
  }

  const block = findSceneBlockAtOffset(scene, startOffset) ?? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? scene.blocks[0] ?? null;
  if (block) {
    state.selectedBlockId = block.blockId;
  }

  selectTextareaEditorHostRange(editorHost, startOffset, endOffset, {
    behavior: "auto",
    focus: true,
    scroll: true,
  });
}

// Intent: cache the current scene editor caret and viewport so autosave can persist it reliably.
function captureSceneEditorSelectionSnapshotFromTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const hostSelection = readTextareaEditorHostSelection(resolveTextareaEditorHost(textarea));
  const sceneId = typeof hostSelection?.sceneId === "string" ? hostSelection.sceneId.trim() : "";
  if (!sceneId) {
    return null;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const startOffset = hostSelection.startOffset;
  const endOffset = hostSelection.endOffset;
  const lineNumber = getSceneEditorSelectionLineNumber(textarea, scene, startOffset);

  return manuscriptSelectionController.createSelectionSnapshot({
    scene,
    sceneId,
    text: hostSelection.text,
    lineNumber,
    startOffset,
    endOffset,
    scrollTop: hostSelection.scrollTop,
    scrollLeft: hostSelection.scrollLeft,
  });
}

function updateSceneEditorSelectionSnapshotFromTextarea(textarea) {
  const snapshot = captureSceneEditorSelectionSnapshotFromTextarea(textarea);
  if (!snapshot) {
    return;
  }

  state.sceneEditorSelectionSnapshot = snapshot;
}

// Intent: keep author editing context current without rerendering the manuscript editor on focus or typing.
function markSceneEditorAsCurrent(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement) || !textarea.classList.contains("editor-document-input")) {
    return false;
  }

  const sceneId = typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId.trim() : "";
  const scene = sceneId ? getScene(sceneId) : null;
  if (!scene) {
    return false;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const block = findSceneBlockAtOffset(scene, selectionStart) ?? scene.blocks[0] ?? null;
  state.activeEditorSceneId = scene.sceneId;
  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId = block?.blockId ?? state.selectedBlockId;
  updateSceneEditorSelectionSnapshotFromTextarea(textarea);
  return true;
}

// Intent: convert the current caret position into a stable manuscript line number for save/restore.
function getSceneEditorSelectionLineNumber(textarea, scene, offset = null) {
  if (!(textarea instanceof HTMLTextAreaElement) || !scene) {
    return null;
  }

  const editorHost = resolveTextareaEditorHost(textarea);
  const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
  const selectedSceneMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    { [scene.sceneId]: textarea.value },
  ).find((candidate) => candidate.sceneId === scene.sceneId);
  const caretOffset = Number.isInteger(offset) ? offset : Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const visualLineOffset = resolveTextareaVisualLineIndexForOffset(editorHost, caretOffset);
  return (selectedSceneMetrics?.startLineNumber ?? 1) + visualLineOffset;
}

function restoreSelectionFromWorkspaceDefaults() {
  const selectionDefaults = state.workspace?.selectionDefaults ?? {};
  state.selectedIssueId = selectionDefaults.issueId ?? null;
  setWorldSpineSelectedNodeId(selectionDefaults.nodeId ?? null);
  state.selectedEntityId = selectionDefaults.entityId ?? null;

  const preferredDraft = normalizeInlinePassageDraftDefaults(
    selectionDefaults.inlinePassageDraft,
    null,
  );
  const preferredSceneId = typeof selectionDefaults.sceneId === "string" ? selectionDefaults.sceneId.trim() : "";
  const sceneIdForRestore = preferredDraft?.sceneId || preferredSceneId;
  if (sceneIdForRestore) {
    const preferredScene = getScene(sceneIdForRestore);
    if (preferredScene) {
      const sceneSelection = normalizeSceneSelectionDefaults(selectionDefaults, preferredScene);
      const inlinePassageDraft = normalizeInlinePassageDraftDefaults(selectionDefaults.inlinePassageDraft, preferredScene);
      selectSceneById(preferredScene.sceneId);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (inlinePassageDraft) {
            restoreInlinePassageDraftFromWorkspaceDefaults(inlinePassageDraft);
          }
          window.requestAnimationFrame(() => {
            restoreSceneSelectionRange(sceneSelection);
            state.sceneEditorSelectionSnapshot = {
              sceneId: preferredScene.sceneId,
              blockId: sceneSelection.blockId ?? "",
              lineNumber: sceneSelection.lineNumber ?? null,
              startOffset: sceneSelection.startOffset ?? null,
              endOffset: sceneSelection.endOffset ?? null,
              scrollTop: sceneSelection.scrollTop ?? null,
              scrollLeft: sceneSelection.scrollLeft ?? null,
            };
          });
        });
      });
      return;
    }
  }

  syncSelectionFromBlock(selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null);
}

// Intent: reopen a saved inline passage composer after scene selection has been restored.
function restoreInlinePassageDraftFromWorkspaceDefaults(draft) {
  if (!draft || draft.sceneId !== state.selectedSceneId) {
    return;
  }

  state.sidePanelMode = draft.noteType;
  state.inlinePassageDraft = draft;
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const noteField = document.querySelector("[data-edit-field='inline-passage-note']");
    if (noteField instanceof HTMLTextAreaElement) {
      noteField.focus({ preventScroll: true });
      noteField.setSelectionRange(noteField.value.length, noteField.value.length);
    }
  });
}

// Intent: mirror canonical project-library state into older browser keys during migration only.
function syncLegacyProjectStorageFromState() {
  if (!state.workspace) {
    return;
  }

  // Intent: stop legacy mirror batches after quota fails so one load cannot generate a storage log storm.
  const legacySnapshots = [
    [EDITOR_PROJECT_TITLE_KEY, state.projectTitle],
    [EDITOR_PROJECT_SOURCE_PATH_KEY, state.projectSourcePath],
    [EDITOR_DRAFTS_KEY, state.sceneDrafts],
    [EDITOR_STRUCTURE_KEY, state.structureDrafts],
    [EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts],
    [EDITOR_TASKS_KEY, state.manuscriptTasks],
    [EDITOR_PASSAGE_NOTES_KEY, state.passageNotes],
    [EDITOR_PREFS_KEY, state.editorPrefs],
    [EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs],
    [EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY, state.panelResizerLayoutProfiles],
    [EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY, state.worldSpineEventRailWidth],
    [EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY, state.worldSpineManuscriptPaneWidth],
    [EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY, state.worldSpinePanelLayoutProfiles],
    [EDITOR_SIDE_PANELS_HIDDEN_KEY, normalizeSidePanelsHiddenState(state.sidePanelsHidden)],
    [EDITOR_SIDE_PANEL_VISIBILITY_KEY, createSidePanelVisibilityState(state.sidePanelVisibility, getMetadataSidePanelIds())],
    [EDITOR_TOP_PANEL_VISIBILITY_KEY, createTopPanelVisibilityState(state.topPanelVisibility)],
  ];

  for (const [storageKey, snapshot] of legacySnapshots) {
    if (writeStoredJsonRaw(storageKey, snapshot) !== true) {
      break;
    }
  }
}

function setRevisionState(revisionState, context = {}) {
  state.revisionState = normalizeRevisionProjectState(revisionState);
  if (context.persist !== true) {
    return state.revisionState;
  }

  persistCurrentProjectRecord({
    domain: "revisions",
    dirtyReason: context.dirtyReason ?? "revision-history-updated",
    source: context.source ?? "RevisionService.setRevisionState",
    skipProjectFileAutosave: context.skipProjectFileAutosave === true,
    markWorkingState: context.markWorkingState,
  });
  return state.revisionState;
}

function clearProjectFileAutosaveTimer() {
  projectPersistenceService.clearProjectAutosaveTimer();
}

function beginProjectFileAutosaveSuppression() {
  projectPersistenceService.beginProjectAutosaveSuppression();
}

function endProjectFileAutosaveSuppression() {
  projectPersistenceService.endProjectAutosaveSuppression();
}

function queueProjectFileAutosave() {
  projectPersistenceService.queueProjectAutosave();
}

function markProjectFileAutosaveDirty() {
  projectPersistenceService.markProjectAutosaveDirty();
}

// Intent: sync the autosave destination after project switches without marking a clean project dirty.
function primeProjectFileAutosave() {
  projectPersistenceService.primeProjectAutosaveTarget();
}

function clearProjectFileAutosaveState() {
  projectPersistenceService.clearProjectAutosaveState();
}

function shouldPersistProjectCache() {
  return state.projectCacheSuppressionDepth === 0;
}

// Intent: keep in-browser project records synchronized with the active app-native project snapshot.
function persistCurrentProjectRecord(options = {}) {
  projectPersistenceService.commitCanonicalProjectMutation(options);
}

// Intent: persist task diagnostics through the canonical project-file boundary instead of legacy task cache writes.
function persistManuscriptTasksState(options = {}) {
  persistCurrentProjectRecord({
    domain: "manuscript-tasks",
    dirtyReason: options.dirtyReason ?? "manuscript-task-updated",
    source: options.source ?? "persistManuscriptTasksState",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    markWorkingState: options.markWorkingState,
  });
}

// Intent: persist inspiration and research notes through the same project-file boundary as manuscript tasks.
function persistPassageNotesState(options = {}) {
  persistCurrentProjectRecord({
    domain: "passage-notes",
    dirtyReason: options.dirtyReason ?? "passage-note-updated",
    source: options.source ?? "persistPassageNotesState",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    markWorkingState: options.markWorkingState,
  });
}

// Intent: persist proof-read coverage as project workflow state rather than editor-only decoration.
function persistDraftProofingState(options = {}) {
  persistCurrentProjectRecord({
    domain: "draft-proofing",
    dirtyReason: options.dirtyReason ?? "draft-proofing-updated",
    source: options.source ?? "persistDraftProofingState",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    markWorkingState: options.markWorkingState,
  });
}

function getActiveDraftProofRunRecord() {
  const draftProofing = normalizeDraftProofingState(state.draftProofing);
  return draftProofing.activeRunId
    ? draftProofing.runs.find((run) => run.id === draftProofing.activeRunId && run.status === "active") ?? null
    : null;
}

function getLatestPausedDraftProofRunRecord() {
  const draftProofing = normalizeDraftProofingState(state.draftProofing);
  return [...draftProofing.runs].reverse().find((run) => run.status === "paused") ?? null;
}

function getLatestCompletedDraftProofRunRecord() {
  const draftProofing = normalizeDraftProofingState(state.draftProofing);
  return [...draftProofing.runs].reverse().find((run) => run.status === "completed") ?? null;
}

function getCurrentDraftProofRunRecord() {
  return getActiveDraftProofRunRecord() ?? getLatestPausedDraftProofRunRecord();
}

// Intent: keep the Proof Read settings controls pointed at one durable iteration at a time.
function resolveSelectedDraftProofSettingsRunId() {
  const selectedRunId = resolveDraftProofSettingsRunId(
    state.draftProofing,
    state.draftProofSettingsSelectedRunId,
  );
  state.draftProofSettingsSelectedRunId = selectedRunId;
  return selectedRunId;
}

function getSelectedDraftProofSettings() {
  return getDraftProofSettingsForRun(state.draftProofing, resolveSelectedDraftProofSettingsRunId());
}

function selectDraftProofSettingsRun(runId) {
  state.draftProofClearConfirmationArmed = false;
  state.draftProofSettingsSelectedRunId = resolveDraftProofSettingsRunId(state.draftProofing, runId);
  renderDraftProofSettingsWindow();
  syncDraftProofLayerForActiveEditor();
  editorInteractionLog.info("user-action", "draft-proof.settings.iteration", "Selected proof-read settings iteration.", {
    projectId: state.activeProjectId ?? "",
    runId: state.draftProofSettingsSelectedRunId,
  });
}

function applyDraftProofingResult(result, {
  dirtyReason = "draft-proofing-updated",
  source = "draftProofing",
  persist = true,
  renderPanel = false,
  syncLayer = true,
} = {}) {
  if (!result?.changed) {
    return false;
  }

  state.draftProofing = normalizeDraftProofingState(result.state);
  if (persist) {
    persistDraftProofingState({
      dirtyReason,
      source,
    });
  }
  if (renderPanel) {
    renderHeader();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  } else if (syncLayer) {
    syncDraftProofLayerForActiveEditor();
  }
  if (state.draftProofSettingsWindowOpen) {
    renderDraftProofSettingsWindow();
  }
  return true;
}

// Intent: start a new proof-read iteration only from the explicit new-run control.
function startDraftProofRun() {
  const now = new Date().toISOString();
  const result = startNewDraftProofRun(state.draftProofing, { now });
  if (result.changed && result.reason === "created-run") {
    state.draftProofMarksVisible = true;
  }
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-run-started",
    source: "startDraftProofRun",
    renderPanel: true,
  });
  if (result.run?.id) {
    state.draftProofSettingsSelectedRunId = result.run.id;
    if (state.draftProofSettingsWindowOpen) {
      renderDraftProofSettingsWindow();
    }
  }
  editorInteractionLog.info("user-action", "draft-proof.start", "Started a new draft proof-read run.", {
    changed,
    reason: result.reason,
    runId: result.run?.id ?? "",
  });
}

function toggleDraftProofRun() {
  const activeRun = getActiveDraftProofRunRecord();
  const pausedRun = activeRun ? null : getLatestPausedDraftProofRunRecord();
  const completedRun = activeRun || pausedRun ? null : getLatestCompletedDraftProofRunRecord();
  if (!activeRun && !pausedRun && !completedRun) {
    editorInteractionLog.info("user-action", "draft-proof.toggle", "No draft proof-read run to resume or continue.", {
      changed: false,
      reason: "missing-continuable-run",
      runId: "",
      active: false,
    });
    return;
  }

  const now = new Date().toISOString();
  const resumePoint = activeRun
    ? captureDraftProofResumePoint(activeRun, now)
    : null;
  if (!activeRun) {
    state.draftProofMarksVisible = true;
  }
  const result = activeRun
    ? pauseDraftProofRun(state.draftProofing, { runId: activeRun.id, now, resumePoint })
    : pausedRun
      ? startOrResumeDraftProofRun(state.draftProofing, { now })
      : continueDraftProofRun(state.draftProofing, { runId: completedRun.id, now });
  const changed = applyDraftProofingResult(result, {
    dirtyReason: activeRun
      ? "draft-proof-run-paused"
      : pausedRun
        ? "draft-proof-run-resumed"
        : "draft-proof-run-continued",
    source: "toggleDraftProofRun",
    renderPanel: true,
  });
  editorInteractionLog.info("user-action", "draft-proof.toggle", "Toggled draft proof-read run.", {
    changed,
    reason: result.reason,
    runId: result.run?.id ?? "",
    active: !activeRun,
  });
  if (!activeRun && changed) {
    navigateToDraftProofResumePoint(result.run, {
      source: pausedRun ? "draft-proof-resumed" : "draft-proof-continued",
    });
  }
}

// Intent: make proof-read coverage recallable without changing the durable proof-read run record.
function toggleDraftProofMarkerVisibility() {
  state.draftProofMarksVisible = state.draftProofMarksVisible !== true;
  renderHeader();
  syncDraftProofLayerForActiveEditor();
  editorInteractionLog.info("user-action", "draft-proof.markers", "Toggled proof-read marker visibility.", {
    visible: state.draftProofMarksVisible,
  });
}

// Intent: hide or restore the ManuScriptInfographicLane without mutating its anchor-backed records.
function toggleManuScriptInfographicLaneVisibility() {
  const visible = state.editorPrefs?.manuScriptInfographicLaneVisible !== false;
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    manuScriptInfographicLaneVisible: !visible,
  });
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  editorInteractionLog.info("user-action", "manuscript.ManuScriptInfographicLane.visibility", "Toggled ManuScriptInfographicLane visibility.", {
    visible: state.editorPrefs.manuScriptInfographicLaneVisible,
  });
}

// Intent: colour picking is a visual preview workflow, so expose existing proof-read marks while the author edits swatches.
function showDraftProofMarksForSettingsPreview() {
  if (state.draftProofMarksVisible === true) {
    return false;
  }

  state.draftProofMarksVisible = true;
  editorInteractionLog.info("user-action", "draft-proof.markers.preview", "Showed proof-read markers for colour preview.", {
    visible: true,
  });
  return true;
}

function updateDraftProofBackdropColor(value, options = {}) {
  state.draftProofClearConfirmationArmed = false;
  const previewVisibilityChanged = showDraftProofMarksForSettingsPreview();
  const selection = getSelectedDraftProofSettings();
  const recentBackdropColors = options.rememberRecent === true
    ? addRecentDraftProofBackdropColor(selection.settings.recentBackdropColors, value)
    : selection.settings.recentBackdropColors;
  const settingsPatch = {
    backdropColor: value,
    recentBackdropColors,
  };
  const result = selection.runId
    ? updateDraftProofRunSettings(state.draftProofing, {
        runId: selection.runId,
        settingsPatch,
      })
    : updateDraftProofSettings(state.draftProofing, settingsPatch);
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-settings-updated",
    source: "updateDraftProofBackdropColor",
    renderPanel: true,
  });
  if (!changed && previewVisibilityChanged) {
    renderHeader();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  }
  renderDraftProofSettingsWindow();
  editorInteractionLog.info("user-action", "draft-proof.settings.color", "Updated proof-read backdrop colour.", {
    changed,
    runId: selection.runId,
    color: result.settings?.backdropColor ?? "",
  });
}

// Intent: persist proof-read highlight strength per theme while leaving coverage spans unchanged.
function updateDraftProofHighlightIntensity(theme, value) {
  const normalizedTheme = String(theme ?? "").trim();
  if (normalizedTheme !== "light" && normalizedTheme !== "dark") {
    return;
  }

  state.draftProofClearConfirmationArmed = false;
  const previewVisibilityChanged = showDraftProofMarksForSettingsPreview();
  const selection = getSelectedDraftProofSettings();
  const settingsPatch = {
    highlightIntensityByTheme: {
      ...selection.settings.highlightIntensityByTheme,
      [normalizedTheme]: value,
    },
  };
  const result = selection.runId
    ? updateDraftProofRunSettings(state.draftProofing, {
        runId: selection.runId,
        settingsPatch,
      })
    : updateDraftProofSettings(state.draftProofing, settingsPatch);
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-highlight-intensity-updated",
    source: "updateDraftProofHighlightIntensity",
    renderPanel: true,
  });
  if (!changed && previewVisibilityChanged) {
    renderHeader();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  }
  renderDraftProofSettingsWindow();
  editorInteractionLog.info("user-action", "draft-proof.settings.intensity", "Updated proof-read highlight intensity.", {
    changed,
    runId: selection.runId,
    theme: normalizedTheme,
    value: result.settings?.highlightIntensityByTheme?.[normalizedTheme] ?? "",
  });
}

// Intent: let the project settings palette apply a saved neutral proof-read backdrop without exposing run data.
function setDraftProofBackdropPreset(index) {
  const presetIndex = Number.parseInt(String(index ?? ""), 10);
  const presets = getSelectedDraftProofSettings().settings.backdropColorPresets;
  if (!Number.isInteger(presetIndex) || presetIndex < 0 || presetIndex >= presets.length) {
    return;
  }

  updateDraftProofBackdropColor(presets[presetIndex]);
}

// Intent: reuse a stored proof-read backdrop colour without creating another recent swatch for the same colour.
function setDraftProofRecentBackdropColor(index) {
  const recentIndex = Number.parseInt(String(index ?? ""), 10);
  const recentBackdropColors = getSelectedDraftProofSettings().settings.recentBackdropColors;
  if (!Number.isInteger(recentIndex) || recentIndex < 0 || recentIndex >= recentBackdropColors.length) {
    return;
  }

  updateDraftProofBackdropColor(recentBackdropColors[recentIndex], {
    rememberRecent: true,
  });
}

// Intent: persist user-edited preset slots as visual proof-read settings and apply the edited colour immediately.
function updateDraftProofBackdropPreset(index, value, options = {}) {
  const presetIndex = Number.parseInt(String(index ?? ""), 10);
  const selection = getSelectedDraftProofSettings();
  const presets = selection.settings.backdropColorPresets;
  if (!Number.isInteger(presetIndex) || presetIndex < 0 || presetIndex >= presets.length) {
    return;
  }

  const nextPresets = presets.map((color, currentIndex) =>
    currentIndex === presetIndex ? value : color
  );
  state.draftProofClearConfirmationArmed = false;
  const previewVisibilityChanged = showDraftProofMarksForSettingsPreview();
  const settingsPatch = {
    backdropColor: value,
    backdropColorPresets: nextPresets,
    recentBackdropColors: options.rememberRecent === true
      ? addRecentDraftProofBackdropColor(selection.settings.recentBackdropColors, value)
      : selection.settings.recentBackdropColors,
  };
  const result = selection.runId
    ? updateDraftProofRunSettings(state.draftProofing, {
        runId: selection.runId,
        settingsPatch,
      })
    : updateDraftProofSettings(state.draftProofing, settingsPatch);
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-preset-updated",
    source: "updateDraftProofBackdropPreset",
    renderPanel: true,
  });
  if (!changed && previewVisibilityChanged) {
    renderHeader();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  }
  renderDraftProofSettingsWindow();
  editorInteractionLog.info("user-action", "draft-proof.settings.preset", "Updated proof-read backdrop preset.", {
    changed,
    runId: selection.runId,
    presetIndex,
    color: result.settings?.backdropColor ?? "",
  });
}

function requestClearDraftProofData() {
  state.draftProofClearConfirmationArmed = true;
  renderDraftProofSettingsWindow();
}

function cancelClearDraftProofData() {
  state.draftProofClearConfirmationArmed = false;
  renderDraftProofSettingsWindow();
}

// Intent: delete only the proof-read iterations explicitly checked in the settings window.
function deleteSelectedDraftProofRuns(target) {
  state.draftProofClearConfirmationArmed = false;
  const runIds = collectCheckedDraftProofRunIds(target);
  const result = deleteDraftProofRuns(state.draftProofing, { runIds });
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-runs-deleted",
    source: "deleteSelectedDraftProofRuns",
    renderPanel: true,
  });
  state.draftProofSettingsSelectedRunId = resolveDraftProofSettingsRunId(
    state.draftProofing,
    state.draftProofSettingsSelectedRunId,
  );
  renderDraftProofSettingsWindow();
  editorInteractionLog.info("user-action", "draft-proof.settings.delete-selected", "Deleted selected proof-read iterations.", {
    changed,
    reason: result.reason,
    requestedRunCount: runIds.length,
    deletedRunCount: result.deletedRunCount ?? 0,
    deletedRunIds: result.deletedRunIds ?? [],
  });
}

// Intent: keep checked-run collection scoped to the open proof-read settings surface.
function collectCheckedDraftProofRunIds(target) {
  const settingsWindow = target instanceof HTMLElement
    ? target.closest(".draft-proof-settings-window")
    : null;
  if (!(settingsWindow instanceof HTMLElement)) {
    return [];
  }

  return [...settingsWindow.querySelectorAll("[data-draft-proof-delete-run-id]:checked")]
    .map((input) => input instanceof HTMLInputElement ? String(input.dataset.draftProofDeleteRunId ?? "").trim() : "")
    .filter(Boolean);
}

function clearAllDraftProofData() {
  state.draftProofClearConfirmationArmed = false;
  state.draftProofSettingsSelectedRunId = "";
  const result = clearDraftProofRunData(state.draftProofing);
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-data-cleared",
    source: "clearAllDraftProofData",
    renderPanel: true,
  });
  renderDraftProofSettingsWindow();
  editorInteractionLog.info("user-action", "draft-proof.settings.clear", "Cleared proof-read version data.", {
    changed,
    reason: result.reason,
    clearedRunCount: result.clearedRunCount ?? 0,
  });
}

function finishDraftProofRun() {
  const currentRun = getCurrentDraftProofRunRecord();
  const now = new Date().toISOString();
  const resumePoint = currentRun?.status === "active"
    ? captureDraftProofResumePoint(currentRun, now)
    : currentRun?.resumePoint ?? resolveLatestDraftProofRunCoveragePoint(currentRun);
  const result = completeDraftProofRun(state.draftProofing, {
    runId: currentRun?.id ?? "",
    now,
    resumePoint,
  });
  const changed = applyDraftProofingResult(result, {
    dirtyReason: "draft-proof-run-completed",
    source: "finishDraftProofRun",
    renderPanel: true,
  });
  editorInteractionLog.info("user-action", "draft-proof.complete", "Completed draft proof-read run.", {
    changed,
    reason: result.reason,
    runId: result.run?.id ?? "",
  });
}

// Intent: persist enough proof-read location context to resume a manual proofing pass deliberately.
function captureDraftProofResumePoint(run = null, now = new Date().toISOString()) {
  const activeElement = document.activeElement;
  const textarea = activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
    ? activeElement
    : getEditorTextareaForScene(state.selectedSceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    const sceneId = String(textarea.dataset.sceneId ?? "").trim();
    const textLength = String(textarea.value ?? "").length;
    const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textLength;
    const selectionEnd = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
    if (sceneId) {
      return {
        sceneId,
        startOffset: Math.max(0, Math.min(selectionStart, selectionEnd, textLength)),
        endOffset: Math.max(0, Math.min(Math.max(selectionStart, selectionEnd), textLength)),
        updatedAt: now,
      };
    }
  }

  return resolveLatestDraftProofRunCoveragePoint(run);
}

function resolveLatestDraftProofRunCoveragePoint(run = null) {
  const coverageByScene = run?.coverageByScene && typeof run.coverageByScene === "object" && !Array.isArray(run.coverageByScene)
    ? run.coverageByScene
    : {};
  let latestPoint = null;
  for (const [sceneId, spans] of Object.entries(coverageByScene)) {
    for (const span of Array.isArray(spans) ? spans : []) {
      const endOffset = Number(span?.endOffset);
      if (!sceneId || !Number.isFinite(endOffset)) {
        continue;
      }

      const touchedAt = typeof span?.touchedAt === "string" ? span.touchedAt : "";
      const touchedAtMs = Date.parse(touchedAt);
      const latestMs = Date.parse(latestPoint?.updatedAt ?? "");
      if (
        !latestPoint ||
        (Number.isFinite(touchedAtMs) && (!Number.isFinite(latestMs) || touchedAtMs >= latestMs))
      ) {
        latestPoint = {
          sceneId,
          startOffset: Math.max(0, Math.floor(endOffset)),
          endOffset: Math.max(0, Math.floor(endOffset)),
          updatedAt: touchedAt,
        };
      }
    }
  }
  return latestPoint;
}

function navigateToDraftProofResumePoint(run = null, {
  source = "draft-proof-resume",
} = {}) {
  const resumePoint = run?.resumePoint ?? resolveLatestDraftProofRunCoveragePoint(run);
  const sceneId = typeof resumePoint?.sceneId === "string" ? resumePoint.sceneId.trim() : "";
  const endOffset = Number(resumePoint?.endOffset);
  if (!sceneId || !Number.isFinite(endOffset)) {
    return false;
  }

  window.requestAnimationFrame(() => {
    takeToSceneRange(sceneId, Math.max(0, Math.floor(endOffset)), Math.max(0, Math.floor(endOffset)), {
      behavior: "smooth",
    });
    editorInteractionLog.info("user-action", "draft-proof.resume-point", "Navigated to proof-read resume point.", {
      source,
      runId: run?.id ?? "",
      sceneId,
      endOffset: Math.max(0, Math.floor(endOffset)),
    });
  });
  return true;
}

function recordDraftProofCoverageFromTextarea(textarea, {
  mode = "add",
  source = "textarea",
  persist = true,
} = {}) {
  const activeRun = getActiveDraftProofRunRecord();
  if (!activeRun || !(textarea instanceof HTMLTextAreaElement) || !textarea.classList.contains("editor-document-input")) {
    draftProofingLog.debug("user-action", "draft-proof.coverage.selection-skip", "Skipped proof-read coverage recording because the textarea or active run was unavailable.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      hasActiveRun: Boolean(activeRun),
      hasTextarea: textarea instanceof HTMLTextAreaElement,
      isEditorTextarea: textarea instanceof HTMLTextAreaElement && textarea.classList.contains("editor-document-input"),
      mode,
      source,
    });
    return false;
  }

  const editorHost = resolveTextareaEditorHost(textarea);
  if (!editorHost) {
    draftProofingLog.warn(
      "user-action",
      "draft-proof.coverage.host-missing",
      "Could not resolve the editor host for proof-read coverage recording.",
      createDraftProofTextareaLogContext(textarea, {
        runId: activeRun.id,
        mode,
        source,
      }),
    );
    return false;
  }

  const text = String(textarea.value ?? "");
  if (!text.length) {
    draftProofingLog.debug(
      "user-action",
      "draft-proof.coverage.empty-text",
      "Skipped proof-read coverage recording because the scene text is empty.",
      createDraftProofTextareaLogContext(textarea, {
        runId: activeRun.id,
        mode,
        source,
      }),
    );
    return false;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const selectionEnd = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
  const startOffset = Math.min(selectionStart, selectionEnd);
  const endOffset = Math.max(selectionStart, selectionEnd);
  if (endOffset <= startOffset) {
    draftProofingLog.info(
      "user-action",
      "draft-proof.coverage.collapsed-selection",
      "Skipped proof-read coverage recording because the selection was collapsed.",
      createDraftProofTextareaLogContext(textarea, {
        runId: activeRun.id,
        mode,
        source,
        startOffset,
        endOffset,
      }),
    );
    return false;
  }

  const selectionContext = createDraftProofTextareaLogContext(textarea, {
    runId: activeRun.id,
    mode: mode === "remove" ? "remove" : "add",
    source,
    startOffset,
    endOffset,
    selectedCharacterCount: endOffset - startOffset,
    persist,
  });
  draftProofingLog.info(
    "user-action",
    "draft-proof.coverage.selection-captured",
    "Captured selected manuscript text for proof-read coverage.",
    selectionContext,
  );
  const changed = recordDraftProofCoverageRange({
    operation: mode === "remove" ? "remove" : "add",
    sceneId: editorHost.sceneId,
    startOffset,
    endOffset,
    textLength: text.length,
    dirtyReason: mode === "remove"
      ? "draft-proof-coverage-selection-removed"
      : "draft-proof-coverage-selection-added",
    source: `draftProof.${source}`,
    persist,
  });
  draftProofingLog.info(
    "state-change",
    mode === "remove" ? "draft-proof.coverage.selection-removed" : "draft-proof.coverage.selection-added",
    mode === "remove" ? "Applied proof-read coverage removal." : "Applied proof-read coverage addition.",
    {
      ...selectionContext,
      changed,
    },
  );
  editorInteractionLog.info("user-action", mode === "remove" ? "draft-proof.selection-remove" : "draft-proof.selection-add", mode === "remove" ? "Removed proof-read coverage from selected manuscript text." : "Recorded proof-read coverage from selected manuscript text.", {
    changed,
    sceneId: editorHost.sceneId,
    startOffset,
    endOffset,
  });
  releaseDraftProofSelectionAfterCoverage(textarea, endOffset);
  return changed;
}

// Intent: prevent the previous proof-read selection from becoming Chrome's next drag source.
function releaseDraftProofSelectionAfterCoverage(textarea, endOffset) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const caretOffset = Math.max(0, Math.min(Math.floor(Number(endOffset) || 0), textarea.value.length));
  try {
    textarea.setSelectionRange(caretOffset, caretOffset, "none");
  } catch {
    textarea.setSelectionRange(caretOffset, caretOffset);
  }
  updateSceneEditorSelectionSnapshotFromTextarea(textarea);
  syncSceneEditorWordCountReadouts(textarea);
  updateInlineFormatToolbarState(textarea);
  return true;
}

function recordDraftProofCoverageRange({
  operation = "add",
  sceneId = "",
  startOffset = 0,
  endOffset = 0,
  textLength = 0,
  dirtyReason = "draft-proof-coverage-updated",
  source = "recordDraftProofCoverageRange",
  persist = true,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const activeRunBefore = getActiveDraftProofRunRecord();
  const beforeSpans = activeRunBefore?.coverageByScene?.[normalizedSceneId] ?? [];
  const coverageMutation = operation === "remove"
    ? removeDraftProofCoverageRange
    : addDraftProofCoverageRange;
  const result = coverageMutation(state.draftProofing, {
    sceneId: normalizedSceneId,
    startOffset,
    endOffset,
    textLength,
    now: new Date().toISOString(),
  });
  const changed = applyDraftProofingResult(result, {
    dirtyReason,
    source,
    persist,
    syncLayer: true,
  });
  const afterSpans = result.run?.coverageByScene?.[normalizedSceneId] ?? beforeSpans;
  draftProofingLog.debug("state-change", "draft-proof.coverage.mutation-result", "Proof-read coverage mutation returned a state result.", {
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    runId: result.run?.id ?? activeRunBefore?.id ?? "",
    sceneId: normalizedSceneId,
    operation: operation === "remove" ? "remove" : "add",
    startOffset,
    endOffset,
    textLength,
    selectedCharacterCount: Math.max(0, endOffset - startOffset),
    changed,
    reason: result.reason ?? "",
    beforeSpanCount: countDraftProofCoverageSpans(beforeSpans),
    afterSpanCount: countDraftProofCoverageSpans(afterSpans),
    beforeCoveredCharacterCount: countDraftProofCoveredCharacters(beforeSpans),
    afterCoveredCharacterCount: countDraftProofCoveredCharacters(afterSpans),
    persist,
  });
  return changed;
}

function syncDraftProofLayerForActiveEditor() {
  const textarea = getEditorTextareaForScene(state.selectedSceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (editorHost) {
    syncDraftProofLayer(editorHost, editorHost.sceneId);
  }
}

// Intent: update durable task/note anchors from the live edit transaction before scene projections rerender.
function updateAnchoredRecordsForSceneTextEdit(sceneId, previousText, nextText, {
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const now = new Date().toISOString();
  const normalizedSceneId = String(sceneId ?? "");
  const taskResult = updateOffsetAnchoredRecordsForTextEdit({
    records: state.manuscriptTasks,
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    ownerType: "task",
    now,
    selectionStart,
    selectionEnd,
  });
  const noteResult = updateOffsetAnchoredRecordsForTextEdit({
    records: state.passageNotes,
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    ownerType: "passageNote",
    now,
    selectionStart,
    selectionEnd,
  });
  const issueResult = updateCanonicalAnchorCollectionFromSceneTextEdit({
    records: state.workspace?.project?.issues,
    ownerType: "issue",
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    now,
    selectionStart,
    selectionEnd,
  });
  const eventTagResult = updateCanonicalAnchorCollectionFromSceneTextEdit({
    records: state.workspace?.project?.eventTags,
    ownerType: "eventTag",
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    now,
    selectionStart,
    selectionEnd,
  });
  const narrationResult = updateNarrationAnchorsForSceneTextEdit({
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    now,
    selectionStart,
    selectionEnd,
  });
  const draftProofResult = updateDraftProofCoverageForTextEdit(state.draftProofing, {
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    now,
    selectionStart,
    selectionEnd,
  });

  if (taskResult.changedRecords.length) {
    state.manuscriptTasks = taskResult.records;
  }

  if (noteResult.changedRecords.length) {
    state.passageNotes = noteResult.records;
  }
  if (state.workspace?.project && issueResult.changedRecords.length) {
    state.workspace.project = {
      ...state.workspace.project,
      issues: issueResult.records,
    };
  }
  if (state.workspace?.project && eventTagResult.changedRecords.length) {
    state.workspace.project = {
      ...state.workspace.project,
      eventTags: eventTagResult.records,
    };
  }
  if (draftProofResult.changed) {
    state.draftProofing = normalizeDraftProofingState(draftProofResult.state);
  }
  if (
    taskResult.changedRecords.length ||
    noteResult.changedRecords.length ||
    issueResult.changedRecords.length ||
    eventTagResult.changedRecords.length ||
    narrationResult.changedCount ||
    draftProofResult.changed
  ) {
    manuscriptStateLog.debug("state-change", "manuscript.anchors.updated", "Updated anchored record ranges from scene edit.", {
      sceneId: normalizedSceneId,
      taskCount: taskResult.changedRecords.length,
      passageNoteCount: noteResult.changedRecords.length,
      issueCount: issueResult.changedRecords.length,
      eventTagCount: eventTagResult.changedRecords.length,
      markCount: 0,
      narrationCount: narrationResult.changedCount,
      draftProofingChanged: draftProofResult.changed,
    });
  }

  anchorIdleValidationScheduler.schedule(normalizedSceneId, {
    reason: "scene-text-edit",
  });
}

// Intent: map scene-level textarea edits into block-local canonical anchor edits before mutating issue/event-style records.
function updateCanonicalAnchorCollectionFromSceneTextEdit({
  records = [],
  ownerType = "record",
  sceneId = "",
  previousText = "",
  nextText = "",
  now = "",
  anchorPath = ["anchor"],
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const result = updateCanonicalAnchorRecordFromSceneTextEdit(record, {
      ownerType,
      sceneId,
      previousText,
      nextText,
      now,
      anchorPath,
      selectionStart,
      selectionEnd,
    });
    if (result.changed) {
      changedRecords.push(result.record);
    }
    return result.record;
  });

  return {
    records: nextRecords,
    changedRecords,
  };
}

function updateCanonicalAnchorRecordFromSceneTextEdit(record, {
  ownerType = "record",
  sceneId = "",
  previousText = "",
  nextText = "",
  now = "",
  anchorPath = ["anchor"],
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const anchor = getValueAtPath(record, anchorPath);
  const context = getCanonicalAnchorTextEditContext(anchor, {
    sceneId,
    previousText,
    nextText,
    selectionStart,
    selectionEnd,
  });
  if (!context) {
    return {
      record,
      changed: false,
    };
  }

  return updateCanonicalAnchorRecordForTextEdit({
    record,
    sceneId,
    previousText: context.previousText,
    nextText: context.nextText,
    ownerType,
    now,
    anchorPath,
    selectionStart: context.selectionStart,
    selectionEnd: context.selectionEnd,
  });
}

function getCanonicalAnchorTextEditContext(anchor, {
  sceneId = "",
  previousText = "",
  nextText = "",
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const anchorSceneId = String(anchor?.sceneId ?? "");
  if (!normalizedSceneId || anchorSceneId !== normalizedSceneId) {
    return null;
  }

  const scene = getScene(normalizedSceneId);
  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  if (!blocks.length) {
    return null;
  }

  if (blocks.length === 1) {
    return {
      previousText: String(previousText ?? ""),
      nextText: String(nextText ?? ""),
      selectionStart,
      selectionEnd,
    };
  }

  const blockId = String(anchor?.blockId ?? "");
  if (!blockId) {
    return null;
  }

  const ranges = getSceneBlockRanges(scene);
  const blockRange = ranges.find((candidate) => candidate.blockId === blockId) ?? null;
  if (!blockRange) {
    return null;
  }

  const composedPreviousText = ranges.map((range) => range.text).join("\n\n");
  if (composedPreviousText !== String(previousText ?? "")) {
    return null;
  }

  const transaction = deriveManuscriptEditTransaction({
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    selectionStart,
    selectionEnd,
  });
  if (
    !transaction ||
    transaction.startOffset < blockRange.startOffset ||
    transaction.endOffset > blockRange.endOffset
  ) {
    return null;
  }

  const previousBlockText = blockRange.text;
  const localStartOffset = transaction.startOffset - blockRange.startOffset;
  const localEndOffset = transaction.endOffset - blockRange.startOffset;
  const localSelectionStart = toBlockLocalSelectionOffset(selectionStart, blockRange, transaction.insertedLength);
  const localSelectionEnd = toBlockLocalSelectionOffset(selectionEnd, blockRange, transaction.insertedLength);
  return {
    previousText: previousBlockText,
    nextText: `${previousBlockText.slice(0, localStartOffset)}${transaction.insertedText}${previousBlockText.slice(localEndOffset)}`,
    selectionStart: localSelectionStart,
    selectionEnd: localSelectionEnd,
  };
}

// Intent: convert textarea-level post-input selections to block-local offsets for canonical anchors.
function toBlockLocalSelectionOffset(offset, blockRange, insertedLength = 0) {
  const numericOffset = Number(offset);
  if (!Number.isInteger(numericOffset)) {
    return null;
  }

  const blockStart = Number(blockRange?.startOffset) || 0;
  const blockEnd = Number(blockRange?.endOffset) || blockStart;
  const maxLocalOffset = Math.max(0, blockEnd - blockStart + Math.max(0, Number(insertedLength) || 0));
  return Math.max(0, Math.min(numericOffset - blockStart, maxLocalOffset));
}

function getValueAtPath(source, path) {
  const segments = Array.isArray(path) && path.length ? path : ["anchor"];
  return segments.reduce((value, segment) => (
    value && typeof value === "object" ? value[segment] : undefined
  ), source);
}

function updateNarrationAnchorsForSceneTextEdit({
  sceneId = "",
  previousText = "",
  nextText = "",
  now = "",
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const narration = state.workspace?.narration;
  if (!narration || typeof narration !== "object") {
    return { changedCount: 0 };
  }

  let changedCount = 0;
  if (narration.session?.currentAnchor) {
    const sessionResult = updateCanonicalAnchorRecordFromSceneTextEdit(narration.session, {
      ownerType: "narrationSession",
      sceneId,
      previousText,
      nextText,
      now,
      anchorPath: ["currentAnchor"],
      selectionStart,
      selectionEnd,
    });
    if (sessionResult.changed) {
      narration.session = sessionResult.record;
      changedCount += 1;
    }
  }

  const jobResult = updateCanonicalAnchorCollectionFromSceneTextEdit({
    records: narration.alignmentJobs,
    ownerType: "narrationAlignmentJob",
    sceneId,
    previousText,
    nextText,
    now,
    anchorPath: ["request", "anchor"],
    selectionStart,
    selectionEnd,
  });
  if (jobResult.changedRecords.length) {
    narration.alignmentJobs = jobResult.records;
    changedCount += jobResult.changedRecords.length;
  }

  return { changedCount };
}

// Intent: validate loaded task/note anchors once the activated project has rebuilt scene text.
function validateAnchoredRecordsForLoadedProject({
  source = "validateAnchoredRecordsForLoadedProject",
} = {}) {
  validateAnchoredRecordsForProject({
    source,
    skipProjectFileAutosave: true,
    markWorkingState: false,
  });
}

function validateAnchoredRecordsForSceneIdle(sceneId, {
  source = "validateAnchoredRecordsForSceneIdle",
} = {}) {
  validateAnchoredRecordsForProject({
    sceneId,
    source,
    skipProjectFileAutosave: false,
    markWorkingState: true,
  });
}

// Intent: keep all anchor owners on the same validation/repair path after load or quiet editing.
function validateAnchoredRecordsForProject({
  sceneId = "",
  source = "validateAnchoredRecordsForProject",
  skipProjectFileAutosave = true,
  markWorkingState = false,
} = {}) {
  const now = new Date().toISOString();
  const normalizedSceneId = String(sceneId ?? "");
  const taskResult = validateOffsetAnchoredRecordsByScene({
    records: state.manuscriptTasks,
    ownerType: "task",
    now,
    getTextForScene: (candidateSceneId) =>
      normalizedSceneId && candidateSceneId !== normalizedSceneId
        ? null
        : getSceneTextForAnchorValidation(candidateSceneId),
    fallbackRange: (record, text) => resolveManuscriptTaskRange(record, text),
  });
  const noteResult = validateOffsetAnchoredRecordsByScene({
    records: state.passageNotes,
    ownerType: "passageNote",
    now,
    getTextForScene: (candidateSceneId) =>
      normalizedSceneId && candidateSceneId !== normalizedSceneId
        ? null
        : getSceneTextForAnchorValidation(candidateSceneId),
    fallbackRange: (record, text) => resolveManuscriptTaskRange(record, text),
  });
  const issueResult = validateCanonicalAnchorRecordsByAnchorText({
    records: state.workspace?.project?.issues,
    ownerType: "issue",
    now,
    getTextForAnchor: (anchor) => getBlockTextForAnchorValidation(anchor, {
      sceneId: normalizedSceneId,
    }),
  });
  const eventTagResult = validateCanonicalAnchorRecordsByAnchorText({
    records: state.workspace?.project?.eventTags,
    ownerType: "eventTag",
    now,
    getTextForAnchor: (anchor) => getBlockTextForAnchorValidation(anchor, {
      sceneId: normalizedSceneId,
    }),
  });
  const narrationResult = validateNarrationAnchorsForProject({
    sceneId: normalizedSceneId,
    now,
  });

  if (taskResult.changedRecords.length) {
    state.manuscriptTasks = taskResult.records;
  }

  if (noteResult.changedRecords.length) {
    state.passageNotes = noteResult.records;
  }
  if (state.workspace?.project && issueResult.changedRecords.length) {
    state.workspace.project = {
      ...state.workspace.project,
      issues: issueResult.records,
    };
  }
  if (state.workspace?.project && eventTagResult.changedRecords.length) {
    state.workspace.project = {
      ...state.workspace.project,
      eventTags: eventTagResult.records,
    };
  }

  const changedCount =
    taskResult.changedRecords.length +
    noteResult.changedRecords.length +
    issueResult.changedRecords.length +
    eventTagResult.changedRecords.length +
    narrationResult.changedCount;
  if (!changedCount) {
    return;
  }

  manuscriptStateLog.info("state-change", "manuscript.anchors.validated", "Validated anchored record ranges.", {
    sceneId: normalizedSceneId,
    taskCount: taskResult.changedRecords.length,
    passageNoteCount: noteResult.changedRecords.length,
    issueCount: issueResult.changedRecords.length,
    eventTagCount: eventTagResult.changedRecords.length,
    narrationCount: narrationResult.changedCount,
    source,
  });
  persistCurrentProjectRecord({
    domain: "manuscript-anchors",
    dirtyReason: normalizedSceneId ? "manuscript-anchors-idle-validated" : "manuscript-anchors-load-validated",
    source,
    skipProjectFileAutosave,
    markWorkingState,
  });
  if (normalizedSceneId && state.selectedSceneId === normalizedSceneId) {
    syncSceneDocumentLayout({ skipSpellcheck: true });
  }
}

function getSceneTextForAnchorValidation(sceneId) {
  const normalizedSceneId = String(sceneId ?? "");
  if (!normalizedSceneId) {
    return null;
  }

  const scene = getScene(normalizedSceneId);
  if (scene && typeof scene.editorText === "string") {
    return scene.editorText;
  }

  const draft = state.sceneDrafts?.[normalizedSceneId];
  return typeof draft?.editorText === "string" ? draft.editorText : null;
}

function getBlockTextForAnchorValidation(anchor, {
  sceneId = "",
} = {}) {
  const normalizedSceneId = String(anchor?.sceneId ?? "");
  if (!normalizedSceneId || (sceneId && normalizedSceneId !== sceneId)) {
    return null;
  }

  const scene = getScene(normalizedSceneId);
  if (!scene || !Array.isArray(scene.blocks)) {
    return null;
  }

  const block = scene.blocks.find((candidate) => candidate.blockId === anchor?.blockId) ?? null;
  if (!block) {
    return null;
  }

  if (scene.blocks.length === 1 && typeof scene.editorText === "string") {
    return scene.editorText;
  }

  return typeof block.text === "string" ? block.text : null;
}

function validateNarrationAnchorsForProject({
  sceneId = "",
  now = new Date().toISOString(),
} = {}) {
  const narration = state.workspace?.narration;
  if (!narration || typeof narration !== "object") {
    return { changedCount: 0 };
  }

  let changedCount = 0;
  const session = narration.session;
  if (session?.currentAnchor) {
    const sessionText = getBlockTextForAnchorValidation(session.currentAnchor, { sceneId });
    if (sessionText !== null && sessionText !== undefined) {
      const sessionResult = validateCanonicalAnchorRecordAgainstText(session, sessionText, {
        ownerType: "narrationSession",
        now,
        anchorPath: ["currentAnchor"],
      });
      if (sessionResult.changed) {
        narration.session = sessionResult.record;
        changedCount += 1;
      }
    }
  }

  const jobs = Array.isArray(narration.alignmentJobs) ? narration.alignmentJobs : [];
  const jobResult = validateCanonicalAnchorRecordsByAnchorText({
    records: jobs,
    ownerType: "narrationAlignmentJob",
    now,
    anchorPath: ["request", "anchor"],
    getTextForAnchor: (anchor) => getBlockTextForAnchorValidation(anchor, { sceneId }),
  });
  if (jobResult.changedRecords.length) {
    narration.alignmentJobs = jobResult.records;
    changedCount += jobResult.changedRecords.length;
  }

  return { changedCount };
}

function loadSelectedProject(requestedProjectId = null) {
  // Intent: keep a clicked recent-project target stable while the current project is saved before switching.
  const requestedProjectIdValue = typeof requestedProjectId === "string" && requestedProjectId.trim()
    ? requestedProjectId.trim()
    : "";
  const selectedProjectId = requestedProjectIdValue || state.projectLibrarySelectionId || state.activeProjectId || "";

  persistCurrentProjectRecord({
    domain: "project",
    dirtyReason: "before-project-switch",
    source: "loadSelectedProject",
    markWorkingState: false,
  });

  if (selectedProjectId) {
    state.projectLibrarySelectionId = selectedProjectId;
  }

  const record = selectedProjectId
    ? state.projectLibrary.find((project) => project.id === selectedProjectId) ?? null
    : state.projectLibrary[0] ?? null;
  if (!record) {
    projectLoadGateLog.warn("validation", "project.load.skipped", "No project record available to load from selection.", {
      requestedProjectId: selectedProjectId,
    });
    return;
  }

  projectLoadGateLog.info("user-action", "project.load.begin", "Loading selected project.", {
    projectId: record.id,
    title: record.title,
  });

  logWritingTargetDebugEvent("info", "project.load-selected", "Loading selected project.", {
    projectId: record.id,
    title: record.title,
  });
  activateProjectRecord(record, {
    reason: "load-project",
    refreshSessionLifecycle: true,
    logLoadCheckpoint: true,
    beforeRender: () => {
      projectPersistenceService.syncActiveProjectFileDestinationFromRecord({
        persistDesktopProjectFilePath: true,
        source: "loadSelectedProject",
      });
    },
    renderAfter: true,
    afterRender: () => primeProjectFileAutosave(),
    recordSnapshot: true,
  });
  projectLoadGateLog.info("lifecycle", "project.load.completed", "Selected project loaded into editor.", {
    projectId: record.id,
    selectedSceneId: state.selectedSceneId ?? "",
  });
  if (state.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Loaded saved project from library.", {
      projectId: record.id,
      title: record.title,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
    });
  }
}

function getSuggestedProjectFileName(projectTitle = "") {
  const title = projectTitle || state.projectTitle || state.workspace?.project?.title || "Untitled Project";
  return getSuggestedProjectFileNameFromTitle(title);
}

function hasProjectFileDestination() {
  return projectPersistenceService.hasProjectSaveDestination();
}

function getProjectFileDisplayState() {
  return projectPersistenceService.getProjectFileDisplayState();
}

// Intent: build the canonical payload written to every `.abe-project.json` destination.
function createProjectLibrarySnapshotForFile() {
  return projectPersistenceService.buildProjectSnapshotForSaveFile();
}

function buildProjectIndexForRecord(projectRecord, persistedProjectIndex = null) {
  const computedIndex = projectService.getProjectIndex({
    projectRecord,
  });
  return mergeProjectIndexWithLiveSceneOverrides({
    computedIndex,
    persistedProjectIndex,
    projectRecord,
  });
}

async function saveProjectLibraryToBrowserHandle(handle, snapshot = createProjectLibrarySnapshotForFile()) {
  return projectPersistenceService.saveProjectSnapshotToBrowserHandle(handle, snapshot);
}

// Intent: write project saves through the desktop path bridge when the host exposes a durable filesystem path.
async function saveProjectLibraryToFile(filePath, snapshot = createProjectLibrarySnapshotForFile()) {
  return projectPersistenceService.saveProjectSnapshotToFilePath(filePath, snapshot);
}

// Intent: load project files into active state and immediately retarget autosave to the loaded destination.
async function loadProjectLibrarySnapshotIntoState(loadedSnapshot, options = {}) {
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot(loadedSnapshot, options);
}

async function loadProjectLibraryFromBrowserHandle(handle) {
  await projectPersistenceService.loadProjectSnapshotFromBrowserHandle(handle);
}

async function loadProjectLibraryFromBrowserFile(file, options = {}) {
  await projectPersistenceService.loadProjectSnapshotFromBrowserFile(file, options);
}

function downloadProjectLibrarySnapshot(snapshot, fileName = getSuggestedProjectFileName()) {
  return projectPersistenceService.exportProjectLibrarySnapshot(snapshot, fileName);
}

async function loadProjectLibraryFromFile() {
  openProjectPackageDialog(PROJECT_PACKAGE_DIALOG_MODES.OPEN);
}

async function portScrivenerProject() {
  await projectPersistenceService.chooseScrivenerProjectForImport();
}

// Intent: keep saved-take word timings from being stranded when a project save overlaps a long Whisper request.
async function waitForNarrationRecordingTranscriptAlignmentJobs({
  reason = "save-project",
} = {}) {
  return narrationRecordingTranscriptAlignmentJobService.waitForPending({ reason });
}

async function saveCurrentProject({
  waitForNarrationRecordingTranscriptAlignment = true,
} = {}) {
  if (!hasProjectFileDestination()) {
    openProjectPackageDialog(PROJECT_PACKAGE_DIALOG_MODES.SAVE_AS);
    return;
  }
  if (waitForNarrationRecordingTranscriptAlignment) {
    await waitForNarrationRecordingTranscriptAlignmentJobs({
      reason: "save-project",
    });
  }
  await projectPersistenceService.saveProjectSnapshot({ reason: "save-project" });
}

async function saveCurrentProjectFileAs() {
  openProjectPackageDialog(PROJECT_PACKAGE_DIALOG_MODES.SAVE_AS);
}

function createProject() {
  openProjectPackageDialog(PROJECT_PACKAGE_DIALOG_MODES.NEW);
}

async function confirmProjectPackageDialog() {
  const dialog = state.projectPackageDialog;
  if (!dialog || !canConfirmProjectPackageDialog(dialog)) return;
  state.projectPackageDialog = { ...dialog, busy: true, errorMessage: "" };
  renderProjectPackageDialog();
  try {
    if (dialog.mode === PROJECT_PACKAGE_DIALOG_MODES.NEW) {
      const title = dialog.projectName.trim() || "Untitled Project";
      await projectPersistenceService.createDesktopProjectPackage({
        parentPath: dialog.locationPath,
        folderName: dialog.folderName,
        buildCandidateSnapshot: () => buildNewProjectCandidateSnapshot(title),
      });
      projectPersistenceLog.info("state-change", "project.create", "Created and activated a verified project package.", {
        projectId: state.activeProjectId,
        title: state.projectTitle,
        projectRoot: state.projectFilePath,
      });
    } else if (dialog.mode === PROJECT_PACKAGE_DIALOG_MODES.OPEN) {
      await projectPersistenceService.openDesktopProjectPackage({ rootPath: dialog.locationPath });
    } else {
      await waitForNarrationRecordingTranscriptAlignmentJobs({ reason: "save-project-as-package" });
      await projectPersistenceService.saveProjectSnapshotAsPackage({
        destinationParentPath: dialog.locationPath,
        folderName: dialog.folderName,
      });
    }
    state.projectPackageDialog = null;
    render();
  } catch (error) {
    state.projectPackageDialog = {
      ...dialog,
      busy: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    renderProjectPackageDialog();
  }
}

async function loadProjectSource() {
  const projectPath = state.projectSourcePath.trim();
  if (!projectPath) {
    state.projectSourceStatus = "Enter a local project source path.";
    projectLoadGateLog.warn("validation", "project-source.load.missing-path", "Load project source skipped because no source path was entered.");
    renderHeader();
    return;
  }

  state.projectSourceBusy = true;
  state.projectSourceStatus = "Loading project source...";
  projectLoadGateLog.info("user-action", "project-source.load.begin", "Loading project source from path.", {
    projectPath,
  });
  renderHeader();

  try {
    const result = await projectSourceService.loadProjectSource({
      projectPath,
      activeProjectId: state.activeProjectId,
      projects: state.projectLibrary,
      sceneStore: state.loadedProjectSceneStore,
    });
    if (!result.ok) {
      throw result.error ?? new Error("Project source load failed.");
    }

    state.projectLibrary = result.persistedLibrary.projects;
    state.activeProjectId = result.persistedLibrary.activeProjectId;
    state.projectLibrarySelectionId = result.persistedLibrary.activeProjectId;
    state.loadedProjectSceneStore = result.mergedLibrary?.sceneStore && typeof result.mergedLibrary.sceneStore === "object" && !Array.isArray(result.mergedLibrary.sceneStore)
      ? cloneValue(result.mergedLibrary.sceneStore)
      : {};

    const record = getActiveProjectRecord();
    if (!record) {
      throw new Error("Unable to activate the loaded project source.");
    }

    activateProjectRecord(record, {
      reason: "load-project-source",
      beforeRender: () => {
        if (state.workspace?.project?.stats) {
          state.projectSourceStatus = `Loaded ${record.title} · ${state.workspace.project.stats.chapterCount} chapters, ${state.workspace.project.stats.sceneCount} scenes`;
        }
      },
      renderAfter: true,
      recordSnapshot: true,
    });
    projectLoadGateLog.info("lifecycle", "project-source.load.completed", "Project source loaded and applied.", {
      projectPath,
      projectId: record.id,
      title: record.title,
    });

    if (state.workspace?.project?.stats) {
      reportBrowserLog("info", "project-source", "Loaded a project source into saved projects.", {
        projectPath,
        projectId: record.id,
        title: record.title,
        chapters: state.workspace.project.stats.chapterCount,
        scenes: state.workspace.project.stats.sceneCount,
        templates: state.workspace.world?.stats?.templateCount ?? 0,
      });
    }
  } catch (error) {
    state.projectSourceStatus = `Load failed: ${error instanceof Error ? error.message : String(error)}`;
    projectLoadGateLog.error("persistence", "project-source.load.failed", "Project source load failed.", {
      projectPath,
      error,
    });
    reportBrowserLog("error", "project-source", "Project source load failed.", {
      projectPath,
      error,
    });
    renderHeader();
  } finally {
    state.projectSourceBusy = false;
    projectLoadGateLog.debug("lifecycle", "project-source.load.end", "Project source load flow finished.", {
      projectPath,
      status: state.projectSourceStatus,
    });
    renderHeader();
  }
}

// Intent: resolve DOM events back to stable scene and selection context for anchored editor actions.
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

  const preservedContextRange = getEditorContextRange(textarea);
  const shouldPreserveExplicitContextSelection =
    event?.type === "contextmenu" &&
    preservedContextRange?.hasExplicitSelection === true;

  // Intent: keep a selected manuscript word intact when the context-menu target is an overlay element.
  if (!(target instanceof HTMLTextAreaElement) && !shouldPreserveExplicitContextSelection) {
    const cursorOffset = textarea.value.length;
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), cursorOffset, cursorOffset, {
      focus: true,
      scroll: false,
    });
  }

  const contextRange = shouldPreserveExplicitContextSelection
    ? preservedContextRange
    : getEditorContextRange(textarea) ?? {
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

// Intent: derive pointer hover context without changing textarea focus or selection.
function getEditorHoverContextFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest("[data-inline-passage-draft]") || target.closest("[data-spellcheck-menu]")) {
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

  return {
    textarea,
    contextRange: {
      selectedText: "",
      startOffset: textarea.selectionStart,
      endOffset: textarea.selectionStart,
      hasExplicitSelection: false,
    },
    inlinePosition: null,
  };
}

function getSpellcheckContextFromEvent(editorContext, event) {
  return buildSpellcheckEditorContextMenu(editorContext, event, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  }, {
    getTextareaOffsetFromPoint,
  });
}

function getSpellcheckHoverContextFromEvent(editorContext, event) {
  return buildSpellcheckEditorHoverContextMenu(editorContext, event, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  }, {
    getTextareaOffsetFromPoint,
  });
}

function getDictionaryContextFromEvent(editorContext, event) {
  return buildDictionaryEditorContextMenu(editorContext, event, {
    getTextareaOffsetFromPoint,
  });
}

function getTextareaOffsetFromPoint(textarea, clientX, clientY) {
  const rect = textarea.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const textNode = document.createTextNode(textarea.value ?? "");
  mirror.setAttribute("aria-hidden", "true");
  mirror.setAttribute("role", "presentation");
  mirror.style.position = "fixed";
  mirror.style.left = `${Math.round(rect.left)}px`;
  mirror.style.top = `${Math.round(rect.top)}px`;
  mirror.style.width = `${Math.round(rect.width)}px`;
  mirror.style.height = `${Math.round(rect.height)}px`;
  mirror.style.margin = "0";
  mirror.style.borderTopStyle = style.borderTopStyle;
  mirror.style.borderRightStyle = style.borderRightStyle;
  mirror.style.borderBottomStyle = style.borderBottomStyle;
  mirror.style.borderLeftStyle = style.borderLeftStyle;
  mirror.style.borderTopWidth = style.borderTopWidth;
  mirror.style.borderRightWidth = style.borderRightWidth;
  mirror.style.borderBottomWidth = style.borderBottomWidth;
  mirror.style.borderLeftWidth = style.borderLeftWidth;
  mirror.style.borderTopLeftRadius = style.borderTopLeftRadius;
  mirror.style.borderTopRightRadius = style.borderTopRightRadius;
  mirror.style.borderBottomLeftRadius = style.borderBottomLeftRadius;
  mirror.style.borderBottomRightRadius = style.borderBottomRightRadius;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.font = style.font || "";
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.tabSize = style.tabSize;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textTransform = style.textTransform;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordBreak = style.wordBreak;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflow = "auto";
  mirror.style.background = "transparent";
  mirror.style.color = "transparent";
  mirror.style.caretColor = "transparent";
  mirror.style.opacity = "0";
  mirror.style.pointerEvents = "auto";
  mirror.style.zIndex = "2147483647";
  mirror.append(textNode);
  document.body.append(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;

  try {
    const caretPoint = getCaretPointFromMirror(mirror, clientX, clientY);
    if (!caretPoint) {
      return null;
    }

    return getOffsetFromCaretPoint(mirror, caretPoint);
  } finally {
    mirror.remove();
  }
}

function getCaretPointFromMirror(mirror, clientX, clientY) {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (position?.offsetNode && mirror.contains(position.offsetNode)) {
      return {
        node: position.offsetNode,
        offset: position.offset,
      };
    }
  }

  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range?.startContainer && mirror.contains(range.startContainer)) {
      return {
        node: range.startContainer,
        offset: range.startOffset,
      };
    }
  }

  return null;
}

async function loadDesktopSettingsSnapshot() {
  const settingsResponse = await fetchJsonFromDesktopApi("/api/settings");
  if (!settingsResponse.ok) {
    reportBrowserLog("warn", "settings", "Unable to load the desktop settings snapshot.", {
      error: settingsResponse.error,
      attemptedUrls: settingsResponse.attemptedUrls,
    });
    return {
      projectRoot: "",
      spotifyClientId: "",
      lastProjectFilePath: "",
    };
  }

  const candidate = settingsResponse.value && typeof settingsResponse.value === "object"
    ? settingsResponse.value
    : {};
  return {
    projectRoot: normalizeProjectFilePath(candidate.projectRoot ?? ""),
    spotifyClientId: String(candidate.spotifyClientId ?? "").trim(),
    lastProjectFilePath: normalizeProjectFilePath(candidate.lastProjectFilePath ?? ""),
    lastProjectFilePathExplicit: candidate.lastProjectFilePathExplicit === true,
  };
}

function getOffsetFromCaretPoint(root, caretPoint) {
  if (!(root instanceof Node) || !caretPoint?.node) {
    return null;
  }

  const targetNode = caretPoint.node;
  const targetOffset = Number(caretPoint.offset);
  if (!Number.isInteger(targetOffset) || targetOffset < 0) {
    return null;
  }

  if (targetNode.nodeType === Node.TEXT_NODE) {
    return getTextNodeOffsetWithinRoot(root, targetNode, targetOffset);
  }

  const range = document.createRange();
  try {
    range.setStart(root, 0);
    range.setEnd(targetNode, targetOffset);
    return range.toString().length;
  } catch {
    return null;
  }
}

function getTextNodeOffsetWithinRoot(root, targetNode, nodeOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let runningOffset = 0;

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const currentLength = currentNode.textContent?.length ?? 0;
    if (currentNode === targetNode) {
      return runningOffset + Math.max(0, Math.min(nodeOffset, currentLength));
    }

    runningOffset += currentLength;
  }

  return null;
}

function collectSpellcheckCorpusTexts() {
  const texts = [];

  if (typeof state.projectTitle === "string" && state.projectTitle.trim()) {
    texts.push(state.projectTitle);
  }

  if (state.workspace?.project?.binder) {
    collectSpellcheckBinderTexts(state.workspace.project.binder, texts);
  }

  for (const scene of state.scenes) {
    if (scene?.chapterTitle) {
      texts.push(scene.chapterTitle);
    }
    if (scene?.sceneTitle) {
      texts.push(scene.sceneTitle);
    }
    if (scene?.sceneSynopsis) {
      texts.push(scene.sceneSynopsis);
    }
    if (scene?.editorText) {
      texts.push(scene.editorText);
    }
  }

  for (const task of state.manuscriptTasks) {
    if (task?.title) {
      texts.push(task.title);
    }
    if (task?.body) {
      texts.push(task.body);
    }
    if (task?.description) {
      texts.push(task.description);
    }
    if (task?.selectedText) {
      texts.push(task.selectedText);
    }
  }

  for (const note of state.passageNotes) {
    if (note?.title) {
      texts.push(note.title);
    }
    if (note?.body) {
      texts.push(note.body);
    }
    if (note?.selectedText) {
      texts.push(note.selectedText);
    }
  }

  return texts;
}

function collectSpellcheckProjectCorpusTexts() {
  const texts = [];

  if (typeof state.projectTitle === "string" && state.projectTitle.trim()) {
    texts.push(state.projectTitle);
  }

  if (state.workspace?.project?.binder) {
    collectSpellcheckBinderTexts(state.workspace.project.binder, texts);
  }

  for (const scene of state.scenes) {
    if (scene?.chapterTitle) {
      texts.push(scene.chapterTitle);
    }
    if (scene?.sceneTitle) {
      texts.push(scene.sceneTitle);
    }
    if (scene?.sceneSynopsis) {
      texts.push(scene.sceneSynopsis);
    }
  }

  for (const task of state.manuscriptTasks) {
    if (task?.title) {
      texts.push(task.title);
    }
  }

  for (const note of state.passageNotes) {
    if (note?.title) {
      texts.push(note.title);
    }
  }

  return texts;
}

function buildCurrentProjectSpellcheckLexicon() {
  const spellcheckProjectSettings = normalizeSpellcheckProjectSettings(state.spellcheckProjectSettings);
  const texts = [
    ...collectSpellcheckProjectCorpusTexts(),
    ...spellcheckProjectSettings.dictionaryWords,
    ...spellcheckProjectSettings.exceptionWords,
  ];

  return buildSpellcheckProjectLexicon(texts);
}

function getCurrentSpellcheckLexicons() {
  return {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  };
}

function collectSpellcheckBinderTexts(node, texts) {
  if (!node || typeof node !== "object" || !Array.isArray(texts)) {
    return;
  }

  if (typeof node.title === "string" && node.title.trim()) {
    texts.push(node.title);
  }

  if (!Array.isArray(node.children)) {
    return;
  }

  for (const child of node.children) {
    collectSpellcheckBinderTexts(child, texts);
  }
}

function getInlinePassagePosition(codeframe, event) {
  const bounds = codeframe.getBoundingClientRect();
  const maxLeft = Math.max(92, codeframe.clientWidth - 390);
  const left = Math.max(92, Math.min(maxLeft, event.clientX - bounds.left + codeframe.scrollLeft));
  const top = Math.max(24, event.clientY - bounds.top + codeframe.scrollTop);

  return { x: left, y: top };
}

function getEditorContextRange(textarea) {
  return manuscriptSelectionController.getContextRange({
    text: textarea.value,
    startOffset: textarea.selectionStart,
    endOffset: textarea.selectionEnd,
  });
}

// Intent: switch high-level workspaces while preserving editor-focused layout and selection state.
function selectWorkspacePane(paneId) {
  const requestedPaneId = String(paneId ?? "").trim();
  const normalizedPaneId = normalizeWorkspacePaneId(requestedPaneId);

  if (requestedPaneId !== "voice" && normalizedPaneId !== requestedPaneId) {
    return;
  }
  const previousPaneId = normalizeWorkspacePaneId(state.activePane);

  if (normalizedPaneId !== "manuscript" && state.manuscriptFind.open) {
    state.manuscriptFind = manuscriptFindController.close(state.manuscriptFind);
  }

  if (normalizedPaneId !== "manuscript" && state.grammarCheckPanel?.open) {
    state.grammarCheckPanel = {
      ...state.grammarCheckPanel,
      open: false,
    };
  }

  if (normalizedPaneId !== "manuscript") {
    state.projectSettingsMenuOpen = false;
    state.draftProofSettingsWindowOpen = false;
    state.draftProofClearConfirmationArmed = false;
    state.draftProofSettingsSelectedRunId = "";
  }
  if (normalizedPaneId !== "narration") {
    state.narrationRecordingPreviewId = null;
  }
  state.keyboardShortcutSettingsWindowOpen = false;
  state.keyboardShortcutCaptureBehaviorId = "";
  state.keyboardShortcutSettingsStatus = "";
  state.topPanelCustomizationOpen = false;
  state.topPanelCustomizationPosition = null;
  state.topPanelCustomizationGroupId = "";

  state.activePane = normalizedPaneId;
  // Intent: persist the last authoring workspace so refresh/load returns to the same page.
  if (previousPaneId !== normalizedPaneId) {
    persistCurrentProjectRecord({
      domain: "app-settings",
      dirtyReason: "workspace-pane-selected",
      source: "selectWorkspacePane",
    });
    uiEventDispatcherLog.info("user-action", "workspace.pane.changed", "Changed workspace pane.", {
      previousPaneId,
      nextPaneId: normalizedPaneId,
    });
  }
  render();
}

function renderPaneVisibility() {
  const visiblePaneSections = state.activePane === "narration"
    ? new Set(["manuscript"])
    : new Set([state.activePane]);

  document.querySelectorAll("[data-pane-section]").forEach((section) => {
    const paneId = section instanceof HTMLElement ? section.dataset.paneSection : null;
    section.toggleAttribute("hidden", !paneId || !visiblePaneSections.has(paneId));
  });
}

function selectSidePanel(panelId) {
  const normalizedPanelId = String(panelId ?? "").trim();
  if (!getMetadataSidePanelIds().includes(normalizedPanelId)) {
    return;
  }

  state.sidePanelMode = normalizedPanelId;
  if (normalizedPanelId === "issues") {
    state.selectedPassageNoteId = null;
    state.selectedIssueId = null;
  } else {
    const selectedNote = state.passageNotes.find((note) =>
      note.noteType === normalizedPanelId && note.id === state.selectedPassageNoteId,
    );
    state.selectedPassageNoteId =
      selectedNote?.id ??
      state.passageNotes.find((note) => note.noteType === normalizedPanelId)?.id ??
      null;
  }
  renderConsolePanel();
}

function ensureSelectedRevisionSession() {
  const model = buildRevisionPanelModel();
  state.revisionPanelState = {
    ...state.revisionPanelState,
    selectedSessionId: model.selectedSessionId,
  };
}

function updateRevisionPanelSearch(value) {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    query: String(value ?? ""),
    selectedSessionId: "",
  };
  renderRevisionWindowSurface();
  focusRevisionPanelControl(state.revisionWindowOpen ? ".revision-window [data-revision-search]" : "[data-revision-search]");
}

function updateRevisionPanelFilter(fieldName, value) {
  if (fieldName !== "categoryFilter" && fieldName !== "originFilter") {
    return;
  }

  state.revisionPanelState = {
    ...state.revisionPanelState,
    [fieldName]: String(value ?? "all"),
    selectedSessionId: "",
  };
  renderRevisionWindowSurface();
}

function focusRevisionPanelControl(selector) {
  window.requestAnimationFrame(() => {
    const field = document.querySelector(selector);
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });
}

function selectRevisionSession(sessionId) {
  const selectedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!selectedSessionId || !revisionService.getSessionById(selectedSessionId)) {
    return;
  }

  state.revisionPanelState = {
    ...state.revisionPanelState,
    selectedSessionId,
    statusMessage: "",
  };
  renderRevisionWindowSurface();
}

function setRevisionPanelStatus(statusMessage) {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    statusMessage: String(statusMessage ?? ""),
  };
  renderRevisionWindowSurface();
}

function bankCurrentRevisionFromPanel() {
  const result = revisionService.bankCurrentRevision({
    reason: "revision-banked",
    markWorkingState: true,
  });
  const session = result?.session ?? null;
  if (result?.banked && session) {
    state.revisionPanelState = {
      ...state.revisionPanelState,
      selectedSessionId: session.metadata.id,
      statusMessage: "Revision banked into this project.",
      showFullDiff: false,
    };
    renderRevisionWindowSurface({ renderChrome: true });
    return;
  }

  const reason = result?.reason === "no-open-session"
    ? "No manuscript changes have started a revision session yet."
    : result?.reason === "no-meaningful-changes"
      ? "No meaningful project changes were found to bank."
      : "Revision could not be banked.";
  setRevisionPanelStatus(reason);
}

function toggleRevisionDiffDetail() {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    showFullDiff: !state.revisionPanelState.showFullDiff,
  };
  renderRevisionWindowSurface();
}

function exportRevisionSummary(sessionId = "") {
  const session = revisionService.getSessionById(sessionId || state.revisionPanelState.selectedSessionId);
  if (!session) {
    setRevisionPanelStatus("Choose a revision session before exporting.");
    return;
  }

  const summary = buildRevisionExportMarkdown(session);
  const blob = new Blob([summary], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeDownloadFileName(session.metadata.title || "revision-summary")}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setRevisionPanelStatus("Revision summary exported.");
}

function buildRevisionExportMarkdown(session) {
  const lines = [
    `# ${session.metadata.title || "Revision Summary"}`,
    "",
    `- Status: ${session.metadata.status || "unknown"}`,
    `- Started: ${session.metadata.startedAt || "Not recorded"}`,
    `- Banked: ${session.metadata.finalisedAt || session.metadata.stagedAt || "Not recorded"}`,
    `- Changed entities: ${Array.isArray(session.changedEntities) ? session.changedEntities.length : 0}`,
    `- Events: ${Array.isArray(session.events) ? session.events.length : 0}`,
    "",
    session.summaryMarkdown || "No generated summary is available.",
  ];
  return `${lines.join("\n")}\n`;
}

function sanitizeDownloadFileName(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "revision-summary";
}

function openFirstRevisionScene(sessionId = "") {
  const session = revisionService.getSessionById(sessionId || state.revisionPanelState.selectedSessionId);
  const target = findFirstRevisionNavigableEntity(session);
  if (!target) {
    setRevisionPanelStatus("No changed scene is available for this revision.");
    return;
  }

  navigateRevisionEntity(target.entityType, target.entityId);
}

function findFirstRevisionNavigableEntity(session) {
  const entities = Array.isArray(session?.changedEntities) ? session.changedEntities : [];
  return entities.find((entity) =>
    entity?.entityType === "scene" &&
    typeof entity.entityId === "string" &&
    getScene(entity.entityId),
  ) ?? null;
}

function navigateRevisionEntity(entityType, entityId) {
  const normalizedType = String(entityType ?? "").trim();
  const normalizedId = String(entityId ?? "").trim();
  if (!normalizedType || !normalizedId) {
    return;
  }

  if (normalizedType === "scene") {
    selectWorkspacePane("manuscript");
    selectSceneById(normalizedId);
    setRevisionPanelStatus("Opened changed scene.");
    return;
  }

  if (normalizedType === "manuscript_task") {
    selectWorkspacePane("manuscript");
    state.sidePanelMode = "issues";
    navigateTaskAnchor(normalizedId);
    return;
  }

  if (normalizedType === "passage_note") {
    const note = state.passageNotes.find((candidate) => candidate.id === normalizedId);
    if (note) {
      selectWorkspacePane("manuscript");
      state.sidePanelMode = note.noteType;
      togglePassageNoteSelection(note.id);
    }
    return;
  }

  if (normalizedType === "world_entity") {
    selectWorkspacePane("world");
    state.selectedEntityId = normalizedId;
    render();
    return;
  }

  if (normalizedType === "timeline_node") {
    selectWorkspacePane("world");
    setWorldSpineSelectedNodeId(normalizedId);
    render();
  }
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

  const editorHost = resolveTextareaEditorHost(textarea);
  const offset = getTextareaOffsetFromPoint(textarea, event.clientX, event.clientY);
  const trailingWhitespaceRange = getTrailingWhitespaceRange(textarea.value);
  if (trailingWhitespaceRange && (!Number.isInteger(offset) || offset >= textarea.value.length)) {
    selectTextareaEditorHostRange(
      editorHost,
      trailingWhitespaceRange.start,
      trailingWhitespaceRange.end,
      {
        focus: true,
        scroll: false,
      },
    );
    return true;
  }

  if (Number.isInteger(offset)) {
    const safeOffset = clampEditorOffset(offset, textarea.value.length);
    selectTextareaEditorHostRange(editorHost, safeOffset, safeOffset, {
      focus: true,
      scroll: false,
    });
  }
  return true;
}

function getTrailingWhitespaceRange(text) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  const match = source.match(/(\s+)$/u);
  if (!match) {
    return null;
  }

  const trailingWhitespace = match[1];
  const start = source.length - trailingWhitespace.length;
  return {
    start,
    end: source.length,
  };
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: task,
    recordType: "task",
    text: textarea.value,
  });
  if (!preview) {
    return;
  }

  const { startOffset, endOffset } = preview.resolvedRange;
  const editorHost = resolveTextareaEditorHost(textarea);

  state.taskPreview = {
    ...preview.previewSelection,
    wasFocused: true,
    pinned: true,
  };

  showTextareaAnchoredRecordPreview(editorHost, preview.projection);
  scrollTextareaEditorHostToOffset(editorHost, startOffset, options);
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: task,
    recordType: "task",
    text: textarea.value,
    repair: false,
  });
  if (!preview) {
    return;
  }

  const editorHost = resolveTextareaEditorHost(textarea);
  const taskElement = document.querySelector(`[data-task-preview-id="${CSS.escape(task.id)}"]`);

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    wasFocused: document.activeElement === textarea,
    pinned: false,
  };

  showTextareaAnchoredRecordPreview(editorHost, preview.projection);
  if (taskElement instanceof HTMLElement) {
    taskElement.classList.add("is-previewing");
  }
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
    task.endOffset === resolvedRange.endOffset &&
    !hasResolvedAnchorRecordPatch(task, resolvedRange)
  ) {
    return;
  }

  anchoredRecordService.repairTaskAnchor(task.id, resolvedRange, {
    dirtyReason: "manuscript-task-anchor-repaired",
    source: "syncResolvedTaskRange",
  });
}

function centerEditorOnCaret(textarea) {
  scrollTextareaEditorHostToSelection(resolveTextareaEditorHost(textarea));
}

function takeToEditorOffset(textarea, offset, options = {}) {
  scrollTextareaEditorHostToOffset(resolveTextareaEditorHost(textarea), offset, options);
}

function centerEditorOnOffset(textarea, offset, options = {}) {
  takeToEditorOffset(textarea, offset, options);
}

function takeToSceneRange(sceneId, startOffset, endOffset = startOffset, options = {}) {
  const scene = getScene(sceneId);
  if (!scene) {
    return false;
  }

  if (state.selectedSceneId !== scene.sceneId) {
    selectSceneById(scene.sceneId);
    window.requestAnimationFrame(() => {
      takeToSceneRange(sceneId, startOffset, endOffset, options);
    });
    return true;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  return Boolean(selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), startOffset, endOffset, {
    behavior: options.behavior ?? "auto",
    focus: true,
    scroll: true,
  }));
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
    const editorHost = resolveTextareaEditorHost(textarea);
    clearTextareaAnchoredRecordPreview(editorHost);

    if (restoreSelection) {
      if (preview.wasFocused) {
        selectTextareaEditorHostRange(editorHost, preview.selectionStart, preview.selectionEnd, {
          focus: false,
          scroll: false,
        });
      } else {
        selectTextareaEditorHostRange(editorHost, textarea.selectionEnd, textarea.selectionEnd, {
          focus: false,
          scroll: false,
        });
        textarea.blur();
      }
    }
  }

  document
    .querySelectorAll("[data-task-preview-id].is-previewing")
    .forEach((element) => element.classList.remove("is-previewing"));
  state.taskPreview = null;
}

// Intent: preserve the editor viewport when anchored notes are removed or rehydrated.
function captureSceneEditorViewport(sceneId) {
  const textarea = getEditorTextareaForScene(sceneId);
  return captureTextareaEditorHostViewport(resolveTextareaEditorHost(textarea));
}

// Intent: restore the manuscript editor to the same visual position after feature-owned state changes.
function restoreSceneEditorViewport(sceneId, viewport) {
  if (!viewport) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  restoreTextareaEditorHostViewport(resolveTextareaEditorHost(textarea), viewport);
}

// Intent: keep author mark commands from using anchored-navigation centering while still restoring selection feedback.
function restoreSceneEditorViewportSelection(sceneId, viewport, selection = null) {
  const textarea = getEditorTextareaForScene(sceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!editorHost || !selection) {
    restoreSceneEditorViewport(sceneId, viewport);
    return false;
  }

  const startOffset = Number.isInteger(selection.startOffset) ? selection.startOffset : null;
  const endOffset = Number.isInteger(selection.endOffset) ? selection.endOffset : startOffset;
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    restoreSceneEditorViewport(sceneId, viewport);
    return false;
  }

  if (viewport) {
    return restoreTextareaEditorHostViewport(editorHost, {
      ...viewport,
      wasFocused: true,
      selectionStart: startOffset,
      selectionEnd: endOffset,
      selectionDirection: "forward",
    });
  }

  return Boolean(selectTextareaEditorHostRange(editorHost, startOffset, endOffset, {
    focus: true,
    scroll: false,
  }));
}

// Intent: start anchored inspiration/research notes from the active manuscript selection.
function openPassageNoteComposerFromContextMenu(noteType) {
  const menu = state.taskContextMenu;
  if (!menu || !isPassageNoteSidePanelMode(noteType)) {
    return;
  }

  state.sidePanelMode = noteType;
  state.taskContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  state.inlinePassageDraft = buildInlinePassageNoteDraftFromContextMenu(menu, noteType, {
    customMetadataDefinitions: getCustomMetadataDefinitions(),
  });
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

  const note = buildPassageNoteFromComposer({
    composer,
    scene,
    body,
  });
  if (!note) {
    hideTaskSurfaces();
    return;
  }

  anchoredRecordService.addPassageNote(note, {
    dirtyReason: `${note.noteType}-note-created`,
    source: "savePassageNoteFromComposer",
  });
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  maybeSuggestPassageNoteTitle(note);
  state.taskComposer = null;
  renderConsolePanel();
  renderTaskContextMenu();
  if (state.selectedSceneId === note.sceneId) {
    scrollSelectedPassageNoteIntoView(note.id);
    return;
  }

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

  if (draft.editingNoteId) {
    const updatedNote = anchoredRecordService.updatePassageNoteBody(draft.editingNoteId, body, {
      dirtyReason: `${draft.noteType}-note-body-edited`,
      source: "commitInlinePassageNote.edit",
    });
    if (!updatedNote) {
      cancelInlinePassageNote();
      return;
    }

    state.sidePanelMode = updatedNote.noteType;
    state.selectedPassageNoteId = updatedNote.id;
    state.inlinePassageDraft = null;
    renderManuscriptPanel();
    syncSceneDocumentLayout();
    renderConsolePanel();
    if (state.selectedSceneId === updatedNote.sceneId) {
      scrollSelectedPassageNoteIntoView(updatedNote.id);
      return;
    }

    focusPassageNoteRange(updatedNote, { behavior: "smooth" });
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

  const note = {
    ...createPassageNote(scene, {
      selectedText: anchor.selectedText,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
      body,
      ...getCustomMetadataDefinitionFields(draft.noteType),
    }, draft.noteType),
    ...createOffsetAnchoredRecordEvidencePatch({
      text: getCurrentSceneEditorText(draft.sceneId, scene.editorText ?? ""),
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
    }),
  };

  anchoredRecordService.addPassageNote(note, {
    dirtyReason: `${note.noteType}-note-created`,
    source: "commitInlinePassageNote.create",
  });
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.inlinePassageDraft = null;
  maybeSuggestPassageNoteTitle(note);
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  renderConsolePanel();
  if (state.selectedSceneId === note.sceneId) {
    scrollSelectedPassageNoteIntoView(note.id);
    return;
  }

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
  state.inlinePassageDraft = updateInlinePassageDraftTypingState(draft, previous, nextText, {
    clampOffset: clampEditorOffset,
  });
}

function insertInlinePassageVerse(draft, verseText, editorText) {
  const insertion = planInlinePassageVerseInsertion(draft, verseText, editorText, {
    trimTextRange: manuscriptSelectionController.trimTextRange,
    clampOffset: clampEditorOffset,
  });
  if (!insertion) {
    return null;
  }

  updateSceneDraft(draft.sceneId, (sceneDraft) => {
    sceneDraft.editorText = insertion.editorText;
    sceneDraft.revisionStats = updateSceneRevisionStats(
      sceneDraft.revisionStats ?? draft.revisionStats,
      insertion.previousText,
      insertion.editorText,
    );
  });
  syncRevisionPanel(draft.sceneId);

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = insertion.editorText;
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), insertion.anchor.startOffset, insertion.anchor.endOffset, {
      focus: false,
      scroll: false,
    });
  }

  return insertion;
}

function getInlinePassageDraftAnchor(draft, editorText, options = {}) {
  return getInlinePassageDraftAnchorFromController(draft, editorText, {
    ...options,
    trimTextRange: manuscriptSelectionController.trimTextRange,
    clampOffset: clampEditorOffset,
  });
}

function updateInlinePassageDraftStatus(editorText) {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return;
  }

  const label = getPassageNoteDisplayLabel(draft.noteType);
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
  selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), offset, offset, {
    behavior: "auto",
    focus: true,
    scroll: true,
  });
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
  scrollSelectedPassageNoteIntoView(note.id);
  focusPassageNoteRange(note, { behavior: "smooth" });
}

function togglePassageNoteSelection(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return;
  }

  if (
    state.selectedPassageNoteId === note.id &&
    state.taskPreview?.taskId === note.id &&
    state.taskPreview.pinned
  ) {
    clearTaskAnchorPreview();
    renderConsolePanel();
    return;
  }

  selectPassageNote(note.id);
}

function selectPassageNoteFromEditorClick(clickTarget) {
  if (!isPassageNoteSidePanelMode(state.sidePanelMode)) {
    return false;
  }

  const textarea =
    clickTarget instanceof HTMLTextAreaElement &&
    clickTarget.classList.contains("editor-document-input")
      ? clickTarget
      : null;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const sceneId = textarea.dataset.sceneId;
  if (!sceneId) {
    return false;
  }

  if (clickTarget.selectionEnd <= clickTarget.selectionStart) {
    return false;
  }

  const note = anchoredRecordNavigationController.findRecordAtSelection({
    records: state.passageNotes.filter((candidate) => candidate.noteType === state.sidePanelMode),
    recordType: "passageNote",
    sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    text: textarea.value,
  });
  if (!note) {
    return false;
  }

  selectPassageNote(note.id);
  return true;
}

function selectTaskFromEditorClick(clickTarget) {
  if (!(clickTarget instanceof HTMLTextAreaElement) || !clickTarget.classList.contains("editor-document-input")) {
    return false;
  }

  const sceneId = clickTarget.dataset.sceneId;
  if (!sceneId) {
    return false;
  }

  if (clickTarget.selectionEnd <= clickTarget.selectionStart) {
    return false;
  }

  const task = anchoredRecordNavigationController.findRecordAtSelection({
    records: state.manuscriptTasks.filter((candidate) => candidate.status === "open"),
    recordType: "task",
    sceneId,
    selectionStart: clickTarget.selectionStart,
    selectionEnd: clickTarget.selectionEnd,
    text: clickTarget.value,
  });
  if (!task) {
    return false;
  }

  state.selectedTaskId = task.id;
  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
  return true;
}

function toggleTaskPreview(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return false;
  }

  if (state.taskPreview?.taskId === task.id && state.taskPreview.pinned) {
    clearTaskAnchorPreview();
    renderConsolePanel();
    return true;
  }

  state.selectedTaskId = task.id;
  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
  renderConsolePanel();
  return true;
}

function scrollSelectedPassageNoteIntoView(noteId) {
  window.requestAnimationFrame(() => {
    const item = document.querySelector(
      `.passage-note-item[data-note-id="${CSS.escape(noteId)}"]`,
    );
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: note,
    recordType: "passageNote",
    text: textarea.value,
  });
  if (!preview) {
    return;
  }

  const { startOffset } = preview.resolvedRange;
  const editorHost = resolveTextareaEditorHost(textarea);

  clearTaskAnchorPreview({ restoreSelection: false });

  state.taskPreview = {
    ...preview.previewSelection,
    wasFocused: true,
    pinned: true,
  };

  if (showTextareaAnchoredRecordPreview(editorHost, preview.projection)) {
    scrollTextareaEditorHostToOffset(editorHost, startOffset, options);
  }
}

function syncResolvedPassageNoteRange(note, resolvedRange) {
  if (!resolvedRange.matched) {
    return;
  }

  if (
    note.startOffset === resolvedRange.startOffset &&
    note.endOffset === resolvedRange.endOffset &&
    !hasResolvedAnchorRecordPatch(note, resolvedRange)
  ) {
    return;
  }

  anchoredRecordService.repairPassageNoteAnchor(note.id, resolvedRange, {
    dirtyReason: "passage-note-anchor-repaired",
    source: "syncResolvedPassageNoteRange",
  });
}

function hasResolvedAnchorRecordPatch(record, resolvedRange) {
  return Object.entries(resolvedRange?.recordPatch ?? {}).some(([key, value]) => record?.[key] !== value);
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
  state.spellcheckContextMenu = null;
  state.taskComposer = buildTaskComposerFromContextMenu(menu, {
    x: event.clientX,
    y: event.clientY,
  });
  renderTaskContextMenu();
}

// Intent: start a manual World Spine event tag from the same manuscript context range as tasks.
function openWorldSpineEventComposerFromContextMenu(event) {
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
  state.spellcheckContextMenu = null;
  state.inlinePassageDraft = null;
  state.taskComposer = buildWorldSpineEventComposerFromContextMenu(menu, {
    x: event.clientX,
    y: event.clientY,
  });
  renderTaskContextMenu();
  window.requestAnimationFrame(() => {
    const field = document.querySelector("[data-world-spine-event-label]");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    }
  });
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

  const task = buildTaskFromComposer({
    composer,
    scene,
    body,
    taskNumber: getNextTaskNumberForScene(scene.sceneId),
  });
  if (!task) {
    hideTaskSurfaces();
    return;
  }
  anchoredRecordService.addTask(task, {
    dirtyReason: "manuscript-task-created",
    source: "saveTaskFromComposer",
  });
  maybeSuggestTaskTitle(task);
  state.taskComposer = null;
  renderBinderPanel();
  renderConsolePanel();
  renderTaskContextMenu();
}

// Intent: persist a right-click World Spine event as an anchor-backed event tag.
function saveWorldSpineEventFromComposer() {
  const composer = state.taskComposer;
  if (!composer || composer.composerType !== "world-spine-event") {
    return;
  }

  const scene = getScene(composer.sceneId);
  const project = state.workspace?.project;
  if (!scene || !project) {
    hideTaskSurfaces();
    return;
  }

  const labelInput = document.querySelector("[data-world-spine-event-label]");
  const label = labelInput instanceof HTMLTextAreaElement ? labelInput.value.trim() : "";
  if (!label) {
    if (labelInput instanceof HTMLTextAreaElement) {
      labelInput.focus();
    }
    return;
  }

  const currentSequence = resolveWorldSpineEventSequence(project);
  const eventTag = buildWorldSpineEventTagFromComposer({
    composer,
    scene,
    label,
    projectId: project.id ?? state.activeProjectId ?? "",
    sequence: currentSequence,
    getSceneBlockRanges,
  });
  if (!eventTag) {
    hideTaskSurfaces();
    return;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  state.workspace.project = {
    ...project,
    eventTags: [...(Array.isArray(project.eventTags) ? project.eventTags : []), eventTag],
    sequences: {
      ...(project.sequences ?? {}),
      event: currentSequence + 1,
    },
    stats: {
      ...(project.stats ?? {}),
      eventCount: (Array.isArray(project.eventTags) ? project.eventTags.length : 0) + 1,
    },
  };
  state.selectedIssueId = null;
  setWorldSpineSelectedNodeId(`event:${eventTag.id}`);
  state.selectedBlockId = eventTag.blockId || state.selectedBlockId;
  state.taskComposer = null;
  persistCurrentProjectRecord({
    changedSceneIds: [scene.sceneId],
    domain: "world-spine-event-tags",
    dirtyReason: "world-spine-event-tag-created",
    source: "saveWorldSpineEventFromComposer",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Created World Spine event pin",
    dirtyReason: "world-spine-event-tag-created",
    source: "saveWorldSpineEventFromComposer",
  });
  render();
  syncSceneDocumentLayout();
}

function resolveWorldSpineEventSequence(project = {}) {
  const sequenceValue = Number(project?.sequences?.event);
  const sequenceFromState = Number.isFinite(sequenceValue) && sequenceValue >= 0
    ? Math.floor(sequenceValue)
    : 0;
  const sequenceFromIds = (Array.isArray(project?.eventTags) ? project.eventTags : []).reduce((highest, eventTag) => {
    const match = String(eventTag?.id ?? "").match(/^event-0*(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);

  return Math.max(sequenceFromState, sequenceFromIds);
}

// Intent: ask local AI for advisory titles without letting model output mutate structure silently.
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

  const result = await localAiTitleService.requestTitle({
    userInput: scene.editorText || scene.sceneSynopsis || scene.sceneTitle,
    manuscriptContext: [
      `Chapter: ${formatChapterDisplayTitle(scene.chapterTitle)}`,
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
  const request = buildTaskTitleRequest(task, {
    projectContext: state.projectTitle,
    formatChapterTitle: formatChapterDisplayTitle,
  });

  if (!request) {
    return;
  }

  localAiTitleService.requestTitle(request).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentTask = state.manuscriptTasks.find((candidate) => candidate.id === task.id);
    if (!canApplySuggestedRecordTitle(currentTask, fallbackTitle)) {
      return;
    }

    anchoredRecordService.updateTaskTitle(task.id, result.title, {
      dirtyReason: "manuscript-task-title-suggested",
      source: "maybeSuggestTaskTitle",
    });
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest task title", error));
}

function maybeSuggestPassageNoteTitle(note) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = note.title;
  const request = buildPassageNoteTitleRequest(note, {
    projectContext: state.projectTitle,
    formatChapterTitle: formatChapterDisplayTitle,
  });

  if (!request) {
    return;
  }

  localAiTitleService.requestTitle(request).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentNote = state.passageNotes.find((candidate) => candidate.id === note.id);
    if (!canApplySuggestedRecordTitle(currentNote, fallbackTitle)) {
      return;
    }

    anchoredRecordService.updatePassageNoteTitle(note.id, result.title, {
      dirtyReason: `${currentNote.noteType}-note-title-suggested`,
      source: "maybeSuggestPassageNoteTitle",
    });
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest passage note title", error));
}

function applySceneTitle(sceneId, title) {
  updateSceneDraft(sceneId, (draft) => {
    draft.sceneTitle = title;
  });
  updateSceneTitleLabel(sceneId, title);
  updateSceneEditorTitle(sceneId, title);
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
  anchoredRecordService.completeTask(taskId, {
    dirtyReason: "manuscript-task-completed",
    source: "completeTask",
  });
  renderBinderPanel();
  renderConsolePanel();
}

function hideTaskContextMenu() {
  if (!state.taskContextMenu && !state.binderContextMenu && !state.spellcheckContextMenu && !state.worldSpineContextMenu) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.worldSpineContextMenu = null;
  renderTaskContextMenu();
}

// Intent: let controls inside transient context surfaces receive focus or submit before generic document-click dismissal runs.
function isTaskContextMenuOwnedTarget(target) {
  return Boolean(
    target instanceof Element &&
    target.closest("[data-binder-menu], [data-world-spine-context-menu], [data-scene-world-spine-metadata-form], [data-world-spine-sublocation-form]"),
  );
}

function hideTaskSurfaces() {
  if (
    !state.taskContextMenu &&
    !state.binderContextMenu &&
    !state.spellcheckContextMenu &&
    !state.worldSpineContextMenu &&
    !state.taskComposer
  ) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.worldSpineContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
}

function hideWorldSpineContextMenu({ renderAfter = true } = {}) {
  if (!state.worldSpineContextMenu) {
    return;
  }

  state.worldSpineContextMenu = null;
  if (renderAfter) {
    renderTaskContextMenu();
  }
}

function hideBinderContextMenu() {
  if (!state.binderContextMenu && !state.spellcheckContextMenu) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  renderTaskContextMenu();
}

// Intent: keep hover and explicit context-menu spellcheck popups from fighting over shell state.
function openSpellcheckContextMenu(menu, source = "contextmenu") {
  if (!menu) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.taskComposer = null;
  state.binderContextMenu = null;
  state.taskContextMenu = null;
  state.spellcheckContextMenu = {
    ...menu,
    source: source === "hover" ? "hover" : "contextmenu",
  };
  renderTaskContextMenu();
}

function openBinderContextMenu(kind, identifiers, event) {
  if ((kind !== "chapter" && kind !== "scene") || !(event instanceof MouseEvent)) {
    return;
  }

  state.taskContextMenu = null;
  state.taskComposer = null;
  state.spellcheckContextMenu = null;
  state.binderContextMenu = {
    kind,
    chapterId: kind === "chapter" ? String(identifiers?.chapterId ?? "") : String(identifiers?.chapterId ?? ""),
    chapterTitle: String(identifiers?.chapterTitle ?? ""),
    sceneId: kind === "scene" ? String(identifiers?.sceneId ?? "") : String(identifiers?.sceneId ?? ""),
    sceneTitle: String(identifiers?.sceneTitle ?? ""),
    x: event.clientX,
    y: event.clientY,
    worldSpineMetadataOpen: false,
  };
  renderTaskContextMenu();
}

// Intent: let timeline detail cards open the same scene metadata editor used by the binder scene menu.
function openWorldSpineSceneMetadataEditor(sceneId = "", event = null) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const scene = getScene(normalizedSceneId);
  if (!scene) {
    return;
  }

  const eventTarget = event?.target instanceof Element ? event.target : null;
  const card = eventTarget?.closest("[data-world-spine-detail-card]");
  const cardRect = card instanceof HTMLElement ? card.getBoundingClientRect() : null;
  const fallbackX = event instanceof MouseEvent ? event.clientX : Math.round(window.innerWidth / 2);
  const fallbackY = event instanceof MouseEvent ? event.clientY : Math.round(window.innerHeight / 2);

  state.taskContextMenu = null;
  state.taskComposer = null;
  state.spellcheckContextMenu = null;
  state.binderContextMenu = {
    kind: "scene",
    chapterId: String(scene.chapterId ?? ""),
    chapterTitle: String(scene.chapterTitle ?? ""),
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle,
    x: Math.round(cardRect?.left ?? fallbackX),
    y: Math.round(cardRect?.top ?? fallbackY),
    worldSpineMetadataOpen: true,
  };
  worldSpineController.close();
  renderTaskContextMenu();
}

// Intent: expand the scene context menu into World Spine metadata fields without opening a permanent inspector.
function openSceneWorldSpineMetadataMenu(sceneId = "") {
  const normalizedSceneId = String(sceneId ?? state.binderContextMenu?.sceneId ?? "").trim();
  if (!normalizedSceneId || state.binderContextMenu?.kind !== "scene") {
    return;
  }

  state.binderContextMenu = {
    ...state.binderContextMenu,
    sceneId: normalizedSceneId,
    worldSpineMetadataOpen: true,
  };
  renderTaskContextMenu();
}

// Intent: collapse the World Spine metadata fields back to the compact scene menu.
function closeSceneWorldSpineMetadataMenu() {
  if (state.binderContextMenu?.kind !== "scene") {
    return;
  }

  state.binderContextMenu = {
    ...state.binderContextMenu,
    worldSpineMetadataOpen: false,
  };
  renderTaskContextMenu();
}

// Intent: persist scene-level World Spine metadata through scene drafts so timeline nodes can derive from it.
function saveSceneWorldSpineMetadataFromMenu(sceneId = "") {
  const normalizedSceneId = String(sceneId ?? state.binderContextMenu?.sceneId ?? "").trim();
  const scene = getScene(normalizedSceneId);
  if (!scene) {
    hideBinderContextMenu();
    return;
  }

  const form = document.querySelector(
    `[data-scene-world-spine-metadata-form][data-scene-id="${CSS.escape(normalizedSceneId)}"]`,
  );
  if (!(form instanceof HTMLElement)) {
    return;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  const existingDraft = state.sceneDrafts?.[normalizedSceneId] ?? createSceneDraft(scene);
  const previousMetadata = buildSceneWorldSpineMetadataMenuModel({
    scene,
    draft: existingDraft,
    expanded: true,
    customMetadataDefinitions: getCustomMetadataDefinitions(),
    pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
  }).metadata ?? {};
  const formMetadata = buildSceneWorldSpineMetadataFromFormValues(readSceneWorldSpineMetadataFormValues(form));
  const metadata = {
    ...formMetadata,
    locationRowLabel: previousMetadata.locationRowLabel,
    locationRowKey: previousMetadata.locationRowKey,
    locationScope: previousMetadata.locationScope,
  };
  state.sceneDrafts = {
    ...state.sceneDrafts,
    [normalizedSceneId]: applySceneWorldSpineMetadataToDraft(scene, existingDraft, metadata),
  };
  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
  state.binderContextMenu = null;
  persistCurrentProjectRecord({
    changedSceneIds: [normalizedSceneId],
    domain: "manuscript",
    dirtyReason: "world-spine-scene-metadata-updated",
    source: "saveSceneWorldSpineMetadataFromMenu",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Updated scene World Spine metadata",
    dirtyReason: "world-spine-scene-metadata-updated",
    source: "saveSceneWorldSpineMetadataFromMenu",
  });
  render();
}

function readSceneWorldSpineMetadataFormValues(form) {
  const values = {};
  form.querySelectorAll("[data-scene-world-spine-field]").forEach((field) => {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      values[field.dataset.sceneWorldSpineField] = field.value;
    }
  });
  return values;
}

// Intent: open timeline whitespace actions without mutating world records until a menu item is chosen.
function openWorldSpineWhitespaceContextMenu(context = null) {
  const menu = normalizeWorldSpineMenuContext(context);
  if (!menu) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  state.worldSpineContextMenu = menu;
  renderTaskContextMenu();
}

// Intent: expose reviewed implication edge actions from the line itself instead of persistent canvas chips.
function openWorldSpineImplicationContextMenu(context = null) {
  const menu = normalizeWorldSpineMenuContext({
    ...context,
    menuType: "implication",
  });
  if (!menu?.edgeId) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  state.worldSpineContextMenu = menu;
  renderTaskContextMenu();
}

// Intent: make catalogue-assignment menu controls respond before timeline click suppression can consume them.
function handleWorldSpineCatalogueAssignmentPointerDown(event, clickTarget = null) {
  if (event.button !== 0) {
    return false;
  }

  const target = clickTarget?.closest(
    '[data-action="world-spine-select-catalogue-assignment-category"], [data-action="world-spine-assign-catalogue-item"]',
  );
  if (!(target instanceof HTMLElement) || !target.closest("[data-world-spine-context-menu]")) {
    return false;
  }
  if (target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    event.stopPropagation();
    worldSpineAssignmentSuppressNextClick = true;
    return true;
  }

  event.preventDefault();
  event.stopPropagation();
  worldSpineAssignmentSuppressNextClick = true;

  if (target.dataset.action === "world-spine-select-catalogue-assignment-category") {
    selectWorldSpineCatalogueAssignmentCategoryFromContextMenu(target);
    return true;
  }

  if (target.dataset.action === "world-spine-assign-catalogue-item") {
    assignWorldSpineCatalogueItemFromContextMenu(target);
    return true;
  }

  return false;
}

// Intent: keep the selected assignment category searchable without changing the transient menu model.
function handleWorldSpineAssignmentFilterInput(event) {
  const input = event.target instanceof HTMLInputElement
    ? event.target
    : null;
  if (!input?.matches("[data-world-spine-assignment-filter]")) {
    return;
  }

  filterWorldSpineAssignmentItems(input);
}

// Intent: let authors type then move straight into the filtered assignment list from the active search field.
function handleWorldSpineAssignmentFilterKeyDown(event) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target?.closest("[data-world-spine-context-menu]")) {
    return;
  }

  if (target.matches("[data-world-spine-assignment-filter]") && event.key === "ArrowDown") {
    const firstItem = findNextVisibleWorldSpineAssignmentItem(target, 1);
    if (firstItem) {
      event.preventDefault();
      event.stopImmediatePropagation();
      firstItem.focus();
    }
    return;
  }

  if (!target.matches("[data-world-spine-assignment-item]")) {
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextItem = findNextVisibleWorldSpineAssignmentItem(target, direction);
    if (nextItem) {
      event.preventDefault();
      event.stopImmediatePropagation();
      nextItem.focus();
    }
    return;
  }

  if (event.key === "ArrowLeft") {
    const input = target
      .closest("[data-world-spine-assignment-items-pane]")
      ?.querySelector("[data-world-spine-assignment-filter]");
    if (input instanceof HTMLInputElement) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.focus();
    }
  }
}

// Intent: focus the selected category filter immediately after the right-side assignment pane renders.
function focusWorldSpineAssignmentFilterInput() {
  const input = document.querySelector("[data-world-spine-context-menu] [data-world-spine-assignment-filter]");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.focus();
  input.select();
  filterWorldSpineAssignmentItems(input);
}

// Intent: filter only the current right-side assignment pane so category selection remains transient.
function filterWorldSpineAssignmentItems(input) {
  const pane = input.closest("[data-world-spine-assignment-items-pane]");
  if (!(pane instanceof HTMLElement)) {
    return;
  }

  const query = normalizeWorldSpineAssignmentFilterText(input.value).toLowerCase();
  let visibleCount = 0;
  pane.querySelectorAll("[data-world-spine-assignment-item]").forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const searchText = normalizeWorldSpineAssignmentFilterText(
      item.dataset.worldSpineAssignmentSearchText || item.textContent || "",
    ).toLowerCase();
    const isVisible = !query || searchText.includes(query);
    item.hidden = !isVisible;
    item.setAttribute("aria-hidden", isVisible ? "false" : "true");
    if (isVisible) {
      visibleCount += 1;
    }
  });

  const empty = pane.querySelector("[data-world-spine-assignment-filter-empty]");
  if (empty instanceof HTMLElement) {
    empty.hidden = visibleCount > 0;
  }
}

// Intent: move keyboard focus through only the visible filtered assignment records.
function findNextVisibleWorldSpineAssignmentItem(target, direction = 1) {
  const pane = target.closest("[data-world-spine-assignment-items-pane]");
  if (!(pane instanceof HTMLElement)) {
    return null;
  }

  const items = Array.from(pane.querySelectorAll("[data-world-spine-assignment-item]"))
    .filter((item) => item instanceof HTMLElement && !item.hidden && !item.hasAttribute("disabled"));
  if (!items.length) {
    return null;
  }

  if (target.matches("[data-world-spine-assignment-filter]")) {
    return direction >= 0 ? items[0] : items[items.length - 1];
  }

  const currentIndex = items.indexOf(target);
  if (currentIndex < 0) {
    return direction >= 0 ? items[0] : items[items.length - 1];
  }

  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  return items[nextIndex] ?? null;
}

function normalizeWorldSpineAssignmentFilterText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

// Intent: expose manual catalogue assignment from event-like World Spine nodes without mutating records on right-click.
function openWorldSpineEventContextMenu(context = null) {
  const baseMenu = normalizeWorldSpineMenuContext({
    ...context,
    menuType: "event",
  });
  if (!baseMenu?.nodeId) {
    return;
  }

  const node = getWorldSpineTimelineNode(baseMenu.nodeId);
  if (!node || !isWorldSpineAssignableEventNodeForContext(node)) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  const assignmentModel = buildWorldSpineCatalogueAssignmentMenuModel({
    world: state.workspace?.world ?? {},
    node,
  });
  setWorldSpineSelectedNodeId(node.id);
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  state.worldSpineContextMenu = {
    ...baseMenu,
    nodeId: node.id,
    nodeTitle: node.title,
    nodeTypeLabel: node.typeLabel,
    nodeKind: node.kind,
    assignmentCategoryId: "",
    assignmentModel,
  };
  renderTaskContextMenu();
  renderDreamScapingPanel();
}

// Intent: switch the transient event assignment picker between catalogue categories without mutating world data.
function selectWorldSpineCatalogueAssignmentCategoryFromContextMenu(target = null) {
  const categoryId = String(target?.dataset?.worldSpineAssignmentCategoryId ?? "").trim();
  const menu = normalizeWorldSpineMenuContext(state.worldSpineContextMenu);
  const groups = Array.isArray(menu?.assignmentModel?.groups) ? menu.assignmentModel.groups : [];
  const categoryExists = groups.some((group) => String(group?.id ?? "").trim() === categoryId);
  if (!categoryId || menu?.menuType !== "event" || !categoryExists) {
    return;
  }

  state.worldSpineContextMenu = {
    ...state.worldSpineContextMenu,
    assignmentCategoryId: categoryId,
  };
  renderTaskContextMenu();
  window.requestAnimationFrame(focusWorldSpineAssignmentFilterInput);
}

// Intent: commit the selected catalogue item as a reviewed event presence link through the project persistence path.
function assignWorldSpineCatalogueItemFromContextMenu(target = null) {
  const menu = normalizeWorldSpineMenuContext(state.worldSpineContextMenu);
  const nodeId = String(target?.dataset?.worldSpineNodeId ?? menu?.nodeId ?? "").trim();
  const entityId = String(target?.dataset?.worldSpineCatalogueItemId ?? "").trim();
  const node = getWorldSpineTimelineNode(nodeId);
  if (!nodeId || !entityId || !node) {
    hideWorldSpineContextMenu();
    return;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  const result = applyWorldSpineCatalogueItemAssignmentToWorld(state.workspace?.world ?? {}, {
    nodeId,
    entityId,
    now: new Date(),
  });
  if (!result.changed) {
    state.worldbuildingStudioStatus = result.reason === "already-assigned"
      ? `"${result.entity?.name ?? "That catalogue item"}" is already assigned to "${node.title}".`
      : "That catalogue item could not be assigned to this event.";
    hideWorldSpineContextMenu({ renderAfter: false });
    renderTaskContextMenu();
    renderDreamScapingPanel();
    return;
  }

  state.workspace.world = result.world;
  setWorldSpineSelectedNodeId(nodeId);
  state.selectedEntityId = entityId;
  state.worldSpineScrollTargetNodeId = nodeId;
  state.worldbuildingStudioStatus = `"${result.entity.name}" assigned to "${node.title}".`;
  hideWorldSpineContextMenu({ renderAfter: false });
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "world-spine-catalogue-item-assigned",
    source: "assignWorldSpineCatalogueItemFromContextMenu",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Assigned World Spine catalogue item",
    dirtyReason: "world-spine-catalogue-item-assigned",
    source: "assignWorldSpineCatalogueItemFromContextMenu",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.catalogue-item.assigned", "Assigned catalogue item to World Spine event.", {
    nodeId,
    entityId,
  });
  renderTaskContextMenu();
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: pin the existing event-entry form to a concrete World Spine slot before the author saves it.
function openWorldSpineEventInsertionFromContextMenu(target = null) {
  const context = normalizeWorldSpineMenuContext({
    ...(state.worldSpineContextMenu ?? {}),
    dropIndex: target?.dataset?.worldSpineDropIndex ?? state.worldSpineContextMenu?.dropIndex,
    spineId: target?.dataset?.worldSpineId ?? state.worldSpineContextMenu?.spineId,
    tierIndex: target?.dataset?.worldSpineTierIndex ?? state.worldSpineContextMenu?.tierIndex,
    locationKey: target?.dataset?.worldSpineLocationKey ?? state.worldSpineContextMenu?.locationKey,
    locationLabel: target?.dataset?.worldSpineLocationLabel ?? state.worldSpineContextMenu?.locationLabel,
  });
  if (!context) {
    hideWorldSpineContextMenu();
    return;
  }

  state.worldSpineInsertionContext = context;
  state.worldSpineContextMenu = null;
  state.worldbuildingCatalogueCategoryId = "";
  state.worldbuildingCataloguePosition = null;
  state.worldbuildingCatalogueBounds = null;
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  clearWorldbuildingCatalogueEditState();
  state.worldbuildingStudioCategoryId = DEFAULT_WORLDBUILDING_CATEGORY_ID;
  const locationSuffix = context.locationLabel ? ` / ${context.locationLabel}` : "";
  state.worldbuildingStudioStatus = `Saving this event will place it on ${context.spineLabel}${locationSuffix}.`;
  renderTaskContextMenu();
  renderDreamScapingPanel();
  window.requestAnimationFrame(() => {
    syncWorldbuildingEntryPopoverPosition();
    const firstField = document.querySelector("[data-worldbuilding-studio-form] [data-worldbuilding-field]");
    if (firstField instanceof HTMLInputElement || firstField instanceof HTMLTextAreaElement) {
      firstField.focus();
    }
  });
}

// Intent: collect minimum locality and construction details before a new parallel timeline becomes durable world data.
function openParallelTimelineFormFromWorldSpineContextMenu() {
  const context = normalizeWorldSpineMenuContext(state.worldSpineContextMenu);
  if (!context) {
    hideWorldSpineContextMenu();
    return;
  }

  const contextLocation = String(context.locationLabel ?? "").trim();
  const initialLocation = contextLocation && contextLocation.toLowerCase() !== "unplaced location"
    ? contextLocation
    : "";
  state.worldSpineContextMenu = {
    ...context,
    menuType: "timeline-form",
    location: initialLocation,
    label: initialLocation ? `${initialLocation} Timeline` : "",
    thread: "",
    participants: "",
    startMarker: "",
    notes: "",
    error: "",
    pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
  };
  renderTaskContextMenu();
  window.requestAnimationFrame(focusWorldSpineParallelTimelineLocationField);
}

// Intent: turn a location-row chip click into a focused naming form instead of letting canvas pan consume it.
function openWorldSpineLocationRowFormFromLabel(target = null, event = null) {
  const label = target instanceof HTMLElement
    ? target.closest("[data-world-spine-location-row-label]")
    : null;
  if (!(label instanceof HTMLElement)) {
    return;
  }

  const rect = label.getBoundingClientRect();
  const existingLocation = String(label.dataset.worldSpineLocationLabel ?? "").trim();
  const isPrompt = label.dataset.worldSpineLocationRowPrompt === "true";
  const pointerX = Number(event?.clientX);
  state.worldSpineContextMenu = normalizeWorldSpineMenuContext({
    menuType: "location-form",
    x: Number.isFinite(pointerX) && pointerX > 0 ? pointerX : rect.left,
    y: Math.round(rect.bottom + 8),
    spineId: label.dataset.worldSpineId,
    spineLabel: label.dataset.worldSpineSpineLabel,
    tierIndex: label.dataset.worldSpineTierIndex,
    locationRowIndex: label.dataset.worldSpineLocationRowIndex,
    locationKey: label.dataset.worldSpineLocationKey,
    locationLabel: existingLocation,
    location: isPrompt ? "" : existingLocation,
    rowNodeIds: label.dataset.worldSpineRowNodeIds,
    rowSceneIds: label.dataset.worldSpineRowSceneIds,
    rowWorldNodeIds: label.dataset.worldSpineRowWorldNodeIds,
    isLocationRowPrompt: isPrompt,
    error: "",
    pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
  });
  renderTaskContextMenu();
  window.requestAnimationFrame(focusWorldSpineParallelTimelineLocationField);
}

function handleWorldSpineParallelTimelineFormSubmit(event) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.matches("[data-world-spine-sublocation-form]")) {
    event.preventDefault();
    saveWorldSpineSublocationFromComposer();
    return;
  }

  if (target?.matches("[data-worldbuilding-category-properties-form]")) {
    event.preventDefault();
    saveWorldbuildingCategoryProperties(target);
    return;
  }

  if (!target?.matches("[data-world-spine-parallel-timeline-form]")) {
    return;
  }

  event.preventDefault();
  if (target.dataset.worldSpineContextKind === "location-form") {
    saveWorldSpineLocationRowFromForm();
    return;
  }
  saveParallelTimelineFromWorldSpineForm();
}

// Intent: append a structured World Spine lane that the timeline renderer displays as another tier.
function saveParallelTimelineFromWorldSpineForm() {
  const form = document.querySelector("[data-world-spine-parallel-timeline-form]");
  if (!(form instanceof HTMLElement)) {
    return;
  }

  const values = readWorldSpineParallelTimelineFormValues(form);
  const location = String(values.location ?? "").trim();
  if (!location) {
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "timeline-form",
      ...values,
      error: "Location is required before creating a parallel timeline.",
    };
    renderTaskContextMenu();
    window.requestAnimationFrame(focusWorldSpineParallelTimelineLocationField);
    return;
  }

  const context = normalizeWorldSpineMenuContext(state.worldSpineContextMenu) ?? {};
  hideWorldSpineContextMenu({ renderAfter: false });
  const historyBefore = captureWorldSpineHistorySnapshot();
  const result = addParallelWorldSpine(state.workspace?.world ?? {}, {
    label: values.label || `${location} Timeline`,
    location,
    thread: values.thread,
    participants: values.participants,
    startMarker: values.startMarker,
    notes: values.notes,
    sourceContext: context,
    now: new Date(),
  });
  state.workspace.world = result.world;
  state.worldbuildingStudioStatus = `"${result.spine.label}" added as a new World Spine tier for ${location}.`;
  if (result.created) {
    persistCurrentProjectRecord({
      domain: "world",
      dirtyReason: "world-spine-parallel-timeline-added",
      source: "saveParallelTimelineFromWorldSpineForm",
    });
    pushWorldSpineHistoryChange(historyBefore, {
      label: "Added World Spine parallel timeline",
      dirtyReason: "world-spine-parallel-timeline-added",
      source: "saveParallelTimelineFromWorldSpineForm",
    });
  }
  renderTaskContextMenu();
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: persist a row-name edit to scene drafts or world spine records according to the row's source data.
function saveWorldSpineLocationRowFromForm() {
  const form = document.querySelector("[data-world-spine-parallel-timeline-form]");
  if (!(form instanceof HTMLElement)) {
    return;
  }

  const values = readWorldSpineParallelTimelineFormValues(form);
  const location = String(values.location ?? "").trim();
  if (!location) {
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "location-form",
      ...values,
      error: "Location is required before naming this timeline row.",
    };
    renderTaskContextMenu();
    window.requestAnimationFrame(focusWorldSpineParallelTimelineLocationField);
    return;
  }

  const context = normalizeWorldSpineMenuContext(state.worldSpineContextMenu) ?? {};
  const historyBefore = captureWorldSpineHistorySnapshot();
  const rowAssignment = createWorldSpineLocationRowAssignment(location, context);
  const changedSceneIds = applyWorldSpineLocationToSceneRows(context.sceneIds, location, context, rowAssignment);
  const shouldUpdateWorld = !context.sceneIds.length || context.worldNodeIds.length > 0;
  const worldResult = shouldUpdateWorld
    ? applyWorldSpineLocationRowNameToWorld(state.workspace?.world ?? {}, {
        spineId: context.spineId,
        worldNodeIds: context.worldNodeIds,
        location,
        now: new Date(),
      })
    : { world: state.workspace?.world ?? {}, changed: false };
  const rowNodeIds = context.primaryNodeIds.length
    ? context.primaryNodeIds
    : context.sceneIds.map((sceneId) => `scene:${sceneId}`);
  const placeLinkResult = applyWorldSpineLocationAssignmentToWorldPlaceLinks(worldResult.world, {
    nodeIds: rowNodeIds,
    sceneIds: context.sceneIds,
    assignment: rowAssignment,
  });
  const shouldUseWorldChange = shouldUpdateWorld && worldResult.changed;
  const shouldUsePlaceLinkChange = Boolean(placeLinkResult.changed);
  const changed = Boolean(changedSceneIds.length || shouldUseWorldChange || shouldUsePlaceLinkChange);
  if (!changed) {
    state.worldSpineContextMenu = null;
    state.worldbuildingStudioStatus = `"${location}" is already the location for this row.`;
    renderTaskContextMenu();
    renderWorldPanel();
    return;
  }

  if (shouldUseWorldChange) {
    state.workspace.world = worldResult.world;
  }
  if (shouldUsePlaceLinkChange) {
    state.workspace.world = placeLinkResult.world;
  }
  if (changedSceneIds.length) {
    writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
    writeStoredJsonRaw(EDITOR_STRUCTURE_KEY, state.structureDrafts);
    refreshScenes();
  }

  state.worldSpineContextMenu = null;
  state.worldbuildingStudioStatus = `Location row named "${location}".`;
  uiEventDispatcherLog.info("user-action", "world-spine.location-row.saved", "Saved World Spine location row assignment.", {
    location,
    contextSceneIds: context.sceneIds,
    contextWorldNodeIds: context.worldNodeIds,
    changedSceneIds,
    changedWorld: shouldUseWorldChange,
    changedPlaceLinks: shouldUsePlaceLinkChange,
    removedPlaceEntityLinkIds: placeLinkResult.removedEntityLinkIds,
    removedPlaceEntityIds: placeLinkResult.removedEntityIds,
    rowLocationKey: context.locationKey,
    rowLocationLabel: context.locationLabel,
    rowIndex: context.locationRowIndex,
  });
  persistCurrentProjectRecord({
    changedSceneIds,
    domain: changedSceneIds.length && (shouldUseWorldChange || shouldUsePlaceLinkChange) ? "world-spine" : changedSceneIds.length ? "manuscript" : "world",
    dirtyReason: "world-spine-location-row-named",
    source: "saveWorldSpineLocationRowFromForm",
    flushProjectFileAutosave: true,
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Named World Spine location row",
    dirtyReason: "world-spine-location-row-named",
    source: "saveWorldSpineLocationRowFromForm",
  });
  renderTaskContextMenu();
  if (changedSceneIds.length) {
    render();
    return;
  }
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: delete only the projected row by unplacing its members in one durable World Spine transaction.
function deleteWorldSpineLocationRowFromForm() {
  const context = normalizeWorldSpineMenuContext(state.worldSpineContextMenu) ?? {};
  const location = String(context.locationLabel ?? "").trim();
  if (!location || !isWorldSpineLocationRowDeleteEligible(context)) {
    hideWorldSpineContextMenu();
    return false;
  }

  const confirmed = window.confirm(
    `Delete location row "${location}"?\n\nEvents and manuscript scenes in this row will not be deleted.\nThey will move to Unplaced location until you assign them to another location.`,
  );
  if (!confirmed) {
    return false;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  const unplacedAssignment = createWorldSpineUnplacedLocationRowAssignment(context);
  const changedSceneIds = applyWorldSpineLocationToSceneRows(
    context.sceneIds,
    unplacedAssignment.location,
    context,
    unplacedAssignment,
    { unplace: true },
  );
  const worldResult = context.worldNodeIds.length
    ? applyWorldSpineLocationRowUnplacementToWorld(state.workspace?.world ?? {}, {
        spineId: context.spineId,
        worldNodeIds: context.worldNodeIds,
        now: new Date(),
      })
    : { world: state.workspace?.world ?? {}, changed: false };
  const rowNodeIds = context.primaryNodeIds.length
    ? context.primaryNodeIds
    : context.sceneIds.map((sceneId) => `scene:${sceneId}`);
  const placeLinkResult = applyWorldSpineLocationAssignmentToWorldPlaceLinks(worldResult.world, {
    nodeIds: rowNodeIds,
    sceneIds: context.sceneIds,
    assignment: unplacedAssignment,
  });
  const changed = Boolean(changedSceneIds.length || worldResult.changed || placeLinkResult.changed);
  if (!changed) {
    state.worldSpineContextMenu = null;
    state.worldbuildingStudioStatus = `Location row "${location}" is already unplaced.`;
    renderTaskContextMenu();
    renderWorldPanel();
    return false;
  }

  state.workspace.world = placeLinkResult.world;
  if (changedSceneIds.length) {
    writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
    writeStoredJsonRaw(EDITOR_STRUCTURE_KEY, state.structureDrafts);
    refreshScenes();
  }

  state.worldSpineContextMenu = null;
  state.worldbuildingStudioStatus = `Location row "${location}" deleted. Its events moved to Unplaced location.`;
  uiEventDispatcherLog.info("user-action", "world-spine.location-row.deleted", "Deleted World Spine location row by unplacing its members.", {
    location,
    changedSceneIds,
    changedWorldNodeIds: context.worldNodeIds,
    removedPlaceEntityLinkIds: placeLinkResult.removedEntityLinkIds,
    removedPlaceEntityIds: placeLinkResult.removedEntityIds,
  });
  persistCurrentProjectRecord({
    changedSceneIds,
    domain: changedSceneIds.length && (worldResult.changed || placeLinkResult.changed) ? "world-spine" : changedSceneIds.length ? "manuscript" : "world",
    dirtyReason: "world-spine-location-row-deleted",
    source: "deleteWorldSpineLocationRowFromForm",
    flushProjectFileAutosave: true,
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Deleted World Spine location row",
    dirtyReason: "world-spine-location-row-deleted",
    source: "deleteWorldSpineLocationRowFromForm",
  });
  renderTaskContextMenu();
  if (changedSceneIds.length) {
    render();
    return true;
  }
  renderDreamScapingPanel();
  renderWorldPanel();
  return true;
}

function applyWorldSpineLocationToSceneRows(
  sceneIds = [],
  location = "",
  context = {},
  assignment = null,
  { unplace = false } = {},
) {
  const changedSceneIds = [];
  const changedEventTagIds = [];
  const rowAssignment = assignment ?? createWorldSpineLocationRowAssignment(location, context);
  normalizeWorldSpineContextIdList(sceneIds).forEach((sceneId) => {
    const scene = getScene(sceneId);
    if (!scene) {
      return;
    }

    const existingDraft = mergeSceneDraftWithLoadedSceneStoreBody(
      sceneId,
      state.sceneDrafts?.[sceneId] ?? createSceneDraft(scene),
    );
    const metadataModel = buildSceneWorldSpineMetadataMenuModel({
      scene,
      draft: existingDraft,
      expanded: true,
      customMetadataDefinitions: getCustomMetadataDefinitions(),
      pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
    });
    const eventTagResult = state.workspace?.project
      ? (unplace ? applyWorldSpineUnplacementToSceneEventTags : applyWorldSpineLocationAssignmentToSceneEventTags)(
          state.workspace.project.eventTags,
          scene,
          rowAssignment,
        )
      : { eventTags: [], changedEventTagIds: [] };
    const structureResult = (unplace
      ? applyWorldSpineUnplacementToStructureDrafts
      : applyWorldSpineLocationAssignmentToStructureDrafts)(state.structureDrafts, sceneId, rowAssignment);
    const sceneStoreRecord = getWorldSpineLocationSceneStoreRecord(sceneId);
    const alreadyAssigned = (
      (unplace ? hasWorldSpineUnplacedLocationRowAssignment : hasWorldSpineLocationAssignment)(existingDraft, rowAssignment) &&
      (unplace ? hasWorldSpineUnplacedLocationRowAssignment : hasWorldSpineLocationAssignment)(scene, rowAssignment) &&
      Boolean(sceneStoreRecord && (unplace ? hasWorldSpineUnplacedLocationRowAssignment : hasWorldSpineLocationAssignment)(sceneStoreRecord, rowAssignment)) &&
      !structureResult.changed &&
      !eventTagResult.changedEventTagIds.length
    );
    if (alreadyAssigned) {
      return;
    }

    const patchedDraft = unplace
      ? applyWorldSpineUnplacementToSceneRecord(existingDraft, rowAssignment)
      : applySceneWorldSpineMetadataToDraft(scene, existingDraft, {
          ...metadataModel.metadata,
          location: rowAssignment.location,
          ...rowAssignment,
        });
    state.sceneDrafts = {
      ...state.sceneDrafts,
      [sceneId]: patchedDraft,
    };
    state.scenes = (Array.isArray(state.scenes) ? state.scenes : []).map((candidate) =>
      candidate?.sceneId === sceneId
        ? (unplace ? applyWorldSpineUnplacementToSceneRecord : applyWorldSpineLocationAssignmentToSceneRecord)(candidate, rowAssignment)
        : candidate
    );
    if (structureResult.changed) {
      state.structureDrafts = structureResult.structureDrafts;
    }
    if (state.workspace?.project) {
      if (eventTagResult.changedEventTagIds.length) {
        state.workspace.project = {
          ...state.workspace.project,
          eventTags: eventTagResult.eventTags,
        };
        changedEventTagIds.push(...eventTagResult.changedEventTagIds);
      }
    }
    state.loadedProjectSceneStore = (unplace
      ? upsertWorldSpineUnplacementInSceneStore
      : upsertWorldSpineLocationAssignmentInSceneStore)(state.loadedProjectSceneStore, {
      projectId: state.workspace?.project?.id ?? state.activeProjectId,
      sceneId,
      sceneRecord: patchedDraft,
      assignment: rowAssignment,
    });
    changedSceneIds.push(sceneId);
  });
  if (changedSceneIds.length) {
    uiEventDispatcherLog.info("state-change", "world-spine.location-row.scene-events-updated", "Updated scene-backed World Spine event locations.", {
      location: rowAssignment.location,
      locationRowKey: rowAssignment.locationRowKey,
      changedSceneIds,
      changedEventTagIds,
      contextSceneIds: normalizeWorldSpineContextIdList(sceneIds),
      contextLocationLabel: context?.locationLabel ?? "",
      contextLocationKey: context?.locationKey ?? "",
    });
  }
  return changedSceneIds;
}

function getWorldSpineLocationSceneStoreRecord(sceneId = "") {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const projectId = String(state.workspace?.project?.id ?? state.activeProjectId ?? "").trim();
  if (!normalizedSceneId || !projectId) {
    return null;
  }

  const projectSceneStore = state.loadedProjectSceneStore?.[projectId];
  if (!projectSceneStore || typeof projectSceneStore !== "object" || Array.isArray(projectSceneStore)) {
    return null;
  }

  const sceneRecord = projectSceneStore[normalizedSceneId];
  return sceneRecord && typeof sceneRecord === "object" && !Array.isArray(sceneRecord)
    ? sceneRecord
    : null;
}

function readWorldSpineParallelTimelineFormValues(form) {
  const values = {};
  form.querySelectorAll("[data-world-spine-parallel-timeline-field]").forEach((field) => {
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      values[field.dataset.worldSpineParallelTimelineField] = field.value;
    }
  });
  return values;
}

function focusWorldSpineParallelTimelineLocationField() {
  const input = document.querySelector(
    '[data-world-spine-parallel-timeline-field="location"]',
  );
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.focus();
  input.select();
}

function normalizeWorldSpineMenuContext(context = null) {
  if (!context || typeof context !== "object") {
    return null;
  }

  const rawMenuType = String(context.menuType ?? context.type ?? "whitespace").trim();
  const menuType = rawMenuType === "implication" || rawMenuType === "event" || rawMenuType === "timeline-form" || rawMenuType === "location-form"
    ? rawMenuType
    : "whitespace";
  const spineId = String(context.spineId ?? context.worldSpineId ?? "").trim() || "spine-0001";
  const spineLabel = String(context.spineLabel ?? "").trim() || "World Spine";
  const dropIndex = Math.max(0, Number.isFinite(Number(context.dropIndex)) ? Number(context.dropIndex) : 0);
  const tierIndex = Math.max(0, Number.isFinite(Number(context.tierIndex)) ? Number(context.tierIndex) : 0);
  const locationLabel = String(context.locationLabel ?? context.localityLabel ?? "").trim();
  const locationKey = String(context.locationKey ?? context.localityKey ?? "").trim();
  return {
    menuType,
    x: Math.max(0, Math.round(Number(context.x) || 0)),
    y: Math.max(0, Math.round(Number(context.y) || 0)),
    composerX: Math.max(0, Math.round(Number(context.composerX) || 0)),
    composerY: Math.max(0, Math.round(Number(context.composerY) || 0)),
    canvasX: Math.max(0, Math.round(Number(context.canvasX) || 0)),
    canvasY: Math.max(0, Math.round(Number(context.canvasY) || 0)),
    dropIndex,
    spineId,
    spineLabel,
    tierIndex,
    locationLabel,
    locationKey,
    locationRowIndex: Math.max(0, Number.isFinite(Number(context.locationRowIndex ?? context.localityRowIndex))
      ? Number(context.locationRowIndex ?? context.localityRowIndex)
      : 0),
    locationScope: String(context.locationScope ?? context.timelineLocationScope ?? "").trim(),
    primaryNodeIds: normalizeWorldSpineContextIdList(context.primaryNodeIds ?? context.rowNodeIds),
    sceneIds: normalizeWorldSpineContextIdList(context.sceneIds ?? context.rowSceneIds),
    worldNodeIds: normalizeWorldSpineContextIdList(context.worldNodeIds ?? context.rowWorldNodeIds),
    isLocationRowPrompt: context.isLocationRowPrompt === true || context.isLocationRowPrompt === "true",
    edgeId: String(context.edgeId ?? context.worldSpineEdgeId ?? "").trim(),
    label: normalizeWorldSpineImplicationText(context.label ?? context.effect),
    fromNodeId: String(context.fromNodeId ?? "").trim(),
    toNodeId: String(context.toNodeId ?? "").trim(),
    nodeId: String(context.nodeId ?? context.worldSpineNodeId ?? "").trim(),
    nodeTitle: String(context.nodeTitle ?? context.title ?? "").trim(),
    nodeTypeLabel: String(context.nodeTypeLabel ?? context.typeLabel ?? "").trim(),
    nodeKind: String(context.nodeKind ?? context.kind ?? "").trim(),
    location: String(context.location ?? "").trim(),
    thread: String(context.thread ?? context.purpose ?? "").trim(),
    participants: String(context.participants ?? context.keyActors ?? "").trim(),
    startMarker: String(context.startMarker ?? "").trim(),
    notes: String(context.notes ?? "").trim(),
    error: String(context.error ?? "").trim(),
    pickerOptionSets: context.pickerOptionSets && typeof context.pickerOptionSets === "object"
      ? context.pickerOptionSets
      : {},
    assignmentCategoryId: String(context.assignmentCategoryId ?? context.catalogueCategoryId ?? "").trim(),
    assignmentModel: context.assignmentModel && typeof context.assignmentModel === "object"
      ? context.assignmentModel
      : null,
  };
}

// Intent: open the Dream Scaping category catalogue without mutating structured world records.
function openWorldbuildingCatalogue(categoryId = "", position = null) {
  const normalizedCategoryId = String(categoryId ?? "").trim();
  if (!normalizedCategoryId) {
    return;
  }

  state.worldSpineInsertionContext = null;
  state.worldbuildingStudioCategoryId = "";
  clearWorldbuildingCatalogueEditState();
  state.worldbuildingStudioStatus = "";
  state.worldbuildingCatalogueCategoryId = normalizedCategoryId;
  const savedBounds = normalizeWorldbuildingCatalogueBounds(state.editorPrefs?.worldbuildingCatalogueBounds, {
    viewport: getWorldbuildingCatalogueViewport(),
  });
  state.worldbuildingCatalogueBounds = savedBounds;
  state.worldbuildingCataloguePosition = savedBounds
    ? { x: savedBounds.left, y: savedBounds.top }
    : clampWorldbuildingCataloguePosition(position);
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.opened", "Opened Dream Scaping category catalogue.", {
    categoryId: normalizedCategoryId,
  });
  renderDreamScapingPanel();
}

// Intent: close the temporary catalogue while leaving saved entities, categories, and event drafts intact.
function closeWorldbuildingCatalogue({ renderAfter = true } = {}) {
  if (!state.worldbuildingCatalogueCategoryId && !state.worldbuildingCatalogueSelectedItemId) {
    return;
  }

  const closedCategoryId = state.worldbuildingCatalogueCategoryId;
  worldbuildingCatalogueDragState = null;
  worldbuildingCatalogueResizeState = null;
  worldbuildingCatalogueSuppressNextClick = false;
  state.worldbuildingCatalogueCategoryId = "";
  state.worldbuildingCataloguePosition = null;
  state.worldbuildingCatalogueBounds = null;
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.closed", "Closed Dream Scaping category catalogue.", {
    categoryId: closedCategoryId,
  });
  if (renderAfter) {
    renderDreamScapingPanel();
  }
}

// Intent: show a detail pane for the selected catalogue row without changing world data.
function selectWorldbuildingCatalogueItem(itemId = "", itemKind = "") {
  const normalizedItemId = String(itemId ?? "").trim();
  if (!state.worldbuildingCatalogueCategoryId || !normalizedItemId) {
    return;
  }

  state.worldbuildingCatalogueSelectedItemId = normalizedItemId;
  state.worldbuildingCatalogueSelectedItemKind = String(itemKind ?? "").trim();
  uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.item-selected", "Selected Dream Scaping catalogue item detail.", {
    categoryId: state.worldbuildingCatalogueCategoryId,
    itemId: normalizedItemId,
    itemKind: state.worldbuildingCatalogueSelectedItemKind,
  });
  renderDreamScapingPanel();
}

// Intent: open the selected catalogue record in the reusable Dream Scaping form with stable edit identifiers.
function editWorldbuildingCatalogueItem(target = null) {
  const catalogueItem = resolveWorldbuildingCatalogueActionItem(target);
  const editState = createWorldbuildingCatalogueEditFormState(state.workspace?.world ?? {}, catalogueItem);
  if (!editState.categoryId) {
    state.worldbuildingStudioStatus = "That catalogue item cannot be edited from this menu.";
    renderDreamScapingPanel();
    return;
  }

  state.worldSpineInsertionContext = null;
  state.worldbuildingStudioCategoryId = editState.categoryId;
  state.worldbuildingEditingCatalogueItemId = editState.itemId;
  state.worldbuildingEditingCatalogueItemKind = editState.itemKind;
  state.worldbuildingCatalogueCategoryId = "";
  state.worldbuildingCataloguePosition = null;
  state.worldbuildingCatalogueBounds = null;
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  state.worldbuildingStudioStatus = "";
  uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.item-edit-opened", "Opened Dream Scaping catalogue item edit form.", {
    categoryId: editState.categoryId,
    itemId: editState.itemId,
    itemKind: editState.itemKind,
  });
  renderDreamScapingPanel();
  requestAnimationFrame(() => {
    const firstField = document.querySelector("[data-worldbuilding-studio-form] [data-worldbuilding-field]");
    if (firstField instanceof HTMLElement) {
      firstField.focus();
    }
  });
}

// Intent: delete a selected catalogue record through the feature-owned world mutation path and persist the result.
function deleteWorldbuildingCatalogueItem(target = null) {
  const catalogueItem = resolveWorldbuildingCatalogueActionItem(target);
  const historyBefore = captureWorldSpineHistorySnapshot();
  const result = deleteWorldbuildingCatalogueItemFromWorld(state.workspace?.world ?? {}, catalogueItem);
  if (!result.changed) {
    state.worldbuildingStudioStatus = "That catalogue item could not be deleted.";
    renderDreamScapingPanel();
    return;
  }

  state.workspace.world = result.world;
  state.worldSpineInsertionContext = null;
  state.worldbuildingStudioCategoryId = "";
  clearWorldbuildingCatalogueEditState();
  state.worldbuildingCatalogueSelectedItemId = "";
  state.worldbuildingCatalogueSelectedItemKind = "";
  if (state.selectedEntityId === result.item?.id) {
    state.selectedEntityId = null;
  }

  const title = String(result.item?.title ?? "Catalogue item").trim() || "Catalogue item";
  state.worldbuildingStudioStatus = `"${title}" deleted from the world catalogue.`;
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "worldbuilding-catalogue-item-deleted",
    source: "deleteWorldbuildingCatalogueItem",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: result.item?.itemKind === "eventDraft"
      ? "Deleted World Spine event draft"
      : "Deleted World Spine catalogue item",
    dirtyReason: "worldbuilding-catalogue-item-deleted",
    source: "deleteWorldbuildingCatalogueItem",
  });
  uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.item-deleted", "Deleted Dream Scaping catalogue item.", {
    itemId: result.item?.id,
    itemKind: result.item?.itemKind,
  });
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: commit category-level Location semantics so catalogue classes can drive World Spine hierarchy.
function saveWorldbuildingCategoryProperties(target = null) {
  const form = target instanceof HTMLElement
    ? target.closest("[data-worldbuilding-category-properties-form]")
    : null;
  const categoryId = String(
    target?.dataset?.worldbuildingCategoryId ??
      form?.dataset?.worldbuildingCategoryId ??
      state.worldbuildingCatalogueCategoryId ??
      "",
  ).trim();
  const locationRole = String(
    form?.querySelector('[data-worldbuilding-category-property="locationRole"]')?.value ?? "",
  ).trim();
  const historyBefore = captureWorldSpineHistorySnapshot();
  const result = applyWorldbuildingCategoryLocationRoleToWorld(state.workspace?.world ?? {}, {
    categoryId,
    locationRole,
    now: new Date(),
  });
  if (!result.changed) {
    state.worldbuildingStudioStatus = categoryId
      ? `${formatWorldbuildingCategoryLocationRoleLabel(locationRole)} is already saved for this catalogue class.`
      : "Choose a catalogue class before saving properties.";
    renderDreamScapingPanel();
    return;
  }

  state.workspace.world = result.world;
  state.worldbuildingStudioStatus = `${formatWorldbuildingCategoryLocationRoleLabel(result.locationRole)} saved for ${result.categoryId}.`;
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "worldbuilding-category-location-role-updated",
    source: "saveWorldbuildingCategoryProperties",
    flushProjectFileAutosave: true,
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Updated World Spine category properties",
    dirtyReason: "worldbuilding-category-location-role-updated",
    source: "saveWorldbuildingCategoryProperties",
  });
  uiEventDispatcherLog.info("user-action", "worldbuilding.category-properties.saved", "Saved Dream Scaping catalogue category properties.", {
    categoryId: result.categoryId,
    locationRole: result.locationRole,
  });
  renderDreamScapingPanel();
  renderWorldPanel();
}

function formatWorldbuildingCategoryLocationRoleLabel(locationRole = "") {
  const normalizedRole = String(locationRole ?? "").trim();
  if (normalizedRole === "main-location") {
    return "Main location";
  }
  if (normalizedRole === "child-location") {
    return "Child location";
  }
  return "Catalogue only";
}

// Intent: persist the selected World Spine RHS mode as project UI state without touching world data.
function setWorldSpineRightPaneMode(mode = "") {
  const nextMode = normalizeWorldSpineRightPaneMode(mode);
  if (state.worldSpineRightPaneMode === nextMode) {
    return;
  }

  state.worldSpineRightPaneMode = nextMode;
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "world-spine-right-pane-mode-updated",
    source: "setWorldSpineRightPaneMode",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.right-pane-mode.changed", "Changed World Spine right pane mode.", {
    mode: nextMode,
  });
  renderWorldPanel();
}

// Intent: persist dock presentation without creating a canonical World Spine history entry.
function toggleWorldSpineUnplacedDock() {
  state.worldSpineUnplacedDockCollapsed = !state.worldSpineUnplacedDockCollapsed;
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: state.worldSpineUnplacedDockCollapsed
      ? "world-spine-unplaced-dock-collapsed"
      : "world-spine-unplaced-dock-expanded",
    source: "toggleWorldSpineUnplacedDock",
  });
  renderWorldPanel();
}

// Intent: keep the location checklist as render-only World Spine view state, separate from world timeline records.
function toggleWorldSpineLocationFilterPane() {
  state.worldSpineLocationFilterOpen = !state.worldSpineLocationFilterOpen;
  renderWorldPanel();
}

function updateWorldSpineLocationFilter(locationKey = "", checked = true) {
  const model = buildWorldSpineModelForState();
  state.worldSpineLocationFilter = updateWorldSpineLocationFilterSelection({
    timeline: model.timeline,
    filterState: state.worldSpineLocationFilter,
    locationKey,
    checked,
  });
  queueWorldSpineLocationFilterFocus(model);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "world-spine-location-filter-updated",
    source: "updateWorldSpineLocationFilter",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.location-filter.changed", "Changed World Spine location filter.", {
    selectedLocationKeys: state.worldSpineLocationFilter.selectedLocationKeys,
  });
  renderWorldPanel();
}

function clearWorldSpineLocationFilter() {
  state.worldSpineLocationFilter = clearWorldSpineLocationFilterSelection();
  state.worldSpineScrollTargetLocationKey = "";
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "world-spine-location-filter-cleared",
    source: "clearWorldSpineLocationFilter",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.location-filter.cleared", "Cleared World Spine location filter.", {});
  renderWorldPanel();
}

function queueWorldSpineLocationFilterFocus(model = buildWorldSpineModelForState()) {
  const filterModel = buildWorldSpineLocationFilterModel(model.timeline, state.worldSpineLocationFilter);
  state.worldSpineScrollTargetLocationKey = filterModel.active && filterModel.singleLocationKey
    ? filterModel.singleLocationKey
    : "";
}

// Intent: keep RHS related cards compact until the author explicitly opens one item for detail.
function toggleWorldSpineRelatedCard(target = null) {
  const nextKey = resolveWorldSpineRelatedCardKeyFromTarget(target);
  if (!nextKey) {
    return;
  }

  state.worldSpineRelatedCardExpandedKey = state.worldSpineRelatedCardExpandedKey === nextKey
    ? ""
    : nextKey;
  renderWorldPanel();
}

function resolveWorldSpineRelatedCardKeyFromTarget(target = null) {
  const explicitKey = String(target?.dataset?.worldSpineRelatedCardKey ?? "").trim();
  if (explicitKey) {
    return explicitKey;
  }

  const itemId = String(target?.dataset?.worldbuildingCatalogueItemId ?? "").trim();
  const itemKind = String(target?.dataset?.worldbuildingCatalogueItemKind ?? "").trim();
  return itemId && itemKind ? `${itemKind}:${itemId}` : "";
}

// Intent: open a focused RHS form for adding a precise place under the selected event's current location row.
function openWorldSpineSublocationComposer(target = null) {
  const nodeId = String(target?.dataset?.worldSpineNodeId ?? state.selectedNodeId ?? "").trim();
  const node = getWorldSpineTimelineNode(nodeId);
  if (!node) {
    return;
  }

  setWorldSpineSelectedNodeId(node.id);
  state.worldSpineRightPaneMode = normalizeWorldSpineRightPaneMode("related-cards");
  state.worldSpineSublocationComposer = {
    nodeId: node.id,
    sceneId: String(target?.dataset?.sceneId ?? node.sceneId ?? "").trim(),
    location: String(target?.dataset?.worldSpineLocationLabel ?? node.locationRowLabel ?? node.location ?? "").trim(),
    sublocation: "",
    error: "",
  };
  renderWorldPanel();
  window.requestAnimationFrame(focusWorldSpineSublocationComposerInput);
}

function closeWorldSpineSublocationComposer({ renderAfter = true } = {}) {
  if (!state.worldSpineSublocationComposer) {
    return;
  }

  state.worldSpineSublocationComposer = null;
  if (renderAfter) {
    renderWorldPanel();
  }
}

// Intent: commit the RHS child location as both event metadata and reviewed catalogue presence.
function saveWorldSpineSublocationFromComposer() {
  const composer = state.worldSpineSublocationComposer && typeof state.worldSpineSublocationComposer === "object"
    ? state.worldSpineSublocationComposer
    : {};
  const form = document.querySelector("[data-world-spine-sublocation-form]");
  const nodeId = String(form?.dataset?.worldSpineNodeId ?? composer.nodeId ?? state.selectedNodeId ?? "").trim();
  const node = getWorldSpineTimelineNode(nodeId);
  if (!node) {
    closeWorldSpineSublocationComposer();
    return;
  }

  const sublocation = normalizeWorldSpineSublocationInput(
    form?.querySelector('[data-world-spine-sublocation-field="sublocation"]')?.value ?? composer.sublocation,
  );
  const location = normalizeWorldSpineSublocationInput(
    form?.dataset?.worldSpineLocationLabel ??
      composer.location ??
      node.locationRowLabel ??
      node.coreLocationLabel ??
      node.location,
  );
  if (!sublocation) {
    state.worldSpineSublocationComposer = {
      ...composer,
      nodeId,
      location,
      error: "Enter a child location name.",
    };
    renderWorldPanel();
    window.requestAnimationFrame(focusWorldSpineSublocationComposerInput);
    return;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  const worldResult = applyWorldSpineEventSublocationToWorld(state.workspace?.world ?? {}, {
    nodeId,
    location,
    childLocation: sublocation,
    sublocation,
    orbitalBand: node.orbitalBand,
    now: new Date(),
  });
  const sceneResult = applyWorldSpineSublocationToSceneDraft(node, {
    location,
    sublocation,
  });
  if (!worldResult.changed && !sceneResult.changed) {
    state.worldSpineSublocationComposer = {
      ...composer,
      nodeId,
      location,
      sublocation,
      error: `"${sublocation}" is already attached to this event.`,
    };
    renderWorldPanel();
    window.requestAnimationFrame(focusWorldSpineSublocationComposerInput);
    return;
  }

  state.workspace.world = worldResult.world;
  if (sceneResult.changed) {
    state.sceneDrafts = sceneResult.sceneDrafts;
    writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
    refreshScenes();
  }
  setWorldSpineSelectedNodeId(nodeId);
  state.selectedEntityId = worldResult.entity?.id ?? state.selectedEntityId;
  state.worldSpineScrollTargetNodeId = nodeId;
  state.worldSpineSublocationComposer = null;
  state.worldbuildingStudioStatus = `"${sublocation}" added as a child location for "${node.title}".`;
  persistCurrentProjectRecord({
    changedSceneIds: sceneResult.changedSceneIds,
    domain: worldResult.changed ? "world" : "manuscript",
    dirtyReason: "world-spine-event-sublocation-added",
    source: "saveWorldSpineSublocationFromComposer",
    flushProjectFileAutosave: true,
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Added World Spine event child location",
    dirtyReason: "world-spine-event-sublocation-added",
    source: "saveWorldSpineSublocationFromComposer",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.event-sublocation.added", "Added child location to World Spine event.", {
    nodeId,
    location,
    sublocation,
    entityId: worldResult.entity?.id,
    sceneIds: sceneResult.changedSceneIds,
  });
  renderDreamScapingPanel();
  renderWorldPanel();
}

function applyWorldSpineSublocationToSceneDraft(node = {}, {
  location = "",
  sublocation = "",
} = {}) {
  const sceneId = String(node?.sceneId ?? "").trim();
  const scene = sceneId ? getScene(sceneId) : null;
  if (!scene) {
    return {
      sceneDrafts: state.sceneDrafts,
      changed: false,
      changedSceneIds: [],
    };
  }

  const existingDraft = state.sceneDrafts?.[sceneId] ?? createSceneDraft(scene);
  const previousMetadata = buildSceneWorldSpineMetadataMenuModel({
    scene,
    draft: existingDraft,
    expanded: true,
    customMetadataDefinitions: getCustomMetadataDefinitions(),
    pickerOptionSets: getWorldSpinePickerOptionSetsForState(),
  }).metadata ?? {};
  const metadata = {
    ...previousMetadata,
    location: location || previousMetadata.location,
    childLocation: sublocation,
    childLocationLabel: sublocation,
    sublocation,
    orbitalBand: previousMetadata.orbitalBand || node.orbitalBand,
    locationRowLabel: previousMetadata.locationRowLabel || node.locationRowLabel || location,
    locationRowKey: previousMetadata.locationRowKey || node.locationRowKey,
    locationScope: previousMetadata.locationScope || node.locationScope,
  };
  const nextDraft = applySceneWorldSpineMetadataToDraft(scene, existingDraft, metadata);
  if (JSON.stringify(nextDraft) === JSON.stringify(existingDraft)) {
    return {
      sceneDrafts: state.sceneDrafts,
      changed: false,
      changedSceneIds: [],
    };
  }

  return {
    sceneDrafts: {
      ...state.sceneDrafts,
      [sceneId]: nextDraft,
    },
    changed: true,
    changedSceneIds: [sceneId],
  };
}

function focusWorldSpineSublocationComposerInput() {
  const input = document.querySelector('[data-world-spine-sublocation-field="sublocation"]');
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.focus();
  input.select();
}

function normalizeWorldSpineSublocationInput(value = "") {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

// Intent: attach author-provided reference imagery to catalogue records through the world persistence boundary.
async function attachWorldbuildingCatalogueImage(target = null) {
  const catalogueItem = resolveWorldbuildingCatalogueActionItem(target);
  if (!catalogueItem.itemId || !catalogueItem.itemKind) {
    return;
  }

  const file = await promptForWorldbuildingCatalogueImageFile();
  if (!file) {
    return;
  }

  const validationError = validateWorldbuildingCatalogueImageFile(file);
  if (validationError) {
    state.worldbuildingStudioStatus = formatWorldbuildingCatalogueImageUploadError(validationError);
    renderDreamScapingPanel();
    renderWorldPanel();
    return;
  }

  try {
    const image = await createWorldbuildingCatalogueImageRecordFromFile(file, {
      itemId: catalogueItem.itemId,
      itemKind: catalogueItem.itemKind,
      title: catalogueItem.itemId,
    });
    if (!image) {
      state.worldbuildingStudioStatus = "Choose a PNG, JPG, WebP, or GIF image under the catalogue image limit.";
      renderDreamScapingPanel();
      renderWorldPanel();
      return;
    }

    const historyBefore = captureWorldSpineHistorySnapshot();
    const result = applyWorldbuildingCatalogueItemImageToWorld(state.workspace?.world ?? {}, {
      ...catalogueItem,
      image,
      now: new Date(),
    });
    if (!result.changed) {
      state.worldbuildingStudioStatus = "That catalogue image could not be attached.";
      renderDreamScapingPanel();
      renderWorldPanel();
      return;
    }

    state.workspace.world = result.world;
    state.worldbuildingCatalogueSelectedItemId = result.item?.id ?? state.worldbuildingCatalogueSelectedItemId;
    state.worldbuildingCatalogueSelectedItemKind = result.item?.itemKind ?? state.worldbuildingCatalogueSelectedItemKind;
    state.worldbuildingStudioStatus = `"${result.item?.title ?? "Catalogue item"}" image attached.`;
    persistCurrentProjectRecord({
      domain: "world",
      dirtyReason: "worldbuilding-catalogue-item-image-attached",
      source: "attachWorldbuildingCatalogueImage",
    });
    pushWorldSpineHistoryChange(historyBefore, {
      label: "Attached World Spine catalogue image",
      dirtyReason: "worldbuilding-catalogue-item-image-attached",
      source: "attachWorldbuildingCatalogueImage",
    });
    uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.image-attached", "Attached image to Dream Scaping catalogue item.", {
      itemId: result.item?.id,
      itemKind: result.item?.itemKind,
      imageSize: result.image?.size ?? 0,
    });
    renderDreamScapingPanel();
    renderWorldPanel();
  } catch (error) {
    state.worldbuildingStudioStatus = "That catalogue image could not be read.";
    uiEventDispatcherLog.warn("user-action", "worldbuilding.catalogue.image-read-failed", "Failed to read catalogue image upload.", {
      itemId: catalogueItem.itemId,
      itemKind: catalogueItem.itemKind,
      error,
    });
    renderDreamScapingPanel();
    renderWorldPanel();
  }
}

// Intent: assign row-level location artwork through catalogue-backed Location entities and project persistence.
async function attachWorldSpineLocationRowImage(target = null) {
  const form = document.querySelector("[data-world-spine-parallel-timeline-form]");
  const formValues = form instanceof HTMLElement ? readWorldSpineParallelTimelineFormValues(form) : {};
  const menu = normalizeWorldSpineMenuContext(state.worldSpineContextMenu) ?? {};
  const location = String(
    formValues.location ??
    target?.dataset?.worldSpineLocationLabel ??
    menu.location ??
    menu.locationLabel ??
    "",
  ).trim();

  if (!location) {
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "location-form",
      ...formValues,
      error: "Name the location before attaching an image.",
    };
    renderTaskContextMenu();
    window.requestAnimationFrame(focusWorldSpineParallelTimelineLocationField);
    return;
  }

  const file = await promptForWorldbuildingCatalogueImageFile();
  if (!file) {
    return;
  }

  const validationError = validateWorldbuildingCatalogueImageFile(file);
  if (validationError) {
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "location-form",
      ...formValues,
      location,
      error: formatWorldbuildingCatalogueImageUploadError(validationError),
    };
    renderTaskContextMenu();
    renderDreamScapingPanel();
    renderWorldPanel();
    return;
  }

  try {
    const image = await createWorldbuildingCatalogueImageRecordFromFile(file, {
      itemId: location,
      itemKind: "location",
      title: location,
    });
    if (!image) {
      state.worldSpineContextMenu = {
        ...(state.worldSpineContextMenu ?? {}),
        menuType: "location-form",
        ...formValues,
        location,
        error: "Choose a PNG, JPG, WebP, or GIF image under the catalogue image limit.",
      };
      renderTaskContextMenu();
      renderDreamScapingPanel();
      renderWorldPanel();
      return;
    }

    const historyBefore = captureWorldSpineHistorySnapshot();
    const result = applyWorldSpineLocationImageToWorld(state.workspace?.world ?? {}, {
      location,
      image,
      now: new Date(),
    });
    if (!result.changed) {
      state.worldSpineContextMenu = {
        ...(state.worldSpineContextMenu ?? {}),
        menuType: "location-form",
        ...formValues,
        location,
        error: "That location image could not be attached.",
      };
      renderTaskContextMenu();
      renderDreamScapingPanel();
      renderWorldPanel();
      return;
    }

    state.workspace.world = result.world;
    state.worldbuildingStudioStatus = `"${result.item?.title ?? location}" image attached.`;
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "location-form",
      ...formValues,
      location,
      error: "",
    };
    persistCurrentProjectRecord({
      domain: "world",
      dirtyReason: "world-spine-location-image-attached",
      source: "attachWorldSpineLocationRowImage",
    });
    pushWorldSpineHistoryChange(historyBefore, {
      label: "Attached World Spine location image",
      dirtyReason: "world-spine-location-image-attached",
      source: "attachWorldSpineLocationRowImage",
    });
    uiEventDispatcherLog.info("user-action", "world-spine.location-image.attached", "Attached image to World Spine location row.", {
      location,
      itemId: result.item?.id,
      imageSize: result.image?.size ?? 0,
    });
    renderTaskContextMenu();
    renderDreamScapingPanel();
    renderWorldPanel();
  } catch (error) {
    state.worldSpineContextMenu = {
      ...(state.worldSpineContextMenu ?? {}),
      menuType: "location-form",
      ...formValues,
      location,
      error: "That location image could not be read.",
    };
    uiEventDispatcherLog.warn("user-action", "world-spine.location-image.read-failed", "Failed to read World Spine location image upload.", {
      location,
      error,
    });
    renderTaskContextMenu();
    renderDreamScapingPanel();
    renderWorldPanel();
  }
}

// Intent: persist worldbuilding image uploads as local project media references instead of inline project JSON data.
async function createWorldbuildingCatalogueImageRecordFromFile(file, {
  itemId = "",
  itemKind = "",
  title = "",
} = {}) {
  if (!file) {
    return null;
  }

  const projectId = state.activeProjectId ?? state.workspace?.project?.id ?? "project";
  const mediaPlan = buildWorldbuildingCatalogueImageMediaPath({
    projectFilePath: state.projectFilePath,
    projectRoot: state.workspace?.settings?.projectRoot ?? "",
    projectId,
    itemKind,
    itemId,
    title,
    fileName: file.name,
    mediaType: file.type,
    nowMs: Date.now(),
  });
  const contentBase64 = await readFileAsBase64(file);
  const saveResponse = await fetchJsonFromDesktopApi("/api/project-media/save", {
    method: "POST",
    body: {
      filePath: mediaPlan.mediaPath,
      contentBase64,
    },
  });
  if (!saveResponse.ok) {
    throw saveResponse.error ?? new Error("Unable to save the catalogue image file.");
  }

  const savedMediaPath = typeof saveResponse.value?.filePath === "string" && saveResponse.value.filePath.trim()
    ? saveResponse.value.filePath.trim()
    : mediaPlan.mediaPath;
  return normalizeWorldbuildingCatalogueImage({
    mediaPath: savedMediaPath,
    projectRelativePath: mediaPlan.projectRelativePath,
    mediaType: file.type,
    name: file.name,
    size: file.size,
  });
}

function promptForWorldbuildingCatalogueImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    let settled = false;
    const settle = (file = null) => {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener("focus", handleWindowFocus);
      input.remove();
      resolve(file);
    };
    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) {
          settle(null);
        }
      }, 250);
    };
    input.type = "file";
    input.accept = WORLDBUILDING_CATALOGUE_IMAGE_ACCEPT;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      settle(file);
    }, { once: true });
    input.addEventListener("cancel", () => settle(null), { once: true });
    document.body.append(input);
    window.addEventListener("focus", handleWindowFocus);
    input.click();
  });
}

// Intent: keep catalogue image validation messages compact for icon-sized actions and RHS cards.
function formatWorldbuildingCatalogueImageUploadError(errorCode) {
  if (errorCode === "image-too-large") {
    return `Choose an image under ${Math.round(WORLDBUILDING_CATALOGUE_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`;
  }

  if (errorCode === "image-empty") {
    return "Choose a non-empty image file for the catalogue item.";
  }

  return "Choose a PNG, JPG, WebP, or GIF image for the catalogue item.";
}

function resolveWorldbuildingCatalogueActionItem(target = null) {
  const element = target instanceof HTMLElement
    ? target
    : null;
  const detail = element?.closest("[data-worldbuilding-catalogue-detail]") ?? null;
  return {
    itemId: String(
      element?.dataset?.worldbuildingCatalogueItemId ??
      detail?.dataset?.worldbuildingCatalogueDetailItemId ??
      "",
    ).trim(),
    itemKind: String(
      element?.dataset?.worldbuildingCatalogueItemKind ??
      detail?.dataset?.worldbuildingCatalogueDetailItemKind ??
      "",
    ).trim(),
  };
}

function clearWorldbuildingCatalogueEditState() {
  state.worldbuildingEditingCatalogueItemId = "";
  state.worldbuildingEditingCatalogueItemKind = "";
}

// Intent: let authors reposition the catalogue inspector and remember the preferred floating bounds.
function beginWorldbuildingCatalogueDrag(handle, event) {
  if (!(handle instanceof HTMLElement) || event?.button !== 0 || !state.worldbuildingCatalogueCategoryId) {
    return;
  }

  const catalogue = handle.closest("[data-worldbuilding-catalogue]");
  if (!(catalogue instanceof HTMLElement)) {
    return;
  }

  const rect = catalogue.getBoundingClientRect();
  const pointerX = Number(event.clientX);
  const pointerY = Number(event.clientY);
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return;
  }

  worldbuildingCatalogueDragState = {
    pointerId: Number(event.pointerId),
    handle,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    offsetX: pointerX - rect.left,
    offsetY: pointerY - rect.top,
    startX: pointerX,
    startY: pointerY,
    hasMoved: false,
  };
  catalogue.classList.add("is-dragging");
  if (Number.isFinite(Number(event.pointerId)) && typeof handle.setPointerCapture === "function") {
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; document-level listeners still carry the drag.
    }
  }
  event.preventDefault();
}

// Intent: let authors resize the catalogue inspector while preserving catalogue data as read-only.
function beginWorldbuildingCatalogueResize(handle, event) {
  if (!(handle instanceof HTMLElement) || event?.button !== 0 || !state.worldbuildingCatalogueCategoryId) {
    return;
  }

  const catalogue = handle.closest("[data-worldbuilding-catalogue]");
  if (!(catalogue instanceof HTMLElement)) {
    return;
  }

  const rect = catalogue.getBoundingClientRect();
  const pointerX = Number(event.clientX);
  const pointerY = Number(event.clientY);
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return;
  }

  worldbuildingCatalogueResizeState = {
    pointerId: Number(event.pointerId),
    handle,
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    startX: pointerX,
    startY: pointerY,
    hasMoved: false,
  };
  catalogue.classList.add("is-resizing");
  if (Number.isFinite(Number(event.pointerId)) && typeof handle.setPointerCapture === "function") {
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; document-level listeners still carry the resize.
    }
  }
  event.preventDefault();
}

function handleWorldbuildingCatalogueDragPointerMove(event) {
  if (handleWorldbuildingCatalogueResizePointerMove(event)) {
    return;
  }

  if (!worldbuildingCatalogueDragState || !state.worldbuildingCatalogueCategoryId) {
    return;
  }

  const expectedPointerId = Number(worldbuildingCatalogueDragState.pointerId);
  const pointerId = Number(event.pointerId);
  if (Number.isFinite(expectedPointerId) && Number.isFinite(pointerId) && expectedPointerId !== pointerId) {
    return;
  }

  const pointerX = Number(event.clientX);
  const pointerY = Number(event.clientY);
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return;
  }

  if (
    Math.abs(pointerX - worldbuildingCatalogueDragState.startX) > 2 ||
    Math.abs(pointerY - worldbuildingCatalogueDragState.startY) > 2
  ) {
    worldbuildingCatalogueDragState.hasMoved = true;
  }

  const nextBounds = clampWorldbuildingCatalogueBounds({
    left: pointerX - worldbuildingCatalogueDragState.offsetX,
    top: pointerY - worldbuildingCatalogueDragState.offsetY,
    width: worldbuildingCatalogueDragState.width,
    height: worldbuildingCatalogueDragState.height,
  }, getWorldbuildingCatalogueViewport());
  state.worldbuildingCatalogueBounds = nextBounds;
  state.worldbuildingCataloguePosition = { x: nextBounds.left, y: nextBounds.top };
  applyWorldbuildingCataloguePosition(state.worldbuildingCataloguePosition, nextBounds);
  event.preventDefault();
}

function handleWorldbuildingCatalogueResizePointerMove(event) {
  if (!worldbuildingCatalogueResizeState || !state.worldbuildingCatalogueCategoryId) {
    return false;
  }

  const expectedPointerId = Number(worldbuildingCatalogueResizeState.pointerId);
  const pointerId = Number(event.pointerId);
  if (Number.isFinite(expectedPointerId) && Number.isFinite(pointerId) && expectedPointerId !== pointerId) {
    return true;
  }

  const pointerX = Number(event.clientX);
  const pointerY = Number(event.clientY);
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return true;
  }

  const deltaX = pointerX - worldbuildingCatalogueResizeState.startX;
  const deltaY = pointerY - worldbuildingCatalogueResizeState.startY;
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    worldbuildingCatalogueResizeState.hasMoved = true;
  }

  const nextBounds = clampWorldbuildingCatalogueBounds({
    left: worldbuildingCatalogueResizeState.left,
    top: worldbuildingCatalogueResizeState.top,
    width: worldbuildingCatalogueResizeState.width + deltaX,
    height: worldbuildingCatalogueResizeState.height + deltaY,
  }, getWorldbuildingCatalogueViewport());
  state.worldbuildingCatalogueBounds = nextBounds;
  state.worldbuildingCataloguePosition = { x: nextBounds.left, y: nextBounds.top };
  applyWorldbuildingCataloguePosition(state.worldbuildingCataloguePosition, nextBounds);
  event.preventDefault();
  return true;
}

function endWorldbuildingCatalogueDrag(event) {
  if (endWorldbuildingCatalogueResize(event)) {
    return;
  }

  if (!worldbuildingCatalogueDragState) {
    return;
  }

  const dragState = worldbuildingCatalogueDragState;
  worldbuildingCatalogueDragState = null;
  if (dragState.hasMoved) {
    worldbuildingCatalogueSuppressNextClick = true;
  }
  const catalogue = document.querySelector("[data-worldbuilding-catalogue]");
  if (catalogue instanceof HTMLElement) {
    catalogue.classList.remove("is-dragging");
  }
  if (
    dragState.handle instanceof HTMLElement &&
    Number.isFinite(Number(event?.pointerId)) &&
    typeof dragState.handle.releasePointerCapture === "function"
  ) {
    try {
      dragState.handle.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  if (state.worldbuildingCatalogueCategoryId && state.worldbuildingCataloguePosition) {
    if (dragState.hasMoved) {
      persistWorldbuildingCatalogueBoundsPreference({
        dirtyReason: "worldbuilding-catalogue-moved",
        source: "endWorldbuildingCatalogueDrag",
      });
    }
    uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.dragged", "Repositioned Dream Scaping category catalogue.", {
      categoryId: state.worldbuildingCatalogueCategoryId,
      x: state.worldbuildingCataloguePosition.x,
      y: state.worldbuildingCataloguePosition.y,
    });
  }
}

function endWorldbuildingCatalogueResize(event) {
  if (!worldbuildingCatalogueResizeState) {
    return false;
  }

  const resizeState = worldbuildingCatalogueResizeState;
  worldbuildingCatalogueResizeState = null;
  if (resizeState.hasMoved) {
    worldbuildingCatalogueSuppressNextClick = true;
  }
  const catalogue = document.querySelector("[data-worldbuilding-catalogue]");
  if (catalogue instanceof HTMLElement) {
    catalogue.classList.remove("is-resizing");
  }
  if (
    resizeState.handle instanceof HTMLElement &&
    Number.isFinite(Number(event?.pointerId)) &&
    typeof resizeState.handle.releasePointerCapture === "function"
  ) {
    try {
      resizeState.handle.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  const bounds = getCurrentWorldbuildingCatalogueBounds();
  if (state.worldbuildingCatalogueCategoryId && bounds) {
    state.worldbuildingCatalogueBounds = bounds;
    state.worldbuildingCataloguePosition = { x: bounds.left, y: bounds.top };
    if (resizeState.hasMoved) {
      persistWorldbuildingCatalogueBoundsPreference({
        dirtyReason: "worldbuilding-catalogue-resized",
        source: "endWorldbuildingCatalogueResize",
      });
    }
    uiEventDispatcherLog.info("user-action", "worldbuilding.catalogue.resized", "Resized Dream Scaping category catalogue.", {
      categoryId: state.worldbuildingCatalogueCategoryId,
      width: bounds.width,
      height: bounds.height,
    });
  }
  return true;
}

function applyWorldbuildingCataloguePosition(position, bounds = null) {
  const catalogue = document.querySelector("[data-worldbuilding-catalogue]");
  if (!(catalogue instanceof HTMLElement)) {
    return;
  }

  const safeBounds = normalizeWorldbuildingCatalogueBounds(bounds, {
    viewport: getWorldbuildingCatalogueViewport(),
  });
  if (safeBounds) {
    applyWorldbuildingCatalogueBoundsToElement(catalogue, safeBounds);
    return;
  }

  const positionBounds = resolveWorldbuildingCataloguePositionBounds({
    width: catalogue.getBoundingClientRect().width,
    height: catalogue.getBoundingClientRect().height,
  });
  const safePosition = clampWorldbuildingCataloguePosition(position, positionBounds);
  catalogue.style.setProperty("--worldbuilding-catalogue-max-height", `${Math.max(220, positionBounds.maxHeight)}px`);
  catalogue.style.removeProperty("width");
  catalogue.style.removeProperty("height");
  catalogue.style.left = `${safePosition.x}px`;
  catalogue.style.top = `${safePosition.y}px`;
}

function syncWorldbuildingCataloguePositionToViewport() {
  if (!state.worldbuildingCatalogueCategoryId) {
    return;
  }

  const catalogue = document.querySelector("[data-worldbuilding-catalogue]");
  if (!(catalogue instanceof HTMLElement)) {
    return;
  }

  const rect = catalogue.getBoundingClientRect();
  const safeBounds = normalizeWorldbuildingCatalogueBounds(state.worldbuildingCatalogueBounds, {
    viewport: getWorldbuildingCatalogueViewport(),
  });
  if (safeBounds) {
    state.worldbuildingCatalogueBounds = safeBounds;
    state.worldbuildingCataloguePosition = { x: safeBounds.left, y: safeBounds.top };
    applyWorldbuildingCatalogueBoundsToElement(catalogue, safeBounds);
    return;
  }

  const positionBounds = resolveWorldbuildingCataloguePositionBounds({
    width: rect.width,
    height: rect.height,
  });
  const nextPosition = clampWorldbuildingCataloguePosition(
    state.worldbuildingCataloguePosition ?? { x: rect.left, y: rect.top },
    positionBounds,
  );
  state.worldbuildingCataloguePosition = nextPosition;
  catalogue.style.setProperty("--worldbuilding-catalogue-max-height", `${Math.max(220, positionBounds.maxHeight)}px`);
  catalogue.style.removeProperty("width");
  catalogue.style.removeProperty("height");
  catalogue.style.left = `${nextPosition.x}px`;
  catalogue.style.top = `${nextPosition.y}px`;
}

function applyWorldbuildingCatalogueBoundsToElement(catalogue, bounds) {
  if (!(catalogue instanceof HTMLElement)) {
    return;
  }

  catalogue.style.setProperty("--worldbuilding-catalogue-max-height", `${Math.max(220, bounds.height)}px`);
  catalogue.style.left = `${bounds.left}px`;
  catalogue.style.top = `${bounds.top}px`;
  catalogue.style.width = `${bounds.width}px`;
  catalogue.style.height = `${bounds.height}px`;
}

function getCurrentWorldbuildingCatalogueBounds() {
  const catalogue = document.querySelector("[data-worldbuilding-catalogue]");
  if (catalogue instanceof HTMLElement) {
    const rect = catalogue.getBoundingClientRect();
    return normalizeWorldbuildingCatalogueBounds({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }, {
      viewport: getWorldbuildingCatalogueViewport(),
    });
  }

  return normalizeWorldbuildingCatalogueBounds(state.worldbuildingCatalogueBounds, {
    viewport: getWorldbuildingCatalogueViewport(),
  });
}

function persistWorldbuildingCatalogueBoundsPreference(options = {}) {
  const bounds = getCurrentWorldbuildingCatalogueBounds();
  if (!bounds) {
    return;
  }

  const previousBounds = JSON.stringify(normalizeWorldbuildingCatalogueBounds(state.editorPrefs?.worldbuildingCatalogueBounds));
  state.worldbuildingCatalogueBounds = bounds;
  state.worldbuildingCataloguePosition = { x: bounds.left, y: bounds.top };
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    worldbuildingCatalogueBounds: bounds,
  });
  const nextBounds = JSON.stringify(state.editorPrefs.worldbuildingCatalogueBounds);
  if (previousBounds === nextBounds) {
    return;
  }

  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: options.dirtyReason ?? "worldbuilding-catalogue-layout-updated",
    source: options.source ?? "persistWorldbuildingCatalogueBoundsPreference",
  });
}

// Intent: anchor click-opened catalogues to the pointer while keeping keyboard activation near the source icon.
function resolveWorldbuildingCatalogueOpenPosition(target = null, event = null) {
  const pointerX = Number(event?.clientX);
  const pointerY = Number(event?.clientY);
  if (Number.isFinite(pointerX) && Number.isFinite(pointerY) && (pointerX > 0 || pointerY > 0)) {
    return { x: pointerX, y: pointerY };
  }

  const categoryTarget = target instanceof HTMLElement
    ? target.closest("[data-worldbuilding-category-id]")
    : null;
  if (categoryTarget instanceof HTMLElement) {
    const rect = categoryTarget.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  return null;
}

// Intent: detect gestures on the compact Dream Scaping category icon strip only.
function getWorldbuildingCategoryContextFromTarget(target) {
  const categoryTarget = target instanceof Element
    ? target.closest("[data-worldbuilding-category-id]")
    : null;
  if (!(categoryTarget instanceof HTMLElement) || !categoryTarget.closest("[data-worldbuilding-studio]")) {
    return null;
  }

  const categoryId = String(categoryTarget.dataset.worldbuildingCategoryId ?? "").trim();
  return categoryId ? { categoryId } : null;
}

function getWorldbuildingCatalogueViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    bottomBoundary: resolveWorldbuildingCatalogueToolbarBoundary(),
  };
}

function normalizeWorldSpineContextIdList(value = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
  } catch {
    // Intent: tolerate legacy delimiter-encoded datasets while new row labels use JSON arrays.
  }

  return text.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

function clampWorldbuildingCataloguePosition(position = null, bounds = {}) {
  const resolvedBounds = resolveWorldbuildingCataloguePositionBounds(bounds);
  const width = resolvedBounds.width;
  const height = Math.min(resolvedBounds.height, resolvedBounds.maxHeight);
  const rawX = Number(position?.x);
  const rawY = Number(position?.y);
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, resolvedBounds.bottomBoundary - height);
  return {
    x: Math.max(8, Math.min(Number.isFinite(rawX) ? Math.round(rawX) : maxX, maxX)),
    y: Math.max(8, Math.min(Number.isFinite(rawY) ? Math.round(rawY) : 120, maxY)),
  };
}

// Intent: keep the catalogue inspector above the Dream Scaping catalogue icon row instead of covering its source controls.
function resolveWorldbuildingCataloguePositionBounds(bounds = {}) {
  const width = Math.max(1, Number(bounds?.width) || 340);
  const requestedHeight = Math.max(1, Number(bounds?.height) || 420);
  const toolbarBoundary = resolveWorldbuildingCatalogueToolbarBoundary();
  const viewportBoundary = window.innerHeight - 8;
  const bottomBoundary = Math.max(228, Math.min(viewportBoundary, toolbarBoundary));
  const maxHeight = Math.max(120, bottomBoundary - 8);
  return {
    width,
    height: Math.min(requestedHeight, maxHeight),
    bottomBoundary,
    maxHeight,
  };
}

function resolveWorldbuildingCatalogueToolbarBoundary() {
  const toolbar = document.querySelector("[data-worldbuilding-studio] .worldbuilding-studio__toolbar");
  if (!(toolbar instanceof HTMLElement)) {
    return window.innerHeight - 8;
  }

  const rect = toolbar.getBoundingClientRect();
  const boundary = Number(rect.top);
  return Number.isFinite(boundary) && boundary > 0
    ? Math.max(228, boundary - 10)
    : window.innerHeight - 8;
}

// Intent: switch Dream Scaping worldbuilding forms without coupling category logic to the shell.
function selectWorldbuildingStudioCategory(categoryId = "") {
  state.worldSpineInsertionContext = null;
  closeWorldbuildingCatalogue({ renderAfter: false });
  clearWorldbuildingCatalogueEditState();
  state.worldbuildingStudioCategoryId = String(categoryId ?? "").trim() || DEFAULT_WORLDBUILDING_CATEGORY_ID;
  state.worldbuildingStudioStatus = "";
  renderDreamScapingPanel();
  window.requestAnimationFrame(() => {
    syncWorldbuildingEntryPopoverPosition();
    const firstField = document.querySelector("[data-worldbuilding-studio-form] [data-worldbuilding-field]");
    if (firstField instanceof HTMLInputElement || firstField instanceof HTMLTextAreaElement) {
      firstField.focus();
    }
  });
}

// Intent: escape the blurred Dream Scaping panel so fixed form positioning uses the viewport/app shell.
function syncWorldbuildingEntryPopoverPortal() {
  const dreamSlot = document.querySelector("#dream-slot");
  const sourcePopover = dreamSlot instanceof HTMLElement
    ? dreamSlot.querySelector("[data-worldbuilding-entry-popover]")
    : null;
  const existingPortal = document.querySelector("[data-worldbuilding-entry-popover-portal]");

  if (!(sourcePopover instanceof HTMLElement)) {
    if (existingPortal instanceof HTMLElement) {
      existingPortal.replaceChildren();
    }
    return;
  }

  const portal = existingPortal instanceof HTMLElement
    ? existingPortal
    : createWorldbuildingEntryPopoverPortal();
  portal.replaceChildren(sourcePopover);
}

// Intent: move the context catalogue out of the Dream Scaping header lane so pointer coordinates remain viewport-based.
function syncWorldbuildingCataloguePortal() {
  const dreamSlot = document.querySelector("#dream-slot");
  const sourceCatalogue = dreamSlot instanceof HTMLElement
    ? dreamSlot.querySelector("[data-worldbuilding-catalogue]")
    : null;
  const existingPortal = document.querySelector("[data-worldbuilding-catalogue-portal]");

  if (!(sourceCatalogue instanceof HTMLElement)) {
    if (existingPortal instanceof HTMLElement) {
      existingPortal.replaceChildren();
    }
    return;
  }

  const portal = existingPortal instanceof HTMLElement
    ? existingPortal
    : createWorldbuildingCataloguePortal();
  portal.replaceChildren(sourceCatalogue);
}

// Intent: keep the transient World Spine studio dialog out of feature panels that create fixed-position containing blocks.
function createWorldbuildingEntryPopoverPortal() {
  const portal = document.createElement("div");
  portal.setAttribute("data-worldbuilding-entry-popover-portal", "");
  document.body.appendChild(portal);
  return portal;
}

// Intent: keep the transient catalogue anchored to the pointer position after render.
function createWorldbuildingCataloguePortal() {
  const portal = document.createElement("div");
  portal.setAttribute("data-worldbuilding-catalogue-portal", "");
  document.body.appendChild(portal);
  return portal;
}

// Intent: keep the World Spine studio form centered over the visible app shell instead of the Dream Scaping lane.
function syncWorldbuildingEntryPopoverPosition() {
  const popover = document.querySelector("[data-worldbuilding-entry-popover]");
  if (!(popover instanceof HTMLElement)) {
    return;
  }

  const appRoot = document.querySelector("#app");
  const appRect = appRoot instanceof HTMLElement ? appRoot.getBoundingClientRect() : null;
  const hasAppRect = Boolean(
    appRect &&
    Number.isFinite(appRect.left) &&
    Number.isFinite(appRect.top) &&
    Number.isFinite(appRect.right) &&
    Number.isFinite(appRect.bottom) &&
    Number.isFinite(appRect.width) &&
    Number.isFinite(appRect.height) &&
    appRect.width > 0 &&
    appRect.height > 0,
  );
  const visibleLeft = hasAppRect ? Math.max(0, appRect.left) : 0;
  const visibleTop = hasAppRect ? Math.max(0, appRect.top) : 0;
  const visibleRight = hasAppRect ? Math.min(window.innerWidth, appRect.right) : window.innerWidth;
  const visibleBottom = hasAppRect ? Math.min(window.innerHeight, appRect.bottom) : window.innerHeight;
  const measuredWidth = Math.max(0, visibleRight - visibleLeft);
  const measuredHeight = Math.max(0, visibleBottom - visibleTop);
  const width = measuredWidth > 0 ? measuredWidth : window.innerWidth;
  const height = measuredHeight > 0 ? measuredHeight : window.innerHeight;
  const left = measuredWidth > 0 ? visibleLeft : 0;
  const top = measuredHeight > 0 ? visibleTop : 0;
  const centerX = Math.round(left + (width / 2));
  const centerY = Math.round(top + (height / 2));

  popover.style.setProperty("--worldbuilding-entry-center-x", `${centerX}px`);
  popover.style.setProperty("--worldbuilding-entry-center-y", `${centerY}px`);
  popover.style.setProperty("--worldbuilding-entry-viewport-width", `${Math.max(0, Math.round(width))}px`);
  popover.style.setProperty("--worldbuilding-entry-viewport-height", `${Math.max(0, Math.round(height))}px`);
}

// Intent: dismiss the World Spine entity form without mutating world data.
function closeWorldbuildingStudioForm() {
  if (!state.worldbuildingStudioCategoryId) {
    return;
  }

  state.worldSpineInsertionContext = null;
  state.worldbuildingStudioCategoryId = "";
  clearWorldbuildingCatalogueEditState();
  renderDreamScapingPanel();
}

// Intent: let the custom worldbuilding form grow structured field definitions before persistence.
function addWorldbuildingCustomField(target) {
  const fieldGroup = target instanceof HTMLElement
    ? target.closest("[data-worldbuilding-field-list-group]")
    : null;
  const rowContainer = fieldGroup instanceof HTMLElement
    ? fieldGroup.querySelector("[data-worldbuilding-field-list-rows]")
    : null;
  if (!(fieldGroup instanceof HTMLElement) || !(rowContainer instanceof HTMLElement)) {
    return;
  }

  const fieldKey = String(fieldGroup.dataset.worldbuildingFieldListGroup ?? "customFieldLabels").trim() || "customFieldLabels";
  const nextIndex = rowContainer.querySelectorAll("[data-worldbuilding-field-list]").length + 1;
  const row = document.createElement("label");
  row.className = "worldbuilding-field worldbuilding-field-list__row";

  const label = document.createElement("span");
  label.textContent = `Field ${nextIndex}`;

  const input = document.createElement("input");
  input.type = "text";
  input.dataset.worldbuildingFieldList = fieldKey;
  input.placeholder = "Enter field name";

  row.append(label, input);
  rowContainer.append(row);
  syncWorldbuildingEntryPopoverPosition();
  input.focus();
}

// Intent: save Dream Scaping worldbuilding records as structured world data before any timeline placement.
function saveWorldbuildingStudioItem() {
  const form = document.querySelector("[data-worldbuilding-studio-form]");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const categoryId = String(form.dataset.worldbuildingCategoryId ?? state.worldbuildingStudioCategoryId ?? "").trim();
  const existingItemId = String(form.dataset.worldbuildingEditItemId ?? state.worldbuildingEditingCatalogueItemId ?? "").trim();
  const existingItemKind = String(form.dataset.worldbuildingEditItemKind ?? state.worldbuildingEditingCatalogueItemKind ?? "").trim();
  const item = buildWorldbuildingItemFromFormValues({
    categoryId,
    values: collectWorldbuildingFormValues(form),
    world: state.workspace?.world ?? {},
    existingItemId,
    existingItemKind,
  });
  if (item?.itemType === "missing") {
    state.worldbuildingStudioStatus = "That catalogue item could not be found for editing.";
    renderDreamScapingPanel();
    return;
  }

  const isEditingCatalogueItem = item?.operation === "updated";
  const historyBefore = captureWorldSpineHistorySnapshot();
  const insertionContext = item?.eventDraft
    ? normalizeWorldSpineMenuContext(state.worldSpineInsertionContext)
    : null;
  if (item?.eventDraft && insertionContext && !isEditingCatalogueItem) {
    const itemForPlacement = applyWorldSpineInsertionLocationToEventDraftItem(item, insertionContext.locationLabel);
    const worldWithDraft = applyWorldbuildingItemToWorld(state.workspace?.world ?? {}, itemForPlacement);
    const placement = dropWorldbuildingEventDraftOnWorldSpine(worldWithDraft, itemForPlacement.eventDraft.id, {
      dropIndex: insertionContext.dropIndex,
      spineId: insertionContext.spineId,
      locationLabel: insertionContext.locationLabel,
    });
    state.worldSpineInsertionContext = null;
    state.worldbuildingStudioCategoryId = "";
    clearWorldbuildingCatalogueEditState();

    if (!placement.node) {
      state.workspace.world = worldWithDraft;
      state.worldbuildingStudioStatus = "That event could not be placed on the selected World Spine tier.";
      renderDreamScapingPanel();
      renderWorldPanel();
      return;
    }

    const scenePlacement = createWorldSpineEventScenePlacement({
      world: placement.world,
      eventNode: placement.node,
      scenes: state.scenes,
      structureDrafts: state.structureDrafts,
      insertionContext,
      now: new Date(),
    });
    state.workspace.world = scenePlacement.world;
    const selectedPlacementNode = scenePlacement.node ?? placement.node;
    if (scenePlacement.changed && scenePlacement.sceneDraft) {
      state.structureDrafts = scenePlacement.structureDrafts;
      writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
      refreshScenes();
      state.selectedIssueId = null;
      state.selectedSceneId = scenePlacement.sceneDraft.sceneId;
      state.activeEditorSceneId = scenePlacement.sceneDraft.sceneId;
      state.selectedBlockId = scenePlacement.sceneDraft.blockId;
    }
    setWorldSpineSelectedNodeId(selectedPlacementNode.id);
    state.worldSpineScrollTargetNodeId = selectedPlacementNode.id;
    const locationSuffix = insertionContext.locationLabel ? ` / ${insertionContext.locationLabel}` : "";
    const sceneSuffix = scenePlacement.changed ? " and added a manuscript scene" : "";
    state.worldbuildingStudioStatus = `"${selectedPlacementNode.label}" inserted on ${insertionContext.spineLabel}${locationSuffix}${sceneSuffix}.`;
    persistCurrentProjectRecord({
      domain: "world",
      dirtyReason: "worldbuilding-event-inserted-on-spine",
      source: "saveWorldbuildingStudioItem.insertEventHere",
      flushProjectFileAutosave: true,
    });
    pushWorldSpineHistoryChange(historyBefore, {
      label: "Inserted World Spine event",
      dirtyReason: "worldbuilding-event-inserted-on-spine",
      source: "saveWorldbuildingStudioItem.insertEventHere",
    });
    playMilestoneSoundEffect(MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM, {
      source: "saveWorldbuildingStudioItem.insertEventHere",
    });
    renderDreamScapingPanel();
    renderWorldPanel();
    return;
  }

  state.workspace.world = applyWorldbuildingItemToWorld(state.workspace?.world ?? {}, item);
  state.worldSpineInsertionContext = null;
  state.worldbuildingStudioCategoryId = "";
  clearWorldbuildingCatalogueEditState();
  state.worldbuildingStudioStatus = getWorldbuildingStudioSaveStatus(item);
  const dirtyReason = getWorldbuildingStudioDirtyReason(item);
  const historyLabel = getWorldbuildingStudioHistoryLabel(item);
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason,
    source: "saveWorldbuildingStudioItem",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: historyLabel,
    dirtyReason,
    source: "saveWorldbuildingStudioItem",
  });
  if ((item?.entity || item?.eventDraft || item?.customCategory) && !isEditingCatalogueItem) {
    playMilestoneSoundEffect(MILESTONE_SOUND_EFFECT_TYPES.CATALOGUE_ITEM, {
      source: "saveWorldbuildingStudioItem",
    });
  }
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: default inserted event drafts to the clicked World Spine location row when the Location field is blank.
function applyWorldSpineInsertionLocationToEventDraftItem(item = {}, locationLabel = "") {
  const eventDraft = item?.eventDraft && typeof item.eventDraft === "object" ? item.eventDraft : null;
  const normalizedLocation = String(locationLabel ?? "").trim();
  const existingLocation = String(eventDraft?.location ?? eventDraft?.metadata?.location ?? "").trim();
  if (!eventDraft || !normalizedLocation || existingLocation) {
    return item;
  }

  return {
    ...item,
    eventDraft: {
      ...eventDraft,
      location: normalizedLocation,
      metadata: {
        ...(eventDraft.metadata && typeof eventDraft.metadata === "object" ? eventDraft.metadata : {}),
        location: normalizedLocation,
      },
    },
  };
}

// Intent: show a node-shaped preview only while a crafted Dream Scaping event is being placed on the timeline.
function createWorldbuildingEventDraftDragImage(draftId, sourceElement, dragEvent) {
  if (!dragEvent.dataTransfer) {
    return null;
  }

  const html = renderWorldbuildingEventDraftPlacementPreviewHTML(state.workspace?.world ?? {}, draftId).trim();
  if (!html) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const dragImage = template.content.firstElementChild;
  if (!(dragImage instanceof HTMLElement)) {
    return null;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const width = 172;
  const height = 58;
  dragImage.style.width = `${width}px`;
  dragImage.style.height = `${height}px`;
  dragImage.style.position = "fixed";
  dragImage.style.top = "-1000px";
  dragImage.style.left = "-1000px";
  dragImage.style.pointerEvents = "none";
  dragImage.style.margin = "0";
  document.body.appendChild(dragImage);
  dragEvent.dataTransfer.setDragImage(
    dragImage,
    Math.max(0, Math.round(width / 2) || Math.round(dragEvent.clientX - sourceRect.left)),
    Math.max(0, Math.round(height / 2) || Math.round(dragEvent.clientY - sourceRect.top)),
  );
  return dragImage;
}

// Intent: clear event-placement drag chrome without mutating the drafted event catalogue.
function clearWorldbuildingEventDraftDragState() {
  worldbuildingEventDraftDragState?.dragImage?.remove();
  worldbuildingEventDraftDragState?.sourceElement?.classList.remove("is-dragging");
  worldbuildingEventDraftDragState = null;
  state.worldbuildingDraggedEventDraftId = "";
}

// Intent: let crafted Dream Scaping events travel as explicit drag payloads into the timeline canvas.
function handleWorldbuildingStudioDragStart(event) {
  const target = event.target instanceof Element
    ? event.target.closest("[data-worldbuilding-event-draft-id]")
    : null;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const draftId = String(target.dataset.worldbuildingEventDraftId ?? "").trim();
  if (!draftId) {
    return;
  }

  clearWorldbuildingEventDraftDragState();
  state.worldbuildingDraggedEventDraftId = draftId;
  const dragImage = createWorldbuildingEventDraftDragImage(draftId, target, event);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draftId);
    event.dataTransfer.setData("application/x-abe-worldbuilding-event-draft", draftId);
  }
  worldbuildingEventDraftDragState = {
    draftId,
    sourceElement: target,
    dragImage,
  };
  target.classList.add("is-dragging");
}

// Intent: keep timeline drag acceptance limited to explicit World Spine drop slots.
function handleWorldSpineTimelineDragOver(event) {
  const zone = event.target instanceof Element
    ? event.target.closest("[data-world-spine-drop-index]")
    : null;
  if (!(zone instanceof HTMLElement) || !state.worldbuildingDraggedEventDraftId) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

// Intent: place a crafted event before, between, or after timeline nodes and persist it as a world node.
function handleWorldSpineTimelineDrop(event) {
  const zone = event.target instanceof Element
    ? event.target.closest("[data-world-spine-drop-index]")
    : null;
  if (!(zone instanceof HTMLElement)) {
    return;
  }

  const draftId = String(
    event.dataTransfer?.getData("application/x-abe-worldbuilding-event-draft") ||
    event.dataTransfer?.getData("text/plain") ||
    state.worldbuildingDraggedEventDraftId ||
    "",
  ).trim();
  if (!draftId) {
    return;
  }

  event.preventDefault();
  const historyBefore = captureWorldSpineHistorySnapshot();
  const placement = dropWorldbuildingEventDraftOnWorldSpine(state.workspace?.world ?? {}, draftId, {
    dropIndex: Number(zone.dataset.worldSpineDropIndex),
    spineId: zone.dataset.worldSpineDropSpineId,
    locationLabel: zone.dataset.worldSpineDropLocationLabel,
  });
  clearWorldbuildingEventDraftDragState();

  if (!placement.node) {
    state.worldbuildingStudioStatus = "That event draft is no longer available.";
    renderDreamScapingPanel();
    return;
  }

  state.workspace.world = placement.world;
  setWorldSpineSelectedNodeId(placement.node.id);
  state.worldSpineScrollTargetNodeId = placement.node.id;
  state.worldbuildingStudioStatus = `"${placement.node.label}" placed on the World Spine.`;
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "worldbuilding-event-draft-placed-on-spine",
    source: "handleWorldSpineTimelineDrop",
    flushProjectFileAutosave: true,
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Placed event draft on World Spine",
    dirtyReason: "worldbuilding-event-draft-placed-on-spine",
    source: "handleWorldSpineTimelineDrop",
  });
  renderDreamScapingPanel();
  renderWorldPanel();
}

// Intent: clear transient drag styling without touching the persisted crafted event list.
function handleWorldbuildingStudioDragEnd(event) {
  const target = event.target instanceof Element
    ? event.target.closest("[data-worldbuilding-event-draft-id]")
    : null;
  if (target instanceof HTMLElement && target !== worldbuildingEventDraftDragState?.sourceElement) {
    target.classList.remove("is-dragging");
  }
  clearWorldbuildingEventDraftDragState();
}

function getWorldbuildingStudioSaveStatus(item) {
  if (item?.operation === "updated" && item?.eventDraft) {
    return `"${item.eventDraft.title}" updated in the event draft catalogue.`;
  }
  if (item?.operation === "updated" && item?.entity) {
    return `"${item.entity.name}" updated in the world catalogue.`;
  }
  if (item?.eventDraft) {
    return `"${item.eventDraft.title}" is ready to drag onto the World Spine.`;
  }
  if (item?.customCategory && item?.entity) {
    return `${item.customCategory.label} category created with "${item.entity.name}".`;
  }
  if (item?.entity) {
    return `"${item.entity.name}" added to the world catalogue.`;
  }
  return "Worldbuilding item saved.";
}

function getWorldbuildingStudioDirtyReason(item) {
  if (item?.operation === "updated") {
    return item?.eventDraft
      ? "worldbuilding-event-draft-updated"
      : "worldbuilding-catalogue-item-updated";
  }

  if (item?.eventDraft) {
    return "worldbuilding-event-draft-created";
  }
  if (item?.customCategory) {
    return "worldbuilding-custom-category-created";
  }
  return "worldbuilding-catalogue-item-created";
}

function getWorldbuildingStudioHistoryLabel(item) {
  if (item?.operation === "updated") {
    return item?.eventDraft
      ? "Updated World Spine event draft"
      : "Updated World Spine catalogue item";
  }

  if (item?.eventDraft) {
    return "Created World Spine event draft";
  }
  if (item?.customCategory) {
    return "Created World Spine custom category";
  }
  return "Created World Spine catalogue item";
}

function hideSpellcheckContextMenu() {
  if (!state.spellcheckContextMenu) {
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  state.spellcheckContextMenu = null;
  renderTaskContextMenu();
}

function handleSpellcheckHoverPointerMove(event) {
  if (
    (typeof PointerEvent !== "undefined" && !(event instanceof PointerEvent)) ||
    event.pointerType === "touch" ||
    event.buttons !== 0
  ) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const grammarCheckSuggestionTarget = target?.closest("[data-grammar-check-suggestion]");
  if (grammarCheckSuggestionTarget instanceof HTMLElement) {
    positionGrammarCheckSuggestionMenu(grammarCheckSuggestionTarget);
    return;
  }
  if (target?.closest("[data-grammar-check-floating-suggestion-menu]")) {
    return;
  }
  if (document.querySelector("[data-grammar-check-floating-suggestion-menu]")) {
    hideGrammarCheckSuggestionMenu();
  }

  if (target?.closest("[data-spellcheck-menu]")) {
    clearSpellcheckHoverMenuHideTimer();
    return;
  }

  if (state.spellcheckContextMenu?.source === "contextmenu") {
    return;
  }

  const editorContext = getEditorHoverContextFromEvent(event);
  if (!editorContext) {
    scheduleSpellcheckHoverMenuHide();
    return;
  }

  const spellcheckContext = getSpellcheckHoverContextFromEvent(editorContext, event);
  if (!spellcheckContext) {
    scheduleSpellcheckHoverMenuHide();
    return;
  }

  clearSpellcheckHoverMenuHideTimer();
  if (isSameSpellcheckContextMenu(state.spellcheckContextMenu, spellcheckContext)) {
    return;
  }

  openSpellcheckContextMenu(spellcheckContext, "hover");
}

function scheduleSpellcheckHoverMenuHide() {
  if (state.spellcheckContextMenu?.source !== "hover" || spellcheckHoverMenuHideTimer !== null) {
    return;
  }

  spellcheckHoverMenuHideTimer = window.setTimeout(() => {
    spellcheckHoverMenuHideTimer = null;
    if (state.spellcheckContextMenu?.source !== "hover") {
      return;
    }

    state.spellcheckContextMenu = null;
    renderTaskContextMenu();
  }, 160);
}

function clearSpellcheckHoverMenuHideTimer() {
  if (spellcheckHoverMenuHideTimer === null) {
    return;
  }

  window.clearTimeout(spellcheckHoverMenuHideTimer);
  spellcheckHoverMenuHideTimer = null;
}

function isSameSpellcheckContextMenu(currentMenu, nextMenu) {
  if (!currentMenu || !nextMenu) {
    return false;
  }

  return (
    String(currentMenu.sceneId ?? "") === String(nextMenu.sceneId ?? "") &&
    String(currentMenu.normalizedWord ?? currentMenu.word ?? "") === String(nextMenu.normalizedWord ?? nextMenu.word ?? "") &&
    Number(currentMenu.startOffset) === Number(nextMenu.startOffset) &&
    Number(currentMenu.endOffset) === Number(nextMenu.endOffset)
  );
}

function applyGrammarCheckWordsToProjectList(targetListKey, sourceWords) {
  const result = applySpellcheckProjectListMutation(
    state.spellcheckProjectSettings,
    targetListKey,
    sourceWords,
  );
  if (!result.changed) {
    return false;
  }

  state.spellcheckProjectSettings = result.settings;
  persistCurrentProjectRecord();
  return true;
}

function addGrammarCheckWordsToProjectList(targetListKey, sourceWords = null) {
  const menu = state.spellcheckContextMenu;
  const words = Array.isArray(sourceWords) ? sourceWords : (menu?.words ?? (menu?.word ? [menu.word] : []));
  if (!words.length) {
    hideSpellcheckContextMenu();
    return;
  }

  const changed = applyGrammarCheckWordsToProjectList(targetListKey, words);
  hideSpellcheckContextMenu();
  if (!changed) {
    return;
  }

  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

// Intent: accept spellcheck corrections from both the context menu and grammar-check panel rows.
function applySpellcheckSuggestionFromMenu(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const sceneId = String(target.dataset.spellcheckSceneId ?? "");
  const replacement = String(target.dataset.spellcheckReplacement ?? "");
  const menuWord = String(target.dataset.spellcheckWord ?? "");
  const startOffset = Number(target.dataset.spellcheckStartOffset);
  const endOffset = Number(target.dataset.spellcheckEndOffset);

  if (
    !sceneId ||
    !replacement ||
    !Number.isFinite(startOffset) ||
    !Number.isFinite(endOffset)
  ) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  hideSpellcheckContextMenu();
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const liveRange = validateLiveSpellcheckMenuRange(textarea.value, {
    word: menuWord,
    startOffset,
    endOffset,
  }, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  });
  if (!liveRange) {
    syncSceneDocumentLayout();
    return;
  }

  focusTextareaEditorHost(resolveTextareaEditorHost(textarea), { preventScroll: true });
  textarea.setRangeText(replacement, liveRange.startOffset, liveRange.endOffset, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  syncGrammarCheckPanelHeaderState();
  syncSceneDocumentLayout();
  renderGrammarCheckPanel();
}

// Intent: keep milestone audio feedback behind the shared editor preference and feature service.
function playMilestoneSoundEffect(type, context = {}) {
  return milestoneSoundEffectsService.playMilestoneSoundEffect(type, {
    enabled: isMilestoneSoundEffectsEnabled(state.editorPrefs),
    source: context.source ?? "",
  });
}

function playMilestoneSoundEffects(effects = [], context = {}) {
  return milestoneSoundEffectsService.playMilestoneSoundEffects(effects, {
    enabled: isMilestoneSoundEffectsEnabled(state.editorPrefs),
    source: context.source ?? "",
  });
}

// Intent: detect writing-goal crossings from the edit transaction instead of from rendered progress cards.
function playWritingGoalMilestoneSounds({
  previousRecord = null,
  currentRecord = null,
  previousWordCount = 0,
  currentWordCount = 0,
  source = "writing-goals",
} = {}) {
  const effects = selectWritingGoalMilestoneSoundEffects({
    previousRecord,
    currentRecord,
    previousWordCount,
    currentWordCount,
    todayKey: getLocalDateKey(new Date()),
  });
  if (!effects.length) {
    return [];
  }

  return playMilestoneSoundEffects(effects, { source });
}

// Intent: apply scene text edits through draft state so canonical project structure stays recoverable.
function updateSceneDraft(sceneId, mutate, options = {}) {
  const scene = getScene(sceneId);
  if (!scene) {
    sceneStorageLog.warn("validation", "scene.update.skipped", "Scene update skipped because scene was not found.", {
      sceneId: sceneId ?? "",
      reason: options.reason ?? "scene-draft",
    });
    return;
  }

  const previousWordCount = getCurrentManuscriptWordCount();
  const previousWritingTargetRecord = getWritingTargetWorkingRecord();
  const hadActiveSession = previousWritingTargetRecord?.sessionIsActive === true;
  const draft = cloneValue(state.sceneDrafts[sceneId] ?? createSceneDraft(scene));
  mutate(draft);
  sceneStorageLog.debug("state-change", "scene.update.mutate", "Applying scene draft mutation.", {
    sceneId,
    reason: options.reason ?? "scene-draft",
    immediate: options.immediate === true,
  });
  state.sceneDrafts = {
    ...state.sceneDrafts,
    [sceneId]: draft,
  };
  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
  syncCompatibilityManuscriptMarksForScene(sceneId, {
    now: new Date().toISOString(),
  });
  const markSessionActivity = options.markSessionActivity !== false;
  const currentWordCount = getCurrentManuscriptWordCount();
  const wordDelta = currentWordCount - previousWordCount;
  manuscriptStateLog.info("state-change", "manuscript.word-count.changed", "Scene draft mutation changed manuscript word count.", {
    sceneId,
    previousWordCount,
    currentWordCount,
    wordDelta,
    reason: options.reason ?? "scene-draft",
  });
  if (wordDelta !== 0) {
    const nowMs = Date.now();
    const shouldLogTypingMetric = options.immediate === true
      || nowMs - writingTargetDebugLastTypingLogAt >= WRITING_TARGET_DEBUG_TYPING_LOG_MIN_INTERVAL_MS
      || writingTargetDebugLastSceneTypingWordCount !== currentWordCount;
    if (shouldLogTypingMetric) {
      writingTargetDebugLastTypingLogAt = nowMs;
      writingTargetDebugLastSceneTypingWordCount = currentWordCount;
      logWritingTargetDebugEvent("info", "scene-draft.word-change", "Scene draft word count changed.", {
        reason: options.reason ?? "scene-draft",
        sceneId,
        previousWordCount,
        currentWordCount,
        wordDelta,
        selectedSceneId: state.selectedSceneId ?? "",
      });
    }
  }

  let currentWritingTargetRecord = null;
  if (markSessionActivity) {
    currentWritingTargetRecord = getWritingTargetWorkingRecord();
    const touchedSessionRecord = touchWritingTargetSessionActivity(
      currentWritingTargetRecord,
      currentWordCount,
      new Date(),
      {
        reason: options.reason ?? "scene-draft",
        previousWordCount,
      },
    );

    if (touchedSessionRecord) {
      state.writingTargetState = persistWritingTargetState(touchedSessionRecord);
      if (state.writingTargetDraft && state.writingTargetDraftProjectId === state.workspace?.project?.id) {
        state.writingTargetDraft = {
          ...cloneValue(state.writingTargetDraft),
          sessionIsActive: state.writingTargetState.sessionIsActive,
          sessionStartedAt: state.writingTargetState.sessionStartedAt,
          sessionLastActiveAt: state.writingTargetState.sessionLastActiveAt,
          sessionConcludedAt: state.writingTargetState.sessionConcludedAt,
          sessionConcludedReason: state.writingTargetState.sessionConcludedReason,
          sessionBaselineWordCount: state.writingTargetState.sessionBaselineWordCount,
          sessionLastWordCount: state.writingTargetState.sessionLastWordCount,
          sessionSamples: cloneValue(state.writingTargetState.sessionSamples),
          updatedAt: state.writingTargetState.updatedAt,
        };
      }
    }
  }

  if (wordDelta > 0) {
    playWritingGoalMilestoneSounds({
      previousRecord: previousWritingTargetRecord,
      currentRecord: state.writingTargetState ?? currentWritingTargetRecord,
      previousWordCount,
      currentWordCount,
      source: "updateSceneDraft",
    });
  }

  persistCurrentProjectRecord({
    changedSceneIds: [sceneId],
    domain: "manuscript",
    dirtyReason: "user-edit",
    source: "updateSceneDraft",
  });
  sceneStorageLog.debug("persistence", "scene.update.persisted", "Persisted scene draft mutation into project record.", {
    sceneId,
    changedSceneIds: [sceneId],
  });
  const shouldCaptureImmediately = options.immediate === true || !hadActiveSession;

  syncHeaderLiveState();
  syncWritingTargetWindowLiveState();

  if (shouldCaptureImmediately) {
    queueWritingTargetSnapshot({
      immediate: true,
      markSessionActivity,
      reason: options.reason ?? "scene-draft",
    });
  }

  if (!shouldCaptureImmediately) {
    queueWritingTargetSnapshot({
      markSessionActivity,
      reason: options.reason ?? "scene-draft",
    });
  }
}

function updateSceneRevisionStats(existingStats, previousText, nextText, now = new Date().toISOString()) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return existingStats ?? null;
  }

  const summary = summarizeSceneTextChange(previous, next);
  const historyEntry = {
    id: `revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    summary,
    previousLength: previous.length,
    nextLength: next.length,
    deltaCharacters: next.length - previous.length,
  };
  const history = Array.isArray(existingStats?.history) ? [...existingStats.history] : [];
  history.unshift(historyEntry);

  return {
    editCount: Number(existingStats?.editCount ?? 0) + 1,
    lastEditedAt: now,
    lastChangeSummary: summary,
    history: history.slice(0, 8),
  };
}

function recordRevisionSceneTextEdit(sceneId, previousText, nextText) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return;
  }

  const scene = getScene(sceneId);
  const summary = summarizeSceneTextChange(previous, next);
  revisionService.recordEvent({
    eventType: "manuscript_edit",
    origin: "manual_editor",
    sourceService: "scene-editor",
    entityType: "scene",
    entityId: sceneId,
    description: summary,
    changeCategory: "manuscript",
    mode: "typing",
    beforeSummary: {
      title: scene?.sceneTitle ?? "Untitled Scene",
      chapterId: scene?.chapterId ?? "",
      chapterTitle: scene?.chapterTitle ?? "",
      wordCount: countWords(previous),
      charCount: previous.length,
    },
    afterSummary: {
      title: scene?.sceneTitle ?? "Untitled Scene",
      chapterId: scene?.chapterId ?? "",
      chapterTitle: scene?.chapterTitle ?? "",
      wordCount: countWords(next),
      charCount: next.length,
    },
  }, {
    persist: false,
    skipProjectFileAutosave: true,
  });
}

function summarizeSceneTextChange(previousText, nextText) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return "No text change";
  }

  let start = 0;
  const previousLength = previous.length;
  const nextLength = next.length;
  while (start < previousLength && start < nextLength && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previousLength - 1;
  let nextEnd = nextLength - 1;
  while (previousEnd >= start && nextEnd >= start && previous[previousEnd] === next[nextEnd]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removed = previous.slice(start, previousEnd + 1);
  const added = next.slice(start, nextEnd + 1);
  const parts = [];

  if (added.length && removed.length) {
    parts.push(`Replaced ${removed.length} chars with ${added.length} chars`);
  } else if (added.length) {
    parts.push(`Inserted ${added.length} chars`);
  } else if (removed.length) {
    parts.push(`Removed ${removed.length} chars`);
  } else {
    parts.push("Updated passage");
  }

  const lineDelta = next.split("\n").length - previous.split("\n").length;
  if (lineDelta !== 0) {
    parts.push(`${lineDelta > 0 ? "+" : ""}${lineDelta} lines`);
  }

  return parts.join(" ");
}

function syncRevisionPanel(sceneId) {
  if (!REVISION_DRAFTING_UI_ENABLED) {
    return;
  }

  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return;
  }

  const sceneShell = document.querySelector(`[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`);
  if (!(sceneShell instanceof HTMLElement)) {
    return;
  }

  const draft = state.sceneDrafts?.[sceneId];
  const revisionStats = draft?.revisionStats ?? null;
  const revisionEditCount = Number(revisionStats?.editCount ?? 0);
  const showRevisionHighlight = Boolean(REVISION_DRAFTING_UI_ENABLED && state.editorPrefs.revisionOverlayEnabled && revisionEditCount > 0);
  const summary = revisionStats?.lastChangeSummary
    ? String(revisionStats.lastChangeSummary)
    : "Track revisions while you edit this passage.";
  const history = Array.isArray(revisionStats?.history) ? revisionStats.history.slice(0, 3) : [];

  sceneShell.classList.toggle("has-revision-preview", showRevisionHighlight);
  const codeframe = sceneShell.querySelector(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.toggle("has-revision-preview", showRevisionHighlight);
  }

  const textarea = sceneShell.querySelector(".editor-document-input");
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.classList.toggle("has-revision-preview", showRevisionHighlight);
  }

  const countNode = sceneShell.querySelector(`[data-revision-count="${CSS.escape(sceneId)}"]`);
  if (countNode instanceof HTMLElement) {
    countNode.textContent = `${revisionEditCount} edit${revisionEditCount === 1 ? "" : "s"}`;
  }

  const summaryNode = sceneShell.querySelector(`[data-revision-summary="${CSS.escape(sceneId)}"]`);
  if (summaryNode instanceof HTMLElement) {
    summaryNode.textContent = summary;
  }

  const historyNode = sceneShell.querySelector(`[data-revision-history="${CSS.escape(sceneId)}"]`);
  if (historyNode instanceof HTMLElement) {
    historyNode.innerHTML = history.map((entry) => `
      <li>
        <strong>${escapeHtml(entry.summary || "Edited passage")}</strong>
        <span>${escapeHtml(formatRevisionTimestamp(entry.updatedAt || entry.createdAt || ""))}</span>
      </li>
    `).join("");
  }
}

function formatRevisionTimestamp(value) {
  const timestamp = typeof value === "string" ? value.trim() : "";
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function toggleRevisionOverlay(sceneId) {
  if (!REVISION_DRAFTING_UI_ENABLED) {
    return;
  }

  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    revisionOverlayEnabled: !state.editorPrefs.revisionOverlayEnabled,
  });
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord();
  renderManuscriptPanel();
  syncLayoutWidths({ reason: "revision-overlay" });
  syncSceneDocumentLayout();
  if (typeof sceneId === "string" && sceneId.trim()) {
    syncRevisionPanel(sceneId);
  }
}

// Intent: route manuscript styling through a shared command controller instead of scene-wide editor preferences.
function toggleManuscriptInlineFormat(formatId) {
  if (AUTHOR_MARK_DECORATION_FORMAT_IDS.has(String(formatId ?? ""))) {
    toggleAuthorMarkDecoration(formatId);
    return;
  }

  executeManuscriptInlineFormatCommand(formatId);
}

// Intent: run inline command mutations from either live DOM selection or a recovered same-scene command selection.
function executeManuscriptInlineFormatCommand(formatId, {
  textarea = null,
  selectionOverride = null,
  applyOnly = false,
} = {}) {
  const activeElement = document.activeElement;
  const targetTextarea = textarea instanceof HTMLTextAreaElement && textarea.classList.contains("editor-document-input")
    ? textarea
    : activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
      ? activeElement
    : document.querySelector(".editor-document-input");
  const editorHost = resolveTextareaEditorHost(targetTextarea);
  const controller = createManuscriptCommandController({
    getInlineFormattingState: () => state.manuscriptInlineFormatting,
    setInlineFormattingState: (nextInlineFormattingState) => {
      state.manuscriptInlineFormatting = normalizeManuscriptInlineFormattingState(nextInlineFormattingState);
    },
    resolveSelection: () => selectionOverride ?? editorHost?.readSelection(
      getSceneInlineFormatRanges(String(targetTextarea?.dataset?.sceneId ?? ""), String(targetTextarea?.value ?? "").length),
    ),
    applyTextMutation: (mutation) => editorHost?.applyTextMutation(mutation),
    applyRangeMutation: (ranges) => {
      const sceneId = String(targetTextarea?.dataset?.sceneId ?? "");
      if (!sceneId) {
        return;
      }

      updateSceneDraft(sceneId, (draft) => {
        draft.inlineFormatRanges = normalizeInlineFormatRanges(ranges, String(targetTextarea?.value ?? "").length);
      }, {
        reason: "manuscript-inline-format",
        markSessionActivity: false,
      });
      syncSceneDocumentLayout({ skipSpellcheck: true });
    },
    log: editorInteractionLog,
  });
  const result = controller.execute("toggleInlineFormat", {
    format: formatId,
    applyOnly,
  });

  if (!result.applied) {
    editorInteractionLog.warn("user-action", "manuscript.inline-format.skipped", "Skipped manuscript inline formatting command.", {
      format: String(formatId ?? ""),
      reason: result.reason,
    });
    return result;
  }

  updateInlineFormatToolbarState(targetTextarea);
  return result;
}

// Intent: keep canonical mark records current while the editor command path still writes compatibility ranges.
function syncCompatibilityManuscriptMarksForScene(sceneId, {
  now = new Date().toISOString(),
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const project = state.workspace?.project;
  const scene = getScene(normalizedSceneId);
  if (!project || !scene) {
    return {
      changed: false,
      changedMarks: [],
      unmappedRanges: [],
    };
  }

  const result = syncCompatibilityManuscriptMarksForSceneState({
    marks: project.marks,
    projectId: project.id ?? "",
    chapterId: scene.chapterId ?? "",
    sceneId: normalizedSceneId,
    text: scene.editorText ?? "",
    sceneBlocks: scene.blocks,
    inlineFormatRanges: state.sceneDrafts?.[normalizedSceneId]?.inlineFormatRanges,
    now,
  });
  if (result.changed) {
    project.marks = result.marks;
    manuscriptStateLog.info("state-change", "manuscript.marks.synced", "Synchronized compatibility inline ranges into canonical manuscript marks.", {
      sceneId: normalizedSceneId,
      markCount: result.changedMarks.length,
      unmappedRangeCount: result.unmappedRanges.length,
    });
  }

  return result;
}

// Intent: update decoration marks from the same text edit and block snapshot used by the live editor draft.
function updateManuscriptMarksAfterSceneTextEdit({
  sceneId = "",
  previousText = "",
  nextText = "",
  previousSceneBlocks = [],
  nextSceneBlocks = [],
  pendingFormats = {},
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const project = state.workspace?.project;
  const scene = getScene(normalizedSceneId);
  if (!project || !scene) {
    return {
      changedMarks: [],
    };
  }

  const result = updateManuscriptMarksForSceneTextEdit({
    marks: project.marks,
    projectId: project.id ?? state.activeProjectId ?? "",
    chapterId: scene.chapterId ?? "",
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    previousSceneBlocks,
    nextSceneBlocks,
    pendingFormats,
    selectionStart,
    selectionEnd,
    now: new Date().toISOString(),
  });
  if (!result.changedMarks.length) {
    return result;
  }

  project.marks = result.marks;
  manuscriptStateLog.debug("state-change", "manuscript.marks.updated", "Updated decoration mark ranges from scene edit.", {
    sceneId: normalizedSceneId,
    markCount: result.changedMarks.length,
  });
  return result;
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
  renderHeader();
  queueWritingTargetSnapshot({
    markSessionActivity: true,
    reason: "scene-reset",
  });
}

// Intent: create manuscript structure drafts as explicit binder entities with stable IDs.
function addChapterDraft() {
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
        chapterTitle: "",
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
  const selectedScene = getScene(getSceneIdForNewSceneDraftAnchor()) ?? getSelectedScene() ?? state.scenes[0];
  if (!selectedScene) {
    return;
  }

  const sceneCount = getScenesForChapter(selectedScene.chapterId).length + 1;
  const sceneId = `draft-scene-${Date.now()}`;
  const newSceneDraft = {
    sceneId,
    chapterId: selectedScene.chapterId,
    chapterTitle: selectedScene.chapterTitle,
    sceneTitle: `New Scene ${sceneCount}`,
    initialText: "",
  };
  state.structureDrafts = insertStructureSceneDraftAfterAnchor(
    state.structureDrafts,
    state.scenes,
    newSceneDraft,
    selectedScene.sceneId,
  );
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

// Intent: treat the focused scene editor as the user's current insertion point, with persisted selection as fallback.
function getSceneIdForNewSceneDraftAnchor() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")) {
    markSceneEditorAsCurrent(activeElement);
    const focusedSceneId = typeof activeElement.dataset.sceneId === "string" ? activeElement.dataset.sceneId.trim() : "";
    if (focusedSceneId && getScene(focusedSceneId)) {
      return focusedSceneId;
    }
  }

  const activeEditorSceneId = typeof state.activeEditorSceneId === "string" ? state.activeEditorSceneId.trim() : "";
  if (activeEditorSceneId && getScene(activeEditorSceneId)) {
    return activeEditorSceneId;
  }

  const snapshotSceneId =
    state.sceneEditorSelectionSnapshot && typeof state.sceneEditorSelectionSnapshot.sceneId === "string"
      ? state.sceneEditorSelectionSnapshot.sceneId.trim()
      : "";
  if (snapshotSceneId && getScene(snapshotSceneId)) {
    return snapshotSceneId;
  }

  return typeof state.selectedSceneId === "string" ? state.selectedSceneId : "";
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

function sceneDraftHasSubstantiveBody(draft) {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  if (typeof draft.editorText === "string" && draft.editorText.trim()) {
    return true;
  }

  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  return blocks.some((block) => typeof block?.text === "string" && block.text.trim().length > 0);
}

function loadSceneDraftIntoState(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    sceneStorageLog.warn("validation", "scene.load.skipped", "Scene draft load skipped because scene ID was empty.", {
      sceneId: sceneId ?? "",
    });
    return;
  }

  const resolvedSceneId = sceneId.trim();
  const existingDraft = state.sceneDrafts?.[resolvedSceneId] ?? null;
  const existingHasBody = sceneDraftHasSubstantiveBody(existingDraft);
  if (existingDraft && existingHasBody) {
    return;
  }

  const projectRecord = getActiveProjectRecord();
  if (!projectRecord) {
    sceneStorageLog.warn("validation", "scene.load.skipped", "Scene draft load skipped because no active project record exists.", {
      sceneId: resolvedSceneId,
    });
    return;
  }

  const loadedDraft = projectService.loadScene({
    projectRecord,
    sceneId: resolvedSceneId,
  });
  if (!loadedDraft) {
    sceneStorageLog.warn("validation", "scene.load.missing", "Project service did not return a draft for requested scene.", {
      projectId: projectRecord.id,
      sceneId: resolvedSceneId,
    });
    return;
  }

  const loadedHasBody = sceneDraftHasSubstantiveBody(loadedDraft);
  if (existingDraft && !existingHasBody && !loadedHasBody) {
    return;
  }
  if (existingDraft && existingHasBody) {
    return;
  }

  state.sceneDrafts = {
    ...(state.sceneDrafts && typeof state.sceneDrafts === "object" ? state.sceneDrafts : {}),
    [resolvedSceneId]: cloneValue(loadedDraft),
  };
  const storedRecord = getProjectRecordById(projectRecord.id);
  if (storedRecord) {
    storedRecord.sceneDrafts = {
      ...(storedRecord.sceneDrafts && typeof storedRecord.sceneDrafts === "object"
        ? storedRecord.sceneDrafts
        : {}),
      [resolvedSceneId]: cloneValue(loadedDraft),
    };
  }
  refreshScenes();
  sceneStorageLog.info("state-change", "scene.load.completed", "Loaded scene draft into runtime cache.", {
    projectId: projectRecord.id,
    sceneId: resolvedSceneId,
    hadExistingDraft: existingDraft != null,
    loadedHasBody,
  });
}

function selectSceneById(sceneId) {
  const scene = getScene(sceneId);
  if (!scene) {
    editorInteractionLog.warn("validation", "scene.select.missing", "Scene selection requested for missing scene ID.", {
      sceneId: sceneId ?? "",
    });
    return;
  }

  loadSceneDraftIntoState(scene.sceneId);
  const refreshedScene = getScene(scene.sceneId);
  if (!refreshedScene) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = refreshedScene.sceneId;
  state.activeEditorSceneId = refreshedScene.sceneId;
  state.selectedBlockId = refreshedScene.blocks[0]?.blockId ?? null;
  editorInteractionLog.info("user-action", "scene.select", "Selected scene in manuscript binder.", {
    sceneId: refreshedScene.sceneId,
    chapterId: refreshedScene.chapterId ?? "",
    blockId: state.selectedBlockId ?? "",
  });
  render();
}

// Intent: let scene-editor controls step through the same ordered scene records used by the binder.
function selectNextSceneFromSceneEditor(sceneId, hintedNextSceneId = "") {
  const nextScene = resolveNextSceneForSceneEditorNavigation(sceneId, hintedNextSceneId);
  if (!nextScene) {
    editorInteractionLog.info("user-action", "scene.select.next.unavailable", "Next-scene navigation reached the end of the binder order.", {
      sceneId: sceneId ?? "",
      hintedNextSceneId: hintedNextSceneId ?? "",
    });
    return;
  }

  selectSceneById(nextScene.sceneId);
}

// Intent: prefer current scene order at click time while accepting rendered next-scene hints as a fallback.
function resolveNextSceneForSceneEditorNavigation(sceneId, hintedNextSceneId = "") {
  const scenes = Array.isArray(state.scenes) ? state.scenes : [];
  const currentSceneId = String(sceneId || state.selectedSceneId || "").trim();
  const currentIndex = scenes.findIndex((candidate) => candidate?.sceneId === currentSceneId);
  if (currentIndex >= 0) {
    return scenes.slice(currentIndex + 1).find((candidate) => typeof candidate?.sceneId === "string" && candidate.sceneId.trim()) ?? null;
  }

  const hintedScene = getScene(hintedNextSceneId);
  return hintedScene ?? null;
}

function selectChapterById(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  const chapterScene = getScenesForChapter(chapterId)[0];
  if (chapterScene) {
    selectSceneById(chapterScene.sceneId);
  }
}

function toggleUserHighlightDecoration() {
  toggleAuthorMarkDecoration("highlight");
}

function toggleDecorationEraser({
  textarea: requestedTextarea = null,
  selectionOverride = null,
} = {}) {
  const context = resolveDecorationCommandContext(requestedTextarea, "decoration-eraser");
  if (!context) {
    return {
      changed: false,
      reason: "missing-editor-context",
    };
  }

  const { textarea, editorHost, sceneId } = context;
  const liveSceneContext = reconcileLiveSceneForAuthorMarkCommand(sceneId, textarea);
  if (!liveSceneContext) {
    editorInteractionLog.warn("user-action", "manuscript.decoration-eraser.skipped", "Skipped decoration eraser command.", {
      sceneId,
      reason: "unresolved-live-scene",
    });
    return {
      changed: false,
      reason: "unresolved-live-scene",
    };
  }

  const liveText = liveSceneContext.text;
  const inlineFormatRanges = getSceneInlineFormatRanges(sceneId, liveText.length);
  const liveSelection = selectionOverride ?? editorHost.readSelection(inlineFormatRanges);
  const selectedForClear = resolveUserMarkCommandSelection({
    liveSelection,
    cachedSelection: state.sceneEditorSelectionSnapshot,
    sceneId,
    text: liveText,
    formatRanges: inlineFormatRanges,
  });
  if (selectedForClear) {
    setDecorationEraserPending(true, textarea, sceneId);
    return clearSelectedManuscriptDecorations({
      textarea,
      selectionOverride: selectedForClear,
    });
  }

  const pendingIntent = resolveUserMarkCommandIntent({
    liveSelection,
    cachedSelection: state.sceneEditorSelectionSnapshot,
    sceneId,
    text: liveText,
    formatRanges: inlineFormatRanges,
    preferPendingToggle: true,
  });
  if (pendingIntent?.mode !== USER_MARK_COMMAND_MODE.PENDING) {
    editorInteractionLog.warn("user-action", "manuscript.decoration-eraser.skipped", "Skipped decoration eraser command.", {
      sceneId,
      reason: "empty-selection",
    });
    return {
      changed: false,
      reason: "empty-selection",
    };
  }

  const nextPending = !isPendingManuscriptDecorationEraser();
  setDecorationEraserPending(nextPending, textarea, sceneId);
  return {
    changed: false,
    pending: nextPending,
  };
}

// Intent: turn the eraser into the only active decoration paint tool without touching manuscript text.
function setDecorationEraserPending(active, textarea = null, sceneId = "") {
  state.manuscriptInlineFormatting = createNextDecorationEraserState(
    state.manuscriptInlineFormatting,
    active === true,
  );
  updateInlineFormatToolbarState(textarea);
  editorInteractionLog.info("user-action", "manuscript.decoration-eraser.pending-toggled", "Toggled pending decoration eraser.", {
    sceneId,
    pending: active === true,
  });
}

// Intent: clear author-owned decorations from a selected manuscript range without changing the manuscript text.
function clearSelectedManuscriptDecorations({
  textarea: requestedTextarea = null,
  selectionOverride = null,
  suppressHistory = false,
} = {}) {
  const context = resolveDecorationCommandContext(requestedTextarea, "decoration-eraser");
  if (!context) {
    return {
      changed: false,
      reason: "missing-editor-context",
    };
  }

  const { textarea, editorHost, sceneId, project } = context;
  const liveSceneContext = reconcileLiveSceneForAuthorMarkCommand(sceneId, textarea);
  if (!liveSceneContext) {
    editorInteractionLog.warn("user-action", "manuscript.decoration-eraser.skipped", "Skipped decoration eraser command.", {
      sceneId,
      reason: "unresolved-live-scene",
    });
    return {
      changed: false,
      reason: "unresolved-live-scene",
    };
  }

  const scene = liveSceneContext.scene;
  const liveText = liveSceneContext.text;
  const liveSceneBlocks = liveSceneContext.blocks;
  const inlineFormatRanges = getSceneInlineFormatRanges(sceneId, liveText.length);
  const liveSelection = selectionOverride ?? editorHost.readSelection(inlineFormatRanges);
  const selection = resolveUserMarkCommandSelection({
    liveSelection,
    cachedSelection: state.sceneEditorSelectionSnapshot,
    sceneId,
    text: liveText,
    formatRanges: inlineFormatRanges,
  });
  if (!selection) {
    editorInteractionLog.warn("user-action", "manuscript.decoration-eraser.skipped", "Skipped decoration eraser command.", {
      sceneId,
      reason: "empty-selection",
    });
    return {
      changed: false,
      reason: "empty-selection",
    };
  }

  const now = new Date().toISOString();
  const beforeMarkHistorySnapshot = suppressHistory
    ? null
    : captureManuscriptMarkHistorySnapshotForScene(sceneId, liveText.length);
  const marksForClear = removeSceneCompatibilityMarks(project.marks, sceneId);
  const markResult = clearManuscriptMarksForSceneSelection({
    marks: marksForClear,
    sequences: project.sequences,
    projectId: project.id ?? state.activeProjectId ?? "",
    chapterId: scene.chapterId ?? "",
    sceneId,
    text: liveText,
    sceneBlocks: liveSceneBlocks,
    selection,
    source: "author",
    now,
  });
  const nextInlineFormatRanges = clearInlineFormatRangesForSelection(
    inlineFormatRanges,
    selection,
    liveText.length,
  );
  const marksChanged = markResult.changed === true;
  const inlineRangesChanged = JSON.stringify(inlineFormatRanges) !== JSON.stringify(nextInlineFormatRanges);
  if (!marksChanged && !inlineRangesChanged) {
    updateInlineFormatToolbarState(textarea);
    editorInteractionLog.warn("user-action", "manuscript.decoration-eraser.skipped", "Skipped decoration eraser command.", {
      sceneId,
      reason: "no-decorations-in-selection",
    });
    return {
      ...markResult,
      changed: false,
      inlineRangesChanged: false,
    };
  }

  project.marks = markResult.marks;
  project.sequences = markResult.sequences;
  updateSceneDraft(sceneId, (draft) => {
    draft.editorText = liveText;
    draft.blocks = liveSceneBlocks;
    draft.inlineFormatRanges = nextInlineFormatRanges;
  }, {
    reason: "manuscript-decoration-eraser",
    markSessionActivity: false,
  });
  if (!suppressHistory) {
    const afterMarkHistorySnapshot = captureManuscriptMarkHistorySnapshotForScene(sceneId, liveText.length);
    state.manuscriptMarkHistory = pushManuscriptMarkHistoryEntry(
      state.manuscriptMarkHistory,
      createManuscriptMarkHistoryEntry({
        sceneId,
        formatId: INLINE_DECORATION_ERASER.id,
        beforeSnapshot: beforeMarkHistorySnapshot,
        afterSnapshot: afterMarkHistorySnapshot,
        selection,
        createdAt: now,
      }),
    );
  }

  const viewport = captureSceneEditorViewport(sceneId);
  syncSceneDocumentLayout({ skipSpellcheck: true });
  restoreSceneEditorViewportSelection(sceneId, viewport, selection);
  updateInlineFormatToolbarState(textarea);
  editorInteractionLog.info("user-action", "manuscript.decoration-eraser.applied", "Cleared manuscript decorations from selected text.", {
    sceneId,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
    selectedTextLength: Math.max(0, selection.endOffset - selection.startOffset),
    selectedTextPreview: liveText.slice(selection.startOffset, selection.endOffset).slice(0, 80),
    removedMarkCount: markResult.removedMarkIds.length,
    preservedMarkFragmentCount: markResult.addedMarks.length,
    inlineRangesChanged,
    selectionSource: selection.selectionSource,
    pending: isPendingManuscriptDecorationEraser(),
  });

  return {
    ...markResult,
    changed: true,
    inlineRangesChanged,
  };
}

function resolveDecorationCommandContext(requestedTextarea = null, commandName = "decoration-command") {
  const activeElement = document.activeElement;
  const cachedSceneId =
    state.sceneEditorSelectionSnapshot && typeof state.sceneEditorSelectionSnapshot.sceneId === "string"
      ? state.sceneEditorSelectionSnapshot.sceneId.trim()
      : "";
  const textarea = requestedTextarea instanceof HTMLTextAreaElement && requestedTextarea.classList.contains("editor-document-input")
    ? requestedTextarea
    : activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
      ? activeElement
      : cachedSceneId
        ? document.querySelector(`.editor-document-input[data-scene-id="${CSS.escape(cachedSceneId)}"]`)
        : document.querySelector(".editor-document-input");
  const editorHost = resolveTextareaEditorHost(textarea);
  const sceneId = String(textarea?.dataset?.sceneId ?? "");
  const scene = getScene(sceneId);
  const project = state.workspace?.project;
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost || !scene || !project) {
    editorInteractionLog.warn("user-action", `manuscript.${commandName}.skipped`, "Skipped manuscript decoration command.", {
      sceneId,
      reason: "missing-editor-context",
    });
    return null;
  }

  return {
    textarea,
    editorHost,
    sceneId,
    scene,
    project,
  };
}

function removeSceneCompatibilityMarks(marks = [], sceneId = "") {
  const normalizedSceneId = String(sceneId ?? "");
  return (Array.isArray(marks) ? marks : []).filter((mark) => !(
    isCompatibilityManuscriptMark(mark) &&
    String(mark?.anchor?.sceneId ?? "") === normalizedSceneId
  ));
}

// Intent: make author mark commands reliable when a fresh draft scene's visible textarea is ahead of scene state.
function reconcileLiveSceneForAuthorMarkCommand(sceneId, textarea) {
  const normalizedSceneId = String(sceneId ?? "");
  const scene = getScene(normalizedSceneId);
  if (!scene || !(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const liveText = String(textarea.value ?? "");
  const previousText = String(scene.editorText ?? "");
  const sourceBlocks = Array.isArray(scene.blocks) && scene.blocks.length
    ? scene.blocks
    : state.sceneDrafts?.[normalizedSceneId]?.blocks;
  const editedBlocks = updateSceneBlocksForTextEdit({
    blocks: sourceBlocks,
    sceneId: normalizedSceneId,
    previousText,
    nextText: liveText,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
  });
  const liveBlocks = reconcileSceneBlocksWithEditorText({
    blocks: editedBlocks,
    sceneId: normalizedSceneId,
    chapterId: scene.chapterId ?? state.sceneDrafts?.[normalizedSceneId]?.chapterId ?? "",
    text: liveText,
  });

  if (shouldSyncLiveSceneDraftForAuthorMark(scene, liveText, liveBlocks)) {
    updateSceneDraft(normalizedSceneId, (draft) => {
      draft.editorText = liveText;
      draft.blocks = liveBlocks;
    }, {
      reason: "manuscript-author-mark-live-text",
      markSessionActivity: false,
      immediate: true,
    });
    syncSceneEditorWordCountReadouts(textarea);
  }

  const refreshedScene = getScene(normalizedSceneId) ?? scene;
  return {
    scene: {
      ...refreshedScene,
      editorText: liveText,
      blocks: liveBlocks,
    },
    text: liveText,
    blocks: liveBlocks,
  };
}

function shouldSyncLiveSceneDraftForAuthorMark(scene, liveText, liveBlocks) {
  if (String(scene?.editorText ?? "") !== String(liveText ?? "")) {
    return true;
  }

  const sceneBlocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  if (sceneBlocks.length !== liveBlocks.length) {
    return true;
  }

  return sceneBlocks.some((block, index) => {
    const liveBlock = liveBlocks[index] ?? {};
    return (
      String(block?.blockId ?? "") !== String(liveBlock.blockId ?? "") ||
      String(block?.paragraphId ?? "") !== String(liveBlock.paragraphId ?? "") ||
      String(block?.text ?? "") !== String(liveBlock.text ?? "")
    );
  });
}

// Intent: capture the render-affecting manuscript mark state for bounded Ctrl+Z/Ctrl+Y history.
function captureManuscriptMarkHistorySnapshotForScene(sceneId, textLength = Number.POSITIVE_INFINITY) {
  const project = state.workspace?.project;
  return createManuscriptMarkHistorySnapshot({
    marks: project?.marks,
    sequences: project?.sequences,
    inlineFormatRanges: getSceneInlineFormatRanges(sceneId, textLength),
  });
}

// Intent: apply author mark buttons to selected manuscript spans or toggle pending styling for incoming text.
function toggleAuthorMarkDecoration(formatId, {
  textarea: requestedTextarea = null,
  selectionOverride = null,
  applyOnly = false,
  suppressHistory = false,
} = {}) {
  const normalizedFormatId = normalizeAuthorMarkDecorationFormat(formatId);
  const formatLabel = INLINE_FORMATS[normalizedFormatId]?.label ?? normalizedFormatId;
  if (!normalizedFormatId) {
    editorInteractionLog.warn("user-action", "manuscript.mark.skipped", "Skipped author mark command.", {
      format: String(formatId ?? ""),
      reason: "unsupported-format",
    });
    return;
  }

  const activeElement = document.activeElement;
  const cachedSceneId =
    state.sceneEditorSelectionSnapshot && typeof state.sceneEditorSelectionSnapshot.sceneId === "string"
      ? state.sceneEditorSelectionSnapshot.sceneId.trim()
      : "";
  const textarea = requestedTextarea instanceof HTMLTextAreaElement && requestedTextarea.classList.contains("editor-document-input")
    ? requestedTextarea
    : activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
      ? activeElement
      : cachedSceneId
        ? document.querySelector(`.editor-document-input[data-scene-id="${CSS.escape(cachedSceneId)}"]`)
        : document.querySelector(".editor-document-input");
  const editorHost = resolveTextareaEditorHost(textarea);
  const sceneId = String(textarea?.dataset?.sceneId ?? "");
  let scene = getScene(sceneId);
  const project = state.workspace?.project;
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost || !scene || !project) {
    editorInteractionLog.warn("user-action", `manuscript.${normalizedFormatId}.skipped`, `Skipped ${formatLabel.toLowerCase()} author mark command.`, {
      sceneId,
      reason: "missing-editor-context",
    });
    return;
  }

  const liveSceneContext = reconcileLiveSceneForAuthorMarkCommand(sceneId, textarea);
  if (!liveSceneContext) {
    editorInteractionLog.warn("user-action", `manuscript.${normalizedFormatId}.skipped`, `Skipped ${formatLabel.toLowerCase()} author mark command.`, {
      sceneId,
      reason: "unresolved-live-scene",
    });
    return;
  }

  scene = liveSceneContext.scene;
  const liveText = liveSceneContext.text;
  const liveSceneBlocks = liveSceneContext.blocks;
  const inlineFormatRanges = getSceneInlineFormatRanges(sceneId, liveText.length);
  const liveSelection = selectionOverride ?? editorHost.readSelection(inlineFormatRanges);
  const formatPending = normalizeManuscriptInlineFormattingState(
    state.manuscriptInlineFormatting,
  ).pendingFormats[normalizedFormatId] === true;
  let commandIntent = null;
  if (formatPending) {
    const selectedWhilePending = resolveUserMarkCommandSelection({
      liveSelection,
      cachedSelection: null,
      sceneId,
      text: liveText,
      formatRanges: inlineFormatRanges,
    });
    if (selectedWhilePending) {
      commandIntent = {
        mode: USER_MARK_COMMAND_MODE.SELECTION,
        selection: selectedWhilePending,
      };
    } else if (!applyOnly) {
      stopPendingAuthorMarkDecoration(normalizedFormatId, textarea, sceneId);
      return;
    }
  }

  if (!commandIntent && applyOnly) {
    const selectedForApply = resolveUserMarkCommandSelection({
      liveSelection,
      cachedSelection: state.sceneEditorSelectionSnapshot,
      sceneId,
      text: liveText,
      formatRanges: inlineFormatRanges,
    });
    commandIntent = selectedForApply
      ? {
          mode: USER_MARK_COMMAND_MODE.SELECTION,
          selection: selectedForApply,
        }
      : null;
  }

  if (!commandIntent && !applyOnly) {
    commandIntent = resolveUserMarkCommandIntent({
      liveSelection,
      cachedSelection: state.sceneEditorSelectionSnapshot,
      sceneId,
      text: liveText,
      formatRanges: inlineFormatRanges,
    });
  }
  if (!commandIntent) {
    editorInteractionLog.warn("user-action", `manuscript.${normalizedFormatId}.skipped`, `Skipped ${formatLabel.toLowerCase()} author mark command.`, {
      sceneId,
      reason: "empty-selection",
    });
    return;
  }

  if (commandIntent.mode === USER_MARK_COMMAND_MODE.PENDING) {
    const result = executeManuscriptInlineFormatCommand(normalizedFormatId, {
      textarea,
      selectionOverride: commandIntent.selection,
    });
    if (result?.applied) {
      editorInteractionLog.info("user-action", `manuscript.${normalizedFormatId}.pending-toggled`, `Toggled pending ${formatLabel.toLowerCase()} for incoming text.`, {
        sceneId,
        selectionSource: commandIntent.selection.selectionSource,
        pending: result.state?.pendingFormats?.[normalizedFormatId] === true,
      });
    }
    return;
  }

  const selection = commandIntent.selection;
  state.manuscriptInlineFormatting = normalizeManuscriptInlineFormattingState({
    ...state.manuscriptInlineFormatting,
    pendingFormats: {
      ...state.manuscriptInlineFormatting?.pendingFormats,
      [normalizedFormatId]: applyOnly ? formatPending === true : true,
    },
    pendingClearDecorations: false,
  });

  const now = new Date().toISOString();
  const beforeMarkHistorySnapshot = suppressHistory
    ? null
    : captureManuscriptMarkHistorySnapshotForScene(sceneId, liveText.length);
  syncCompatibilityManuscriptMarksForScene(sceneId, {
    now,
  });

  const mutateMarksForSceneSelection = applyManuscriptMarksForSceneSelection;
  const result = mutateMarksForSceneSelection({
    marks: project.marks,
    sequences: project.sequences,
    projectId: project.id ?? state.activeProjectId ?? "",
    chapterId: scene.chapterId ?? "",
    sceneId,
    text: liveText,
    sceneBlocks: liveSceneBlocks,
    selection,
    kind: normalizedFormatId,
    source: "author",
    metadata: getAuthorMarkDecorationMetadata(normalizedFormatId),
    now,
  });
  if (!result.changed) {
    updateInlineFormatToolbarState(textarea);
    editorInteractionLog.warn("user-action", `manuscript.${normalizedFormatId}.skipped`, `Skipped ${formatLabel.toLowerCase()} author mark command.`, {
      sceneId,
      reason: result.reason,
    });
    return;
  }

  const promotedResult = promoteCompatibilityManuscriptMarksForSceneFormat({
    marks: result.marks,
    sequences: result.sequences,
    sceneId,
    kind: normalizedFormatId,
    source: "author",
    now,
  });
  project.marks = promotedResult.marks;
  project.sequences = promotedResult.sequences;
  updateSceneDraft(sceneId, (draft) => {
    draft.editorText = liveText;
    draft.blocks = liveSceneBlocks;
    draft.inlineFormatRanges = removeInlineFormatRangesByFormat(
      draft.inlineFormatRanges,
      normalizedFormatId,
      liveText.length,
    );
  }, {
    reason: "manuscript-author-mark",
    markSessionActivity: false,
  });
  if (!suppressHistory) {
    const afterMarkHistorySnapshot = captureManuscriptMarkHistorySnapshotForScene(sceneId, liveText.length);
    state.manuscriptMarkHistory = pushManuscriptMarkHistoryEntry(
      state.manuscriptMarkHistory,
      createManuscriptMarkHistoryEntry({
        sceneId,
        formatId: normalizedFormatId,
        beforeSnapshot: beforeMarkHistorySnapshot,
        afterSnapshot: afterMarkHistorySnapshot,
        selection,
        createdAt: now,
      }),
    );
  }
  const viewport = captureSceneEditorViewport(sceneId);
  syncSceneDocumentLayout({ skipSpellcheck: true });
  restoreSceneEditorViewportSelection(sceneId, viewport, selection);
  updateInlineFormatToolbarState(textarea);
  editorInteractionLog.info("user-action", `manuscript.${normalizedFormatId}.toggled`, `Toggled ${formatLabel.toLowerCase()} author mark.`, {
    sceneId,
    format: normalizedFormatId,
    applyOnly,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
    selectedTextLength: Math.max(0, selection.endOffset - selection.startOffset),
    selectedTextPreview: liveText.slice(selection.startOffset, selection.endOffset).slice(0, 80),
    addedCount: result.addedMarks.length,
    removedCount: result.removedMarkIds.length,
    promotedCompatibilityCount: promotedResult.promotedMarkIds.length,
    selectionSource: selection.selectionSource,
    toggledOff: result.toggledOff,
    pending: normalizeManuscriptInlineFormattingState(state.manuscriptInlineFormatting).pendingFormats[normalizedFormatId] === true,
  });
  return result;
}

function stopPendingUserHighlightDecoration(textarea, sceneId = "") {
  stopPendingAuthorMarkDecoration("highlight", textarea, sceneId);
}

// Intent: turn off one pending author mark switch without changing selected manuscript text.
function stopPendingAuthorMarkDecoration(formatId, textarea, sceneId = "") {
  const normalizedFormatId = normalizeAuthorMarkDecorationFormat(formatId);
  if (!normalizedFormatId) {
    return;
  }

  state.manuscriptInlineFormatting = normalizeManuscriptInlineFormattingState({
    ...state.manuscriptInlineFormatting,
    pendingFormats: {
      ...state.manuscriptInlineFormatting?.pendingFormats,
      [normalizedFormatId]: false,
    },
  });
  updateInlineFormatToolbarState(textarea);
  editorInteractionLog.info("user-action", `manuscript.${normalizedFormatId}.pending-toggled`, `Stopped pending ${normalizedFormatId} for incoming text.`, {
    sceneId,
    pending: false,
  });
}

function normalizeAuthorMarkDecorationFormat(formatId) {
  const normalizedFormatId = String(formatId ?? "").trim();
  return AUTHOR_MARK_DECORATION_FORMAT_IDS.has(normalizedFormatId) ? normalizedFormatId : "";
}

function getAuthorMarkDecorationMetadata(formatId) {
  if (formatId === "highlight") {
    const highlightColor = resolveHighlightColorOption(
      state.editorPrefs.highlightColorId,
      state.editorPrefs.highlightCustomRgb,
    );
    return {
      purpose: "reference",
      colorToken: "user-highlight",
      highlightColor: {
        id: highlightColor.id,
        label: highlightColor.label,
        color: highlightColor.color,
        outline: highlightColor.outline,
        ...(highlightColor.rgb ? { rgb: highlightColor.rgb } : {}),
      },
    };
  }

  return {
    purpose: "emphasis",
  };
}

function removeInlineFormatRangesByFormat(ranges, formatId, textLength = Number.POSITIVE_INFINITY) {
  return normalizeInlineFormatRanges(ranges, textLength)
    .filter((range) => range.formatId !== formatId);
}

function toggleChapterCollapse(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  state.collapsedChapterIds = toggleCollapsedChapterId(state.collapsedChapterIds, chapterId);
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  persistCurrentProjectRecord();
  renderBinderPanel();
}

function toggleConsoleChapterCollapse(panelId, chapterKey) {
  if (typeof panelId !== "string" || !panelId.trim() || typeof chapterKey !== "string" || !chapterKey.trim()) {
    return;
  }

  if (!state.activeProjectId) {
    return;
  }

  const panelState = toggleCollapsedConsoleChapter(state.collapsedConsoleChapterIds, panelId, chapterKey);
  if (panelState === state.collapsedConsoleChapterIds) {
    return;
  }
  state.collapsedConsoleChapterIds = panelState;
  persistCollapsedConsoleChapterState(state.activeProjectId, panelState);
  persistCurrentProjectRecord();
  renderConsolePanel();
}

function syncSelectionFromBlock(blockId) {
  const scene = blockId ? findSceneByBlockId(state.scenes, blockId) : state.scenes[0];
  if (!scene) {
    return;
  }

  loadSceneDraftIntoState(scene.sceneId);
  const resolvedScene = getScene(scene.sceneId) ?? scene;
  state.selectedSceneId = resolvedScene.sceneId;
  state.selectedBlockId =
    blockId && resolvedScene.blocks.some((block) => block.blockId === blockId)
      ? blockId
      : resolvedScene.blocks[0]?.blockId ?? null;
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

function isChapterCollapsed(chapterId) {
  return state.collapsedChapterIds.includes(chapterId);
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

// Intent: resolve both automatic scene-derived nodes and saved world-schema nodes through the World Spine model.
function getWorldSpineTimelineNode(nodeId) {
  return findWorldSpineNode(buildWorldSpineModelForState(), nodeId);
}

function isWorldSpineAssignableEventNodeForContext(node) {
  return isWorldSpineAssignableEventNode(node);
}

// Intent: collapse RHS card detail when World Spine focus moves to a different timeline event.
function setWorldSpineSelectedNodeId(nodeId = null) {
  const normalizedNodeId = String(nodeId ?? "").trim();
  const nextNodeId = normalizedNodeId || null;
  if (state.selectedNodeId !== nextNodeId) {
    state.worldSpineRelatedCardExpandedKey = "";
    state.worldSpineSublocationComposer = null;
  }
  state.selectedNodeId = nextNodeId;
  return nextNodeId;
}

// Intent: let blank-canvas clicks remove event scope so catalogue strip counts return to full-project totals.
function clearWorldSpineSelection({ renderAfter = true } = {}) {
  const hadSelection = Boolean(
    state.selectedNodeId ||
    state.selectedBlockId ||
    state.selectedEntityId ||
    state.worldSpineScrollTargetNodeId ||
    state.worldSpinePassageScrollTargetBlockId ||
    state.worldSpineRelatedCardExpandedKey ||
    state.worldSpineSublocationComposer
  );
  if (!hadSelection) {
    return false;
  }

  state.selectedNodeId = null;
  state.selectedBlockId = null;
  state.selectedEntityId = null;
  state.worldSpineScrollTargetNodeId = "";
  state.worldSpinePassageScrollTargetBlockId = "";
  state.worldSpineRelatedCardExpandedKey = "";
  state.worldSpineSublocationComposer = null;
  worldSpineController.close();
  if (renderAfter) {
    render();
  }
  return true;
}

function selectWorldSpineNode(nodeId) {
  const timelineNode = getWorldSpineTimelineNode(nodeId);
  const savedNode = timelineNode ? null : getNode(nodeId);
  const selectedNodeId = timelineNode?.id ?? savedNode?.id ?? "";
  if (!selectedNodeId) {
    return;
  }

  setWorldSpineSelectedNodeId(selectedNodeId);
  state.worldSpineScrollTargetNodeId = selectedNodeId;

  const primaryBlockId = timelineNode?.primaryBlockId ?? savedNode?.primaryBlockId ?? "";
  if (primaryBlockId) {
    state.selectedIssueId = null;
    syncSelectionFromBlock(primaryBlockId);
  }
  if (!timelineNode && savedNode?.linkedEntityIds?.[0]) {
    state.selectedEntityId = savedNode.linkedEntityIds[0];
  }

  render();
}

// Intent: show the clicked World Spine event's manuscript section without mutating world records.
function openWorldSpinePassage(nodeId, hintedBlockId = "") {
  const timelineNode = getWorldSpineTimelineNode(nodeId);
  const savedNode = timelineNode ? null : getNode(nodeId);
  const selectedNodeId = timelineNode?.id ?? savedNode?.id ?? "";
  const blockId = hintedBlockId || timelineNode?.primaryBlockId || savedNode?.primaryBlockId || "";
  if (!selectedNodeId || !blockId) {
    return;
  }

  setWorldSpineSelectedNodeId(selectedNodeId);
  state.selectedIssueId = null;
  state.worldSpineRightPaneMode = normalizeWorldSpineRightPaneMode(WORLD_SPINE_RIGHT_PANE_MODE_EVENT_SECTION);
  state.worldSpineScrollTargetNodeId = selectedNodeId;
  state.worldSpinePassageScrollTargetBlockId = blockId;
  syncSelectionFromBlock(blockId);
  render();
}

// Intent: let a cross-location implication line pivot the visible lane to its target event.
function navigateWorldSpineImplicationTarget(context = {}) {
  const targetNodeId = String(context?.toNodeId ?? "").trim() || String(context?.fromNodeId ?? "").trim();
  const targetNode = getWorldSpineTimelineNode(targetNodeId);
  if (!targetNode) {
    return;
  }

  setWorldSpineSelectedNodeId(targetNode.id);
  state.worldSpineScrollTargetNodeId = targetNode.id;
  const locationKey = String(targetNode.locationKey ?? "").trim();
  if (locationKey) {
    state.worldSpineLocationFilter = normalizeWorldSpineLocationFilterState({
      selectedLocationKeys: [locationKey],
    });
    state.worldSpineScrollTargetLocationKey = locationKey;
  }
  if (targetNode.primaryBlockId) {
    state.selectedIssueId = null;
    syncSelectionFromBlock(targetNode.primaryBlockId);
  }

  persistCurrentProjectRecord({
    domain: "app-settings",
    dirtyReason: "world-spine-implication-target-opened",
    source: "navigateWorldSpineImplicationTarget",
  });
  uiEventDispatcherLog.info("user-action", "world-spine.implication-target.opened", "Opened a World Spine implication target.", {
    edgeId: String(context?.edgeId ?? "").trim(),
    targetNodeId: targetNode.id,
    locationKey,
  });
  render();
}

// Intent: open the reviewed implication text form after a node-to-node World Spine drag completes.
function openWorldSpineImplicationComposer(draft = {}) {
  const fromNodeId = String(draft?.fromNodeId ?? "").trim();
  const toNodeId = String(draft?.toNodeId ?? "").trim();
  if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
    return;
  }

  const model = buildWorldSpineModelForState();
  if (!findWorldSpineNode(model, fromNodeId) || !findWorldSpineNode(model, toNodeId)) {
    return;
  }

  state.worldSpineImplicationComposer = {
    edgeId: String(draft.edgeId ?? "").trim(),
    fromNodeId,
    toNodeId,
    x: Math.max(0, Math.round(Number(draft.x) || 0)),
    y: Math.max(0, Math.round(Number(draft.y) || 0)),
    width: Math.max(220, Math.round(Number(draft.width) || 276)),
    effect: normalizeWorldSpineImplicationText(draft.effect),
    error: "",
  };
  renderWorldPanel();
  window.requestAnimationFrame(focusWorldSpineImplicationComposer);
}

// Intent: reopen a saved implication edge in the same reviewed composer used for new links.
function openWorldSpineImplicationEditorFromContextMenu(target = null) {
  const edgeId = String(
    target?.dataset?.worldSpineEdgeId ??
    state.worldSpineContextMenu?.edgeId ??
    "",
  ).trim();
  if (!edgeId) {
    hideWorldSpineContextMenu();
    return;
  }

  const edge = normalizeWorldSpineEdges(state.workspace?.world?.edges)
    .find((candidate) => candidate.id === edgeId);
  if (!edge) {
    hideWorldSpineContextMenu();
    return;
  }

  const context = normalizeWorldSpineMenuContext(state.worldSpineContextMenu) ?? {};
  hideWorldSpineContextMenu({ renderAfter: false });
  openWorldSpineImplicationComposer({
    edgeId: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    x: context.composerX || 16,
    y: context.composerY || 16,
    width: 300,
    effect: edge.effect || edge.label,
  });
}

// Intent: commit a reviewed implication edge through the canonical project persistence boundary.
function saveWorldSpineImplicationComposer() {
  const composer = document.querySelector("[data-world-spine-implication-composer]");
  if (!(composer instanceof HTMLElement)) {
    return;
  }

  const input = composer.querySelector("[data-world-spine-implication-input]");
  const effect = normalizeWorldSpineImplicationText(
    input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement
      ? input.value
      : state.worldSpineImplicationComposer?.effect,
  );
  const fromNodeId = String(composer.dataset.fromNodeId ?? state.worldSpineImplicationComposer?.fromNodeId ?? "").trim();
  const toNodeId = String(composer.dataset.toNodeId ?? state.worldSpineImplicationComposer?.toNodeId ?? "").trim();
  const edgeId = String(composer.dataset.worldSpineEdgeId ?? state.worldSpineImplicationComposer?.edgeId ?? "").trim();

  if (!effect) {
    state.worldSpineImplicationComposer = {
      ...state.worldSpineImplicationComposer,
      edgeId,
      fromNodeId,
      toNodeId,
      effect,
      error: "Add an implication before saving.",
    };
    renderWorldPanel();
    return;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  if (edgeId) {
    const result = updateWorldSpineImplicationEdgeInWorld(state.workspace?.world ?? {}, {
      edgeId,
      effect,
    });
    if (!result.edge) {
      state.worldSpineImplicationComposer = {
        ...state.worldSpineImplicationComposer,
        edgeId,
        fromNodeId,
        toNodeId,
        effect,
        error: result.reason === "missing-effect"
          ? "Add an implication before saving."
          : "The implication link could not be edited.",
      };
      renderWorldPanel();
      return;
    }

    state.workspace.world = result.world;
    setWorldSpineSelectedNodeId(result.edge.toNodeId);
    state.worldSpineScrollTargetNodeId = result.edge.toNodeId;
    state.worldSpineImplicationComposer = null;
    persistCurrentProjectRecord({
      domain: "world",
      dirtyReason: "world-spine-implication-edge-edited",
      source: "saveWorldSpineImplicationComposer",
    });
    pushWorldSpineHistoryChange(historyBefore, {
      label: "Edited implication link",
      dirtyReason: "world-spine-implication-edge-edited",
      source: "saveWorldSpineImplicationComposer",
    });
    renderWorldPanel();
    return;
  }

  const result = applyWorldSpineImplicationEdgeToWorld(state.workspace?.world ?? {}, {
    fromNodeId,
    toNodeId,
    effect,
  });
  if (!result.edge) {
    state.worldSpineImplicationComposer = {
      ...state.worldSpineImplicationComposer,
      fromNodeId,
      toNodeId,
      effect,
      error: "Choose two different timeline nodes.",
    };
    renderWorldPanel();
    return;
  }

  state.workspace.world = result.world;
  setWorldSpineSelectedNodeId(result.edge.toNodeId);
  state.worldSpineScrollTargetNodeId = result.edge.toNodeId;
  state.worldSpineImplicationComposer = null;
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "world-spine-implication-edge-created",
    source: "saveWorldSpineImplicationComposer",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Created implication link",
    dirtyReason: "world-spine-implication-edge-created",
    source: "saveWorldSpineImplicationComposer",
  });
  renderWorldPanel();
}

function cancelWorldSpineImplicationComposer() {
  state.worldSpineImplicationComposer = null;
  renderWorldPanel();
}

// Intent: let authors remove reviewed implication links without mutating timeline nodes themselves.
function deleteWorldSpineImplication(edgeId = "") {
  const normalizedEdgeId = String(edgeId ?? "").trim();
  if (!normalizedEdgeId) {
    return false;
  }

  const historyBefore = captureWorldSpineHistorySnapshot();
  const result = deleteWorldSpineImplicationEdgeFromWorld(state.workspace?.world ?? {}, normalizedEdgeId);
  if (!result.edge) {
    renderWorldPanel();
    return false;
  }

  state.workspace.world = result.world;
  setWorldSpineSelectedNodeId(result.edge.toNodeId || result.edge.fromNodeId || state.selectedNodeId);
  state.worldSpineScrollTargetNodeId = state.selectedNodeId || "";
  state.worldSpineImplicationComposer = null;
  persistCurrentProjectRecord({
    domain: "world",
    dirtyReason: "world-spine-implication-edge-deleted",
    source: "deleteWorldSpineImplication",
  });
  pushWorldSpineHistoryChange(historyBefore, {
    label: "Deleted implication link",
    dirtyReason: "world-spine-implication-edge-deleted",
    source: "deleteWorldSpineImplication",
  });
  renderWorldPanel();
  return true;
}

function focusWorldSpineImplicationComposer() {
  const input = document.querySelector("[data-world-spine-implication-input]");
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
}

// Intent: route ManuScriptInfographicLane marker clicks back to the owning metadata or World Spine record.
function openManuScriptInfographicLaneMarker(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const recordType = String(target.dataset.recordType ?? "").trim();
  const recordId = String(target.dataset.recordId ?? "").trim();
  const nodeId = String(target.dataset.nodeId ?? "").trim();
  if (!recordType || !recordId) {
    return;
  }

  hideFileMenu();
  hideTaskSurfaces();
  if (recordType === "task") {
    const task = state.manuscriptTasks.find((candidate) => candidate.id === recordId);
    if (!task) {
      return;
    }

    if (state.activePane !== "manuscript") {
      selectWorkspacePane("manuscript");
      window.requestAnimationFrame(() => navigateTaskAnchor(recordId));
      return;
    }

    navigateTaskAnchor(recordId);
    return;
  }

  if (recordType === "passageNote") {
    const note = state.passageNotes.find((candidate) => candidate.id === recordId);
    if (!note) {
      return;
    }

    if (state.activePane !== "manuscript") {
      selectWorkspacePane("manuscript");
      window.requestAnimationFrame(() => selectPassageNote(recordId));
      return;
    }

    selectPassageNote(recordId);
    return;
  }

  const targetNodeId = nodeId || (recordType === "eventTag" ? `event:${recordId}` : recordId);
  if (!targetNodeId) {
    return;
  }

  if (state.activePane !== "world") {
    selectWorkspacePane("world");
  }
  selectWorldSpineNode(targetNodeId);
}

function getEntity(entityId) {
  return state.workspace.world.entities.find((entity) => entity.id === entityId) ?? null;
}

function stripChapterTitlePrefix(chapterTitle) {
  return String(chapterTitle ?? "")
    .replace(/^(?:new\s+)?chapter\s+\d+\s*[:\-–—]?\s*/i, "")
    .trim();
}

function getEditableChapterTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  if (!value) {
    return "";
  }

  const stripped = stripChapterTitlePrefix(value);
  return stripped || value;
}

function updateBinderChapterTitle(node, chapterId, title) {
  if (!node || typeof node !== "object") {
    return false;
  }

  let updated = false;
  if (node.kind === "chapter" && node.refId === chapterId) {
    node.title = title;
    updated = true;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      updated = updateBinderChapterTitle(child, chapterId, title) || updated;
    }
  }

  return updated;
}

function updateChapterTitle(chapterId, title) {
  if (typeof chapterId !== "string" || !chapterId.trim() || !state.workspace?.project) {
    return;
  }

  const nextTitle = String(title ?? "");
  let updated = false;

  if (Array.isArray(state.workspace.project.lines)) {
    for (const line of state.workspace.project.lines) {
      if (line.chapterId === chapterId) {
        line.chapterTitle = nextTitle;
        updated = true;
      }
    }
  }

  if (state.workspace.project.navigationTargets && typeof state.workspace.project.navigationTargets === "object") {
    const navigationTarget = state.workspace.project.navigationTargets[chapterId];
    if (navigationTarget && typeof navigationTarget === "object") {
      navigationTarget.title = nextTitle;
      updated = true;
    }
  }

  if (state.workspace.project.binder) {
    updated = updateBinderChapterTitle(state.workspace.project.binder, chapterId, nextTitle) || updated;
  }

  if (Array.isArray(state.structureDrafts.scenes)) {
    for (const scene of state.structureDrafts.scenes) {
      if (scene.chapterId === chapterId) {
        scene.chapterTitle = nextTitle;
        updated = true;
      }
    }
  }

  if (!updated) {
    return;
  }

  refreshScenes();
  persistCurrentProjectRecord();
  updateSceneEditorChapterTitle(chapterId, nextTitle);
}

function beginChapterTitleEdit(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  state.editingChapterTitleId = chapterId;
  const binderSlot = document.querySelector("#binder-slot");
  const scrollTop = binderSlot instanceof HTMLElement ? binderSlot.scrollTop : 0;
  const scrollLeft = binderSlot instanceof HTMLElement ? binderSlot.scrollLeft : 0;
  renderBinderPanel();
  window.requestAnimationFrame(() => {
    const nextBinderSlot = document.querySelector("#binder-slot");
    if (nextBinderSlot instanceof HTMLElement) {
      nextBinderSlot.scrollTop = scrollTop;
      nextBinderSlot.scrollLeft = scrollLeft;
    }

    const titleInput = document.querySelector(
      `.binder-chapter-title-input[data-chapter-id="${CSS.escape(chapterId)}"]`,
    );
    if (titleInput instanceof HTMLInputElement) {
      titleInput.focus();
      titleInput.select();
    }
  });
}

function consumeBinderTitleClick(kind, id) {
  if (typeof kind !== "string" || !kind.trim() || typeof id !== "string" || !id.trim()) {
    return false;
  }

  const now = Date.now();
  const previous = binderTitleClickState;
  const isRepeat =
    previous &&
    previous.kind === kind &&
    previous.id === id &&
    now - previous.timestamp <= BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS;

  if (previous?.timeoutId) {
    window.clearTimeout(previous.timeoutId);
  }

  if (isRepeat) {
    binderTitleClickState = null;
    return true;
  }

  const stateSnapshot = {
    kind,
    id,
    timestamp: now,
    timeoutId: window.setTimeout(() => {
      if (
        binderTitleClickState &&
        binderTitleClickState.kind === stateSnapshot.kind &&
        binderTitleClickState.id === stateSnapshot.id &&
        binderTitleClickState.timestamp === stateSnapshot.timestamp
      ) {
        binderTitleClickState = null;
      }
    }, BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS),
  };
  binderTitleClickState = stateSnapshot;
  return false;
}

function finishChapterTitleEdit(chapterId) {
  if (typeof chapterId !== "string" || state.editingChapterTitleId !== chapterId) {
    return;
  }

  state.editingChapterTitleId = null;
  renderBinderPanel();
}

function beginSceneTitleEdit(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return;
  }

  state.editingSceneTitleId = sceneId;
  const binderSlot = document.querySelector("#binder-slot");
  const scrollTop = binderSlot instanceof HTMLElement ? binderSlot.scrollTop : 0;
  const scrollLeft = binderSlot instanceof HTMLElement ? binderSlot.scrollLeft : 0;
  renderBinderPanel();
  window.requestAnimationFrame(() => {
    const nextBinderSlot = document.querySelector("#binder-slot");
    if (nextBinderSlot instanceof HTMLElement) {
      nextBinderSlot.scrollTop = scrollTop;
      nextBinderSlot.scrollLeft = scrollLeft;
    }

    const titleInput = document.querySelector(
      `.binder-scene-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
    );
    if (titleInput instanceof HTMLInputElement) {
      titleInput.focus();
      titleInput.select();
    }
  });
}

function finishSceneTitleEdit(sceneId) {
  if (typeof sceneId !== "string" || state.editingSceneTitleId !== sceneId) {
    return;
  }

  state.editingSceneTitleId = null;
  renderBinderPanel();
}

function updateSceneTitleLabel(sceneId, title) {
  document
    .querySelectorAll(`[data-scene-title-id="${CSS.escape(sceneId)}"] span:last-child`)
    .forEach((node) => {
      node.textContent = title;
    });
}

function getEditorTypingSpellcheckRange(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (document.activeElement !== textarea) {
    return null;
  }

  if (!Number.isInteger(textarea.selectionStart) || textarea.selectionStart !== textarea.selectionEnd) {
    return null;
  }

  const caretOffset = textarea.selectionStart;
  const source = String(textarea.value ?? "");
  const previousChar = caretOffset > 0 ? source[caretOffset - 1] : "";
  const nextChar = caretOffset < source.length ? source[caretOffset] : "";
  const currentWordBoundary = /[A-Za-z'’-]/;
  if (!currentWordBoundary.test(previousChar) && !currentWordBoundary.test(nextChar)) {
    return null;
  }

  const range = getSpellcheckWordRange(source, caretOffset);
  if (!range) {
    return null;
  }

  if (caretOffset < range.startOffset || caretOffset > range.endOffset) {
    return null;
  }

  return range;
}

function syncSpellcheckLayer(editorHost, sceneId, options = {}) {
  if (!editorHost || !(editorHost.textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (areNarrationManuscriptDecorationsSuppressed() || !spellcheckBaseLexicon?.wordList?.length) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
    return;
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const snapshot = {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      sceneId,
      text: editorHost.textarea.value,
      spellcheckMisspellings: collectSpellcheckMisspellings(editorHost.textarea.value, {
        baseLexicon: spellcheckBaseLexicon,
        projectLexicon,
        referenceLexicon: spellcheckReferenceLexicon,
      }, {
        excludeRange: options.activeTypingWordRange ?? options.excludeRange ?? null,
      }),
      includeAuthorMarks: false,
      includeDraftProofing: false,
      includeDiagnostics: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: false,
    }),
  };
  renderTextareaSpellcheckLayer(editorHost, snapshot);
}

function updateSceneEditorTitle(sceneId, title) {
  const titleInput = document.querySelector(
    `.editor-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
  );
  if (titleInput instanceof HTMLInputElement) {
    titleInput.value = String(title ?? "");
  }
}

function updateSceneEditorChapterTitle(chapterId, title) {
  const titleNode = document.querySelector(
    `[data-scene-editor-chapter-title="${CSS.escape(chapterId)}"]`,
  );
  if (titleNode instanceof HTMLElement) {
    titleNode.textContent = formatChapterDisplayTitle(title);
  }
}

function updateSceneEditorChapterForScene(sceneId, chapterId, title) {
  const sceneShell = document.querySelector(
    `[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`,
  );
  if (!(sceneShell instanceof HTMLElement)) {
    return false;
  }

  const titleNode = sceneShell.querySelector("[data-scene-editor-chapter-title]");
  if (!(titleNode instanceof HTMLElement)) {
    return false;
  }

  titleNode.textContent = formatChapterDisplayTitle(title);
  titleNode.dataset.sceneEditorChapterTitle = chapterId;
  return true;
}

function isPersistentScene(scene) {
  return Boolean(
    scene &&
    Array.isArray(scene.blocks) &&
    scene.blocks.some((block) => Number.isInteger(block.lineNumber)),
  );
}

function getPersistentSceneById(sceneId) {
  const scene = getScene(sceneId);
  return isPersistentScene(scene) ? scene : null;
}

function isMovableScene(scene) {
  return Boolean(
    scene &&
    typeof scene.sceneId === "string" &&
    scene.sceneId.trim() &&
    typeof scene.chapterId === "string" &&
    scene.chapterId.trim(),
  );
}

function getMovableSceneById(sceneId) {
  const scene = getScene(sceneId);
  return isMovableScene(scene) ? scene : null;
}

function buildSceneGroupsFromProjectLines(lines) {
  const groups = [];
  const groupsBySceneId = new Map();

  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || typeof line !== "object") {
      continue;
    }

    const sceneId = typeof line.sceneId === "string" ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    let group = groupsBySceneId.get(sceneId);
    if (!group) {
      group = {
        sceneId,
        chapterId: typeof line.chapterId === "string" ? line.chapterId : "",
        chapterTitle: typeof line.chapterTitle === "string" ? line.chapterTitle : "",
        sceneTitle: typeof line.sceneTitle === "string" ? line.sceneTitle : "",
        sceneSynopsis: typeof line.sceneSynopsis === "string" ? line.sceneSynopsis : "",
        lines: [],
      };
      groupsBySceneId.set(sceneId, group);
      groups.push(group);
    }

    group.lines.push(line);
  }

  return groups;
}

function describeSceneGroups(sceneGroups) {
  return sceneGroups
    .map((group) => `${group.sceneId}:${group.chapterId}:${group.chapterTitle}`)
    .join("|");
}

function collectBinderNodeIds(node, nodeIds = new Map()) {
  if (!node || typeof node !== "object") {
    return nodeIds;
  }

  if (typeof node.refId === "string" && node.refId.trim() && typeof node.id === "string") {
    nodeIds.set(node.refId, node.id);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectBinderNodeIds(child, nodeIds);
    }
  }

  return nodeIds;
}

function buildBinderTreeFromSceneGroups(project, sceneGroups) {
  const existingNodeIds = collectBinderNodeIds(project?.binder);
  const rootId =
    existingNodeIds.get(project?.id) ??
    (typeof project?.id === "string" && project.id.trim() ? `binder-${project.id}` : "binder-project");
  const binderRoot = {
    id: rootId,
    kind: "project",
    refId: project?.id ?? "project",
    title: project?.title ?? "Untitled Project",
    order: 1,
    children: [],
  };
  const chapterNodes = new Map();

  for (const sceneGroup of sceneGroups) {
    if (!chapterNodes.has(sceneGroup.chapterId)) {
      const chapterNodeId =
        existingNodeIds.get(sceneGroup.chapterId) ??
        `binder-${sceneGroup.chapterId}`;
      const chapterNode = {
        id: chapterNodeId,
        kind: "chapter",
        refId: sceneGroup.chapterId,
        title: sceneGroup.chapterTitle,
        order: chapterNodes.size + 1,
        children: [],
      };
      chapterNodes.set(sceneGroup.chapterId, chapterNode);
      binderRoot.children.push(chapterNode);
    }

    const chapterNode = chapterNodes.get(sceneGroup.chapterId);
    chapterNode.children.push({
      id: existingNodeIds.get(sceneGroup.sceneId) ?? `binder-${sceneGroup.sceneId}`,
      kind: "scene",
      refId: sceneGroup.sceneId,
      title: sceneGroup.sceneTitle,
      order: chapterNode.children.length + 1,
      children: [],
    });
  }

  return binderRoot;
}

function buildNavigationTargetsFromLines(project, lines) {
  const targets = {};
  const firstLine = lines[0];

  if (firstLine) {
    targets[project.id] = {
      refId: project.id,
      kind: "project",
      title: project.title,
      lineId: firstLine.blockId,
      lineNumber: firstLine.lineNumber,
    };
  }

  const seenChapters = new Set();
  const seenScenes = new Set();
  for (const line of lines) {
    if (!seenChapters.has(line.chapterId)) {
      seenChapters.add(line.chapterId);
      targets[line.chapterId] = {
        refId: line.chapterId,
        kind: "chapter",
        title: line.chapterTitle,
        lineId: line.blockId,
        lineNumber: line.lineNumber,
      };
    }

    if (!seenScenes.has(line.sceneId)) {
      seenScenes.add(line.sceneId);
      targets[line.sceneId] = {
        refId: line.sceneId,
        kind: "scene",
        title: line.sceneTitle,
        lineId: line.blockId,
        lineNumber: line.lineNumber,
      };
    }
  }

  return targets;
}

function reorderSceneGroupsForDropTarget(sceneGroups, sourceSceneId, dropTarget) {
  const sourceIndex = sceneGroups.findIndex((group) => group.sceneId === sourceSceneId);
  if (sourceIndex === -1) {
    return null;
  }

  const nextGroups = sceneGroups.map((group) => ({
    ...group,
    lines: [...group.lines],
  }));
  const [movedGroup] = nextGroups.splice(sourceIndex, 1);

  let insertIndex = -1;
  let targetChapterId = "";
  let targetChapterTitle = "";

  if (dropTarget.type === "chapter-start") {
    const targetIndex = nextGroups.findIndex((group) => group.chapterId === dropTarget.chapterId);
    if (targetIndex === -1) {
      return null;
    }

    insertIndex = targetIndex;
    targetChapterId = nextGroups[targetIndex].chapterId;
    targetChapterTitle = nextGroups[targetIndex].chapterTitle;
  } else {
    const targetIndex = nextGroups.findIndex((group) => group.sceneId === dropTarget.sceneId);
    if (targetIndex === -1 || dropTarget.sceneId === sourceSceneId) {
      return null;
    }

    insertIndex = dropTarget.type === "before" ? targetIndex : targetIndex + 1;
    targetChapterId = nextGroups[targetIndex].chapterId;
    targetChapterTitle = nextGroups[targetIndex].chapterTitle;
  }

  movedGroup.chapterId = targetChapterId;
  movedGroup.chapterTitle = targetChapterTitle;
  nextGroups.splice(insertIndex, 0, movedGroup);

  return nextGroups;
}

// Intent: reorder UI scene records, including draft-only scenes that do not yet have persisted manuscript lines.
function reorderSceneRecordsForDropTarget(scenes, sourceSceneId, dropTarget) {
  const sourceIndex = scenes.findIndex((scene) => scene.sceneId === sourceSceneId);
  if (sourceIndex === -1) {
    return null;
  }

  const nextScenes = scenes.map((scene) => ({ ...scene }));
  const [movedScene] = nextScenes.splice(sourceIndex, 1);

  let insertIndex = -1;
  let targetChapterId = "";
  let targetChapterTitle = "";

  if (dropTarget.type === "chapter-start") {
    const targetIndex = nextScenes.findIndex((scene) => scene.chapterId === dropTarget.chapterId);
    if (targetIndex === -1) {
      return null;
    }

    insertIndex = targetIndex;
    targetChapterId = nextScenes[targetIndex].chapterId;
    targetChapterTitle = nextScenes[targetIndex].chapterTitle;
  } else {
    const targetIndex = nextScenes.findIndex((scene) => scene.sceneId === dropTarget.sceneId);
    if (targetIndex === -1 || dropTarget.sceneId === sourceSceneId) {
      return null;
    }

    insertIndex = dropTarget.type === "before" ? targetIndex : targetIndex + 1;
    targetChapterId = nextScenes[targetIndex].chapterId;
    targetChapterTitle = nextScenes[targetIndex].chapterTitle;
  }

  movedScene.chapterId = targetChapterId;
  movedScene.chapterTitle = targetChapterTitle;
  nextScenes.splice(insertIndex, 0, movedScene);

  return nextScenes;
}

function rebuildProjectSceneStateFromGroups(project, sceneGroups) {
  const lines = [];
  const lineByBlockId = new Map();
  const sceneMetaBySceneId = new Map();
  let lineNumber = 1;
  let currentChapterId = "";
  let sceneNumberInChapter = 0;

  for (const sceneGroup of sceneGroups) {
    if (sceneGroup.chapterId !== currentChapterId) {
      currentChapterId = sceneGroup.chapterId;
      sceneNumberInChapter = 0;
    }

    sceneNumberInChapter += 1;
    sceneMetaBySceneId.set(sceneGroup.sceneId, {
      chapterId: sceneGroup.chapterId,
      chapterTitle: sceneGroup.chapterTitle,
      sceneId: sceneGroup.sceneId,
      sceneTitle: sceneGroup.sceneTitle,
    });

    sceneGroup.lines.forEach((line, index) => {
      const nextLine = {
        ...line,
        lineNumber,
        sceneLineNumber: index + 1,
        chapterId: sceneGroup.chapterId,
        chapterTitle: sceneGroup.chapterTitle,
        sceneId: sceneGroup.sceneId,
        sceneTitle: sceneGroup.sceneTitle,
        sceneSynopsis: sceneGroup.sceneSynopsis ?? line.sceneSynopsis ?? "",
        startsChapter: index === 0 && sceneNumberInChapter === 1,
        startsScene: index === 0,
        issueIds: [],
        eventTagIds: [],
      };
      lines.push(nextLine);
      lineByBlockId.set(nextLine.blockId, nextLine);
      lineNumber += 1;
    });
  }

  const issues = Array.isArray(project?.issues)
    ? project.issues.map((issue) => {
        const line = typeof issue?.blockId === "string" ? lineByBlockId.get(issue.blockId) : null;
        if (line) {
          line.issueIds.push(issue.id);
        }

        if (!line) {
          return { ...issue };
        }

        return {
          ...issue,
          lineNumber: line.lineNumber,
          sceneLineNumber: line.sceneLineNumber,
          chapterTitle: line.chapterTitle,
          sceneTitle: line.sceneTitle,
        };
      })
    : [];

  const eventTags = Array.isArray(project?.eventTags)
    ? project.eventTags.map((eventTag) => {
        const line = typeof eventTag?.blockId === "string" ? lineByBlockId.get(eventTag.blockId) : null;
        if (line) {
          line.eventTagIds.push(eventTag.id);
        }

        if (!line) {
          return { ...eventTag };
        }

        return {
          ...eventTag,
          lineNumber: line.lineNumber,
          sceneLineNumber: line.sceneLineNumber,
          chapterTitle: line.chapterTitle,
          sceneTitle: line.sceneTitle,
        };
      })
    : [];

  return {
    lines,
    lineByBlockId,
    sceneMetaBySceneId,
    binder: buildBinderTreeFromSceneGroups(project, sceneGroups),
    navigationTargets: buildNavigationTargetsFromLines(project, lines),
    issues,
    eventTags,
    stats: {
      chapterCount: new Set(sceneGroups.map((group) => group.chapterId)).size,
      sceneCount: sceneGroups.length,
      lineCount: lines.length,
      issueCount: issues.length,
      eventCount: eventTags.length,
      characterCount: Array.isArray(project?.characters) ? project.characters.length : 0,
    },
  };
}

function syncSceneLinkedMetadata(items, sceneMetaBySceneId) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const sceneMeta = sceneMetaBySceneId.get(item?.sceneId);
    if (!sceneMeta) {
      return { ...item };
    }

    return {
      ...item,
      chapterId: sceneMeta.chapterId,
      chapterTitle: sceneMeta.chapterTitle,
      sceneId: sceneMeta.sceneId,
      sceneTitle: sceneMeta.sceneTitle,
    };
  });
}

function syncSuggestionQueueMetadata(queue, lineByBlockId) {
  if (!Array.isArray(queue)) {
    return [];
  }

  return queue.map((suggestion) => ({
    ...suggestion,
    evidence: Array.isArray(suggestion?.evidence)
      ? suggestion.evidence.map((evidence) => {
          const line = typeof evidence?.blockId === "string" ? lineByBlockId.get(evidence.blockId) : null;
          if (!line) {
            return { ...evidence };
          }

          return {
            ...evidence,
            lineNumber: line.lineNumber,
            sceneLineNumber: line.sceneLineNumber,
            chapterTitle: line.chapterTitle,
            sceneTitle: line.sceneTitle,
          };
        })
      : [],
  }));
}

function moveBinderScene(sceneId, dropTarget, options = {}) {
  if (typeof sceneId !== "string" || !sceneId.trim() || !dropTarget || !state.workspace?.project) {
    return false;
  }

  const sourceScene = getMovableSceneById(sceneId);
  if (!sourceScene) {
    return false;
  }

  if (!isPersistentScene(sourceScene)) {
    return moveDraftBinderScene(sceneId, dropTarget, options);
  }

  const orderedScenes = reorderSceneRecordsForDropTarget(
    (Array.isArray(state.scenes) ? state.scenes : []).filter((scene) => isMovableScene(scene)),
    sceneId,
    dropTarget,
  );
  if (!orderedScenes) {
    return false;
  }

  const sceneGroups = buildSceneGroupsFromProjectLines(state.workspace.project.lines);
  const nextSceneGroups = reorderSceneGroupsForDropTarget(sceneGroups, sceneId, dropTarget);
  if (!nextSceneGroups) {
    return false;
  }

  if (describeSceneGroups(sceneGroups) === describeSceneGroups(nextSceneGroups)) {
    return false;
  }

  const beforeSceneGroups = cloneBinderSceneGroups(sceneGroups);
  resetBinderSceneDragState();
  const applied = applyBinderSceneGroups(nextSceneGroups, {
    orderedScenes,
    persist: false,
    render: false,
  });
  if (!applied) {
    return false;
  }

  if (options.recordHistory !== false) {
    pushBinderSceneMoveHistory(beforeSceneGroups, nextSceneGroups, sceneId);
  }
  persistCurrentProjectRecord({
    changedSceneIds: options.changedSceneIds,
    domain: options.domain,
    dirtyReason: options.dirtyReason,
    source: options.source,
    flushProjectFileAutosave: options.flushProjectFileAutosave === true,
  });

  if (state.selectedSceneId === sceneId) {
    const movedScene = getScene(sceneId);
    if (movedScene) {
      updateSceneEditorChapterForScene(sceneId, movedScene.chapterId, movedScene.chapterTitle);
    }
  }

  // Intent: repaint on the next frame so native drag/drop can settle before the binder rerenders.
  window.requestAnimationFrame(() => {
    render();
  });
  return true;
}

// Intent: persist an explicit binder order overlay so empty draft scenes can sit between canonical scenes.
function buildStructureDraftScenesFromOrderedScenes(orderedScenes) {
  const existingDraftsBySceneId = new Map(
    (Array.isArray(state.structureDrafts?.scenes) ? state.structureDrafts.scenes : [])
      .filter((scene) => scene && typeof scene === "object")
      .map((scene) => [String(scene.sceneId ?? ""), scene]),
  );

  return orderedScenes.map((scene, index) => {
    const existingDraft = existingDraftsBySceneId.get(scene.sceneId) ?? {};
    return {
      ...cloneValue(existingDraft),
      sceneId: scene.sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
      sceneTitle: scene.sceneTitle,
      sceneSynopsis: typeof scene.sceneSynopsis === "string" ? scene.sceneSynopsis : "",
      order: index + 1,
      initialText: typeof existingDraft.initialText === "string"
        ? existingDraft.initialText
        : isPersistentScene(scene)
          ? ""
          : String(scene.editorText ?? ""),
    };
  });
}

function syncStructureDraftsFromOrderedScenes(orderedScenes) {
  const movableScenes = Array.isArray(orderedScenes)
    ? orderedScenes.filter((scene) => isMovableScene(scene))
    : [];
  if (!movableScenes.length) {
    return false;
  }

  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    sceneOrder: movableScenes.map((scene) => scene.sceneId),
    scenes: buildStructureDraftScenesFromOrderedScenes(movableScenes),
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  return true;
}

function moveDraftBinderScene(sceneId, dropTarget, options = {}) {
  const orderedScenes = reorderSceneRecordsForDropTarget(
    (Array.isArray(state.scenes) ? state.scenes : []).filter((scene) => isMovableScene(scene)),
    sceneId,
    dropTarget,
  );
  if (!orderedScenes) {
    return false;
  }

  if (describeSceneGroups(state.scenes) === describeSceneGroups(orderedScenes)) {
    return false;
  }

  resetBinderSceneDragState();
  syncStructureDraftsFromOrderedScenes(orderedScenes);
  refreshScenes();
  persistCurrentProjectRecord({
    changedSceneIds: options.changedSceneIds,
    domain: options.domain,
    dirtyReason: options.dirtyReason,
    source: options.source,
    flushProjectFileAutosave: options.flushProjectFileAutosave === true,
  });

  if (state.selectedSceneId === sceneId) {
    const movedScene = getScene(sceneId);
    if (movedScene) {
      updateSceneEditorChapterForScene(sceneId, movedScene.chapterId, movedScene.chapterTitle);
    }
  }

  // Intent: repaint on the next frame so native drag/drop can settle before the binder rerenders.
  window.requestAnimationFrame(() => {
    render();
  });
  return true;
}

function syncStructureDraftScenesFromSceneGroups(sceneGroups) {
  if (!Array.isArray(state.structureDrafts?.scenes)) {
    return false;
  }

  const orderedDraftScenes = [];
  const draftSceneById = new Map();
  let changed = false;

  for (const draftScene of state.structureDrafts.scenes) {
    if (!draftScene || typeof draftScene !== "object") {
      continue;
    }

    const draftSceneId = typeof draftScene.sceneId === "string" ? draftScene.sceneId.trim() : "";
    if (draftSceneId) {
      draftSceneById.set(draftSceneId, draftScene);
    }
  }

  for (const sceneGroup of Array.isArray(sceneGroups) ? sceneGroups : []) {
    const draftScene = draftSceneById.get(sceneGroup.sceneId);
    if (!draftScene) {
      continue;
    }

    const nextDraftScene = { ...draftScene };
    if (nextDraftScene.chapterId !== sceneGroup.chapterId) {
      nextDraftScene.chapterId = sceneGroup.chapterId;
      changed = true;
    }
    if (nextDraftScene.chapterTitle !== sceneGroup.chapterTitle) {
      nextDraftScene.chapterTitle = sceneGroup.chapterTitle;
      changed = true;
    }

    orderedDraftScenes.push(nextDraftScene);
    draftSceneById.delete(sceneGroup.sceneId);
  }

  for (const draftScene of state.structureDrafts.scenes) {
    if (!draftScene || typeof draftScene !== "object") {
      continue;
    }

    const draftSceneId = typeof draftScene.sceneId === "string" ? draftScene.sceneId.trim() : "";
    if (!draftSceneId || !draftSceneById.has(draftSceneId)) {
      continue;
    }

    orderedDraftScenes.push(draftScene);
    draftSceneById.delete(draftSceneId);
  }

  if (!changed) {
    return false;
  }

  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: orderedDraftScenes,
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  return true;
}

function deleteSceneFromBinder(sceneId) {
  const scene = getScene(sceneId);
  if (!scene || !state.workspace?.project) {
    hideBinderContextMenu();
    return false;
  }

  const confirmed = window.confirm(
    `Delete "${scene.sceneTitle}"?\n\nThis removes the scene, its tasks, notes, and linked diagnostics.`,
  );
  if (!confirmed) {
    hideBinderContextMenu();
    return false;
  }

  return removeScenesFromProject([scene.sceneId]);
}

function deleteChapterFromBinder(chapterId) {
  if (!state.workspace?.project) {
    hideBinderContextMenu();
    return false;
  }

  const chapterScenes = getScenesForChapter(chapterId);
  if (!chapterScenes.length) {
    hideBinderContextMenu();
    return false;
  }

  const removedSceneIds = chapterScenes.map((scene) => scene.sceneId);
  const chapterTitle = chapterScenes[0]?.chapterTitle || "Untitled chapter";
  const confirmed = window.confirm(
    `Delete "${chapterTitle}" and all ${removedSceneIds.length} of its scene${removedSceneIds.length === 1 ? "" : "s"}?\n\nThis removes their tasks, notes, and linked diagnostics.`,
  );
  if (!confirmed) {
    hideBinderContextMenu();
    return false;
  }

  return removeScenesFromProject(removedSceneIds);
}

function removeScenesFromProject(removedSceneIds) {
  if (!state.workspace?.project) {
    return false;
  }

  const sceneGroups = buildSceneGroupsFromProjectLines(state.workspace.project.lines);
  const currentScenes = Array.isArray(state.scenes) ? state.scenes : [];
  const removedSet = new Set(
    Array.isArray(removedSceneIds)
      ? removedSceneIds.filter((sceneId) => typeof sceneId === "string" && sceneId.trim())
      : [],
  );
  const removedScenes = currentScenes.filter((scene) => removedSet.has(scene.sceneId));
  if (!removedScenes.length) {
    return false;
  }

  const removedChapterIds = new Set(removedScenes.map((scene) => scene.chapterId));
  const remainingSceneIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .map((scene) => scene.sceneId),
  );
  const remainingChapterIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .map((scene) => scene.chapterId),
  );
  const remainingBlockIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .flatMap((scene) => scene.blocks.map((block) => block.blockId).filter(Boolean)),
  );
  const fallbackSceneId = getFallbackSceneIdAfterRemoval(sceneGroups, removedSet);
  const nextSceneGroups = sceneGroups.filter((group) => !removedSet.has(group.sceneId));
  const rebuilt = rebuildProjectSceneStateFromGroups(state.workspace.project, nextSceneGroups);
  const remainingIssues = rebuilt.issues.filter((issue) =>
    isManuscriptAnchorStillPresent(issue, remainingSceneIds, remainingBlockIds),
  );
  const remainingEventTags = rebuilt.eventTags.filter((eventTag) =>
    isManuscriptAnchorStillPresent(eventTag, remainingSceneIds, remainingBlockIds),
  );

  state.workspace.project = {
    ...state.workspace.project,
    binder: rebuilt.binder,
    stats: {
      ...rebuilt.stats,
      issueCount: remainingIssues.length,
      eventCount: remainingEventTags.length,
    },
    navigationTargets: rebuilt.navigationTargets,
    lines: rebuilt.lines,
    issues: remainingIssues,
    eventTags: remainingEventTags,
  };

  state.sceneDrafts = Object.fromEntries(
    Object.entries(state.sceneDrafts).filter(([sceneId]) => !removedSet.has(sceneId)),
  );
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: Array.isArray(state.structureDrafts.scenes)
      ? state.structureDrafts.scenes.filter((draftScene) => {
          const draftSceneId = String(draftScene?.sceneId ?? "");
          const draftChapterId = String(draftScene?.chapterId ?? "");
          return !removedSet.has(draftSceneId) && !removedChapterIds.has(draftChapterId);
        })
      : [],
  };
  state.localAiTitleStatus = Object.fromEntries(
    Object.entries(state.localAiTitleStatus).filter(([sceneId]) => !removedSet.has(sceneId)),
  );
  state.manuscriptTasks = syncSceneLinkedMetadata(
    state.manuscriptTasks.filter((task) => remainingSceneIds.has(task.sceneId)),
    rebuilt.sceneMetaBySceneId,
  );
  state.passageNotes = syncSceneLinkedMetadata(
    state.passageNotes.filter((note) => remainingSceneIds.has(note.sceneId)),
    rebuilt.sceneMetaBySceneId,
  );

  // Intent: keep proof-read run coverage anchored only to scenes that still exist.
  const draftProofPruneResult = pruneDraftProofCoverageForScenes(state.draftProofing, {
    remainingSceneIds,
    now: new Date().toISOString(),
  });
  if (draftProofPruneResult.changed) {
    state.draftProofing = draftProofPruneResult.state;
  }

  if (state.workspace.narration && typeof state.workspace.narration === "object") {
    state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobsMetadata(
      state.workspace.narration.alignmentJobs,
      rebuilt.lineByBlockId,
    ).filter((job) => remainingBlockIds.has(job?.request?.anchor?.blockId));

    const currentSession = state.workspace.narration.session;
    state.workspace.narration.session =
      currentSession &&
      currentSession.currentAnchor &&
      remainingBlockIds.has(currentSession.currentAnchor.blockId)
        ? syncNarrationSessionMetadata(currentSession, rebuilt.lineByBlockId)
        : null;
  }

  if (state.workspace.voice && typeof state.workspace.voice === "object") {
    state.workspace.voice.recordings = syncVoiceRecordingsMetadata(
      state.workspace.voice.recordings,
      rebuilt.lineByBlockId,
    ).filter((recording) => remainingBlockIds.has(recording.blockId));
    state.workspace.voice.renderJobs = syncVoiceRenderJobsMetadata(
      state.workspace.voice.renderJobs,
      rebuilt.sceneMetaBySceneId,
    ).filter((job) => remainingSceneIds.has(job?.request?.sceneId));
  }

  refreshScenes();

  const fallbackScene = fallbackSceneId ? getScene(fallbackSceneId) : state.scenes[0] ?? null;
  if (fallbackScene) {
    syncSelectionFromBlock(fallbackScene.blocks[0]?.blockId ?? null);
  } else {
    state.selectedSceneId = null;
    state.selectedBlockId = null;
  }

  const currentIssueId = state.selectedIssueId;
  state.selectedIssueId = currentIssueId && state.workspace.project.issues.some((issue) => issue.id === currentIssueId)
    ? currentIssueId
    : currentIssueId
      ? state.workspace.project.issues[0]?.id ?? null
      : null;
  state.selectedTaskId = state.manuscriptTasks.some((task) => task.id === state.selectedTaskId)
    ? state.selectedTaskId
    : null;
  state.selectedPassageNoteId = state.passageNotes.some((note) => note.id === state.selectedPassageNoteId)
    ? state.selectedPassageNoteId
    : null;
  state.inlinePassageDraft = state.inlinePassageDraft && !removedSet.has(state.inlinePassageDraft.sceneId)
    ? state.inlinePassageDraft
    : null;
  state.taskComposer = state.taskComposer && !removedSet.has(state.taskComposer.sceneId)
    ? state.taskComposer
    : null;
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskPreview = state.taskPreview && !removedSet.has(state.taskPreview.sceneId)
    ? state.taskPreview
    : null;
  state.narrationTakeSelection = state.narrationTakeSelection && !removedSet.has(state.narrationTakeSelection.sceneId)
    ? state.narrationTakeSelection
    : null;
  state.editingChapterTitleId = removedChapterIds.has(state.editingChapterTitleId)
    ? null
    : state.editingChapterTitleId;
  state.editingSceneTitleId = removedSet.has(state.editingSceneTitleId)
    ? null
    : state.editingSceneTitleId;
  state.collapsedChapterIds = pruneCollapsedChapterIds(state.collapsedChapterIds, remainingChapterIds);
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  state.workspace.selectionDefaults = {
    ...(state.workspace.selectionDefaults ?? {}),
    lineId: state.selectedBlockId ?? "",
    sceneId: state.selectedSceneId ?? "",
    issueId: state.selectedIssueId ?? undefined,
    inlinePassageDraft: captureInlinePassageDraftDefaultsForSave(),
  };
  binderTitleClickState = null;

  persistCurrentProjectRecord();
  render();
  syncSceneDocumentLayout();
  return true;
}

function isManuscriptAnchorStillPresent(item, remainingSceneIds, remainingBlockIds) {
  // Intent: drop diagnostics and event tags tied to deleted manuscript anchors while preserving project-level records.
  const blockId = typeof item?.blockId === "string" ? item.blockId : "";
  if (blockId) {
    return remainingBlockIds.has(blockId);
  }

  const sceneId = typeof item?.sceneId === "string" ? item.sceneId : "";
  return sceneId ? remainingSceneIds.has(sceneId) : true;
}

function getFallbackSceneIdAfterRemoval(sceneGroups, removedSet) {
  if (!Array.isArray(sceneGroups) || !(removedSet instanceof Set) || !removedSet.size) {
    return null;
  }

  const removedIndices = sceneGroups
    .map((group, index) => (removedSet.has(group.sceneId) ? index : -1))
    .filter((index) => index >= 0);
  if (!removedIndices.length) {
    return null;
  }

  const firstRemovedIndex = removedIndices[0];
  const remainingGroups = sceneGroups.filter((group) => !removedSet.has(group.sceneId));
  if (!remainingGroups.length) {
    return null;
  }

  const preferredGroup = remainingGroups.find(
    (group) => sceneGroups.findIndex((candidate) => candidate.sceneId === group.sceneId) >= firstRemovedIndex,
  );
  return preferredGroup?.sceneId ?? remainingGroups[remainingGroups.length - 1]?.sceneId ?? null;
}

function trimSceneWhitespace(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return false;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return false;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  const currentText =
    textarea instanceof HTMLTextAreaElement
      ? textarea.value
      : String(scene.editorText ?? "");
  const trimmedText = currentText.replace(/\s+$/u, "");

  if (trimmedText === currentText) {
    return false;
  }

  updateSceneDraft(sceneId, (draft) => {
    draft.editorText = trimmedText;
    draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, currentText, trimmedText);
  }, {
    reason: "scene-trim",
    immediate: true,
  });
  syncRevisionPanel(sceneId);

  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = trimmedText;
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), trimmedText.length, trimmedText.length, {
      focus: true,
      scroll: false,
    });
  }

  renderHeader();
  syncSceneDocumentLayout();
  return true;
}

function pushBinderSceneMoveHistory(beforeSceneGroups, afterSceneGroups, sceneId) {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  undoStack.push({
    sceneId,
    beforeSceneGroups: cloneBinderSceneGroups(beforeSceneGroups),
    afterSceneGroups: cloneBinderSceneGroups(afterSceneGroups),
  });

  state.binderSceneMoveHistory = {
    undoStack: undoStack.slice(-20),
    redoStack: [],
  };
}

function applyBinderSceneGroups(sceneGroups, options = {}) {
  if (!state.workspace?.project) {
    return false;
  }

  const rebuilt = rebuildProjectSceneStateFromGroups(state.workspace.project, sceneGroups);
  state.workspace.project = {
    ...state.workspace.project,
    binder: rebuilt.binder,
    stats: rebuilt.stats,
    navigationTargets: rebuilt.navigationTargets,
    lines: rebuilt.lines,
    issues: rebuilt.issues,
    eventTags: rebuilt.eventTags,
  };
  state.manuscriptTasks = syncSceneLinkedMetadata(state.manuscriptTasks, rebuilt.sceneMetaBySceneId);
  state.passageNotes = syncSceneLinkedMetadata(state.passageNotes, rebuilt.sceneMetaBySceneId);
  state.workspace.analysis.suggestionQueue = syncSuggestionQueueMetadata(
    state.workspace.analysis.suggestionQueue,
    rebuilt.lineByBlockId,
  );
  state.workspace.narration.session = syncNarrationSessionMetadata(
    state.workspace.narration.session,
    rebuilt.lineByBlockId,
  );
  state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobsMetadata(
    state.workspace.narration.alignmentJobs,
    rebuilt.lineByBlockId,
  );
  state.workspace.voice.recordings = syncVoiceRecordingsMetadata(
    state.workspace.voice.recordings,
    rebuilt.lineByBlockId,
  );
  state.workspace.voice.renderJobs = syncVoiceRenderJobsMetadata(
    state.workspace.voice.renderJobs,
    rebuilt.sceneMetaBySceneId,
  );
  if (Array.isArray(options.orderedScenes)) {
    syncStructureDraftsFromOrderedScenes(options.orderedScenes);
  } else {
    syncStructureDraftScenesFromSceneGroups(sceneGroups);
  }

  const existingChapterIds = new Set(
    [...rebuilt.sceneMetaBySceneId.values()].map((sceneMeta) => sceneMeta.chapterId),
  );
  state.collapsedChapterIds = pruneCollapsedChapterIds(state.collapsedChapterIds, existingChapterIds);
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  refreshScenes();

  if (state.selectedSceneId) {
    const selectedScene = getSelectedScene();
    if (selectedScene) {
      updateSceneEditorChapterForScene(selectedScene.sceneId, selectedScene.chapterId, selectedScene.chapterTitle);
    }
  }

  if (options.persist !== false) {
    persistCurrentProjectRecord();
  }

  if (options.render !== false) {
    window.requestAnimationFrame(() => {
      render();
    });
  }

  return true;
}

function undoBinderSceneMove() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  const entry = undoStack.pop();
  if (!entry) {
    return false;
  }

  const redoStack = Array.isArray(currentHistory.redoStack) ? [...currentHistory.redoStack] : [];
  redoStack.push(entry);
  state.binderSceneMoveHistory = {
    undoStack,
    redoStack: redoStack.slice(-20),
  };

  if (!applyBinderSceneGroups(entry.beforeSceneGroups)) {
    state.binderSceneMoveHistory = currentHistory;
    return false;
  }

  return true;
}

function canUndoBinderSceneMoveHistory() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  return Array.isArray(currentHistory.undoStack) && currentHistory.undoStack.length > 0;
}

function redoBinderSceneMove() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const redoStack = Array.isArray(currentHistory.redoStack) ? [...currentHistory.redoStack] : [];
  const entry = redoStack.pop();
  if (!entry) {
    return false;
  }

  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  undoStack.push(entry);
  state.binderSceneMoveHistory = {
    undoStack: undoStack.slice(-20),
    redoStack,
  };

  if (!applyBinderSceneGroups(entry.afterSceneGroups)) {
    state.binderSceneMoveHistory = currentHistory;
    return false;
  }

  return true;
}

function canRedoBinderSceneMoveHistory() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  return Array.isArray(currentHistory.redoStack) && currentHistory.redoStack.length > 0;
}

function clearBinderSceneDropIndicators() {
  document
    .querySelectorAll(
      ".binder-scene.is-drop-before, .binder-scene.is-drop-after, .binder-scene-drop-slot.is-drop-before, .binder-scene-drop-slot.is-drop-after, .binder-chapter.is-drop-start",
    )
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        node.classList.remove("is-drop-before", "is-drop-after", "is-drop-start");
      }
    });

  if (binderSceneDragState) {
    binderSceneDragState.dropTarget = null;
  }
}

function resetBinderSceneDragState() {
  clearBinderSceneDropIndicators();

  if (binderSceneDragState?.sourceElement instanceof HTMLElement) {
    binderSceneDragState.sourceElement.classList.remove("is-dragging");
    binderSceneDragState.sourceElement.removeAttribute("aria-grabbed");
  }

  if (binderSceneDragState?.dragImage instanceof HTMLElement && binderSceneDragState.dragImage.isConnected) {
    binderSceneDragState.dragImage.remove();
  }

  binderSceneDragState = null;
}

function applyBinderSceneDropIndicator(dropTarget) {
  clearBinderSceneDropIndicators();

  if (!binderSceneDragState || !dropTarget) {
    return;
  }

  binderSceneDragState.dropTarget = dropTarget;
  const selector = dropTarget.type === "chapter-start"
    ? `[data-binder-chapter-drop-id="${CSS.escape(dropTarget.chapterId)}"]`
    : `[data-binder-scene-drop-slot-id="${CSS.escape(dropTarget.sceneId)}"][data-binder-scene-drop-position="${CSS.escape(dropTarget.type)}"], [data-binder-scene-drop-id="${CSS.escape(dropTarget.sceneId)}"]`;
  const dropElement = document.querySelector(selector);
  if (!(dropElement instanceof HTMLElement)) {
    return;
  }

  if (dropTarget.type === "chapter-start") {
    dropElement.classList.add("is-drop-start");
    return;
  }

  dropElement.classList.add(dropTarget.type === "before" ? "is-drop-before" : "is-drop-after");
}

function resolveBinderSceneDropTarget(event) {
  if (!binderSceneDragState) {
    return null;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return null;
  }

  const sceneDropTarget = target.closest("[data-binder-scene-drop-id]");
  if (sceneDropTarget instanceof HTMLElement) {
    const sceneId = sceneDropTarget.dataset.binderSceneDropId;
    if (!sceneId || sceneId === binderSceneDragState.sourceSceneId) {
      return null;
    }

    const scene = getMovableSceneById(sceneId);
    if (!scene) {
      return null;
    }

    const rect = sceneDropTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + (rect.height / 2)
      ? "before"
      : "after";

    return {
      type: placement,
      sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
    };
  }

  const sceneDropSlot = target.closest("[data-binder-scene-drop-slot-id]");
  if (sceneDropSlot instanceof HTMLElement) {
    const sceneId = sceneDropSlot.dataset.binderSceneDropSlotId;
    const position = sceneDropSlot.dataset.binderSceneDropPosition === "after" ? "after" : "before";
    if (!sceneId || sceneId === binderSceneDragState.sourceSceneId) {
      return null;
    }

    const scene = getMovableSceneById(sceneId);
    if (!scene) {
      return null;
    }

    return {
      type: position,
      sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
    };
  }

  const chapterDropTarget = target.closest("[data-binder-chapter-drop-id]");
  if (chapterDropTarget instanceof HTMLElement) {
    const chapterId = chapterDropTarget.dataset.binderChapterDropId;
    if (!chapterId) {
      return null;
    }

    const chapterScenes = getScenesForChapter(chapterId).filter((candidate) => isMovableScene(candidate));
    if (!chapterScenes.length) {
      return null;
    }

    // Intent: map chapter-body drops to the nearest movable scene boundary so end-of-chapter drops land after the last scene instead of collapsing to the first placeholder.
    const pointerY = Number(event.clientY);
    const chapterSceneTargets = chapterScenes
      .map((scene) => {
        const sceneDropTarget = document.querySelector(`[data-binder-scene-drop-id="${CSS.escape(scene.sceneId)}"]`);
        if (!(sceneDropTarget instanceof HTMLElement)) {
          return null;
        }

        const rect = sceneDropTarget.getBoundingClientRect();
        return {
          scene,
          midpoint: rect.top + (rect.height / 2),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.midpoint - right.midpoint);

    if (!chapterSceneTargets.length) {
      const firstSceneInChapter = chapterScenes[0];
      return {
        type: "before",
        sceneId: firstSceneInChapter.sceneId,
        chapterId: firstSceneInChapter.chapterId,
        chapterTitle: firstSceneInChapter.chapterTitle,
      };
    }

    let nearestTarget = chapterSceneTargets[0];
    let nearestDistance = Math.abs(pointerY - nearestTarget.midpoint);
    for (const candidate of chapterSceneTargets) {
      const candidateDistance = Math.abs(pointerY - candidate.midpoint);
      if (candidateDistance < nearestDistance) {
        nearestTarget = candidate;
        nearestDistance = candidateDistance;
      }
    }

    return {
      type: pointerY < nearestTarget.midpoint ? "before" : "after",
      sceneId: nearestTarget.scene.sceneId,
      chapterId: nearestTarget.scene.chapterId,
      chapterTitle: nearestTarget.scene.chapterTitle,
    };
  }

  return null;
}

function handleBinderSceneDragStart(event) {
  const target = event.target instanceof Element
    ? event.target.closest(".binder-scene-button[data-binder-scene-id]")
    : null;
  if (!(target instanceof HTMLElement) || target.getAttribute("draggable") !== "true") {
    return;
  }

  const sceneId = target.dataset.binderSceneId;
  const scene = getMovableSceneById(sceneId);
  if (!scene) {
    event.preventDefault();
    return;
  }

  resetBinderSceneDragState();

  const rect = target.getBoundingClientRect();
  let dragImage = null;
  if (event.dataTransfer) {
    const clone = target.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.classList.add("binder-scene-drag-image");
      clone.style.position = "fixed";
      clone.style.top = "-1000px";
      clone.style.left = "-1000px";
      clone.style.width = `${rect.width}px`;
      clone.style.pointerEvents = "none";
      clone.style.opacity = "0.72";
      clone.style.transform = "scale(0.98)";
      clone.style.margin = "0";
      document.body.appendChild(clone);
      dragImage = clone;
      event.dataTransfer.setDragImage(
        clone,
        Math.max(0, event.clientX - rect.left),
        Math.max(0, event.clientY - rect.top),
      );
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sceneId);
  }

  binderSceneDragState = {
    sourceSceneId: sceneId,
    sourceElement: target,
    dragImage,
    dropTarget: null,
  };
  target.classList.add("is-dragging");
  target.setAttribute("aria-grabbed", "true");
}

function handleBinderSceneDragOver(event) {
  if (!binderSceneDragState) {
    return;
  }

  event.preventDefault();
  const dropTarget = resolveBinderSceneDropTarget(event);
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = dropTarget ? "move" : "none";
  }

  if (dropTarget) {
    applyBinderSceneDropIndicator(dropTarget);
    return;
  }

  clearBinderSceneDropIndicators();
}

function handleBinderSceneDrop(event) {
  if (!binderSceneDragState) {
    return;
  }

  event.preventDefault();
  const dropTarget = binderSceneDragState.dropTarget ?? resolveBinderSceneDropTarget(event);
  if (dropTarget) {
    moveBinderScene(binderSceneDragState.sourceSceneId, dropTarget);
  }

  resetBinderSceneDragState();
}

function handleBinderSceneDragEnd() {
  if (!binderSceneDragState) {
    return;
  }

  resetBinderSceneDragState();
}

function updateFocusedLineCard() {
  renderConsolePanel();
}

// Intent: match side-panel clamp math to the five-column workspace grid, including visible column gaps.
function resolveWorkspaceGridAvailableWidth(workspaceWidth, { sidePanelsHidden = false } = {}) {
  const measuredWorkspaceWidth = Number(workspaceWidth);
  const safeWorkspaceWidth = Number.isFinite(measuredWorkspaceWidth) ? measuredWorkspaceWidth : 0;
  const sideRailGapTotal = sidePanelsHidden ? 0 : WORKSPACE_GRID_COLUMN_GAP * 4;
  return Math.max(0, safeWorkspaceWidth - (PANEL_RESIZER_WIDTH * 2) - sideRailGapTotal);
}

// Intent: keep panel widths clamped and only persist viewport profiles after explicit resizer drags.
function syncLayoutWidths(options = {}) {
  const syncOptions = normalizeLayoutSyncOptions(options);
  const persistProfileRequested = syncOptions.persistProfile === true;
  const sidePanelsHidden = state.sidePanelsHidden === true;
  const persistProfile = persistProfileRequested && syncOptions.reason === "panel-resize" && !sidePanelsHidden;
  const workspace = document.querySelector(".workspace-grid");
  const workspaceWidth = workspace instanceof HTMLElement ? workspace.getBoundingClientRect().width : 0;
  const availableWidth = resolveWorkspaceGridAvailableWidth(workspaceWidth, { sidePanelsHidden });
  const beforeBinderPanelWidth = state.binderPanelWidth;
  const beforeConsoleDockWidth = state.consoleDockWidth;

  if (!sidePanelsHidden && availableWidth > 0) {
    ensurePanelResizerFallbackProfile(availableWidth);
  }

  let restoreResult = null;
  if (!sidePanelsHidden && !persistProfile && !layoutResizeSession && availableWidth > 0) {
    restoreResult = restorePanelWidthsFromUserSettings(availableWidth, {
      reason: syncOptions.reason,
    });
  }

  const binderWidth = clampNumber(state.binderPanelWidth, MIN_BINDER_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const consoleWidth = clampNumber(state.consoleDockWidth, MIN_CONSOLE_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const currentConsoleWidth = state.consoleDockCollapsed
    ? CONSOLE_DOCK_COLLAPSED_WIDTH
    : consoleWidth;

  let nextBinderWidth = binderWidth;
  let nextConsoleWidth = consoleWidth;
  let maxBinderWidth = null;
  let maxConsoleWidth = null;

  if (!sidePanelsHidden && availableWidth > 0) {
    maxBinderWidth = Math.max(
      MIN_BINDER_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - currentConsoleWidth,
    );
    nextBinderWidth = clampNumber(binderWidth, MIN_BINDER_PANEL_WIDTH, maxBinderWidth);

    if (!state.consoleDockCollapsed) {
      maxConsoleWidth = Math.max(
        MIN_CONSOLE_PANEL_WIDTH,
        availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - nextBinderWidth,
      );
      nextConsoleWidth = clampNumber(consoleWidth, MIN_CONSOLE_PANEL_WIDTH, maxConsoleWidth);
    }
  }

  state.binderPanelWidth = nextBinderWidth;
  state.consoleDockWidth = nextConsoleWidth;
  appRoot.classList.toggle(
    "is-binder-panel-compact",
    state.binderPanelWidth <= BINDER_PANEL_COMPACT_THRESHOLD,
  );
  appRoot.classList.toggle(
    "is-revision-overlay-enabled",
    state.editorPrefs.revisionOverlayEnabled === true,
  );

  appRoot.style.setProperty("--binder-width", `${state.binderPanelWidth}px`);
  appRoot.style.setProperty(
    "--console-dock-width",
    `${state.consoleDockCollapsed ? CONSOLE_DOCK_COLLAPSED_WIDTH : state.consoleDockWidth}px`,
  );
  appRoot.style.setProperty("--binder-resizer-width", `${PANEL_RESIZER_WIDTH}px`);
  appRoot.style.setProperty(
    "--console-resizer-width",
    state.consoleDockCollapsed ? "0px" : `${PANEL_RESIZER_WIDTH}px`,
  );

  layoutStateLog.debug("layout", "panel-layout.sync", "Synchronized manuscript side-panel widths.", {
    reason: syncOptions.reason,
    handleId: syncOptions.handleId ?? layoutResizeSession?.handleId ?? "",
    persistProfileRequested,
    persistProfileApplied: persistProfile,
    layoutResizeSessionActive: Boolean(layoutResizeSession),
    beforeBinderPanelWidth,
    beforeConsoleDockWidth,
    requestedBinderPanelWidth: binderWidth,
    requestedConsoleDockWidth: consoleWidth,
    maxBinderWidth,
    maxConsoleWidth,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
    consoleDockCollapsed: state.consoleDockCollapsed,
    sidePanelsHidden,
    restoreSource: restoreResult?.restoreSource ?? "",
    selectedProfileKey: restoreResult?.selectedProfileKey ?? "",
    profileKeys: Object.keys(state.panelResizerLayoutProfiles ?? {}),
    ...getLayoutViewportLogContext(workspaceWidth, availableWidth),
  });

  if (persistProfileRequested && !persistProfile) {
    layoutStateLog.warn("layout", "panel-layout.persist-blocked", "Blocked side-panel profile persistence from a non-resizer layout sync.", {
      reason: syncOptions.reason,
      handleId: syncOptions.handleId ?? "",
      binderPanelWidth: state.binderPanelWidth,
      consoleDockWidth: state.consoleDockWidth,
      profileKeys: Object.keys(state.panelResizerLayoutProfiles ?? {}),
      ...getLayoutViewportLogContext(workspaceWidth, availableWidth),
    });
  }

  if (persistProfile) {
    persistPanelResizerUserSettings(availableWidth, {
      reason: syncOptions.reason,
      handleId: syncOptions.handleId,
    });
    writeStoredJsonRaw(EDITOR_PANEL_RESIZER_LAYOUT_PROFILES_KEY, state.panelResizerLayoutProfiles);
    writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, state.binderPanelWidth);
    writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, state.consoleDockWidth);
    persistCurrentProjectRecord();
  }
}

function normalizeLayoutSyncOptions(options) {
  // Intent: keep old boolean/event call shapes observable without letting them update layout profiles.
  const isDomEvent = typeof Event !== "undefined" && options instanceof Event;
  if (options === true) {
    return {
      persistProfile: true,
      reason: "legacy-persist",
      handleId: "",
    };
  }
  if (
    !options ||
    options === false ||
    isDomEvent
  ) {
    return {
      persistProfile: false,
      reason: isDomEvent ? `dom-${options.type || "event"}` : "unspecified",
      handleId: "",
    };
  }

  if (typeof options !== "object") {
    return {
      persistProfile: false,
      reason: "unspecified",
      handleId: "",
    };
  }

  return {
    persistProfile: options.persistProfile === true,
    reason: String(options.reason || "unspecified"),
    handleId: String(options.handleId || ""),
  };
}

function getLayoutViewportLogContext(workspaceWidth, availableWidth) {
  // Intent: include enough browser geometry to diagnose monitor/maximize bucket changes.
  return {
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight,
    windowOuterWidth: window.outerWidth,
    windowOuterHeight: window.outerHeight,
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    screenAvailWidth: window.screen?.availWidth ?? null,
    screenAvailHeight: window.screen?.availHeight ?? null,
    devicePixelRatio: window.devicePixelRatio,
    workspaceWidth,
    availableWidth,
    profileKey: resolvePanelResizerLayoutProfileKey(availableWidth),
  };
}

function restorePanelWidthsFromUserSettings(availableWidth, { reason = "" } = {}) {
  // Intent: restore the size-specific profile first so compact display moves do not overwrite wide layouts.
  const previousBinderPanelWidth = state.binderPanelWidth;
  const previousConsoleDockWidth = state.consoleDockWidth;
  const profiles = normalizePanelResizerLayoutProfiles(state.panelResizerLayoutProfiles);
  state.panelResizerLayoutProfiles = profiles;
  const sizeProfile = resolvePanelResizerLayoutProfile(profiles, availableWidth);
  const fallbackProfile = profiles[PANEL_RESIZER_FALLBACK_PROFILE_KEY] ?? null;
  const sizeProfileLooksClamped = doesPanelResizerProfileLookClamped(sizeProfile, profiles);
  const fallbackProfileLooksClamped = doesPanelResizerProfileLookClamped(fallbackProfile, profiles);

  let selectedProfile = null;
  let recoveredProfile = null;
  let restoreSource = "legacy-percent";
  if (sizeProfile && !sizeProfileLooksClamped) {
    selectedProfile = sizeProfile;
    restoreSource = "size-profile";
  } else if (fallbackProfile && !fallbackProfileLooksClamped) {
    selectedProfile = fallbackProfile;
    restoreSource = sizeProfileLooksClamped ? "fallback-after-clamped-size-profile" : "fallback";
  } else if (sizeProfileLooksClamped) {
    recoveredProfile = sizeProfile;
    restoreSource = "recovered-clamped-size-profile";
  } else if (fallbackProfileLooksClamped) {
    recoveredProfile = fallbackProfile;
    restoreSource = "recovered-clamped-fallback";
  }

  const profileWidths = selectedProfile
    ? resolvePanelResizerLayoutProfileWidths(selectedProfile, availableWidth, {
        preferStoredPixels: true,
      })
    : recoveredProfile
      ? recoverPanelResizerWidthsFromClampedProfile(recoveredProfile, availableWidth)
      : resolvePanelResizerPercentWidths({
          leftPercent: state.userSettingPanelResizerLeftPercent,
          rightPercent: state.userSettingPanelResizerRightPercent,
          availableWidth,
        });

  if (recoveredProfile) {
    layoutStateLog.warn("layout", "panel-layout.profile-recovered", "Recovered a wide side-panel profile that matched a compact layout.", {
      reason,
      availableWidth,
      profileKey: recoveredProfile.profileKey,
      profileWorkspaceWidth: recoveredProfile.workspaceWidth,
      storedBinderPanelWidth: recoveredProfile.binderPanelWidth,
      storedConsoleDockWidth: recoveredProfile.consoleDockWidth,
      recoveredBinderPanelWidth: profileWidths.binderPanelWidth,
      recoveredConsoleDockWidth: profileWidths.consoleDockWidth,
    });
  }

  layoutStateLog.debug("layout", "panel-layout.restore", "Resolved manuscript side-panel widths for current workspace.", {
    reason,
    availableWidth,
    restoreSource,
    sizeProfileKey: sizeProfile?.profileKey ?? "",
    sizeProfileWorkspaceWidth: sizeProfile?.workspaceWidth ?? null,
    sizeProfileLooksClamped,
    fallbackProfileLooksClamped,
    selectedProfileKey: selectedProfile?.profileKey ?? recoveredProfile?.profileKey ?? "",
    previousBinderPanelWidth,
    previousConsoleDockWidth,
    nextBinderPanelWidth: profileWidths.binderPanelWidth,
    nextConsoleDockWidth: profileWidths.consoleDockWidth,
    profileKeys: Object.keys(profiles),
  });

  if (profileWidths.binderPanelWidth !== null) {
    state.binderPanelWidth = profileWidths.binderPanelWidth;
  }
  if (profileWidths.consoleDockWidth !== null) {
    state.consoleDockWidth = profileWidths.consoleDockWidth;
  }

  return {
    restoreSource,
    selectedProfileKey: selectedProfile?.profileKey ?? recoveredProfile?.profileKey ?? "",
    sizeProfileKey: sizeProfile?.profileKey ?? "",
    sizeProfileWorkspaceWidth: sizeProfile?.workspaceWidth ?? null,
    sizeProfileLooksClamped,
    fallbackProfileLooksClamped,
    binderPanelWidth: profileWidths.binderPanelWidth,
    consoleDockWidth: profileWidths.consoleDockWidth,
  };
}

function doesPanelResizerProfileLookClamped(profile, profiles) {
  // Intent: keep compact display buckets from masquerading as a saved wide-workspace preference.
  return isPanelResizerLayoutProfileLikelyClamped(profile, profiles, {
    minWideWorkspaceWidth: MIN_MANUSCRIPT_PANEL_WIDTH + DEFAULT_BINDER_PANEL_WIDTH + DEFAULT_CONSOLE_PANEL_WIDTH,
    minWideBinderWidth: DEFAULT_BINDER_PANEL_WIDTH,
  });
}

function recoverPanelResizerWidthsFromClampedProfile(profile, availableWidth) {
  // Intent: preserve the right-console width when only the wide binder profile was compacted.
  return recoverPanelResizerLayoutProfileWidths(profile, availableWidth, {
    minBinderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
    fallbackConsoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
  });
}

function persistPanelResizerUserSettings(availableWidth, { reason = "", handleId = "" } = {}) {
  // Intent: save layout handles by workspace-size bucket while keeping legacy fallback fields stable.
  if (availableWidth <= 0) {
    layoutStateLog.warn("layout", "panel-layout.persist-skipped", "Skipped side-panel layout persistence without a measurable workspace.", {
      reason,
      handleId,
      availableWidth,
    });
    return;
  }

  const profileKey = resolvePanelResizerLayoutProfileKey(availableWidth);
  const profile = createPanelResizerLayoutProfile({
    profileKey,
    availableWidth,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
  });
  state.panelResizerLayoutProfiles = upsertPanelResizerLayoutProfile(
    state.panelResizerLayoutProfiles,
    profile,
  );
  layoutStateLog.debug("layout", "panel-layout.persist", "Persisted manuscript side-panel layout profile.", {
    reason,
    handleId,
    availableWidth,
    profileKey,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
    profileWorkspaceWidth: profile?.workspaceWidth ?? null,
    profileKeys: Object.keys(state.panelResizerLayoutProfiles),
  });

  const fallbackProfile = state.panelResizerLayoutProfiles[PANEL_RESIZER_FALLBACK_PROFILE_KEY] ?? null;
  if (!shouldReplacePanelResizerFallbackProfile(fallbackProfile, availableWidth)) {
    layoutStateLog.debug("layout", "panel-layout.fallback-preserved", "Preserved the wider side-panel fallback profile.", {
      reason,
      handleId,
      availableWidth,
      fallbackWorkspaceWidth: fallbackProfile?.workspaceWidth ?? null,
      fallbackBinderPanelWidth: fallbackProfile?.binderPanelWidth ?? null,
      fallbackConsoleDockWidth: fallbackProfile?.consoleDockWidth ?? null,
    });
    return;
  }

  const nextFallbackProfile = createPanelResizerLayoutProfile({
    profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
    availableWidth,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
  });
  state.panelResizerLayoutProfiles = upsertPanelResizerLayoutProfile(
    state.panelResizerLayoutProfiles,
    nextFallbackProfile,
  );
  state.userSettingPanelResizerLeftPercent = nextFallbackProfile?.leftPercent ?? null;
  state.userSettingPanelResizerRightPercent = nextFallbackProfile?.rightPercent ?? null;
  layoutStateLog.debug("layout", "panel-layout.fallback-updated", "Updated the wide side-panel fallback profile.", {
    reason,
    handleId,
    availableWidth,
    fallbackWorkspaceWidth: nextFallbackProfile?.workspaceWidth ?? null,
    fallbackBinderPanelWidth: nextFallbackProfile?.binderPanelWidth ?? null,
    fallbackConsoleDockWidth: nextFallbackProfile?.consoleDockWidth ?? null,
  });
}

function ensurePanelResizerFallbackProfile(availableWidth) {
  // Intent: preserve legacy pixel widths before automatic resize clamping mutates runtime panel state.
  state.panelResizerLayoutProfiles = normalizePanelResizerLayoutProfiles(state.panelResizerLayoutProfiles);
  if (state.panelResizerLayoutProfiles[PANEL_RESIZER_FALLBACK_PROFILE_KEY]) {
    return;
  }

  const hasLegacyPercent =
    normalizePanelResizerPercent(state.userSettingPanelResizerLeftPercent) !== null ||
    normalizePanelResizerPercent(state.userSettingPanelResizerRightPercent) !== null;
  if (hasLegacyPercent) {
    state.panelResizerLayoutProfiles = upsertPanelResizerLayoutProfile(
      state.panelResizerLayoutProfiles,
      {
        profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
        workspaceWidth: availableWidth,
        binderPanelWidth: null,
        consoleDockWidth: null,
        leftPercent: state.userSettingPanelResizerLeftPercent,
        rightPercent: state.userSettingPanelResizerRightPercent,
      },
    );
    return;
  }

  const fallbackProfile = createPanelResizerLayoutProfile({
    profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
    availableWidth,
    binderPanelWidth: state.binderPanelWidth,
    consoleDockWidth: state.consoleDockWidth,
  });
  state.panelResizerLayoutProfiles = upsertPanelResizerLayoutProfile(
    state.panelResizerLayoutProfiles,
    fallbackProfile,
  );
}

// Intent: keep World Spine side-panel widths clamped and remembered per browser-window size.
function syncWorldSpinePanelLayout(options = {}) {
  const syncOptions = normalizeLayoutSyncOptions(options);
  const persistProfileRequested = syncOptions.persistProfile === true;
  const sidePanelsHidden = state.sidePanelsHidden === true;
  const persistProfile = persistProfileRequested && syncOptions.reason === "world-spine-panel-resize" && !sidePanelsHidden;
  const workspace = document.querySelector("[data-world-spine-root]");
  const workspaceWidth = workspace instanceof HTMLElement ? workspace.getBoundingClientRect().width : 0;
  const availableWidth = Math.max(0, workspaceWidth - (PANEL_RESIZER_WIDTH * 2));
  const beforeEventRailWidth = state.worldSpineEventRailWidth;
  const beforeManuscriptPaneWidth = state.worldSpineManuscriptPaneWidth;

  if (!sidePanelsHidden && availableWidth > 0) {
    ensureWorldSpineLayoutFallbackProfile(availableWidth);
  }

  let restoreResult = null;
  if (!sidePanelsHidden && !persistProfile && !worldSpineLayoutResizeSession && availableWidth > 0) {
    restoreResult = restoreWorldSpinePanelWidthsFromUserSettings(availableWidth, {
      reason: syncOptions.reason,
    });
  }

  if (!sidePanelsHidden) {
    const nextWidths = clampWorldSpinePanelWidths({
      availableWidth,
      eventRailWidth: state.worldSpineEventRailWidth,
      manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
      activeHandleId: syncOptions.handleId || worldSpineLayoutResizeSession?.handleId || "",
    });
    state.worldSpineEventRailWidth = nextWidths.eventRailWidth;
    state.worldSpineManuscriptPaneWidth = nextWidths.manuscriptPaneWidth;
  }

  if (workspace instanceof HTMLElement) {
    workspace.style.setProperty("--world-spine-event-rail-width", `${state.worldSpineEventRailWidth}px`);
    workspace.style.setProperty("--world-spine-manuscript-pane-width", `${state.worldSpineManuscriptPaneWidth}px`);
    workspace.style.setProperty("--world-spine-panel-resizer-width", `${PANEL_RESIZER_WIDTH}px`);
  }

  layoutStateLog.debug("layout", "world-spine-panel-layout.sync", "Synchronized World Spine side-panel widths.", {
    reason: syncOptions.reason,
    handleId: syncOptions.handleId ?? worldSpineLayoutResizeSession?.handleId ?? "",
    persistProfileRequested,
    persistProfileApplied: persistProfile,
    worldSpineLayoutResizeSessionActive: Boolean(worldSpineLayoutResizeSession),
    beforeEventRailWidth,
    beforeManuscriptPaneWidth,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
    sidePanelsHidden,
    timelineMinWidth: MIN_WORLD_SPINE_TIMELINE_WIDTH,
    restoreSource: restoreResult?.restoreSource ?? "",
    selectedProfileKey: restoreResult?.selectedProfileKey ?? "",
    profileKeys: Object.keys(state.worldSpinePanelLayoutProfiles ?? {}),
    ...getWorldSpineLayoutViewportLogContext(workspaceWidth, availableWidth),
  });

  if (persistProfileRequested && !persistProfile) {
    layoutStateLog.warn("layout", "world-spine-panel-layout.persist-blocked", "Blocked World Spine layout profile persistence from a non-resizer sync.", {
      reason: syncOptions.reason,
      handleId: syncOptions.handleId ?? "",
      eventRailWidth: state.worldSpineEventRailWidth,
      manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
      profileKeys: Object.keys(state.worldSpinePanelLayoutProfiles ?? {}),
      ...getWorldSpineLayoutViewportLogContext(workspaceWidth, availableWidth),
    });
  }

  if (persistProfile) {
    persistWorldSpinePanelLayoutUserSettings(availableWidth, {
      reason: syncOptions.reason,
      handleId: syncOptions.handleId,
    });
    writeStoredJsonRaw(EDITOR_WORLD_SPINE_PANEL_LAYOUT_PROFILES_KEY, state.worldSpinePanelLayoutProfiles);
    writeStoredJsonRaw(EDITOR_WORLD_SPINE_EVENT_RAIL_WIDTH_KEY, state.worldSpineEventRailWidth);
    writeStoredJsonRaw(EDITOR_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH_KEY, state.worldSpineManuscriptPaneWidth);
    persistCurrentProjectRecord({
      domain: "app-settings",
      dirtyReason: "world-spine-panel-layout-updated",
      source: "syncWorldSpinePanelLayout",
    });
  }

  syncWorldbuildingEntryPopoverPosition();
}

function clampWorldSpinePanelWidths({
  availableWidth,
  eventRailWidth,
  manuscriptPaneWidth,
  activeHandleId = "",
} = {}) {
  // Intent: reserve enough center canvas width while preserving the rail currently being dragged.
  let nextEventRailWidth = clampNumber(
    eventRailWidth,
    MIN_WORLD_SPINE_EVENT_RAIL_WIDTH,
    Number.POSITIVE_INFINITY,
  );
  let nextManuscriptPaneWidth = clampNumber(
    manuscriptPaneWidth,
    MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
    Number.POSITIVE_INFINITY,
  );

  if (availableWidth <= 0) {
    return {
      eventRailWidth: nextEventRailWidth,
      manuscriptPaneWidth: nextManuscriptPaneWidth,
    };
  }

  const maxSidePanelTotal = Math.max(
    MIN_WORLD_SPINE_EVENT_RAIL_WIDTH + MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
    availableWidth - MIN_WORLD_SPINE_TIMELINE_WIDTH,
  );
  nextEventRailWidth = clampNumber(
    nextEventRailWidth,
    MIN_WORLD_SPINE_EVENT_RAIL_WIDTH,
    Math.max(MIN_WORLD_SPINE_EVENT_RAIL_WIDTH, maxSidePanelTotal - MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH),
  );
  nextManuscriptPaneWidth = clampNumber(
    nextManuscriptPaneWidth,
    MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH,
    Math.max(MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH, maxSidePanelTotal - nextEventRailWidth),
  );

  const overflow = Math.max(0, nextEventRailWidth + nextManuscriptPaneWidth - maxSidePanelTotal);
  if (overflow > 0 && activeHandleId === "event-rail") {
    nextManuscriptPaneWidth = Math.max(MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH, nextManuscriptPaneWidth - overflow);
  } else if (overflow > 0 && activeHandleId === "manuscript-pane") {
    nextEventRailWidth = Math.max(MIN_WORLD_SPINE_EVENT_RAIL_WIDTH, nextEventRailWidth - overflow);
  } else if (overflow > 0 && nextEventRailWidth - MIN_WORLD_SPINE_EVENT_RAIL_WIDTH >= nextManuscriptPaneWidth - MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH) {
    nextEventRailWidth = Math.max(MIN_WORLD_SPINE_EVENT_RAIL_WIDTH, nextEventRailWidth - overflow);
  } else if (overflow > 0) {
    nextManuscriptPaneWidth = Math.max(MIN_WORLD_SPINE_MANUSCRIPT_PANE_WIDTH, nextManuscriptPaneWidth - overflow);
  }

  return {
    eventRailWidth: nextEventRailWidth,
    manuscriptPaneWidth: nextManuscriptPaneWidth,
  };
}

function restoreWorldSpinePanelWidthsFromUserSettings(availableWidth, { reason = "" } = {}) {
  // Intent: restore World Spine rail widths from the nearest window-size profile without overwriting it on resize.
  const previousEventRailWidth = state.worldSpineEventRailWidth;
  const previousManuscriptPaneWidth = state.worldSpineManuscriptPaneWidth;
  const profiles = normalizeWorldSpineLayoutProfiles(state.worldSpinePanelLayoutProfiles);
  state.worldSpinePanelLayoutProfiles = profiles;
  const sizeProfile = resolveWorldSpineLayoutProfile(profiles, availableWidth);
  const fallbackProfile = profiles[WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY] ?? null;
  const selectedProfile = sizeProfile ?? fallbackProfile;
  const restoreSource = sizeProfile ? "size-profile" : fallbackProfile ? "fallback" : "state";
  const profileWidths = selectedProfile
    ? resolveWorldSpineLayoutProfileWidths(selectedProfile, availableWidth, {
        preferStoredPixels: true,
      })
    : {
        eventRailWidth: null,
        manuscriptPaneWidth: null,
      };

  if (profileWidths.eventRailWidth !== null) {
    state.worldSpineEventRailWidth = profileWidths.eventRailWidth;
  }
  if (profileWidths.manuscriptPaneWidth !== null) {
    state.worldSpineManuscriptPaneWidth = profileWidths.manuscriptPaneWidth;
  }

  layoutStateLog.debug("layout", "world-spine-panel-layout.restore", "Resolved World Spine side-panel widths for current workspace.", {
    reason,
    availableWidth,
    restoreSource,
    sizeProfileKey: sizeProfile?.profileKey ?? "",
    selectedProfileKey: selectedProfile?.profileKey ?? "",
    previousEventRailWidth,
    previousManuscriptPaneWidth,
    nextEventRailWidth: profileWidths.eventRailWidth,
    nextManuscriptPaneWidth: profileWidths.manuscriptPaneWidth,
    profileKeys: Object.keys(profiles),
  });

  return {
    restoreSource,
    selectedProfileKey: selectedProfile?.profileKey ?? "",
    sizeProfileKey: sizeProfile?.profileKey ?? "",
    eventRailWidth: profileWidths.eventRailWidth,
    manuscriptPaneWidth: profileWidths.manuscriptPaneWidth,
  };
}

function persistWorldSpinePanelLayoutUserSettings(availableWidth, { reason = "", handleId = "" } = {}) {
  // Intent: store World Spine rail widths by workspace-size bucket while keeping a wide fallback profile.
  if (availableWidth <= 0) {
    layoutStateLog.warn("layout", "world-spine-panel-layout.persist-skipped", "Skipped World Spine layout persistence without a measurable workspace.", {
      reason,
      handleId,
      availableWidth,
    });
    return;
  }

  const profileKey = resolveWorldSpineLayoutProfileKey(availableWidth);
  const profile = createWorldSpineLayoutProfile({
    profileKey,
    availableWidth,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
  });
  state.worldSpinePanelLayoutProfiles = upsertWorldSpineLayoutProfile(
    state.worldSpinePanelLayoutProfiles,
    profile,
  );
  layoutStateLog.debug("layout", "world-spine-panel-layout.persist", "Persisted World Spine side-panel layout profile.", {
    reason,
    handleId,
    availableWidth,
    profileKey,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
    profileWorkspaceWidth: profile?.workspaceWidth ?? null,
    profileKeys: Object.keys(state.worldSpinePanelLayoutProfiles),
  });

  const fallbackProfile = state.worldSpinePanelLayoutProfiles[WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY] ?? null;
  if (!shouldReplaceWorldSpineFallbackProfile(fallbackProfile, availableWidth)) {
    layoutStateLog.debug("layout", "world-spine-panel-layout.fallback-preserved", "Preserved the wider World Spine fallback profile.", {
      reason,
      handleId,
      availableWidth,
      fallbackWorkspaceWidth: fallbackProfile?.workspaceWidth ?? null,
      fallbackEventRailWidth: fallbackProfile?.eventRailWidth ?? null,
      fallbackManuscriptPaneWidth: fallbackProfile?.manuscriptPaneWidth ?? null,
    });
    return;
  }

  const nextFallbackProfile = createWorldSpineLayoutProfile({
    profileKey: WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
    availableWidth,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
  });
  state.worldSpinePanelLayoutProfiles = upsertWorldSpineLayoutProfile(
    state.worldSpinePanelLayoutProfiles,
    nextFallbackProfile,
  );
  layoutStateLog.debug("layout", "world-spine-panel-layout.fallback-updated", "Updated the wide World Spine side-panel fallback profile.", {
    reason,
    handleId,
    availableWidth,
    fallbackWorkspaceWidth: nextFallbackProfile?.workspaceWidth ?? null,
    fallbackEventRailWidth: nextFallbackProfile?.eventRailWidth ?? null,
    fallbackManuscriptPaneWidth: nextFallbackProfile?.manuscriptPaneWidth ?? null,
  });
}

function ensureWorldSpineLayoutFallbackProfile(availableWidth) {
  // Intent: seed a World Spine fallback profile before automatic resize clamping can distort the defaults.
  state.worldSpinePanelLayoutProfiles = normalizeWorldSpineLayoutProfiles(state.worldSpinePanelLayoutProfiles);
  if (state.worldSpinePanelLayoutProfiles[WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY]) {
    return;
  }

  const fallbackProfile = createWorldSpineLayoutProfile({
    profileKey: WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
    availableWidth,
    eventRailWidth: state.worldSpineEventRailWidth,
    manuscriptPaneWidth: state.worldSpineManuscriptPaneWidth,
  });
  state.worldSpinePanelLayoutProfiles = upsertWorldSpineLayoutProfile(
    state.worldSpinePanelLayoutProfiles,
    fallbackProfile,
  );
}

function getWorldSpineLayoutViewportLogContext(workspaceWidth, availableWidth) {
  // Intent: log enough viewport context to diagnose per-window World Spine profile restores.
  return {
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight,
    windowOuterWidth: window.outerWidth,
    windowOuterHeight: window.outerHeight,
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    screenAvailWidth: window.screen?.availWidth ?? null,
    screenAvailHeight: window.screen?.availHeight ?? null,
    devicePixelRatio: window.devicePixelRatio,
    workspaceWidth,
    availableWidth,
    profileKey: resolveWorldSpineLayoutProfileKey(availableWidth),
  };
}

function normalizePanelResizerPercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(clampNumber(numericValue, 0, 100) * 10) / 10
    : null;
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function writeStoredJson(storageKey, value) {
  localStorageAdapterLog.debug("file-access", "local-storage.write", "Persisting user preference key.", {
    storageKey,
    valueType: Array.isArray(value) ? "array" : typeof value,
  });
  projectService.saveUserPreference(storageKey, value);

  if (PROJECT_STATE_STORAGE_KEYS.has(storageKey)) {
    persistCurrentProjectRecord();
  }
}

// Intent: expose one stable runtime bridge so the separate Developer Logs window can control and observe the live logger directly.
function registerDeveloperLogRuntimeBridge() {
  window[DEVELOPER_LOG_RUNTIME_BRIDGE_KEY] = {
    getEntries: () => developerLogger.getEntries(),
    getSettings: () => developerLogger.getSettings(),
    setGlobalEnabled: (enabled) => developerLogger.setGlobalEnabled(enabled === true),
    setSourceEnabled: (sourceName, enabled) => developerLogger.setSourceEnabled(sourceName, enabled === true),
    setAllSourcesEnabled: (enabled) => developerLogger.setAllSourcesEnabled(enabled === true),
    clear: () => developerLogger.clear(),
    subscribe: (listener) => developerLogger.subscribe(listener),
    subscribeSettings: (listener) => developerLogger.subscribeSettings(listener),
  };
}

// Intent: bridge browser runtime failures back to the desktop host logger when available.
function registerRuntimeLogging() {
  window.addEventListener("error", (event) => {
    reportBrowserLog("error", "window", event.message || "Unhandled browser error.", {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
    logWritingTargetDebugEvent("error", "runtime.window", event.message || "Unhandled browser error.", {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportBrowserLog("error", "promise", "Unhandled promise rejection.", {
      reason: event.reason,
    });
    logWritingTargetDebugEvent("error", "runtime.promise", "Unhandled promise rejection.", {
      reason: event.reason,
    });
  });
}

function reportBrowserLog(level, scope, message, context = {}) {
  const normalizedLevel = String(level ?? "info").toLowerCase();
  const source = resolveDeveloperLogSource(scope);
  const category = resolveDeveloperLogCategory(scope);
  const eventName = `${String(scope ?? "runtime")}.${normalizedLevel}`;
  const entry = developerLogger.log({
    level: normalizedLevel,
    source,
    category,
    event: eventName,
    message,
    context,
  });

  if (entry || !shouldMirrorBrowserLogWhenSourceDisabled(normalizedLevel, scope)) {
    return;
  }

  const payload = {
    level: normalizedLevel,
    scope,
    message,
    context: serializeBrowserLogContext(context),
  };

  void postJsonToDesktopHost("/api/log", payload, {
    logTransport: false,
  });
}

// Intent: keep warn/error visibility when source gates are off, but do not mirror dropped debug/info chatter.
function shouldMirrorBrowserLogWhenSourceDisabled(level, scope) {
  const normalizedLevel = String(level ?? "").toLowerCase();
  if (normalizedLevel === "warn" || normalizedLevel === "error") {
    return true;
  }

  const normalizedScope = String(scope ?? "").toLowerCase();
  return normalizedLevel === "info" && [
    "project-file",
    "project-library",
    "project-source",
    "workspace",
  ].includes(normalizedScope);
}

// Intent: mirror structured in-app developer logger entries to the desktop log file sink without re-entering the app logger.
async function postDeveloperLogEntryToDesktopHost(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const baseUrls = getDesktopApiBaseUrls();
  const payload = {
    level: entry.level,
    scope: String(entry.source ?? "browser"),
    message: String(entry.message ?? "Developer log entry"),
    context: serializeBrowserLogContext({
      category: entry.category ?? "",
      event: entry.event ?? "",
      timestamp: entry.timestamp ?? "",
      callsite: entry.callsite ?? null,
      projectId: entry.projectId ?? "",
      sceneId: entry.sceneId ?? "",
      chapterId: entry.chapterId ?? "",
      blockId: entry.blockId ?? "",
      ...(entry.context && typeof entry.context === "object" ? entry.context : {}),
    }),
  };
  const body = JSON.stringify(payload);

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL("/api/log", baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore and try the next desktop-host origin.
    }
  }

  return false;
}

function resolveDeveloperLogSource(scope) {
  const normalizedScope = String(scope ?? "").toLowerCase();
  if (normalizedScope === "storage") {
    return "LocalStorageAdapter";
  }
  if (normalizedScope === "project-file") {
    return "DesktopFileSystemAdapter";
  }
  if (normalizedScope === "settings" || normalizedScope === "api") {
    return "FileAccessBridge";
  }
  if (normalizedScope === "project-library") {
    return "ProjectPersistenceService";
  }
  if (normalizedScope === "window" || normalizedScope === "promise") {
    return "UIEventDispatcher";
  }
  return "AppRuntime";
}

function resolveDeveloperLogCategory(scope) {
  const normalizedScope = String(scope ?? "").toLowerCase();
  if (normalizedScope === "storage") {
    return "file-access";
  }
  if (normalizedScope === "project-file" || normalizedScope === "settings" || normalizedScope === "api") {
    return "persistence";
  }
  if (normalizedScope === "project-library") {
    return "state-change";
  }
  return "lifecycle";
}

async function postJsonToDesktopHost(pathname, payload, options = {}) {
  const baseUrls = getDesktopApiBaseUrls();
  const body = JSON.stringify(payload);
  const failedOrigins = [];
  const shouldLogTransport = options.logTransport !== false && pathname !== "/api/log";
  // Intent: do not log log-transport calls; that creates recursive FileAccessBridge noise.
  if (shouldLogTransport) {
    fileAccessBridgeLog.debug("file-access", "desktop-host.post", "Posting JSON payload to desktop host.", {
      pathname,
      bodyLength: body.length,
    });
  }

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL(pathname, baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      });

      if (response.ok) {
        if (shouldLogTransport) {
          fileAccessBridgeLog.debug("file-access", "desktop-host.post-success", "Desktop host accepted JSON payload.", {
            pathname,
            baseUrl,
          });
        }
        return true;
      }
    } catch {
      // Ignore and try the next desktop host origin.
      failedOrigins.push(baseUrl);
    }
  }

  const nowMs = Date.now();
  const shouldWarn = pathname !== "/api/log"
    || nowMs - lastDesktopLogBridgeWarningAt >= DESKTOP_LOG_BRIDGE_WARNING_THROTTLE_MS;
  if (shouldWarn) {
    if (pathname === "/api/log") {
      lastDesktopLogBridgeWarningAt = nowMs;
    }
    fileAccessBridgeLog.warn("file-access", "desktop-host.post-unavailable", "No desktop host origin accepted JSON payload.", {
      pathname,
      failedOrigins,
      failedOriginCount: failedOrigins.length,
    });
  }
  return false;
}

function serializeBrowserLogContext(context) {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, serializeBrowserLogValue(value)]),
  );
}

function serializeBrowserLogValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeBrowserLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeBrowserLogValue(item)]),
    );
  }

  return value;
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
