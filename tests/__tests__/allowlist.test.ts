import { isEmailAllowed } from "../../src/lib/allowlist";

function testAllowlist() {
  console.log("🧪 Testing allowlist logic...");

  // Scenario 1: Normal list of 3 emails
  process.env.ALLOWED_EMAILS = "akash@example.com, judge@productspace.in, rohan@example.com";
  if (!isEmailAllowed("akash@example.com")) throw new Error("Expected akash@example.com to be allowed");
  if (!isEmailAllowed("JUDGE@PRODUCTSPACE.IN")) throw new Error("Expected case-insensitivity to pass");
  if (isEmailAllowed("stranger@example.com")) throw new Error("Expected stranger to be rejected");

  // Scenario 2: Max 5 emails
  process.env.ALLOWED_EMAILS = "a@a.com, b@b.com, c@c.com, d@d.com, e@e.com";
  if (!isEmailAllowed("e@e.com")) throw new Error("Expected 5th email to be allowed");

  // Scenario 3: More than 5 emails (Security guardrail: must refuse all)
  process.env.ALLOWED_EMAILS = "a@a.com, b@b.com, c@c.com, d@d.com, e@e.com, f@f.com";
  if (isEmailAllowed("a@a.com")) throw new Error("Expected rejection when list > 5");

  console.log("✅ All allowlist checks passed!");
}

testAllowlist();

