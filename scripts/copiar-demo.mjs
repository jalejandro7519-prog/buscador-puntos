import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist/demo", { recursive: true });
cpSync("demo", "dist/demo", { recursive: true });
console.log("demo copiada a dist/demo");
