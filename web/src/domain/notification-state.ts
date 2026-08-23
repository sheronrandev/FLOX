export interface NotificationState { readIds: string[]; dismissedIds: string[]; activeIds: string[] }

const unique = (ids: string[]) => [...new Set(ids)];
export function reconcileNotificationState(state: NotificationState, currentIds: string[]): NotificationState {
  const current = new Set(currentIds); const previouslyActive = new Set(state.activeIds);
  return {
    readIds: state.readIds.filter((id) => current.has(id) && previouslyActive.has(id)),
    dismissedIds: state.dismissedIds.filter((id) => current.has(id) && previouslyActive.has(id)),
    activeIds: unique(currentIds),
  };
}
export function markAllRead(state: NotificationState, ids: string[]): NotificationState {
  return { ...state, readIds: unique([...state.readIds, ...ids]), activeIds: unique([...state.activeIds, ...ids]) };
}
export function clearFindings(state: NotificationState, ids: string[]): NotificationState {
  return { ...state, dismissedIds: unique([...state.dismissedIds, ...ids]), activeIds: unique([...state.activeIds, ...ids]) };
}
export function restoreCleared(state: NotificationState): NotificationState { return { ...state, dismissedIds: [] } }

export function loadNotificationState(storage: Pick<Storage, "getItem">, projectId: string): NotificationState {
  try {
    const value = JSON.parse(storage.getItem(`flox.validation.${projectId}`) ?? "null") as Partial<NotificationState> | null;
    return { readIds: Array.isArray(value?.readIds) ? value.readIds.filter((id): id is string => typeof id === "string") : [], dismissedIds: Array.isArray(value?.dismissedIds) ? value.dismissedIds.filter((id): id is string => typeof id === "string") : [], activeIds: Array.isArray(value?.activeIds) ? value.activeIds.filter((id): id is string => typeof id === "string") : [] };
  } catch { return { readIds: [], dismissedIds: [], activeIds: [] } }
}
export function saveNotificationState(storage: Pick<Storage, "setItem">, projectId: string, state: NotificationState) {
  storage.setItem(`flox.validation.${projectId}`, JSON.stringify(state));
}
