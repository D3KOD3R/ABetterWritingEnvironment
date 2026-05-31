// Intent: keep narration and voice recording metadata anchored after manuscript structure changes.

export function syncNarrationSessionMetadata(session, lineByBlockId, {
  now = new Date().toISOString(),
} = {}) {
  if (!session || typeof session !== "object") {
    return session;
  }

  const anchor = session.currentAnchor && typeof session.currentAnchor === "object"
    ? session.currentAnchor
    : null;
  const line = anchor?.blockId ? lineByBlockId.get(anchor.blockId) : null;
  if (!line) {
    return session;
  }

  return {
    ...session,
    currentAnchor: {
      ...anchor,
      chapterId: line.chapterId,
      sceneId: line.sceneId,
    },
    currentLineNumber: line.lineNumber,
    currentText: line.text,
    updatedAt: now,
  };
}

export function syncNarrationAlignmentJobsMetadata(jobs, lineByBlockId) {
  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs.map((job) => {
    const anchor = job?.request?.anchor;
    const line = anchor?.blockId ? lineByBlockId.get(anchor.blockId) : null;
    if (!line) {
      return { ...job };
    }

    return {
      ...job,
      request: {
        ...job.request,
        anchor: {
          ...anchor,
          chapterId: line.chapterId,
          sceneId: line.sceneId,
        },
      },
      result: job.result && typeof job.result === "object"
        ? {
            ...job.result,
            matchedLineNumber: line.lineNumber,
          }
        : job.result,
    };
  });
}

export function syncVoiceRecordingsMetadata(recordings, lineByBlockId) {
  if (!Array.isArray(recordings)) {
    return [];
  }

  return recordings.map((recording) => {
    const line = typeof recording?.blockId === "string" ? lineByBlockId.get(recording.blockId) : null;
    if (!line) {
      return { ...recording };
    }

    return {
      ...recording,
      chapterId: line.chapterId,
      chapterTitle: line.chapterTitle,
      sceneId: line.sceneId,
      sceneTitle: line.sceneTitle,
      lineNumber: line.lineNumber,
    };
  });
}

export function syncVoiceRenderJobsMetadata(jobs, sceneMetaBySceneId) {
  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs.map((job) => {
    const sceneId = typeof job?.request?.sceneId === "string" ? job.request.sceneId : "";
    if (!sceneId) {
      return { ...job };
    }

    const sceneMeta = sceneMetaBySceneId.get(sceneId);
    if (!sceneMeta) {
      return { ...job };
    }

    return {
      ...job,
      request: {
        ...job.request,
        chapterId: sceneMeta.chapterId,
      },
    };
  });
}
