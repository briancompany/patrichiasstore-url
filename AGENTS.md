# Layout architecture
- Keep app-wide intrinsic flex/grid shrink and fluid page-wrapper defaults in global CSS so every route reflows consistently.
- Keep intentional image, progress, carousel, and scroll-region clipping local; page wrappers must not clip content.
# AI chat provider
- The ai-chat edge function runs on Groq (`openai/gpt-oss-120b`) with the GROQ_API_KEY secret, never the Lovable AI gateway or OpenAI SDK — the owner's own Groq key powers it and free-tier caps are ~8k tokens/minute, so keep prompts, history (last 10 messages) and tool results small.
- When Groq fails, ai-chat returns a friendly assistant-style fallback message (saved to the session) instead of a raw error.
