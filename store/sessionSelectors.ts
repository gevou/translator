import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export const selectSessionState = (state: RootState) => state.session;

export const selectCurrentSessionId = (state: RootState) =>
  state.session.currentSessionId;
export const selectIsWelcomeScreenVisible = (state: RootState) =>
  state.session.isWelcomeScreenVisible;
export const selectIsTranscribing = (state: RootState) =>
  state.session.isTranscribing;
export const selectIsProcessingTranslation = (state: RootState) =>
  state.session.isProcessingTranslation;
export const selectIsFetchingTtsAudio = (state: RootState) =>
  state.session.isFetchingTtsAudio;
export const selectIsEnglishTtsEnabled = (state: RootState) =>
  state.session.isEnglishTtsEnabled;
export const selectIsSpanishTtsEnabled = (state: RootState) =>
  state.session.isSpanishTtsEnabled;
export const selectWebRtcIsLoading = (state: RootState) =>
  state.session.webRtcIsLoading;
export const selectWebRtcIsConnected = (state: RootState) =>
  state.session.webRtcIsConnected;
export const selectCurrentSessionSummary = (state: RootState) =>
  state.session.currentSessionSummary;
export const selectAreWebRtcHandlesAvailable = (state: RootState) =>
  state.session.areWebRtcHandlesAvailable;
export const selectEnglishHistory = (state: RootState) =>
  state.session.englishHistory;
export const selectSpanishHistory = (state: RootState) =>
  state.session.spanishHistory;
export const selectApiTranslationResult = (state: RootState) =>
  state.session.apiTranslationResult;
export const selectActionInvocationStatus = (state: RootState) =>
  state.session.actionInvocationStatus;
export const selectActionErrorMessages = (state: RootState) =>
  state.session.actionErrorMessages;
export const selectPendingToolCalls = (state: RootState) =>
  state.session.pendingToolCalls;
export const selectToolSubmissionStatus = (state: RootState) =>
  state.session.toolSubmissionStatus;
export const selectIsFetchingSessionData = (state: RootState) =>
  state.session.isFetchingSessionData;
export const selectFetchSessionDataError = (state: RootState) =>
  state.session.fetchSessionDataError;
export const selectAutoInitiateNewSession = (state: RootState) =>
  state.session.autoInitiateNewSession;
export const selectIsFetchingSummary = (state: RootState) =>
  state.session.isFetchingSummary;
export const selectFetchSummaryError = (state: RootState) =>
  state.session.fetchSummaryError;
export const selectPendingTtsRequest = (state: RootState) =>
  state.session.pendingTtsRequest;

export const selectHasCurrentSessionSummary = createSelector(
  selectCurrentSessionSummary,
  (summary) => !!summary,
);
