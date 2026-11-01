import { describe, it, expect } from "vitest";
import { detectSelfIntro, linesWithSpeakers, speakerForQuote } from "@/lib/speakers";

const team = ["You", "Akash", "Rohan Mehta"];

describe("detectSelfIntro", () => {
  it("parses self-introduction cues against the team", () => {
    expect(detectSelfIntro("Rohan here, quick update", team)).toBe("Rohan Mehta");
    expect(detectSelfIntro("Hi, this is Akash.", team)).toBe("Akash");
    expect(detectSelfIntro("hey I'm rohan", team)).toBe("Rohan Mehta");
  });
  it("ignores non-team names and ordinary sentences", () => {
    expect(detectSelfIntro("This is Priya", team)).toBeNull();
    expect(detectSelfIntro("Let's push the launch to the 14th", team)).toBeNull();
    expect(detectSelfIntro("it's fine, ship it")).toBeNull();
  });
  it("works without a team list", () => {
    expect(detectSelfIntro("Neha here")).toBe("Neha");
  });
});

describe("speaker attribution", () => {
  const lines = [
    { speaker: "Akash", text: "Quick sync before launch." },
    { speaker: "Rohan", text: "Let's push the launch to November 14th." },
    { speaker: "Speaker ?", text: "Okay." },
  ];
  it("prefixes known speakers for the conflict check", () => {
    expect(linesWithSpeakers(lines)).toBe("Akash: Quick sync before launch.\nRohan: Let's push the launch to November 14th.\nOkay.");
  });
  it("finds who said an objection's quote", () => {
    expect(speakerForQuote("push the launch to November 14th", lines)).toBe("Rohan");
    expect(speakerForQuote("something else entirely", lines)).toBeNull();
  });
});
