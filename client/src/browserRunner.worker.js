import variant from "@jitl/quickjs-wasmfile-release-sync";
import wasmLocation from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
self.onmessage = async ({ data: { source, language, input } }) => {
  const start = performance.now();
  let stdout = "",
    stderr = "",
    vm,
    runtime;
  function finish(exitCode) {
    postMessage({
      stdout,
      stderr,
      exitCode,
      elapsedMs: Math.round(performance.now() - start),
    });
  }
  try {
    if (source.length > 65536 || input.length > 8192)
      throw Error("Source or input exceeds the limit.");
    if (language === "typescript") {
      const ts = await import("typescript");
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.None,
        },
        reportDiagnostics: true,
      });
      const errors = compiled.diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      );
      if (errors.length)
        throw Error(
          errors
            .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "))
            .join("\n"),
        );
      source = compiled.outputText;
    }
    let python;
    if(language==="python"){
      python=await Promise.all([import("skulpt/dist/skulpt.min.js?raw"),import("skulpt/dist/skulpt-stdlib.js?raw")]);
    }
    const engine = await newQuickJSWASMModuleFromVariant(
      newVariant(variant, { wasmLocation }),
    );
    runtime = engine.newRuntime();
    runtime.setMemoryLimit(24 * 1024 * 1024);
    runtime.setMaxStackSize(512 * 1024);
    const deadline = performance.now() + 2500;
    runtime.setInterruptHandler(() => performance.now() > deadline);
    vm = runtime.newContext();
    const lines = input.split(/\r?\n/);
    function bind(name, callback) {
      const fn = vm.newFunction(name, callback);
      vm.setProp(vm.global, name, fn);
      fn.dispose();
    }
    bind("readline", () =>
      lines.length ? vm.newString(lines.shift()) : vm.null,
    );
    for (const name of ["__stdout", "__stderr"])
      bind(name, (v) => {
        const value = vm.getString(v) + (python ? "" : "\n");
        const remaining = 32768 - stdout.length - stderr.length;
        if (name === "__stdout") stdout += value.slice(0, remaining);
        else stderr += value.slice(0, remaining);
        if (value.length > remaining) throw Error("Output limit exceeded.");
      });
    function evaluate(code) {
      const result = vm.evalCode(code, "main.js", { type: "global" });
      if (result.error) {
        const detail = vm.dump(result.error);
        result.error.dispose();
        throw Error(String(detail?.message || detail).slice(0, 1024));
      }
      result.value.dispose();
    }
    evaluate(
      'globalThis.console={log:(...args)=>__stdout(args.map(String).join(" ")),error:(...args)=>__stderr(args.map(String).join(" "))}',
    );
    if(python){
      evaluate("globalThis.self=globalThis;globalThis.setTimeout=f=>Promise.resolve().then(f);globalThis.clearTimeout=()=>{};");
      for(const module of python)evaluate(module.default+"\n;void 0;");
      evaluate("Sk.configure({__future__:Sk.python3,output:__stdout,inputfun:()=>readline(),read:p=>{if(!Object.hasOwn(Sk.builtinFiles.files,p))throw Error('Module unavailable');return Sk.builtinFiles.files[p]}});");
      evaluate("Sk.misceval.asyncToPromise(()=>Sk.importMainWithBody('<stdin>',false,"+JSON.stringify(source)+",true)).then(()=>globalThis.pythonDone=true,e=>globalThis.pythonError=String(e));void 0;");
    }else evaluate(source);
    while (runtime.hasPendingJob()) {
      const jobs = runtime.executePendingJobs(32);
      if (jobs.error) {
        jobs.error.dispose();
        throw Error("Promise job failed.");
      }
      if (performance.now() > deadline) throw Error("Time limit exceeded.");
    }
    if (python) evaluate("if(globalThis.pythonError)throw Error(pythonError);if(!globalThis.pythonDone)throw Error('Python execution did not finish');");
    finish(0);
  } catch (e) {
    stderr += (stderr ? "\n" : "") + String(e.message || e).slice(0, 1024);
    finish(1);
  } finally {
    vm?.dispose();
    runtime?.dispose();
  }
};

