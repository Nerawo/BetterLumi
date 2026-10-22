import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = fs.readdirSync(path.join(root, "src"))
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".d.ts"));
const sources = files.map(name => ts.createSourceFile(name,
  fs.readFileSync(path.join(root, "src", name), "utf8"), ts.ScriptTarget.Latest, true));
const dictionaries = { en: new Set(), zh: new Set() };
const usages = [];
const dependencies = new Map();

function literalKeys(node) {
  if (ts.isStringLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)];
  return [];
}

for (const source of sources) {
  const imports = [];
  function visit(node) {
    // Resource dictionaries are registered by i18n.ts and the *locale.ts modules.
    if (ts.isVariableDeclaration(node) && ["en", "zh"].includes(node.name.getText(source))
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const language = node.name.getText(source);
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property)) dictionaries[language].add(property.name.getText(source).replace(/^["']|["']$/g, ""));
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && node.arguments[0]) {
      for (const key of literalKeys(node.arguments[0])) usages.push({ key, file: source.fileName });
    }
    const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith("./")) {
      const target = files.find(file => file === specifier.text.slice(2) || file === specifier.text.slice(2) + ".ts" || file === specifier.text.slice(2) + ".tsx");
      if (target) imports.push(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  dependencies.set(source.fileName, imports);
}

let failures = 0;
for (const language of ["en", "zh"]) {
  for (const { key, file } of usages) {
    if (!dictionaries[language].has(key)) {
      console.error(`${file}: missing ${language} translation: ${key}`);
      failures++;
    }
  }
}
const reached = new Set();
function follow(file) {
  if (reached.has(file)) return;
  reached.add(file);
  for (const dependency of dependencies.get(file) ?? []) follow(dependency);
}
follow("main.tsx");
const unreachable = files.filter(file => !reached.has(file));
if (unreachable.length) {
  console.error("Modules unreachable from main.tsx (review compatibility and tests before removal):", unreachable.join(", "));
  failures++;
}
console.log(`Checked ${files.length} application modules and ${usages.length} literal translation references in English and Chinese.`);
console.log("Dynamic translation keys and persisted values require runtime/compatibility review; this check does not declare them unused.");
process.exitCode = failures ? 1 : 0;
