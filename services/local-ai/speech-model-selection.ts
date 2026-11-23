// Install completion must re-read machine state after asynchronous verification: two downloads
// can finish together, or the author can select a model while another installation is running.
export async function selectFirstInstalledLive({ modelId, progress, models, readSettings, writeSettings, isLocked }: any) {
  if (progress?.state !== "installed" || isLocked()) return false;
  const list = await models.snapshot();
  const current = readSettings();
  if (isLocked() || current.liveModelId || !list.some((m: any) => m.id === modelId && m.installed && m.roles.includes("live"))) return false;
  writeSettings({ ...current, liveModelId: modelId });
  return true;
}
