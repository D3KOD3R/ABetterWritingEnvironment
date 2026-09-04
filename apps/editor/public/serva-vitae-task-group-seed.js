// Intent: seed one real-anchor Serva Vitae lore-revision chain for manual task-iteration testing without rewriting imported tasks.
(() => {
  const library = window.__ABE_SERVA_VITAE_PROJECT_LIBRARY__;
  const project = Array.isArray(library?.projects)
    ? library.projects.find((candidate) => candidate?.id === "project-serva-vitae")
    : null;
  const tasks = Array.isArray(project?.manuscriptTasks) ? project.manuscriptTasks : null;
  if (!tasks) {
    return;
  }

  const groupId = "lore-marcellus-trust-europa";
  const groupTitle = "Marcellus threat, sentient trust, and Europa return";
  const iterations = [
    {
      id: "source-task-group-marcellus-trust-1a",
      anchorTaskId: "source-comment-25f39d38-61ca-4214-b185-11f84d4f7e6e-3dd04504-9254-4b17-bbe1-0045a76b1558",
      label: "1a",
      index: 0,
      title: "1a — Seed Marcellus' Europa-worker threat",
      body: "Rework this exchange so Marcellus' framing of Europa's new workers feels paternal, controlled, and slightly wrong without making him openly villainous. Preserve enough ambiguity that the crew's later distrust grows from evidence rather than arriving fully formed here.",
    },
    {
      id: "source-task-group-marcellus-trust-1b",
      anchorTaskId: "source-comment-622d5022-8f5d-4f30-ac3f-ca62ac5831df-bec43002-6c7c-4b9c-8d8d-9afff0ca7b41",
      label: "1b",
      index: 1,
      title: "1b — Deepen the Athos reveal without resolving it",
      body: "At the hidden-facility discovery, let the Athos connection turn unease into a credible threat, but do not let John or the crew suddenly understand the whole conspiracy. Preserve uncertainty around motive, scale, and what the Sentients themselves want.",
    },
    {
      id: "source-task-group-marcellus-trust-1c",
      anchorTaskId: "source-comment-915d6d88-2f76-4e99-adb0-cfa7e9f0659c-4a92e16e-f7d8-4440-9cf0-710dd12b030c",
      label: "1c",
      index: 2,
      title: "1c — Keep the courier escape plan trust-limited",
      body: "During the escape and courier plan, keep the crew acting on incomplete information. Tebo's route should be plausible enough to follow, but trust in the Sentient gate/courier system should still feel provisional and eerie rather than established or safe.",
    },
    {
      id: "source-task-group-marcellus-trust-1d",
      anchorTaskId: "source-comment-1c495c92-3273-4f77-8eff-5b748ba386c8-5040544f-1e7a-4811-96d4-745809fead9b",
      label: "1d",
      index: 3,
      title: "1d — Pay off the Marcellus / Europa continuity",
      body: "Reconcile the later account of Marcellus suppressing the hidden Sentient line with what the crew currently knows. Clarify what is now established, what remains inference, and why returning toward Europa and the stranded Sentient workers is a choice they make despite unresolved risk rather than because trust has suddenly become complete.",
    },
  ];

  for (const iteration of iterations) {
    if (tasks.some((candidate) => candidate?.id === iteration.id)) {
      continue;
    }

    const anchorTask = tasks.find((candidate) => candidate?.id === iteration.anchorTaskId);
    if (!anchorTask) {
      continue;
    }

    tasks.push({
      ...anchorTask,
      id: iteration.id,
      source: "source-task-group-seed",
      sourceCommentId: undefined,
      taskGroupId: groupId,
      taskGroupNumber: 1,
      taskGroupTitle: groupTitle,
      taskIterationIndex: iteration.index,
      taskIterationLabel: iteration.label,
      title: iteration.title,
      body: iteration.body,
      description: iteration.body,
      status: "open",
      completedAt: undefined,
      createdAt: "2026-09-04T03:00:00.000Z",
    });
  }
})();
