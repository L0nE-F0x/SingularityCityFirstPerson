/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AGENT DISTRICT — Autonomous AI Agent Frameworks Zone (v1.0.0)
   The nerve center of agentic AI. Where autonomous agents are built, orchestrated,
   deployed, and monitored. CrewAI, LangGraph, AutoGPT, Claude Agent SDK, OpenAI Agents.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Each framework carries real 2026 flavor: product / hq / founded / milestone
// (latest real headline) / facts[] (panel bullets). Keys feed the getFramework matcher.
const AGENT_FRAMEWORKS = {
    claude_sdk: {
        name: 'Claude Agent SDK', ceo: 'Anthropic', color: '#d97706', icon: '🧬',
        hq: 'San Francisco', founded: '2025', product: 'Agent SDK (Python + TS)',
        milestone: 'Jun 30, 2026: Anthropic shipped Claude Sonnet 5 with a native 1M-token context window — the biggest agentic/coding jump yet for a Sonnet-class model, now powering the SDK alongside Opus 4.8.',
        facts: [
            'Ships file-edit, bash, web-search/fetch and a tool-use loop out of the box',
            'First-class Model Context Protocol (MCP) client — the emerging tool standard',
            'June 2026: a separate Agent SDK credit pool split programmatic use from subscriptions'
        ],
        desc: "Anthropic's production agent framework. Tool use, extended thinking, subagents and MCP — the backbone of the Claude agent ecosystem."
    },
    openai_agentkit: {
        name: 'OpenAI AgentKit', ceo: 'OpenAI', color: '#4ade80', icon: '⚡',
        hq: 'San Francisco', founded: '2025', product: 'AgentKit + Agents SDK + Operator',
        milestone: 'Launched at DevDay Oct 2025; the Agents SDK gained sandboxing in 2026 while Agent Builder + Evals were slated to sunset Nov 30, 2026.',
        facts: [
            'Operator does full computer use — 38.1% on OSWorld, 58.1% on WebVoyager',
            'Agents SDK now sandboxes agents into controlled file/code environments',
            'The platform churns fast: AgentKit builder already on a deprecation clock'
        ],
        desc: "OpenAI's agent stack. AgentKit, the Agents SDK, and Operator's mouse-and-keyboard computer use — building agents that actually click."
    },
    cognition: {
        name: 'Cognition / Devin', ceo: 'Scott Wu', color: '#8b5cf6', icon: '👨‍💻',
        hq: 'San Francisco', founded: '2023', product: 'Devin + Devin Desktop',
        milestone: 'Apr 2026: valued at $25B (up from $10.2B in 7 months) after absorbing Windsurf; June 2026 rebranded Windsurf to Devin Desktop.',
        facts: [
            'Devin is the autonomous software engineer — plans, codes, tests, ships PRs',
            'Devin Desktop\'s Agent Command Center runs local + cloud agents from one Kanban',
            'ARR doubled to a ~$492M run rate; backs the open Agent Client Protocol (ACP)',
            'Jul 1, 2026: launched Devin Security Swarm — agents that find, verify and patch vulnerabilities across codebases'
        ],
        desc: 'The autonomous-coding giant. Devin writes and ships software on its own; Devin Desktop (ex-Windsurf) commands whole fleets of agents.'
    },
    manus: {
        name: 'Manus', ceo: 'Xiao Hong (Red)', color: '#f43f5e', icon: '🙌',
        hq: 'Singapore / China', founded: '2025', product: 'Manus general agent',
        milestone: 'Jun 19, 2026: original investors moved to buy Manus back from Meta for $2B after Beijing forced the deal\'s unwind — reported ARR has grown from $100M to $400–500M since.',
        facts: [
            'Apr 2026: China blocked Meta\'s $2–3B acquisition on national-security grounds; Meta cut ties Jun 15, 2026',
            'A general-purpose agent: its "My Computer" runs terminal commands + local files',
            'Orchestrates multiple LLMs under the hood, tracking forward to the Opus 4.x line',
            'The breakout Chinese autonomous agent of 2025–26'
        ],
        desc: 'The general-purpose autonomous agent. Books, browses, codes and operates your computer — the one Meta tried (and failed) to buy.'
    },
    langgraph: {
        name: 'LangGraph', ceo: 'Harrison Chase', color: '#22d3ee', icon: '🔗',
        hq: 'San Francisco', founded: '2024', product: 'LangGraph + LangSmith',
        milestone: 'The stateful graph framework became LangChain\'s flagship for durable, multi-actor agents — with LangSmith for tracing every step.',
        facts: [
            'Models agents as cyclic graphs with persistent state and checkpoints',
            'LangSmith observability is now standard kit for debugging agent runs',
            'Powers long-running, human-in-the-loop enterprise workflows'
        ],
        desc: "LangChain's stateful agent framework. Cyclic computation graphs give agents durable memory and controllable, resumable workflows."
    },
    crewai: {
        name: 'CrewAI', ceo: 'João Moura', color: '#ec4899', icon: '👥',
        hq: 'San Francisco', founded: '2023', product: 'CrewAI framework + platform',
        milestone: 'Crossed millions of monthly agent executions — role-based "crews" became a default pattern for multi-agent collaboration.',
        facts: [
            'Agents take roles (researcher, writer, reviewer) and collaborate with shared memory',
            'One of the most-installed open-source agent frameworks on PyPI',
            'Raised venture funding to build an enterprise orchestration platform'
        ],
        desc: 'Role-based multi-agent crews. Assign each agent a job and let the team collaborate — the human-org metaphor for agent swarms.'
    },
    composio: {
        name: 'Composio', ceo: 'Karan Vaidya', color: '#a855f7', icon: '🧩',
        hq: 'San Francisco', founded: '2023', product: 'Tool + auth infrastructure',
        milestone: 'Grew to 250+ managed integrations with handled auth — the "give your agent hands" layer beneath every framework.',
        facts: [
            'Managed OAuth + API connectors so agents can act in real SaaS tools',
            'Framework-agnostic: plugs into Claude SDK, LangGraph, CrewAI alike',
            'MCP-compatible tool servers for the emerging standard'
        ],
        desc: 'Tooling infrastructure for agents. Pre-built, authenticated integrations that let any framework\'s agents actually do things.'
    },
    n8n: {
        name: 'n8n', ceo: 'Jan Oberhauser', color: '#ef4444', icon: '🔄',
        hq: 'Berlin, Germany', founded: '2019', product: 'n8n workflow automation + AI nodes',
        milestone: 'Became the go-to visual canvas for wiring LLM agents into 400+ apps — a fair-code Zapier that grew AI-agent nodes.',
        facts: [
            'Native AI-agent nodes drop autonomous decisions into any workflow',
            '400+ integrations connect agents to the rest of the software stack',
            'Self-hostable and fair-code — a favorite of technical automation teams'
        ],
        desc: 'Workflow automation with native agent nodes. Wire an autonomous decision-maker into 400+ apps on a visual canvas.'
    }
};

