// Intent: own the Local AI model-library panel markup and browser API calls outside app.js.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";

export function createLocalAiModelLibraryClient({
  fetchJson,
  logger = console,
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createLocalAiModelLibraryClient requires a fetchJson function.");
  }

  return {
    loadModelLibrary: () => requestLocalAiModelLibrary({ fetchJson, logger }),
    saveModelSettings: (settings) => requestLocalAiModelSettings(settings, { fetchJson, logger }),
    ensureModelFolders: (settings) => requestEnsureLocalAiModelFolders(settings, { fetchJson, logger }),
  };
}

export async function requestLocalAiModelLibrary({
  fetchJson,
  logger = console,
  endpoint = "/api/local-ai/models",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("requestLocalAiModelLibrary requires a fetchJson function.");
  }

  try {
    const response = await fetchJson(endpoint);
    if (!response?.ok || !response.value?.ok) {
      return {
        ok: false,
        message: "Local AI model library unavailable",
      };
    }

    return {
      ok: true,
      modelLibrary: response.value,
    };
  } catch (error) {
    logger?.warn?.("Local AI model library request failed", error);
    return {
      ok: false,
      message: "Local AI model library unavailable",
    };
  }
}

export async function requestLocalAiModelSettings(settings = {}, {
  fetchJson,
  logger = console,
  endpoint = "/api/local-ai/model-settings",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("requestLocalAiModelSettings requires a fetchJson function.");
  }

  try {
    const response = await fetchJson(endpoint, {
      method: "POST",
      body: buildLocalAiModelSettingsPayload(settings),
    });
    if (!response?.ok || !response.value?.ok) {
      return {
        ok: false,
        message: "Local AI settings not saved",
      };
    }

    return {
      ok: true,
      settings: response.value.settings,
      modelLibrary: response.value.modelLibrary,
    };
  } catch (error) {
    logger?.warn?.("Local AI settings request failed", error);
    return {
      ok: false,
      message: "Local AI settings not saved",
    };
  }
}

export async function requestEnsureLocalAiModelFolders(settings = {}, {
  fetchJson,
  logger = console,
  endpoint = "/api/local-ai/models/ensure-folders",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("requestEnsureLocalAiModelFolders requires a fetchJson function.");
  }

  try {
    const response = await fetchJson(endpoint, {
      method: "POST",
      body: buildLocalAiModelSettingsPayload(settings),
    });
    if (!response?.ok || !response.value?.ok) {
      return {
        ok: false,
        message: "Model folders not created",
      };
    }

    return {
      ok: true,
      settings: response.value.settings,
      modelLibrary: response.value.modelLibrary,
    };
  } catch (error) {
    logger?.warn?.("Local AI model folder request failed", error);
    return {
      ok: false,
      message: "Model folders not created",
    };
  }
}

export function buildLocalAiModelSettingsPayload(settings = {}) {
  return {
    modelRoot: String(settings.modelRoot ?? "").trim(),
    executionMode: settings.executionMode === "hybrid" ? "hybrid" : "local-only",
  };
}

export function buildLocalAiPanelModel({
  localAiPrefs = {},
  modelLibrary = null,
  modelRootDraft = "",
  statusMessage = "",
  loading = false,
} = {}) {
  const safeModelLibrary = modelLibrary && typeof modelLibrary === "object" ? modelLibrary : null;
  const folders = Array.isArray(safeModelLibrary?.folders) ? safeModelLibrary.folders : [];
  const models = Array.isArray(safeModelLibrary?.models) ? safeModelLibrary.models : [];
  const browseLinks = Array.isArray(safeModelLibrary?.browseLinks) ? safeModelLibrary.browseLinks : [];
  const modelRoot = String(modelRootDraft || safeModelLibrary?.modelRoot || "").trim();
  return {
    enabled: localAiPrefs?.enabled !== false,
    modelRoot,
    rootExists: safeModelLibrary?.rootExists === true,
    manifestFileName: String(safeModelLibrary?.manifestFileName ?? "abe-model.json"),
    folders,
    models,
    browseLinks,
    statusMessage: String(statusMessage ?? ""),
    loading: loading === true,
    registeredCount: models.filter((model) => model?.status === "registered").length,
    unregisteredCount: models.filter((model) => model?.status === "unregistered").length,
    invalidCount: models.filter((model) => model?.status === "invalid").length,
  };
}

