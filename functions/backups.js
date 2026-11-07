const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getStorage } = require("firebase-admin/storage");
const { gzipSync } = require("node:zlib");
exports.archiveSnapshot = onDocumentCreated(
  {
    document: "projects/{project}/versions/{version}/backup/files",
    retry: true,
  },
  async (event) => {
    const { project, version } = event.params;
    const file = getStorage()
      .bucket()
      .file("backups/" + project + "/" + version + ".json.gz");
    const data = event.data
      .get("files")
      .map((f) => ({
        name: f.name,
        bytes: Buffer.from(f.bytes).toString("base64"),
      }));
    try {
      await file.save(gzipSync(JSON.stringify({ format: 1, files: data })), {
        resumable: false,
        contentType: "application/gzip",
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (e) {
      if (Number(e.code) !== 412) throw e;
    }
  },
);
