export async function formatProgram(source, filename) {
  const ts = await import("typescript");
  const service = ts.createLanguageService({
    getCompilationSettings: () => ({allowJs: true, noLib: true}),
    getScriptFileNames: () => [filename],
    getScriptVersion: () => "1",
    getScriptSnapshot: name => name === filename ? ts.ScriptSnapshot.fromString(source) : undefined,
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: () => "",
    fileExists: name => name === filename,
    readFile: name => name === filename ? source : undefined
  });
  try {
    const edits = service.getFormattingEditsForDocument(filename, {
      indentSize: 2, tabSize: 2, convertTabsToSpaces: true, newLineCharacter: "\n",
      insertSpaceBeforeAndAfterBinaryOperators: true, insertSpaceAfterCommaDelimiter: true,
      insertSpaceBeforeOpeningBraceInFunctions: true
    });
    for (const {span, newText} of edits.reverse()) {
      source = source.slice(0,span.start) + newText + source.slice(span.start + span.length);
    }
    return source;
  } finally {service.dispose();}
}
