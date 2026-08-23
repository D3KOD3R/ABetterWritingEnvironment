// Intent: coordinate saved-take transcript alignment jobs so project saves can wait for durable word timings.

function normalizeRecordingId(recordingId) {
  return typeof recordingId === "string" && recordingId.trim() ? recordingId.trim() : "";
}

export function createNarrationRecordingAlignmentJobService({
  runAlignment = null,
  reportLog = () => {},
} = {}) {
  const jobs = new Map();

  // Intent: share a single in-flight alignment job per recording across review, cleanup, and save triggers.
  async function start(recordingId, options = {}) {
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    if (!normalizedRecordingId || typeof runAlignment !== "function") {
      return null;
    }

    const existingJob = jobs.get(normalizedRecordingId);
    if (existingJob) {
      return existingJob;
    }

    const job = Promise.resolve().then(() => runAlignment(normalizedRecordingId, options));
    jobs.set(normalizedRecordingId, job);
    try {
      return await job;
    } finally {
      if (jobs.get(normalizedRecordingId) === job) {
        jobs.delete(normalizedRecordingId);
      }
    }
  }

  // Intent: give project-save flows a deterministic point to wait for pending timing persistence.
  async function waitForPending({
    reason = "save-project",
  } = {}) {
    const pendingJobs = [...jobs.entries()]
      .filter(([, job]) => job && typeof job.then === "function");
    if (!pendingJobs.length) {
      return [];
    }

    reportLog("info", "voice-recording", "Waiting for saved take transcript word timing alignment before project save.", {
      reason,
      recordingIds: pendingJobs.map(([recordingId]) => recordingId),
      pendingJobCount: pendingJobs.length,
    });
    const settledJobs = await Promise.allSettled(pendingJobs.map(([, job]) => job));
    const failedJobCount = settledJobs.filter((result) => result.status === "rejected").length;
    reportLog(failedJobCount ? "warn" : "info", "voice-recording", "Saved take transcript word timing alignment wait finished.", {
      reason,
      pendingJobCount: pendingJobs.length,
      failedJobCount,
    });
    return settledJobs;
  }

  function getPendingRecordingIds() {
    return [...jobs.keys()];
  }

  return {
    start,
    waitForPending,
    getPendingRecordingIds,
  };
}