const AgentsZone = {
    BLDS: [
        { id: 'agents_orchestrator', name: 'Orchestration Hub',    w: 220, fl: 6, emoji: '🎛️', type: 'agents',
          desc: 'Central command for multi-agent systems. Workflow graphs, task decomposition, and agent-to-agent communication protocols. Every swarm starts here.' },
        { id: 'agents_toolshop',     name: 'Tool Registry',        w: 180, fl: 4, emoji: '🔧', type: 'agents',
          desc: 'Where agents acquire capabilities. API connectors, code interpreters, browser tools, and custom function registries. 2,400+ tools indexed.' },
        { id: 'agents_sandbox',      name: 'Sandbox Arena',        w: 200, fl: 5, emoji: '🏟️', type: 'agents',
          desc: 'Isolated execution environments for agent testing. SWE-bench, GAIA, and WebArena benchmarks run 24/7. Failure is cheap here.' },
        { id: 'agents_deploy',       name: 'Deployment Gateway',   w: 190, fl: 4, emoji: '🚀', type: 'agents',
          desc: 'Production deployment pipeline. Guardrails, rate limits, human-in-the-loop checkpoints, and rollback. From sandbox to production in minutes.' },
        { id: 'agents_memory',       name: 'Memory Vault',         w: 170, fl: 5, emoji: '🧠', type: 'agents',
          desc: 'Persistent agent memory store. Vector embeddings, episodic memory, shared knowledge graphs. Agents remember across sessions.' },
    ],

    NPCS: [
        { id: 'npc_agent_architect', name: 'Agent Architect',     role: 'System Design',         workplace: 'agents_orchestrator', color: '#f43f5e', shift: 'day' },
        { id: 'npc_agent_ops',       name: 'Agent Ops Lead',      role: 'Orchestration',         workplace: 'agents_orchestrator', color: '#22d3ee', shift: 'night' },
        { id: 'npc_tool_engineer',   name: 'Tool Engineer',       role: 'Integration Dev',       workplace: 'agents_toolshop',     color: '#fbbf24', shift: 'day' },
        { id: 'npc_sandbox_eng',     name: 'Sandbox Engineer',    role: 'Eval & Benchmarks',     workplace: 'agents_sandbox',      color: '#4ade80', shift: 'day' },
        { id: 'npc_guardrail_eng',   name: 'Guardrail Engineer',  role: 'Safety & Alignment',    workplace: 'agents_deploy',       color: '#ef4444', shift: 'day' },
        { id: 'npc_deploy_sre',      name: 'Deploy SRE',          role: 'Production Reliability',workplace: 'agents_deploy',       color: '#f97316', shift: 'night' },
        { id: 'npc_memory_eng',      name: 'Memory Engineer',     role: 'Knowledge Graphs',      workplace: 'agents_memory',       color: '#a855f7', shift: 'day' },
        { id: 'npc_swarm_lead',      name: 'Swarm Lead',          role: 'Multi-Agent Systems',   workplace: 'agents_sandbox',      color: '#8b5cf6', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Live stats
    agentStats: {
        activeAgents: 847,
        tasksPerHour: 12403,
        toolCalls: 89200,
        memoryOps: 4100,
        errorRate: 0.3,
        swarmSize: 24
    },
    statusTicker: [],
    tickerIdx: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Register NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }

        this._buildTicker();
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 45;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    _buildTicker() {
        this.statusTicker = [];
        const s = this.agentStats;
        this.statusTicker.push(`🤖 Active Agents: ${s.activeAgents.toLocaleString()} — ${s.swarmSize} swarms coordinating`);
        this.statusTicker.push(`⚡ Tasks/hr: ${s.tasksPerHour.toLocaleString()} — ${s.toolCalls.toLocaleString()} tool calls`);
        this.statusTicker.push(`🧠 Memory ops: ${s.memoryOps.toLocaleString()}/hr — vector store at 94% utilization`);
        this.statusTicker.push(`🔧 Tool registry: 2,418 endpoints indexed — 12 new integrations this week`);
        this.statusTicker.push(`🏟️ Sandbox: SWE-bench 48.2% · GAIA 62.1% · WebArena 38.7%`);
        this.statusTicker.push(`🚀 Deploy pipeline: 99.7% uptime — ${s.errorRate}% error rate — 3 rollbacks today`);
        this.statusTicker.push('🔗 CrewAI: 6 crews active · LangGraph: 14 flows · Claude Agent SDK: 21 subagents');
        this.statusTicker.push('🛡️ Guardrails: 12.4K/hr blocked — prompt injection, PII leak, infinite loop');
        // Real 2026 framework headlines
        this.statusTicker.push('👨‍💻 Cognition/Devin valued at $25B after folding in Windsurf → Devin Desktop');
        this.statusTicker.push('🛡️ Devin Security Swarm hunts and patches vulnerabilities across codebases');
        this.statusTicker.push('🙌 Manus\'s original backers move to buy it back from Meta for $2B after Beijing forced the unwind');
        this.statusTicker.push('⚡ OpenAI Operator: 38.1% OSWorld · 58.1% WebVoyager on full computer-use tasks');
        this.statusTicker.push('🧬 Claude Sonnet 5 ships with a native 1M-token context — SDK now runs on Sonnet 5 + Opus 4.8');
        this.statusTicker.push('🧩 Composio passes 250+ managed, authenticated tool integrations');

        // Shuffle
        for (let i = this.statusTicker.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.statusTicker[i], this.statusTicker[j]] = [this.statusTicker[j], this.statusTicker[i]];
        }
    },

    getNextTickerItem() {
        if (!this.statusTicker.length) return '';
        const item = this.statusTicker[this.tickerIdx % this.statusTicker.length];
        this.tickerIdx++;
        return item;
    },

    update() {
        if (!this._inited) return;
        // Vary stats for visual interest
        if (G.tick % 300 === 0) {
            this.agentStats.activeAgents = 700 + Math.floor(Math.random() * 300);
            this.agentStats.tasksPerHour = 10000 + Math.floor(Math.random() * 5000);
            this.agentStats.toolCalls = 70000 + Math.floor(Math.random() * 40000);
            this.agentStats.errorRate = +(0.1 + Math.random() * 0.5).toFixed(1);
            this.agentStats.swarmSize = 16 + Math.floor(Math.random() * 16);
        }
    },

    getFramework(name) {
        const n = name.toLowerCase();
        for (const [key, fw] of Object.entries(AGENT_FRAMEWORKS)) {
            if (n.includes(key) || n.includes(fw.name.toLowerCase())) return fw;
        }
        return null;
    }
};
