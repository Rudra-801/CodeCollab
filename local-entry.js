const root = document.getElementById("root");
try {
  const entry = new URL("./client/dist/index.html", import.meta.url);
  const response = await fetch(entry, {cache: "no-store"});
  if (!response.ok) throw new Error("Missing frontend build");
  const html = new DOMParser().parseFromString(await response.text(), "text/html");
  const module = html.querySelector('script[type="module"][src]');
  if (!module) throw new Error("Invalid frontend build");
  function asset(value) {
    return new URL(value.replace(/^\//, ""), entry).href;
  }
  await Promise.all(Array.from(html.querySelectorAll('link[rel="stylesheet"]'), link =>
    new Promise((resolve, reject) => {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = asset(link.getAttribute("href"));
      style.onload = resolve;
      style.onerror = reject;
      document.head.append(style);
    })
  ));
  await import(asset(module.getAttribute("src")));
} catch {
  root.textContent = "Start CodeCollab from the project folder with npm start, then open the local address printed in the terminal.";
}
