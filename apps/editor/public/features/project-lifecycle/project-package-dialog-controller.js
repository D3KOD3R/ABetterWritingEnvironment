// Intent: add responsive project-package location UX while keeping app.js as the lifecycle authority.
import {
  chooseDesktopDirectory,
  installDesktopDirectoryPickerBridge,
  queueDesktopDirectoryForNextPicker,
} from "../../adapters/platform/desktop-directory-picker.js";

export const PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS = 260;

let locationRefreshTimer = null;
let nativePickerBusy = false;
let scrivenerPickerBusy = false;
let replayingScrivenerClick = false;
let pendingFocusRestore = null;
let pendingCompletionRestore = null;
let suppressNextLocationFocusRefresh = false;
let suppressNextLocationInputRefresh = false;

function hasNativeDesktopDirectoryPicker() {
  return document.querySelector('meta[name="abe-native-directory-picker"][content="true"]') !== null;
}

// Intent: install the compatibility bridge only on desktop hosts that can preselect through the shared native chooser.
if (hasNativeDesktopDirectoryPicker()) {
  installDesktopDirectoryPickerBridge();
}

function getLocationInput() {
  const input = document.querySelector('[data-project-package-field="locationPath"]');
  return input instanceof HTMLInputElement ? input : null;
}

function clearScheduledLocationRefresh() {
  if (locationRefreshTimer !== null) {
    window.clearTimeout(locationRefreshTimer);
    locationRefreshTimer = null;
  }
}

function rememberLocationFocus(input) {
  if (!(input instanceof HTMLInputElement) || document.activeElement !== input) {
    pendingFocusRestore = null;
    return;
  }
  pendingFocusRestore = {
    value: input.value,
    selectionStart: input.selectionStart,
    selectionEnd: input.selectionEnd,
  };
}

export function resolveProjectPackageLocationLookup(value) {
  const typedValue = String(value ?? "").trim();
  if (!typedValue) {
    return {
      typedValue,
      browsePath: "",
      prefix: "",
      isPartialSegment: false,
    };
  }

  const endsWithSeparator = /[\\/]$/.test(typedValue);
  const separatorIndex = Math.max(typedValue.lastIndexOf("\\"), typedValue.lastIndexOf("/"));
  if (endsWithSeparator || separatorIndex < 0) {
    return {
      typedValue,
      browsePath: typedValue,
      prefix: "",
      isPartialSegment: false,
    };
  }

  const separator = typedValue[separatorIndex];
  let browsePath = typedValue.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(browsePath)) {
    browsePath += separator;
  } else if (!browsePath && typedValue.startsWith(separator)) {
    browsePath = separator;
  }

  return {
    typedValue,
    browsePath,
    prefix: typedValue.slice(separatorIndex + 1),
    isPartialSegment: Boolean(browsePath),
  };
}

// Intent: reuse the existing Enter-to-validate path so persistence ordering stays in the established app controller.
function requestExistingProjectPackageValidation({
  restoreFocus = false,
  browsePath = null,
  completion = null,
} = {}) {
  const input = getLocationInput();
  if (!input || input.disabled) return false;
  if (restoreFocus) rememberLocationFocus(input);
  if (completion) pendingCompletionRestore = completion;

  const typedValue = input.value;
  if (typeof browsePath === "string") {
    input.value = browsePath;
  }
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }));

  // The existing handler may replace this node synchronously, but restore the detached node too for callers/tests.
  input.value = typedValue;
  return true;
}

function scheduleLocationRefresh(input) {
  if (!(input instanceof HTMLInputElement)) return;
  clearScheduledLocationRefresh();
  const expectedValue = input.value;
  locationRefreshTimer = window.setTimeout(() => {
    locationRefreshTimer = null;
    const currentInput = getLocationInput();
    if (!currentInput || currentInput.value !== expectedValue || currentInput.disabled) return;

    const lookup = resolveProjectPackageLocationLookup(expectedValue);
    const restoreFocus = document.activeElement === currentInput;
    if (lookup.isPartialSegment) {
      const selectionStart = currentInput.selectionStart;
      const selectionEnd = currentInput.selectionEnd;
      requestExistingProjectPackageValidation({
        restoreFocus,
        browsePath: lookup.browsePath,
        completion: {
          typedValue: lookup.typedValue,
          prefix: lookup.prefix,
          restoreFocus,
          selectionStart,
          selectionEnd,
        },
      });
      return;
    }

    requestExistingProjectPackageValidation({ restoreFocus });
  }, PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS);
}

function collectMatchingDirectoryMarkup(prefix) {
  const browser = document.querySelector(".project-package-dialog__browser");
  if (!(browser instanceof HTMLElement)) return "";
  const normalizedPrefix = String(prefix ?? "").toLocaleLowerCase();
  const matches = Array.from(browser.querySelectorAll('[data-action="navigate-project-package"]'))
    .filter((button) => {
      const name = String(button.querySelector("span")?.textContent ?? "").trim();
      if (!name || name === "..") return false;
      return !normalizedPrefix || name.toLocaleLowerCase().startsWith(normalizedPrefix);
    })
    .map((button) => button.outerHTML);
  return matches.join("") || "<p>No matching child folders.</p>";
}

