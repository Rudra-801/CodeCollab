const { Template } = require("e2b");
const path = require("node:path");
async function main() {
  if (!process.env.E2B_API_KEY)
    throw Error(
      "Set the provider credential before building the private template.",
    );
  const template = Template().fromDockerfile(
    path.join(__dirname, "Dockerfile"),
  );
  const result = await Template.build(template, "codecollab-runtime", {
    cpuCount: 1,
    memoryMB: 512,
  });
  console.log("Template build completed", result.templateId);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
