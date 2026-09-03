// Intent: keep the native directory chooser behind a small same-origin desktop capability adapter.

function toErrorMessage(payload, fallback) {
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  return message || fallback;
}

export async function chooseDesktopDirectory({ initialPath = "" } = {}) {
  const response = await fetch("/api/platform/pick-directory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initialPath: String(initialPath ?? "").trim(),
    }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.status === 501 || payload?.supported === false) {
    return {
      supported: false,
      cancelled: false,
      path: "",
    };
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, "Unable to open the desktop folder picker."));
  }

  return {
    supported: true,
    cancelled: payload?.cancelled === true,
    path: typeof payload?.path === "string" ? payload.path : "",
  };
}
