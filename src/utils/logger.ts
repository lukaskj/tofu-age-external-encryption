import type { Writable } from "node:stream";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LoggerOptions {
  level?: LogLevel;
  locale?: Intl.LocalesArgument;
  color?: boolean;
  transports?: Writable[];
}

const defaultOptions: LoggerOptions = {
  level: "info",
  color: true,
  transports: [process.stderr],
};

export class Logger {
  private static loggers: Logger[] = [];
  private levels: LogLevel[] = ["error", "warn", "info", "debug"];

  private colors: Record<LogLevel | "reset", string> = {
    error: "\x1b[31m", // red
    warn: "\x1b[33m", // yellow
    info: "\x1b[36m", // cyan
    debug: "\x1b[35m", // magenta
    reset: "\x1b[0m", // reset
  };

  private level: LogLevel;
  private formatter: Intl.DateTimeFormat;
  private options: LoggerOptions = defaultOptions;
  private transports: Writable[] = [];

  private constructor(options: LoggerOptions = {}) {
    this.options = {
      ...this.options,
      ...options,
    };
    this.transports = this.options.transports ?? [];
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.level = envLevel && this.levels.includes(envLevel) ? envLevel : this.options.level || "info";

    this.formatter = new Intl.DateTimeFormat(this.options.locale || "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    this.startTransforms();
  }

  public static create(options: LoggerOptions = {}): Logger {
    const logger = new Logger(options);
    Logger.loggers.push(logger);
    return logger;
  }

  public setLevel(level: LogLevel): void {
    if (!this.levels.includes(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.level = level;
  }

  public addTransport(transport: Writable): void {
    this.transports.push(transport);
  }

  public removeTransport(transport: Writable): void {
    this.transports = this.transports.filter((t) => t !== transport);
  }

  public clearTransports(): void {
    this.transports = [];
  }

  private shouldLog(level: LogLevel): boolean {
    const shouldLog = this.levels.indexOf(level) <= this.levels.indexOf(this.level);
    const debugEnabled = process.env.DEBUG === "true" || process.env.DEBUG === "1";
    // if (!debugEnabled) return;
    if (level === "debug" && (debugEnabled || shouldLog)) {
      return true;
    }

    return shouldLog;
  }

  private formatTimestamp(): string {
    return this.formatter.format(new Date());
  }

  private startTransforms() {
    const timestamp = this.formatTimestamp();
    for (const transport of this.transports) {
      if (transport !== process.stdout && transport !== process.stderr) {
        transport.write(`${"-".repeat(timestamp.length + 2)}\n`);
        transport.write(`[${timestamp}]\n`);
      }
    }
  }

  private logMessage(level: LogLevel, message: unknown, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = this.formatTimestamp();
    const color = this.options.color ? this.colors[level] || "" : "";
    const reset = this.colors.reset;

    const cleanLine = `[${timestamp}] [${level.toUpperCase()}] ${String(message)} ${args.map(String).join(" ")}`;
    const coloredLine = `${color}${cleanLine}${reset}`;

    // Write line to all transports
    for (const transport of this.transports) {
      if (transport === process.stdout || transport === process.stderr) {
        transport.write(`${coloredLine}\n`);
      } else {
        transport.write(`${cleanLine}\n`);
      }
    }
  }

  public error(message: unknown, ...args: unknown[]): void {
    this.logMessage("error", message, ...args);
  }

  public warn(message: unknown, ...args: unknown[]): void {
    this.logMessage("warn", message, ...args);
  }

  public info(message: unknown, ...args: unknown[]): void {
    this.logMessage("info", message, ...args);
  }

  public debug(message: unknown, ...args: unknown[]): void {
    this.logMessage("debug", message, ...args);
  }

  private isClosing = false;
  public async [Symbol.dispose]() {
    if (this.isClosing) return;
    this.isClosing = true;

    const promises = this.transports.map(
      (transport) =>
        new Promise<void>((resolve) => {
          // If already ended or destroyed, resolve immediately
          if (transport.writableEnded || transport.destroyed) return resolve();

          transport.end(() => resolve());
          transport.on("error", () => resolve()); // Avoid blocking on error
        }),
    );

    await Promise.all(promises);
  }
}

const signals = ["beforeExit", "exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"] as const;

signals.forEach((signal) => {
  process.once(signal, async (arg) => {
    for (const logger of Logger["loggers"]) {
      await logger[Symbol.dispose]();
    }

    switch (signal) {
      case "SIGINT":
      case "SIGTERM":
        process.exit();
        break;
      case "uncaughtException":
      case "unhandledRejection":
        console.error(signal, arg);
        process.exit(1);
        break;
      // case "beforeExit":
      // case "exit":
      default:
        break;
    }
  });
});
