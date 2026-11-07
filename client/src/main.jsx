import React from "react";
import ReactDOM from "react-dom/client";
import ErrorBoundary from './ErrorBoundary';
import App from "./Workspace.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);


