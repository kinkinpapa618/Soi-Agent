const { execSync } = require("child_process");

console.log("Running database migration...");
try {
  execSync("npx drizzle-kit push", { stdio: "inherit", cwd: __dirname });
  console.log("Migration complete.");
} catch (err) {
  console.warn("Migration warning (non-fatal):", err.message);
}

console.log("Starting server...");
require("./dist/index.cjs");
