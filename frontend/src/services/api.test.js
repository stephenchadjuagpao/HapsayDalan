jest.mock("axios", () => ({ create: jest.fn(() => ({
  get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
})) }));

const API = require("./api").default;
const prepareRequest = API.interceptors.request.use.mock.calls[0][0];
const handleFailure = API.interceptors.response.use.mock.calls[0][1];

test("rate limits from any endpoint show readable waits and preserve quota details", async () => {
  const error = { response: { status: 429, headers: { "retry-after": "1154" }, data: {
    detail: "This email has reached the limit of 3 reports per 10 minutes. Your report has not been submitted. Expected available in 1154 seconds.",
  } } };
  await expect(handleFailure(error)).rejects.toBe(error);
  expect(error.response.data.detail).toBe("This email has reached the limit of 3 reports per 10 minutes. Your report has not been submitted. Please try again in 19 minutes and 14 seconds.");
  const other = { response: { status: 400, data: { detail: "Incorrect code." } } };
  await expect(handleFailure(other)).rejects.toBe(other);
  expect(other.response.data.detail).toBe("Incorrect code.");
});

beforeEach(() => API.get.mockReset());

test("writes fetch a fresh CSRF token even after login rotates it", async () => {
  API.get.mockResolvedValueOnce({ data: { csrfToken: "before-login" } })
    .mockResolvedValueOnce({ data: { csrfToken: "after-login" } });
  const login = await prepareRequest({ method: "post", headers: {} });
  expect(login.headers["X-CSRFToken"]).toBe("before-login");
  const save = await prepareRequest({ method: "patch", headers: {} });
  expect(save.headers["X-CSRFToken"]).toBe("after-login");
  expect(API.get).toHaveBeenCalledWith("csrf/");
});

test("reads do not recursively fetch CSRF and writes fail if token is unavailable", async () => {
  await prepareRequest({ method: "get", headers: {} });
  expect(API.get).not.toHaveBeenCalled();
  API.get.mockResolvedValue({ data: {} });
  await expect(prepareRequest({ method: "patch", headers: {} })).rejects.toThrow(/verify this session/);
});
