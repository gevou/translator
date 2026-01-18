"use client";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { setSession } from "../store/sessionSlice";
import { AppDispatch, RootState } from "../store/store";

interface ConversationActionsProps {
  onRequestNewSession?: () => void;
}

export default function ConversationActions({
  onRequestNewSession,
}: ConversationActionsProps) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { isFetchingSummary } = useSelector(
    (state: RootState) => state.session,
  );

  const handleRestartClick = () => {
    if (onRequestNewSession) {
      onRequestNewSession();
    } else {
      dispatch(setSession(null));
      router.push("/");
    }
  };

  const isRestartDisabled = isFetchingSummary;

  return (
    <div className="w-full flex flex-col md:flex-row items-center md:space-x-4 space-y-3 md:space-y-0">
      <button
        onClick={handleRestartClick}
        disabled={isRestartDisabled}
        className={`
          w-full md:flex-1 m-5 px-6 py-3 rounded-lg shadow-md 
          focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-150 ease-in-out
          ${
            isRestartDisabled
              ? "border border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed"
              : "border border-slate-400 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-500 focus:ring-slate-400 active:bg-slate-100"
          }
        `}
      >
        Restart
      </button>
    </div>
  );
}
