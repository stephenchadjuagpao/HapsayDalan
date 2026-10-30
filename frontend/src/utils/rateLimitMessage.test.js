import { formatWaitDuration, rateLimitMessage } from "./rateLimitMessage";

test.each([[1154, "19 minutes and 14 seconds"], [60, "1 minute"], [1, "1 second"],
  [0.1, "1 second"], [0, ""], ["invalid", ""]])("formats wait %s", (seconds, expected) => {
  expect(formatWaitDuration(seconds)).toBe(expected);
});

test("formatting is idempotent and prefers Retry-After over rounded server text", () => {
  const error = { response: { status: 429, headers: { "retry-after": "61" }, data: {
    detail: "Request was throttled. Expected available in 60 seconds.",
  } } };
  const message = rateLimitMessage(error);
  expect(message).toBe("Too many requests. Please try again in 1 minute and 1 second.");
  error.response.data.detail = message;
  expect(rateLimitMessage(error)).toBe(message);
});

test("unavailable wait times do not invent a duration", () => {
  expect(rateLimitMessage({ response: { status: 429, data: {} } })).toBe("Too many requests. Please wait before trying again.");
  expect(rateLimitMessage({}, "Connection failed.")).toBe("Connection failed.");
});
