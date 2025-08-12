export const BD_MSG = {
  OPEN_ANALYSIS: 'open-analysis',
  GET_ANALYSIS_SELECTION: 'get-analysis-selection',
  CLEANUP_SESSION: 'cleanup-session',
  GET_OPTIONS: 'get-options',
  SET_OPTIONS: 'set-options',
  FETCH_ROUTE_ONLY: 'fetch-route-only',
  START_ANALYSIS: 'start-analysis',
  ANALYSIS_PROGRESS: 'analysis-progress',
} as const;

export type MessageType = typeof BD_MSG[keyof typeof BD_MSG];

