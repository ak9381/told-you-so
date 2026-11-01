import { describe, it, expect } from "vitest";
import { friendlyEmailError } from "../../src/lib/email";

describe("friendlyEmailError", () => {
  it("hides the raw Resend test-mode error", () => {
    const m = friendlyEmailError("You can only send testing emails to your own email address (ak9381@nyu.edu). To send emails to other recipients, please verify a domain");
    expect(m).toMatch(/demo inbox/);
    expect(m).not.toMatch(/resend\.com|verify a domain/);
  });
  it("has a default", () => expect(friendlyEmailError("weird")).toMatch(/Not delivered/));
});
