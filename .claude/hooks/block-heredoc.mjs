// PreToolUse hook for the Bash tool: refuse any command containing `<<`.
//
// Why a hook and not a rule: "never use heredocs" was written down in
// AGENTS.md and in session memory, and still slipped ~10 times on 2026-09-26
// alone (his count), across two sessions. A heredoc mangles its payload
// silently — `\b` became a literal 0x08 byte and three test guards ran green
// but dead for weeks; backticks run as command substitution. Tanveer chose a
// mechanical block on 2026-09-26.
//
// Covers every form: `<<EOF`, `<<'EOF'`, `<<-EOF`, `cat >> f <<EOF` and the
// `<<<` here-string. Exit code 2 blocks the call and hands stderr back to
// Claude as the reason.
//
// The replacement is never a heredoc in another shape: file content goes
// through the Write or Edit tool, and a scripted change is a .py or .mjs file
// written to the scratchpad and then run.

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    // Unparseable input is not ours to judge; let the call through.
    process.exit(0);
  }
  if (typeof command === "string" && command.includes("<<")) {
    process.stderr.write(
      "Blocked: this command contains `<<` (a heredoc or here-string), which " +
        "this project forbids — it silently mangles backslashes and backticks. " +
        "Write file content with the Write or Edit tool; for a scripted change, " +
        "Write a .py/.mjs file to the scratchpad and run it.\n",
    );
    process.exit(2);
  }
  process.exit(0);
});
