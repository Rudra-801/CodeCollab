const { onCall } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { randomUUID } = require("node:crypto");
const { authorize, reserve, fail } = require("./toolAccess");
exports.assistant = onCall(
  { timeoutSeconds: 60, maxInstances: 4,secrets: process.env.CODECOLLAB_ENABLE_AI==="true"?["GEMINI_API_KEY"]:[] },
  async (req) => {
    const uid = await authorize(req),
      { context, question } = req.data,
      key = process.env.GEMINI_API_KEY,
      model = process.env.GEMINI_MODEL;
    if (!key || !model)
      fail("failed-precondition", "AI provider is unconfigured.");
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 2000 ||
      typeof context !== "string" ||
      context.length > 20000
    )
      fail("invalid-argument", "Select less code or shorten the question.");
    const ref = getFirestore().doc("assistantQuotas/" + uid);
    await reserve(ref, randomUUID());
    try {
      const result = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) +
          ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: question },
                  { text: "Selected project context:\n" + context },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 1800 },
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
      if (!result.ok) fail("unavailable", "AI provider request failed.");
      const answer = (await result.json()).candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("");
      if (!answer) fail("unavailable", "The provider returned no text.");
      return { answer };
    } finally {
      await ref.update({ until: 0 });
    }
  },
);

