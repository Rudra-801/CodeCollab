import React, { useEffect, useState } from "react";
import DOMPurify from "dompurify";
export default function HtmlPreview({ editor }) {
  const [open, O] = useState(false),
    [document, D] = useState("");
  useEffect(() => {
    if (!open || !editor.current) return;
    const model = editor.current.model;
    let timer;
    function render() {
      const html = DOMPurify.sanitize(model.getValue(), {
        USE_PROFILES: { html: true },
        FORBID_TAGS: [
          "a",
          "form",
          "input",
          "button",
          "iframe",
          "meta",
          "link",
          "base",
          "object",
          "embed",
          "video",
          "audio",
          "source",
          "img",
        ],
      });
      D(
        "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'\"><style>body{font:16px system-ui}</style>" +
          html,
      );
    }
    render();
    const subscription = model.onDidChangeContent(() => {
      clearTimeout(timer);
      timer = setTimeout(render, 200);
    });
    return () => {
      clearTimeout(timer);
      subscription.dispose();
    };
  }, [open, editor]);
  return (
    <section>
      <button onClick={() => O(!open)}>
        {open ? "Stop preview" : "Preview HTML"}
      </button>
      {open && document && (
        <iframe
          title="Static HTML preview"
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: 320, background: "white" }}
          srcDoc={document}
        />
      )}
    </section>
  );
}

