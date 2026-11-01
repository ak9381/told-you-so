import { describe, it, expect } from "vitest";
import { findDuplicate } from "@/lib/people";

const team = [{ id: "1", name: "Harsh", email: "h@x.com", project_id: "p" }];
describe("findDuplicate", () => {
  it("catches the same name in any case", () => {
    expect(findDuplicate(team, " harsh ", null)?.field).toBe("name");
  });
  it("catches the same email under a different name", () => {
    expect(findDuplicate(team, "Harshit", "H@X.com")?.field).toBe("email");
  });
  it("allows a new person", () => {
    expect(findDuplicate(team, "Riya", "r@x.com")).toBeNull();
  });
});
