function write(level, message, details) {
  const timestamp = new Date().toISOString();
  const suffix = details === undefined ? "" : " " + JSON.stringify(details);
  const line = "[" + timestamp + "] [" + level.toUpperCase() + "] " + message + suffix;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = Object.freeze({
  info: (message, details) => write("info", message, details),
  warn: (message, details) => write("warn", message, details),
  error: (message, details) => write("error", message, details)
});
