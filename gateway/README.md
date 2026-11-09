# Free backend gateway

This package prepares a Cloudflare Workers Free deployment with SQLite Durable Objects. No billing, paid resource or provider account was created. Wrangler dry-run bundles the Worker successfully. The local CLI is not authenticated to Cloudflare, so no public gateway URL exists yet.

## Owner setup

1. Sign in to a Cloudflare account on the Workers Free plan with `npx wrangler@4.158.0 login`. Keep the account on Free. Stop if an upgrade or payment method is requested.
2. In gateway/wrangler.toml, add the public Firebase web API key as FIREBASE_WEB_API_KEY under [vars]. This is public Firebase configuration, not an Admin credential. No service-account key is required.
3. Configure current text model IDs as comma-separated GROQ_MODELS, OPENROUTER_MODELS and GEMINI_MODELS under [vars]. IDs are checked against the live official catalogs at request time. Removed models are excluded. OpenRouter models with nonzero prompt or completion pricing are excluded. Use only each provider's free account allocation and do not enable paid account upgrades.
4. Store provider keys with `npx wrangler@4.158.0 secret put GROQ_API_KEY --config gateway/wrangler.toml`, then repeat for OPENROUTER_API_KEY and GEMINI_API_KEY. At least one provider is required for AI. Never paste keys into client variables, this repository, Firebase documents or chat.
5. Review limits and deploy with `npx wrangler@4.158.0 deploy --config gateway/wrangler.toml`. This creates the two configured SQLite Durable Object namespaces on the Free plan. No deployment has been performed by this release.
6. Set VITE_AI_GATEWAY_URL to the resulting HTTPS Worker URL and VITE_PRESENCE_URL to its WSS /presence endpoint, then rebuild and deploy the frontend. Keep the URLs unset until real provider and two-account tests pass. ALLOWED_ORIGINS must include only the intended frontend origins.

AI_FALLBACK_ORDER defaults to groq,openrouter,gemini and can be changed in [vars]. Manual provider selection disables fallback. AI conversation history remains in the current browser session under the authenticated user's project key. Selected code/current-file context is sent only when the user submits it. Code edits require diff review and explicit approval, reject stale documents and read-only editors, and use Monaco undo. The system instruction is a mitigation for prompt injection, not an isolation boundary.

## Controls and limits

The gateway accepts requests only from configured origins, validates Firebase ID tokens using the official Auth REST API, and checks project membership through Firestore REST with the user's token. No Firebase Admin credentials are stored. The AI Durable Object serializes one active request per account, enforces a 30-request daily quota and a five-second cooldown. Model lookup has its own quota. Requests are limited to 64 KiB, selected context to 20,000 characters, history to 12 messages, output to 32,768 characters and the AI operation to 55 seconds. Cancellation aborts upstream fetches. Failed partial streams are never mixed with a fallback provider's output. No prompts or keys are logged by gateway code.

The presence Durable Object implements the existing awareness protocol. Durable Yjs edits continue through the existing Firestore update log. The room accepts at most 12 sockets, requires authentication within eight seconds, checks project/file membership for every recipient before broadcast, throttles updates, bounds message sizes and renews connections after five minutes. The client reconnects and reapplies awareness. Tokens are kept in server memory for the live connection and are never sent to peers. Permission revocation is checked on every publication, including heartbeat traffic. This implementation is not claimed production-verified. Presence HTTP read costs and rate limits must be measured against the Firebase Spark quota. Workers Free usage caps can reject requests, and daily quotas are not a guarantee of availability.

## Verification

Run Node 22 `node --test tests/*.test.js` from the repository root. AI tests use mocked streaming provider responses and cover all three formats, fallback after throttling, free-model filtering, cancellation, Firebase rejection, cross-project denial, quota enforcement and presence-recipient revocation. Mocked browser QA checks provider/model selection, streamed text, review-before-apply and undo. These results do not establish live provider access or two-user hosted presence.

The gateway does not execute untrusted programs. Full CPython and the other eight native-language runtimes, a persistent shell, React/Node workspace execution and complete Git working-tree operations remain unavailable without a suitable approved runtime. Existing browser QuickJS and Skulpt flows remain supported. A WebContainer alternative was investigated, but requires cross-origin isolation and license/use-case review before integration. No terminal has been simulated.

Official references:
- https://console.groq.com/docs/api-reference
- https://openrouter.ai/docs/api-reference/streaming
- https://ai.google.dev/api/generate-content
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://webcontainers.io/guides/introduction
