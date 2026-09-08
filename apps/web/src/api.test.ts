import { api, type ApiError } from "./api";

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("maps network failures to a useful service error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const request = api.login("person@example.com", "correct-horse-battery-staple");

    await expect(request).rejects.toMatchObject<Partial<ApiError>>({
      name: "ApiError",
      status: 0,
      code: "API_UNAVAILABLE",
      message:
        "AskPDF cannot reach its API. Check that the local services are running, then try again.",
    });
  });

  it("preserves sanitized API authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "INVALID_CREDENTIALS",
              message: "The identifier or password is incorrect.",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(api.login("person@example.com", "incorrect-password")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "The identifier or password is incorrect.",
    });
  });
});
