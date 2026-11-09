const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { Sandbox } = require("e2b");
const programs = {
  python: ["main.py", "python3 main.py"],
  javascript: ["main.js", "node main.js"],
  typescript: ["main.ts", "tsc --skipLibCheck main.ts && node main.js"],
  java: ["Main.java", "javac Main.java && java Main"],
  c: ["main.c", "gcc main.c -o program && ./program"],
  cpp: ["main.cpp", "g++ main.cpp -o program && ./program"],
  csharp: ["Main.cs", "mcs Main.cs && mono Main.exe"],
  go: ["main.go", "go run main.go"],
  rust: ["main.rs", "rustc main.rs -o program && ./program"],
  php: ["main.php", "php main.php"],
  ruby: ["main.rb", "ruby main.rb"],
};
const { authorize, reserve, fail } = require("./toolAccess");
exports.runner = onCall(
  { timeoutSeconds: 120, maxInstances: 4, concurrency: 4, secrets: process.env.CODECOLLAB_ENABLE_RUNNER==="true"?["E2B_API_KEY"]:[] },
  async (req) => {
    const uid = await authorize(req),
      { source, stdin = "", language, job, action } = req.data;
    if (typeof job !== "string" || !/^[-\w]{16,64}$/.test(job))
      fail("invalid-argument", "Invalid job.");
    if (action !== undefined && action !== "stop")
      fail("invalid-argument", "Unsupported execution action.");
    const ref = getFirestore().doc("executionQuotas/" + uid);
    if (!process.env.E2B_API_KEY || !process.env.E2B_TEMPLATE)
      fail("failed-precondition", "Execution provider is unconfigured.");
    if (action === "stop") {
      const sandbox = await getFirestore().runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.get("job") !== job) return null;
        tx.update(ref, { cancelled: true });
        return s.get("sandbox");
      });
      if (sandbox) await Sandbox.kill(sandbox);
      return {};
    }
    if (
      !Object.hasOwn(programs, language) ||
      typeof source !== "string" ||
      Buffer.byteLength(source) > 65536 ||
      typeof stdin !== "string" ||
      Buffer.byteLength(stdin) > 8192
    )
      fail("invalid-argument", "Unsupported program or input is too large.");
    await reserve(ref, job);
    let box;
    try {
      box = await Sandbox.create(process.env.E2B_TEMPLATE, {
        timeoutMs: 60000,
        secure: true,
        allowInternetAccess: false,
        network: { allowPublicTraffic: false },
      });
      const cancelled = await getFirestore().runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.get("job") !== job || s.get("cancelled")) return true;
        tx.update(ref, { sandbox: box.sandboxId });
        return false;
      });
      if (cancelled) fail("cancelled", "Job cancelled.");
      const [name, command] = programs[language],
        dir = "/home/user";
      await box.files.write(dir + "/" + name, source, { user: "user" });
      await box.files.write(dir + "/stdin.txt", stdin, { user: "user" });
      const started = Date.now();
      // The provider VM owns this shell. Output files are capped by RLIMIT_FSIZE.
      const run = await box.commands.run(
        "umask 077; ulimit -t 15; ulimit -f 128; timeout -k 1 20 sh -c '" +
          command +
          "' <stdin.txt >stdout.txt 2>stderr.txt; echo $?",
        { user: "user", cwd: dir, timeoutMs: 25000 },
      );
      const read = async (path) =>
        (
          await box.commands.run("head -c 32768 " + path, {
            user: "user",
            cwd: dir,
            timeoutMs: 2000,
          })
        ).stdout;
      const exitCode = Number(run.stdout.trim());
      if (!/^\d{1,3}$/.test(run.stdout.trim()) || !Number.isInteger(exitCode) || exitCode > 255)
        fail("internal", "Execution provider returned an invalid result.");
      return {
        exitCode,
        stdout: await read("stdout.txt"),
        stderr: await read("stderr.txt"),
        elapsedMs: Date.now() - started,
      };
    } finally {
      try {
        if (box) await box.kill();
      } finally {
        await getFirestore().runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (s.get("job") === job) tx.update(ref, { until: 0, sandbox: null });
        });
      }
    }
  },
);

