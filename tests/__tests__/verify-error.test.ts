import { describe, it, expect } from "vitest";
import { verifyErrorReason } from "@/lib/verifier";
describe("verifyErrorReason", () => {
  it("names the real cause", () => {
    const abort = new Error("The operation was aborted"); abort.name = "AbortError";
    expect(verifyErrorReason(abort)).toBe("AI check timed out");
    expect(verifyErrorReason(new Error("Too many subrequests."))).toMatch(/too many requests/);
    expect(verifyErrorReason(new SyntaxError("Unexpected token"))).toBe("AI check returned unreadable output");
    expect(verifyErrorReason(new Error("boom"))).toBe("AI check failed: boom");
  });
});
