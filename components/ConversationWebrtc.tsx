"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { forwardRef, useImperativeHandle } from "react";
import ConversationActions from "./ConversationActions";
import ConversationSummary from "./ConversationSummary";
import ConversationV2 from "./ConversationV2";
import BottomScrollFade from "./eyeCandy/BottomScrollFade";
import TopScrollFade from "./eyeCandy/TopScrollFade";
import { useWebRtcSession } from "../hooks/useWebRtcSession";

export interface ConversationWebrtcHandles {
  initiateSession: (isNewSession?: boolean) => Promise<void>;
  closeSession: (
    isNewSessionRequest?: boolean,
    closingSessionId?: string | null,
  ) => void;
}

interface ConversationWebrtcProps {
  onConnectionStateChange?: (isConnected: boolean) => void;
  onFinalTranscriptForTranslation?: (
    transcript: string,
    language: string,
    itemId: string,
  ) => void;
  onRequestNewSession?: () => void;
  autoInitiateNewSession?: boolean;
  onNewSessionAutoInitiated?: () => void;
  mainContentAreaRef?: React.RefObject<HTMLDivElement | null>;
}

const ConversationWebrtc = forwardRef<
  ConversationWebrtcHandles,
  ConversationWebrtcProps
>(
  (
    {
      onConnectionStateChange,
      onFinalTranscriptForTranslation,
      onRequestNewSession,
      onNewSessionAutoInitiated,
      mainContentAreaRef,
    },
    ref,
  ) => {
    const {
      englishHistory,
      spanishHistory,
      currentSessionSummary,
      isFetchingSummary,
      fetchSummaryError,
      activeSessionId,
      initiateSession,
      closeSession,
      remoteAudioPlayerRef,
      summaryContainerRef,
      internalScrollContainerRef,
      handleSummaryAnimationComplete,
    } = useWebRtcSession({
      onConnectionStateChange,
      onFinalTranscriptForTranslation,
      onNewSessionAutoInitiated,
      mainContentAreaRef,
    });

    useImperativeHandle(ref, () => ({ initiateSession, closeSession }), [
      initiateSession,
      closeSession,
    ]);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <audio ref={remoteAudioPlayerRef} style={{ display: "none" }} />
          <div
            ref={internalScrollContainerRef}
            style={{ flexGrow: 1, overflowY: "auto", minHeight: "100px" }}
            className="relative bg-gray-100 p-6 flex flex-col gap-6 min-h-0"
          >
            <TopScrollFade gradientFromColor="from-gray-100" />
            <AnimatePresence>
              <div
                key="conversation-histories"
                className="flex flex-col md:flex-row gap-6 md:gap-10 -mt-8 flex-1 min-h-0"
              >
                <motion.div className="w-full h-full min-h-0">
                  <ConversationV2
                    conversationHistory={englishHistory}
                    displayLanguage="EN"
                  />
                </motion.div>
                <motion.div className="w-full h-full min-h-0">
                  <ConversationV2
                    conversationHistory={spanishHistory}
                    displayLanguage="ES"
                  />
                </motion.div>
              </div>
              {currentSessionSummary && (
                <motion.div
                  key="summary-in-scroll"
                  ref={summaryContainerRef}
                  initial={{ opacity: 0, y: 20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 20, height: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                  onAnimationComplete={handleSummaryAnimationComplete}
                >
                  <ConversationSummary
                    summary={currentSessionSummary.summary_text}
                    detectedActions={currentSessionSummary.detected_actions}
                    isLoading={isFetchingSummary}
                    error={fetchSummaryError}
                  />
                </motion.div>
              )}
              {!currentSessionSummary &&
                fetchSummaryError &&
                !isFetchingSummary &&
                !fetchSummaryError.includes("No summary found") && (
                  <div
                    key="no-summary-message"
                    className="text-center py-4 text-gray-600 italic"
                  >
                    Error loading conversation summary.
                  </div>
                )}
            </AnimatePresence>
            <BottomScrollFade gradientFromColor="from-gray-100" />
          </div>
          <div className="flex shrink-0 flex-col items-center gap-4 px-4 pb-4 pt-5 md:flex-row md:gap-10 md:px-0 md:pb-0">
            {activeSessionId && (
              <ConversationActions onRequestNewSession={onRequestNewSession} />
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default ConversationWebrtc;
