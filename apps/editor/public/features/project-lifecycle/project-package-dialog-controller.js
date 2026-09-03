// Intent: add responsive project-package location UX while keeping app.js as the lifecycle authority.
import { chooseDesktopDirectory } from "../../adapters/platform/desktop-directory-picker.js";

export const PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS = 260;

let locationRefreshTimer = null;
let nativePickerBusy = false;
let pendingFocusRestore = null;
let suppressNextLocationFocusRefresh = false;

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

// Intent: reuse the existing Enter-to-validate path so persistence ordering stays in the established app controller.
function requestExistingProjectPackageValidation({ restoreFocus = false } = {}) {
  const input = getLocationInput();
  if (!input || input.disabled) return false;
  if (restoreFocus) rememberLocationFocus(input);
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }));
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
    requestExistingProjectPackageValidation({ restoreFocus: document.activeElement === currentInput });
  }, PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS);
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

// Intent: restore the caret after the existing lifecycle controller rerenders the dialog around validation.
const dialogObserver = new MutationObserver(() => {
  if (!pendingFocusRestore) return;
  const input = getLocationInput();
  if (!input || input.disabled || input.value !== pendingFocusRestore.value) return;

  const { selectionStart, selectionEnd } = pendingFocusRestore;
  pendingFocusRestore = null;
  suppressNextLocationFocusRefresh = true;
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