export function renderLocalAiPanelHTML(options = {}) {
  const model = buildLocalAiPanelModel(options);
  return `
    <section class="local-ai-panel" role="dialog" aria-label="Local AI model settings">
      <header class="local-ai-panel__header">
        <div>
          <p class="local-ai-panel__kicker">Project Settings</p>
          <h2>Local AI</h2>
        </div>
        <button
          class="local-ai-panel__close"
          type="button"
          data-action="close-local-ai-panel"
          aria-label="Close Local AI settings"
          title="Close"
        >&times;</button>
      </header>

      <section class="local-ai-panel__section">
        <label class="local-ai-panel__toggle">
          <input
            type="checkbox"
            data-local-ai-setting="enabled"
            ${model.enabled ? "checked" : ""}
          />
          <span>Local AI</span>
          <strong>${model.enabled ? "On" : "Off"}</strong>
        </label>
      </section>

      <section class="local-ai-panel__section">
        <span class="local-ai-panel__label">Model root</span>
        <div class="local-ai-panel__root-row">
          <input
            class="local-ai-panel__path-input"
            type="text"
            value="${escapeHtml(model.modelRoot)}"
            data-local-ai-model-setting="modelRoot"
            aria-label="Local AI model root folder"
            spellcheck="false"
          />
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="save-local-ai-model-settings"
            ${model.loading ? "disabled" : ""}
          >Save</button>
        </div>
        <div class="local-ai-panel__actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="ensure-local-ai-model-folders"
            ${model.loading ? "disabled" : ""}
          >Create folders</button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="refresh-local-ai-models"
            ${model.loading ? "disabled" : ""}
          >Refresh</button>
        </div>
        <p class="local-ai-panel__status ${model.rootExists ? "is-ready" : "is-warning"}">
          ${escapeHtml(model.statusMessage || (model.rootExists ? "Model folder found" : "Model folder missing"))}
        </p>
      </section>

      <section class="local-ai-panel__section">
        <span class="local-ai-panel__label">Folder architecture</span>
        <div class="local-ai-panel__folder-grid">
          ${model.folders.map((folder) => renderFolderRecord(folder)).join("")}
        </div>
      </section>

      <section class="local-ai-panel__section">
        <div class="local-ai-panel__section-heading">
          <span class="local-ai-panel__label">Installed models</span>
          <strong>${escapeHtml(formatModelSummary(model))}</strong>
        </div>
        ${model.models.length > 0 ? renderModelList(model.models, model.manifestFileName) : renderEmptyModelState(model)}
      </section>

      <section class="local-ai-panel__section">
        <span class="local-ai-panel__label">Browse models</span>
        <div class="local-ai-panel__link-grid">
          ${model.browseLinks.map((link) => renderBrowseLink(link)).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderFolderRecord(folder) {
  const modelCount = Math.max(0, Math.round(Number(folder?.modelCount) || 0));
  const exists = folder?.exists === true;
  return `
    <div class="local-ai-panel__folder ${exists ? "is-ready" : "is-missing"}">
      <strong>${escapeHtml(folder?.category ?? "")}</strong>
      <span>${escapeHtml(folder?.label ?? "")}</span>
      <small>${escapeHtml(exists ? `${formatDisplayNumber(modelCount)} models` : "Missing")}</small>
    </div>
  `;
}

function renderModelList(models, manifestFileName) {
  return `
    <div class="local-ai-panel__model-list">
      ${models.map((model) => renderModelRecord(model, manifestFileName)).join("")}
    </div>
  `;
}

function renderModelRecord(model, manifestFileName) {
  const taskLabel = Array.isArray(model?.taskTypes) && model.taskTypes.length
    ? model.taskTypes.join(", ")
    : "No task mapping";
  const artifactCount = Array.isArray(model?.artifactPaths) ? model.artifactPaths.length : 0;
  return `
    <article class="local-ai-panel__model is-${escapeHtml(model?.status ?? "unregistered")}">
      <div>
        <strong>${escapeHtml(model?.displayName ?? model?.id ?? "Local model")}</strong>
        <span>${escapeHtml(`${model?.category ?? "model"} / ${model?.runtime ?? "unknown"} / ${model?.format ?? "unknown"}`)}</span>
      </div>
      <div class="local-ai-panel__model-meta">
        <span>${escapeHtml(model?.tier || "No tier")}</span>
        <span>${escapeHtml(taskLabel)}</span>
        <span>${escapeHtml(`${formatDisplayNumber(artifactCount)} artifact${artifactCount === 1 ? "" : "s"}`)}</span>
      </div>
      ${renderModelValidation(model, manifestFileName)}
    </article>
  `;
}

function renderModelValidation(model, manifestFileName) {
  const messages = Array.isArray(model?.validationMessages) ? model.validationMessages.filter(Boolean) : [];
  if (messages.length === 0) {
    return `<p class="local-ai-panel__model-note is-ready">Registered with ${escapeHtml(manifestFileName)}</p>`;
  }

  return `
    <p class="local-ai-panel__model-note">
      ${escapeHtml(messages.join(" "))}
    </p>
  `;
}

function renderEmptyModelState(model) {
  return `
    <div class="local-ai-panel__empty">
      <strong>${model.rootExists ? "No models found" : "No model folder yet"}</strong>
      <span>${escapeHtml(model.rootExists ? `Add model folders containing ${model.manifestFileName}.` : "Create the folder architecture first.")}</span>
    </div>
  `;
}

function renderBrowseLink(link) {
  return `
    <a
      class="local-ai-panel__link"
      href="${escapeHtml(link?.url ?? "#")}"
      target="_blank"
      rel="noreferrer noopener"
    >
      <strong>${escapeHtml(link?.label ?? "Model catalog")}</strong>
      <span>${escapeHtml(link?.description ?? "")}</span>
    </a>
  `;
}

function formatModelSummary(model) {
  const parts = [
    `${formatDisplayNumber(model.registeredCount)} registered`,
    `${formatDisplayNumber(model.unregisteredCount)} unregistered`,
  ];
  if (model.invalidCount > 0) {
    parts.push(`${formatDisplayNumber(model.invalidCount)} invalid`);
  }
  return parts.join(" / ");
}
