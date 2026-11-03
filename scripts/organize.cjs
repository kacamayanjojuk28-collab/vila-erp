const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  process.cwd(),
);
const files = parsed.fileNames.filter(
  (f) => f.includes("/src/") || f.includes("\\src\\"),
);
const service = ts.createLanguageService({
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => "0",
  getScriptSnapshot: (f) =>
    fs.existsSync(f)
      ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, "utf8"))
      : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
});
for (const f of files) {
  const changes = service.organizeImports(
    { type: "file", fileName: f },
    {},
    {},
  );
  for (const change of changes) {
    let content = fs.readFileSync(change.fileName, "utf8");
    for (const e of [...change.textChanges].sort(
      (a, b) => b.span.start - a.span.start,
    ))
      content =
        content.slice(0, e.span.start) +
        e.newText +
        content.slice(e.span.start + e.span.length);
    fs.writeFileSync(change.fileName, content);
  }
}
console.log("Organized imports in", files.length, "files");
