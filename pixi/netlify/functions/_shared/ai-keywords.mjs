// Shared AI-topic keyword filter — the single copy of a list that used to be
// pasted into hn-ai-stories.mjs, collect-events.mjs, and
// publish-newspaper-edition.mjs (and had already started drifting between
// them). Word-boundary matching only, so "AI" doesn't match inside "paid".
export const AI_KEYWORDS = [
    'ai', 'a\\.i\\.', 'gpt', 'gpt-\\d', 'llm', 'llms', 'agi', 'asi',
    'claude', 'gemini', 'llama', 'deepseek', 'qwen', 'mistral', 'grok',
    'openai', 'anthropic', 'groq', 'xai', 'perplexity', 'cohere',
    'chatgpt', 'copilot', 'midjourney', 'dall-e', 'sora', 'runway',
    'transformer', 'transformers', 'rlhf', 'dpo', 'rag',
    'agent', 'agents', 'agentic',
    'machine learning', 'deep learning', 'neural network', 'neural networks',
    'diffusion', 'stable diffusion',
    'inference', 'benchmark', 'benchmarks', 'eval', 'evals',
    'fine-tune', 'fine-tuning', 'fine tuning', 'pretraining', 'pre-training',
    'reasoning model', 'reasoning models',
    'hugging face', 'huggingface',
    'mamba', 'moe', 'mixture of experts',
];

export const AI_TITLE_RE = new RegExp('\\b(' + AI_KEYWORDS.join('|') + ')\\b', 'i');

export const isAITitle = (title) => AI_TITLE_RE.test(title || '');
