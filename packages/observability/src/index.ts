export interface LogContext {
  traceId?: string;
  jobId?: string;
  sourceId?: string;
  edition?: string;
  gameVersionId?: string;
  [key: string]: unknown;
}

export function createLogger(service: string) {
  function write(
    level: "info" | "warn" | "error",
    message: string,
    context: LogContext = {},
  ) {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      ...context,
    };
    const serialized = JSON.stringify(record);
    if (level === "error") {
      console.error(serialized);
    } else if (level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  return {
    info: (message: string, context?: LogContext) =>
      write("info", message, context),
    warn: (message: string, context?: LogContext) =>
      write("warn", message, context),
    error: (message: string, context?: LogContext) =>
      write("error", message, context),
  };
}
