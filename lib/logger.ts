type LogMethod = (...args: unknown[]) => void;

export const createLogger = (scope: string) => {
  const isDebugEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

  const prefix = `[${scope}]`;
  const log: LogMethod = (...args) =>
    isDebugEnabled ? console.log(prefix, ...args) : undefined;
  const warn: LogMethod = (...args) => console.warn(prefix, ...args);
  const error: LogMethod = (...args) => console.error(prefix, ...args);

  return { log, warn, error };
};
