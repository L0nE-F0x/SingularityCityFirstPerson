// Flat ESLint config for Singularity City.
//
// Philosophy: this is a zero-bundler browser project where every js/*.js
// file defines one or more globals on `window` via `const Foo = {...}`.
// ESLint here is a safety net, not a style cop — Prettier handles style.
// Rules are intentionally lenient so the existing 32K LOC doesn't drown
// in warnings. Tighten later, file-by-file.

export default [
    {
        ignores: [
            'node_modules/**',
            '.claude/**',
            '.git/**',
            'coverage/**',
            'dist/**',
            'build/**',
        ],
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                AbortSignal: 'readonly',
                AbortController: 'readonly',
                WebSocket: 'readonly',
                WheelEvent: 'readonly',
                PointerEvent: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                HTMLElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                Image: 'readonly',
                Audio: 'readonly',
                AudioContext: 'readonly',
                webkitAudioContext: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                getComputedStyle: 'readonly',
                matchMedia: 'readonly',
                performance: 'readonly',
                crypto: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                MediaRecorder: 'readonly',
                FormData: 'readonly',
                DOMParser: 'readonly',
                MutationObserver: 'readonly',
                ResizeObserver: 'readonly',

                // Third-party libs loaded via <script>
                PIXI: 'readonly',
                supabase: 'readonly',
                Chart: 'readonly',
                THREE: 'readonly',
                Notification: 'readonly',
                Worker: 'readonly',
                self: 'readonly',

                // Singularity City module globals (defined in js/*.js).
                // All writable because each module file assigns them.
                G: 'writable',
                API: 'writable',
                VisitorTracker: 'writable',
                Aurora: 'writable',
                AgentsEnv: 'writable',
                AgentsZone: 'writable',
                AGENT_FRAMEWORKS: 'writable',
                BackboneEnv: 'writable',
                BackboneZone: 'writable',
                Camera: 'writable',
                ConferenceData: 'writable',
                ConferenceEnv: 'writable',
                ConferenceInterior: 'writable',
                CourtData: 'writable',
                CourtEnv: 'writable',
                CourtInterior: 'writable',
                JailData: 'writable',
                JailEnv: 'writable',
                JailInterior: 'writable',
                ACHIEVEMENTS: 'writable',
                STAGES: 'writable',
                NEWS: 'writable',
                DCManager: 'writable',
                EasterEggs: 'writable',
                CoreLabRegions: 'writable',
                Entities: 'writable',
                EntitiesGfx: 'writable',
                Environment: 'writable',
                Holomap: 'writable',
                InteriorAvatarStates: 'writable',
                InteriorAgents: 'writable',
                InteriorBackbone: 'writable',
                InteriorBar: 'writable',
                InteriorCityAI: 'writable',
                InteriorCity: 'writable',
                InteriorDC: 'writable',
                InteriorCityProps: 'writable',
                InteriorLegacy: 'writable',
                InteriorLongevity: 'writable',
                Interior: 'writable',
                InteriorNPC: 'writable',
                InteriorResAI: 'writable',
                InteriorRes: 'writable',
                InteriorResProps: 'writable',
                InteriorRobotics: 'writable',
                InteriorVCRow: 'writable',
                InteriorPower: 'writable',
                LongevityEnv: 'writable',
                LongevityZone: 'writable',
                MacroView: 'writable',
                Multiplayer: 'writable',
                NPCHousing: 'writable',
                OrbitMode: 'writable',
                Persistence: 'writable',
                Personality: 'writable',
                PortEnv: 'writable',
                PortZone: 'writable',
                PowerEnv: 'writable',
                PowerZone: 'writable',
                RoboticsEnv: 'writable',
                RoboticsZone: 'writable',
                RobotModels: 'writable',
                Seasonal: 'writable',
                SeasonalEnv: 'writable',
                SND: 'writable',
                SpaceData: 'writable',
                SpaceEntities: 'writable',
                SpaceEnvironment: 'writable',
                SpaceInterior: 'writable',
                SpaceRockets: 'writable',
                CityAmbience: 'writable',
                StreetVendors: 'writable',
                NOTIFY: 'writable',
                UI: 'writable',
                UniversityData: 'writable',
                UniversityEnv: 'writable',
                UniversityInterior: 'writable',
                VCRow: 'writable',
                VCRowEnv: 'writable',
                XRayMode: 'writable',
                Debug: 'writable', // debug/perf overlay
                BitmapFonts: 'writable',
                Goals: 'writable', // goal-driven NPC archetypes
                AutoTour: 'writable', // idle screensaver / handsfree tour
                Newspaper: 'writable', // Singularity City Times weekly paper
                InteriorNewspaper: 'writable', // Times HQ interior
                CityPark: 'writable', // Central Park green space
                BirdFlocks: 'writable', // Procedural bird formations
                AIIndex: 'writable', // Global AI Index billboard
                SupplyChain: 'writable', // Port→DC delivery system
                ResearchPapers: 'writable', // arXiv paper delivery
                BlackMarket: 'writable', // Underground jailbroken models zone
                InteriorBlackMarket: 'writable', // Black Market interior
                InteriorMetroStation: 'writable', // Metro station interior
                InteriorTrain: 'writable', // Train "interior" — real-world camera cutaway
                Kardashev: 'writable', // Kardashev compute scale
                AlignmentForest: 'writable', // Alignment Forest zone
                InteriorAlignment: 'writable', // Alignment Forest interior
                EmbassyRow: 'writable', // Embassy Row zone
                EmbassyQuarter: 'writable', // Embassy Quarter zone
                InteriorEmbassy: 'writable', // Embassy interior
                InteriorAmbassadorRes: 'writable', // Ambassador residence interior
                Quests: 'writable', // Quest / objective system
                Shadows: 'writable', // Entity shadow renderer
                HNBlimps: 'writable', // Hacker News headline blimps
                HumanAvatar: 'writable', // Generic human avatar builder
                CrowdSeparation: 'writable', // Crowd separation steering
                Underground: 'writable', // Underground strata constants
                NewsReactivity: 'writable', // News-driven city reactions
                CitizenOfDay: 'writable', // Daily featured citizen
                DailyBriefing: 'writable', // Daily briefing video summary
                Terminal: 'writable', // In-app terminal
                enterCity: 'writable', // Landing → city boot handler

                // Data / constants declared at top level across many files
                BLDS: 'writable',
                LABS: 'writable',
                COSTS: 'writable',
                BM: 'writable',
                BM_M: 'writable',
                avgBM: 'writable',
                AI_EVENTS: 'writable',
                ACTS: 'writable',
                CHAT_MSGS: 'writable',
                COMPUTE_DATA: 'writable',
                CTX: 'writable',
                DC_FACILITIES: 'writable',
                DC_OPERATORS: 'writable',
                FAMILIES: 'writable',
                REAL_FOUNDERS: 'writable',
                SPACE_ORGS: 'writable',
                ROBOTICS_COMPANIES: 'writable',
                LONGEVITY_COMPANIES: 'writable',
                SUPPLY_CHAIN: 'writable',
                SEED: 'writable',
                InteriorCityCore: 'writable',
                CityElevator: 'writable',

                // Free helper functions declared at top level
                getStage: 'writable',
                getAct: 'writable',
                escapeHTML: 'writable',
                safeHref: 'writable',
                safeColor: 'writable',
                haptic: 'writable',
                _checkOrientation: 'writable',
                _lockLandscape: 'writable',
                _requestFullscreen: 'writable',
                _requestWakeLock: 'writable',
            },
        },
        rules: {
            // Correctness (catch real bugs)
            'no-undef': 'error',
            'no-unused-vars': [
                'warn',
                {
                    // Every js/*.js file declares a const Foo = {...} module global
                    // that's referenced from other files. `vars: 'local'` tells the
                    // rule to only warn on locally-scoped unused variables, not the
                    // top-level module declarations.
                    vars: 'local',
                    args: 'none',
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
            'no-unreachable': 'warn',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-dupe-else-if': 'error',
            'no-duplicate-case': 'error',
            'no-unsafe-negation': 'error',
            'no-unsafe-finally': 'error',
            'no-self-assign': 'warn',
            'no-constant-condition': ['warn', { checkLoops: false }],
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-empty-pattern': 'warn',
            'no-sparse-arrays': 'warn',
            'no-irregular-whitespace': 'warn',
            'no-func-assign': 'error',
            'no-class-assign': 'error',
            'no-const-assign': 'error',
            'no-ex-assign': 'error',
            'no-cond-assign': ['error', 'except-parens'],
            'no-var': 'off', // 32K LOC — too disruptive to flip to error today
            'prefer-const': 'off',
            eqeqeq: 'off',
            'no-redeclare': 'off', // module globals redeclared in many files
            'no-inner-declarations': 'off',
            'no-case-declarations': 'off',
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'warn',
            'no-fallthrough': 'warn',
        },
    },
    {
        // Node scripts (if any land in tools/ or scripts/)
        files: ['tools/**/*.js', 'tools/**/*.mjs', 'scripts/**/*.js', '*.config.js', 'eslint.config.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'writable',
                require: 'readonly',
                exports: 'writable',
                Buffer: 'readonly',
            },
        },
    },

    // ─── Netlify functions: Node 18+ ESM (secrets handling — keep linted) ───
    {
        files: ['netlify/functions/**/*.mjs', 'tools/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                Request: 'readonly',
                Headers: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                AbortController: 'readonly',
                AbortSignal: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
        },
    },

    // ─── Service worker: worker global scope ───
    {
        files: ['sw.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                self: 'readonly',
                caches: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                console: 'readonly',
                Promise: 'readonly',
            },
        },
        rules: {
            'no-undef': 'error',
        },
    },
];
