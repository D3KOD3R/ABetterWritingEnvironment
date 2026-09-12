// Runtime-only confirmation UI. The persistence guard owns discard eligibility and save safety.
export function confirmProjectDiscard(documentRoot = document) {
  const previousFocus = documentRoot.activeElement;
  const dialog = documentRoot.createElement("dialog");
  dialog.className = "project-package-dialog project-discard-dialog";
  dialog.setAttribute("aria-labelledby", "project-discard-title");
  dialog.setAttribute("aria-describedby", "project-discard-description");
  dialog.innerHTML = `
    <header><h2 id="project-discard-title">Discard unsaved changes?</h2></header>
    <p id="project-discard-description">Discard current unsaved changes and create the new project? Your current content will be replaced only after the new project is successfully created.</p>
    <footer>
      <button type="button" data-discard-cancel autofocus>Cancel</button>
      <button type="button" class="primary" data-discard-confirm>Discard Changes and Create Project</button>
    </footer>
  `;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      previousFocus?.focus();
      resolve(confirmed);
    };
    dialog.querySelector("[data-discard-cancel]").addEventListener("click", () => finish(false));
    dialog.querySelector("[data-discard-confirm]").addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener("close", () => finish(false));
    // Keep editor shortcuts away from this modal; Escape and Tab retain native dialog behavior.
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    documentRoot.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("[data-discard-cancel]").focus();
  });
}
