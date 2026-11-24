export const MAX_EDITOR_GROUPS = 3;

export function createGroupId(index = 1) {
  return `group-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createInitialGroups(tabs = [], activeFile = '') {
  const cleanTabs = Array.isArray(tabs) ? Array.from(new Set(tabs.filter(Boolean))) : [];
  const active = activeFile && cleanTabs.includes(activeFile) ? activeFile : cleanTabs[0] || '';
  return {
    groups: [
      {
        id: 'group-1',
        tabs: cleanTabs,
        activeFile: active,
      },
    ],
    activeGroupId: 'group-1',
  };
}

export function getActiveGroup(groups, activeGroupId) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return { id: 'group-1', tabs: [], activeFile: '' };
  }
  return groups.find((g) => g.id === activeGroupId) || groups[0];
}

export function normalizeGroups(groups, files, preferredActiveGroupId) {
  const fileKeys = Object.keys(files || {});
  if (fileKeys.length === 0) {
    return {
      groups: [{ id: 'group-1', tabs: [], activeFile: '' }],
      activeGroupId: 'group-1',
    };
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    return createInitialGroups([fileKeys[0]], fileKeys[0]);
  }

  const normalized = [];
  for (const g of groups.slice(0, MAX_EDITOR_GROUPS)) {
    const validTabs = Array.from(new Set((g.tabs || []).filter((t) => files[t] !== undefined)));
    const validActive = g.activeFile && files[g.activeFile] !== undefined
      ? g.activeFile
      : validTabs[0] || '';
    if (validActive && !validTabs.includes(validActive)) {
      validTabs.unshift(validActive);
    }
    if (validTabs.length > 0 || groups.length === 1) {
      normalized.push({
        id: g.id || createGroupId(normalized.length + 1),
        tabs: validTabs,
        activeFile: validActive,
      });
    }
  }

  if (normalized.length === 0) {
    return createInitialGroups([fileKeys[0]], fileKeys[0]);
  }

  const nextActiveGroupId = normalized.some((g) => g.id === preferredActiveGroupId)
    ? preferredActiveGroupId
    : normalized[0].id;

  return { groups: normalized, activeGroupId: nextActiveGroupId };
}

export function openFileInGroup(groups, groupId, path) {
  if (!path) return groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return [{ id: 'group-1', tabs: [path], activeFile: path }];
  }
  const targetExists = groups.some((g) => g.id === groupId);
  const resolvedId = targetExists ? groupId : groups[0].id;
  return groups.map((g) => {
    if (g.id !== resolvedId) return g;
    const nextTabs = g.tabs.includes(path) ? g.tabs : [...g.tabs, path];
    return { ...g, tabs: nextTabs, activeFile: path };
  });
}

export function closeTabInGroup(groups, groupId, path, activeGroupId) {
  const target = groups.find((g) => g.id === groupId);
  if (!target) return { groups, activeGroupId };

  const nextTabs = target.tabs.filter((t) => t !== path);
  let nextActive = target.activeFile;
  if (target.activeFile === path) {
    const idx = target.tabs.indexOf(path);
    nextActive = nextTabs[Math.min(idx, nextTabs.length - 1)] || '';
  }

  if (nextTabs.length === 0 && groups.length > 1) {
    const remaining = groups.filter((g) => g.id !== groupId);
    const nextGroupId = remaining.some((g) => g.id === activeGroupId)
      ? activeGroupId
      : remaining[0].id;
    return { groups: remaining, activeGroupId: nextGroupId };
  }

  return {
    groups: groups.map((g) =>
      g.id === groupId ? { ...g, tabs: nextTabs, activeFile: nextActive } : g
    ),
    activeGroupId,
  };
}

export function pickSplitTargetFile(groups, sourceGroup, files, explicitFile) {
  if (explicitFile && files?.[explicitFile] !== undefined) {
    return explicitFile;
  }

  const activeInOtherGroups = new Set(groups.map((g) => g.activeFile).filter(Boolean));
  const otherTabInSource = sourceGroup.tabs.find(
    (t) => t !== sourceGroup.activeFile && !activeInOtherGroups.has(t)
  );
  if (otherTabInSource) return otherTabInSource;

  const anyOtherTabInSource = sourceGroup.tabs.find((t) => t !== sourceGroup.activeFile);
  if (anyOtherTabInSource) return anyOtherTabInSource;

  const fileKeys = Object.keys(files || {});
  const unopenedFile = fileKeys.find((k) => !activeInOtherGroups.has(k));
  if (unopenedFile) return unopenedFile;

  return sourceGroup.activeFile || fileKeys[0] || '';
}

export function splitEditorGroup(groups, sourceGroupId, explicitFile, files) {
  const safeGroups = Array.isArray(groups) && groups.length > 0
    ? groups
    : [{ id: 'group-1', tabs: [], activeFile: '' }];

  const sourceIdx = Math.max(0, safeGroups.findIndex((g) => g.id === sourceGroupId));
  const sourceGroup = safeGroups[sourceIdx];
  const fileToOpen = pickSplitTargetFile(safeGroups, sourceGroup, files, explicitFile);

  if (!fileToOpen) {
    return { groups: safeGroups, activeGroupId: sourceGroup.id, didSplit: false };
  }

  // If already at max groups, open the file in the next adjacent group
  if (safeGroups.length >= MAX_EDITOR_GROUPS) {
    const nextIdx = (sourceIdx + 1) % safeGroups.length;
    const targetGroup = safeGroups[nextIdx];
    const nextGroups = openFileInGroup(safeGroups, targetGroup.id, fileToOpen);
    return { groups: nextGroups, activeGroupId: targetGroup.id, didSplit: false };
  }

  // If explicit file is opened to the side and a second group already exists, open in the adjacent group
  if (explicitFile && safeGroups.length > 1) {
    const adjacentIdx = sourceIdx + 1 < safeGroups.length ? sourceIdx + 1 : sourceIdx - 1;
    const adjacentGroup = safeGroups[adjacentIdx];
    const nextGroups = openFileInGroup(safeGroups, adjacentGroup.id, fileToOpen);
    return { groups: nextGroups, activeGroupId: adjacentGroup.id, didSplit: false };
  }

  const newGroup = {
    id: createGroupId(safeGroups.length + 1),
    tabs: [fileToOpen],
    activeFile: fileToOpen,
  };

  const nextGroups = [
    ...safeGroups.slice(0, sourceIdx + 1),
    newGroup,
    ...safeGroups.slice(sourceIdx + 1),
  ];

  return { groups: nextGroups, activeGroupId: newGroup.id, didSplit: true };
}

export function closeEditorGroup(groups, groupId, activeGroupId) {
  if (!Array.isArray(groups) || groups.length <= 1) {
    return { groups, activeGroupId };
  }
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx === -1) return { groups, activeGroupId };

  const remaining = groups.filter((g) => g.id !== groupId);
  let nextActiveGroupId = activeGroupId;
  if (activeGroupId === groupId) {
    const fallbackIdx = Math.max(0, Math.min(idx, remaining.length - 1));
    nextActiveGroupId = remaining[fallbackIdx].id;
  }
  return { groups: remaining, activeGroupId: nextActiveGroupId };
}

export function moveTabBetweenGroups(groups, fromGroupId, path, files) {
  const fromIdx = groups.findIndex((g) => g.id === fromGroupId);
  if (fromIdx === -1) return { groups, activeGroupId: fromGroupId };

  if (groups.length === 1) {
    const onlyGroup = groups[0];
    if (onlyGroup.tabs.length <= 1) {
      return splitEditorGroup(groups, fromGroupId, path, files);
    }
    const remainingTabs = onlyGroup.tabs.filter((t) => t !== path);
    const nextActiveInFirst = onlyGroup.activeFile === path
      ? remainingTabs[remainingTabs.length - 1] || ''
      : onlyGroup.activeFile;
    const newGroup = {
      id: createGroupId(2),
      tabs: [path],
      activeFile: path,
    };
    return {
      groups: [{ ...onlyGroup, tabs: remainingTabs, activeFile: nextActiveInFirst }, newGroup],
      activeGroupId: newGroup.id,
    };
  }

  const targetIdx = (fromIdx + 1) % groups.length;
  const targetGroup = groups[targetIdx];
  const withAdded = openFileInGroup(groups, targetGroup.id, path);
  const { groups: afterClose } = closeTabInGroup(withAdded, fromGroupId, path, targetGroup.id);
  return { groups: afterClose, activeGroupId: targetGroup.id };
}

export function renameFileInGroups(groups, oldPath, newPath) {
  return groups.map((g) => ({
    ...g,
    tabs: Array.from(new Set(g.tabs.map((t) => (t === oldPath ? newPath : t)))),
    activeFile: g.activeFile === oldPath ? newPath : g.activeFile,
  }));
}

export function removeFileFromGroups(groups, path, remainingFiles, activeGroupId) {
  const remainingKeys = Object.keys(remainingFiles || {});
  if (remainingKeys.length === 0) {
    return {
      groups: [{ id: 'group-1', tabs: [], activeFile: '' }],
      activeGroupId: 'group-1',
    };
  }

  let nextGroups = [];
  for (const g of groups) {
    const nextTabs = g.tabs.filter((t) => t !== path);
    let nextActive = g.activeFile === path ? nextTabs[nextTabs.length - 1] || '' : g.activeFile;
    if (nextTabs.length === 0 && groups.length === 1) {
      const fallback = remainingKeys[0] || '';
      nextGroups.push({
        ...g,
        tabs: fallback ? [fallback] : [],
        activeFile: fallback,
      });
    } else if (nextTabs.length > 0) {
      nextGroups.push({ ...g, tabs: nextTabs, activeFile: nextActive });
    }
  }

  if (nextGroups.length === 0) {
    const fallback = remainingKeys[0] || '';
    nextGroups = [{ id: 'group-1', tabs: fallback ? [fallback] : [], activeFile: fallback }];
  }

  const nextActiveGroupId = nextGroups.some((g) => g.id === activeGroupId)
    ? activeGroupId
    : nextGroups[0].id;

  return { groups: nextGroups, activeGroupId: nextActiveGroupId };
}
