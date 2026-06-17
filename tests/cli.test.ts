import { describe, expect, it } from "vitest";
import { createCliProgram } from "../src/cli.js";

describe("CLI", () => {
  it("accepts repeated bundle URL flags and empty startup", () => {
    const emptyProgram = createCliProgram();
    emptyProgram.exitOverride();
    emptyProgram.parse([], { from: "user" });
    expect(emptyProgram.opts()).toMatchObject({ bundleUrl: [] });

    const program = createCliProgram();
    program.exitOverride();
    program.parse(["--bundle-url", "https://github.com/a/b/tree/main/one", "--bundle-url", "https://github.com/a/b/tree/main/two"], {
      from: "user"
    });

    expect(program.opts()).toMatchObject({
      bundleUrl: ["https://github.com/a/b/tree/main/one", "https://github.com/a/b/tree/main/two"]
    });
  });
});
