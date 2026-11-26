import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const src = fileURLToPath(new URL("../src/", import.meta.url));
const modules = new Map();
const dictionaries = new Map(["en", "zh"].map(language => [language, new Set()]));
const usages = [];
const errors = new Set();

function readModules(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) readModules(file);
    else if (/\.tsx?$/.test(file) && !file.endsWith(".d.ts")) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      modules.set(file, { source, dependencies: [], runtime: [] });
    }
  }
}
readModules(src);

function propertyName(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined;
}
function inspectImports(file, info) {
  function visit(node) {
    let specifier;
    let typeOnly = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
      const clause = ts.isImportDeclaration(node) ? node.importClause : node;
      const bindings = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
      typeOnly = clause?.isTypeOnly || (!clause?.name && bindings?.elements?.length && bindings.elements.every(e => e.isTypeOnly));
    } else if (ts.isImportTypeNode(node)) {
      specifier = node.argument.literal;
      typeOnly = true;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = node.arguments[0];
    }
    if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith(".")) {
      const resolved = ts.resolveModuleName(specifier.text, file, { moduleResolution: ts.ModuleResolutionKind.Bundler }, ts.sys).resolvedModule;
      if (resolved) {
        const target = path.normalize(resolved.resolvedFileName);
        if (modules.has(target)) {
          info.dependencies.push(target);
          if (!typeOnly) info.runtime.push(target);
        }
      } else if (!fs.existsSync(path.resolve(path.dirname(file), specifier.text.split("?")[0]))) {
        errors.add(`${path.relative(src, file)}: unresolved local import: ${specifier.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(info.source);
}
for (const [file, info] of modules) inspectImports(file, info);

function reachable(roots, edge) {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const child of modules.get(file)[edge]) visit(child);
  }
  for (const file of roots) visit(file);
  return seen;
}
const entry = path.join(src, "main.tsx");
const runtime = reachable([entry], "runtime");
const application = reachable([entry], "dependencies");
const tests = [...modules.keys()].filter(file => /\.test\.tsx?$/.test(file));
const tested = reachable(tests, "dependencies");
// OCR worker uses the separately packaged resources. Its UI entry was retired.
const compatible = reachable([path.join(src, "label-ocr.ts")], "dependencies");
const relative = file => path.relative(src, file);
const retained = [];
for (const file of modules.keys()) {
  if (application.has(file) || tests.includes(file)) continue;
  if (tested.has(file) || compatible.has(file)) retained.push(relative(file));
  else errors.add(`Unreferenced module: ${relative(file)}`);
}

function literalKeys(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)];
  return [];
}
for (const file of runtime) {
  const source = modules.get(file).source;
  const objects = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) objects.set(decl.name.text, decl.initializer);
    }
  }
  function object(node) {
    if (node && ts.isIdentifier(node)) node = objects.get(node.text);
    return node && ts.isObjectLiteralExpression(node) ? node : undefined;
  }
  function field(node, key) {
    const prop = object(node)?.properties.find(p => propertyName(p.name) === key);
    return prop && (ts.isShorthandPropertyAssignment(prop) ? prop.name : prop.initializer);
  }
  function register(language, node) {
    const bundle = object(node);
    if (!bundle) {
      errors.add(`${relative(file)}: cannot inspect ${language} translation bundle`);
      return;
    }
    for (const p of bundle.properties) {
      if (ts.isSpreadAssignment(p)) register(language, p.expression);
      else if (propertyName(p.name)) dictionaries.get(language).add(propertyName(p.name));
      else errors.add(`${relative(file)}: unsupported translation key`);
    }
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const method = ts.isPropertyAccessExpression(expr) ? expr.name.text : undefined;
      const [first, second, third] = node.arguments;
      if (method === "init" && field(first, "resources")) {
        const resources = field(first, "resources");
        for (const language of dictionaries.keys()) register(language, field(field(resources, language), "translation"));
      }
      if (method === "addResourceBundle" && dictionaries.has(first?.text) && second?.text === "translation")
        register(first.text, third);
      if (first && (ts.isIdentifier(expr) && expr.text === "t" || method === "t")) {
        for (const key of literalKeys(first)) usages.push({ key, file, count: Boolean(field(second, "count")) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
for (const [language, keys] of dictionaries) {
  const suffixes = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  for (const { key, file, count } of usages) {
    if (keys.has(key) || count && suffixes.every(form => keys.has(`${key}_${form}`))) continue;
    errors.add(`${relative(file)}: missing ${language} translation: ${key}`);
  }
}
for (const error of errors) console.error(error);
console.log(`Checked ${application.size} application modules (including type dependencies) and ${usages.length} literal translation references in English and Chinese.`);
console.log("Additional test/compatibility modules:", retained.sort().join(", "));
console.log("Dynamic translation keys and persisted values require runtime/compatibility review.");
process.exitCode = errors.size ? 1 : 0;
