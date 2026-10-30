export function formatWaitDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  const total = Math.ceil(value);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  const parts = [];
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (remainder) parts.push(`${remainder} ${remainder === 1 ? "second" : "seconds"}`);
  return parts.join(" and ");
}

export function rateLimitMessage(error, fallback = "Unable to continue. Please try again.") {
  const response = error?.response;
  const detail = response?.data?.detail;
  if (response?.status !== 429) return typeof detail === "string" && detail ? detail : fallback;

  const header = response.headers?.get?.("retry-after") ?? response.headers?.["retry-after"];
  let message = typeof detail === "string" && detail ? detail : "Too many requests.";
  message = message.replace(/Request was throttled\./i, "Too many requests.")
    .replace(/Expected available in/i, "Please try again in");
  let replaced = false;
  message = message.replace(/\b(in|wait)\s+(\d+(?:\.\d+)?)\s+seconds?\b/gi, (match, prefix, seconds) => {
    replaced = true;
    return `${prefix} ${formatWaitDuration(header) || formatWaitDuration(seconds) || `${seconds} seconds`}`;
  });
  // Already formatted messages may pass through both the API and a UI handler.
  const hasWait = /\b(?:in|wait)\s+\d+\s+(?:minutes?|seconds?)\b/i.test(message);
  if (!replaced && !hasWait) {
    const duration = formatWaitDuration(header);
    message = `${message.trim()}${/[.!?]$/.test(message.trim()) ? "" : "."} ${duration
      ? `Please try again in ${duration}.` : "Please wait before trying again."}`;
  }
  return message;
}