function restorePartialLocationCompletion() {
  if (!pendingCompletionRestore) return false;
  const input = getLocationInput();
  if (!input || input.disabled) return false;

  const completion = pendingCompletionRestore;
  const browser = document.querySelector(".project-package-dialog__browser");
  const matchingMarkup = collectMatchingDirectoryMarkup(completion.prefix);
  pendingCompletionRestore = null;
  pendingFocusRestore = null;

  suppressNextLocationInputRefresh = true;
  input.value = completion.typedValue;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  document.querySelector(".project-package-dialog__error")?.remove();
  if (browser instanceof HTMLElement) {
    browser.innerHTML = matchingMarkup;
  }

  if (completion.restoreFocus) {
    suppressNextLocationFocusRefresh = true;
    input.focus({ preventScroll: true });
    if (Number.isInteger(completion.selectionStart) && Number.isInteger(completion.selectionEnd)) {
      input.setSelectionRange(completion.selectionStart, completion.selectionEnd);
    }
  }
  return true;
}

async function openNativeProjectPackageDirectoryPicker() {
  if (nativePickerBusy) return;
  nativePickerBusy = true;
  clearScheduledLocationRefresh();
  const initialPath = getLocationInput()?.value ?? "";

  try {
    const result = await chooseDesktopDirectory({ initialPath });
    if (!result.supported) {
      requestExistingProjectPackageValidation();
      return;
    }
    if (result.cancelled || !result.path) return;

    const input = getLocationInput();
    if (!input || input.disabled) return;
    input.value = result.path;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    clearScheduledLocationRefresh();
    requestExistingProjectPackageValidation();
  } catch (error) {
    console.warn("Desktop folder picker unavailable; falling back to the in-app folder browser.", error);
    requestExistingProjectPackageValidation();
  } finally {
    nativePickerBusy = false;
  }
}

function replayScrivenerPortClick(target) {
  replayingScrivenerClick = true;
  try {
    target.click();
  } finally {
    replayingScrivenerClick = false;
  }
}

// Intent: select the Scrivener source with the same native picker used by New Project before persistence awaits can lose the click gesture.
async function openNativeScrivenerDirectoryPicker(target) {
  if (scrivenerPickerBusy) return;
  scrivenerPickerBusy = true;
  try {
    const result = await chooseDesktopDirectory();
    if (!result.supported) {
      replayScrivenerPortClick(target);
      return;
    }
    if (result.cancelled || !result.path) return;

    queueDesktopDirectoryForNextPicker({
      rootPath: result.path,
      windowRef: window,
    });
    replayScrivenerPortClick(target);
  } catch (error) {
    console.warn("Desktop Scrivener folder selection failed; falling back to the existing import path.", error);
    replayScrivenerPortClick(target);
  } finally {
    scrivenerPickerBusy = false;
  }
}

// Intent: validation may canonicalize a path, but it must not rewrite text while the user is still editing it.
const dialogObserver = new MutationObserver(() => {
  if (restorePartialLocationCompletion()) return;
  if (!pendingFocusRestore) return;
  const input = getLocationInput();
  if (!input || input.disabled) return;

  const { value, selectionStart, selectionEnd } = pendingFocusRestore;
  pendingFocusRestore = null;
  suppressNextLocationFocusRefresh = true;
  if (input.value !== value) {
    input.value = value;
  }
  input.focus({ preventScroll: true });
  if (Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
    input.setSelectionRange(selectionStart, selectionEnd);
  }
});

dialogObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

document.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.projectPackageField !== "locationPath") return;
  if (suppressNextLocationInputRefresh) {
    suppressNextLocationInputRefresh = false;
    return;
  }
  scheduleLocationRefresh(input);
}, true);

document.addEventListener("focusin", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.projectPackageField !== "locationPath") return;
  if (suppressNextLocationFocusRefresh) {
    suppressNextLocationFocusRefresh = false;
    return;
  }
  scheduleLocationRefresh(input);
}, true);

// Intent: on desktop, Port Scrivener reuses the New Project native chooser and then re-enters the established persistence/import action.
document.addEventListener("click", (event) => {
  if (replayingScrivenerClick || !hasNativeDesktopDirectoryPicker()) return;
  const target = event.target instanceof Element
    ? event.target.closest('[data-action="import-scrivener-project"]')
    : null;
  if (!(target instanceof HTMLElement)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  void openNativeScrivenerDirectoryPicker(target);
}, true);

// Intent: Browse means native OS selection on supported desktop hosts, with the existing browser as fallback.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest('[data-action="browse-project-package-path"]')
    : null;
  if (!(target instanceof HTMLButtonElement) || target.disabled) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openNativeProjectPackageDirectoryPicker();
}, true);
