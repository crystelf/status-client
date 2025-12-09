/**
 * Logger utility
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * Simple logger class for consistent logging across the application
 */
export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log an error message with stack trace
   */
  error(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${LogLevel.ERROR}] [${this.context}] ${message}`);

    if (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (error.stack) {
          console.error(`Stack trace:\n${error.stack}`);
        }
      } else {
        console.error(`Error details: ${JSON.stringify(error, null, 2)}`);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${LogLevel.WARN}] [${this.context}] ${message}`);
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${LogLevel.INFO}] [${this.context}] ${message}`);
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${LogLevel.DEBUG}] [${this.context}] ${message}`);
  }
}
