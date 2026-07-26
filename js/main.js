/* ══════════════════════════════════════════════════════════════════════════
   SINGULARITY CITY — FIRST PERSON · main entry
   Boot: data → layout → renderer → world → systems → loop.
   Performance posture (from the 3D-version autopsy): no shadow maps, no
   post-processing, no logarithmic depth, DPR capped, instancing everywhere.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, qualityPreset, computeDayPhase } from './state.js';
import { City } from './city.js';
import { World } from './world.js';
import { Citizens } from './citizens.js';
import { Traffic } from './traffic.js';
import { Signals } from './signals.js';
import { Weather } from './weather.js';
import { Player } from './player.js';
import { Interact } from './interact.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Progress } from './progress.js';
import { Tour } from './tour.js';
import { Interior } from './interior.js';
import { ChatBubbles } from './chatbubbles.js';
import { Vendors } from './vendors.js';
import { Birds } from './birds.js';
import { CitizenOfDay } from './citizen_of_day.js';
import { VCDealFlow } from './vc_dealflow.js';
import { ResearchPapers } from './research_papers.js';
import { Metro } from './metro.js';
import { Jail } from './jail.js';
import { Court } from './court.js';
import { OrbitMode } from './orbit_mode.js';
import { XrayMode } from './xray_mode.js';
import { Holomap } from './holomap.js';
import { Conference } from './conference.js';
import { Seasonal } from './seasonal.js';
import { Kardashev } from './kardashev.js';
import { Wetness } from './wetness.js';
import { Terminal } from './terminal.js';
import { CityStore } from './store/city_store.js';
import { Live } from './store/live.js';
import { Shell } from './shell.js';
import { readResumeToken, clearResumeToken } from './store/nav.js';

// expose for inline panel handlers (newspaper button) + debugging
window.G = G;

async function boot() {
    // fonts matter for the sign atlas + billboard canvas text
    try { await document.fonts.ready; } catch (e) { /* fall back to system fonts */ }

    // ── state / quality ──
    G.progress = Progress;
    Progress.init();
    const qOverride = localStorage.getItem('sc_fp_quality');
    if (qOverride) G.quality = qOverride;
    G.preset = qualityPreset(G.quality);

    // sync start-screen controls with saved state
    const qSel = document.getElementById('qualitySel');
    const mChk = document.getElementById('musicChk');
    if (qSel) qSel.value = G.quality;
    if (mChk) mChk.checked = !!G.settings.music;

    // ── renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, G.preset.dpr));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES is a photographic curve — it crushed the midtones of a flat-shaded,
    // procedurally-textured city and cost ~25% scene luminance for nothing the
    // art style wanted. The exposure bump to 1.22 was papering over it.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.getElementById('app').appendChild(renderer.domElement);
    G.renderer = renderer;
    G.canvas = renderer.domElement;

    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(G.settings.fov, innerWidth / innerHeight, 0.5, 12000);

    window.addEventListener('resize', () => {
        G.camera.aspect = innerWidth / innerHeight;
        G.camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    // ── wire modules into G (order matters: layout before world) ──
    G.ui = UI;
    G.audio = Audio;
    G.world = World;
    G.citizens = Citizens;
    G.traffic = Traffic;
    G.weatherSys = Weather;
    G.player = Player;
    G.interact = Interact;
    G.tour = Tour;
    G.interior = Interior;

    City.layout();
    World.build();
    Weather.init(G.scene);
    Citizens.init(G.scene);
    Traffic.init(G.scene);
    Signals.init(G.scene);
    G.signals = Signals;
    Interior.init(G.scene);
    Vendors.build(G.scene);
    ChatBubbles.init(G.scene);
    G.chatBubbles = ChatBubbles;
    Birds.init(G.scene);
    CitizenOfDay.init(G.scene);
    G.cotd = CitizenOfDay;
    G.birds = Birds;
    VCDealFlow.init(G.scene);
    ResearchPapers.init(G.scene);
    Metro.init(G.scene);
    Jail.init(G.scene);
    Court.init(G.scene);
    OrbitMode.init();
    XrayMode.init();
    Holomap.init(G.scene);
    Seasonal.init(G.scene);
    Kardashev.init(G.scene);
    Wetness.init(G.scene);
    Terminal.init();
    G.vcDealFlow = VCDealFlow;
    G.researchPapers = ResearchPapers;
    G.metro = Metro;
    G.jail = Jail;
    G.court = Court;
    G.orbitModeSys = OrbitMode;
    G.xrayModeSys = XrayMode;
    G.holomap = Holomap;
    G.seasonal = Seasonal;
    G.kardashev = Kardashev;
    G.wetness = Wetness;
    G.terminal = Terminal;
    // UI before Conference — unlock toasts need HUD nodes
    UI.init();
    Conference.init(G.scene);
    G.conference = Conference;
    Player.init();
    Interact.init();
    Player.placeAtSpawn();

    // Integration: live data + view shell (CityStore already init via Progress)
    G.store = CityStore;
    G.live = Live;
    G.shell = Shell;
    Live.start();
    Shell.init();
    // Arriving from Pixi 2D hard-swap: toast + consume token
    {
        const tok = readResumeToken();
        if (tok && tok.from === 'pixi') {
            clearResumeToken();
            setTimeout(() => {
                G.ui?.addToast?.('↩ Resumed First Person from 2D city', 'info');
            }, 800);
        }
    }

    // ── start screen ──
    const startGame = () => {
        G.settings.music = mChk ? mChk.checked : true;
        document.getElementById('startScreen').style.display = 'none';
        G.started = true;
        Player.enabled = true;
        Audio.init();
        UI.startHUD();
        UI.setWeather(Weather._label());
        // Pointer lock needs a user gesture (autostart / from=pixi has none)
        if (startGame._gesture) Player.lock();
        else setTimeout(() => UI.addToast?.('Click the city to look around', 'info'), 500);
        Progress.unlock('first_steps');
        setTimeout(() => UI.addToast('Tip: press <b>ESC</b> to free the mouse, or <b>P</b> for 2D City', 'info'), 2500);
        UI.banner('🏙️ SINGULARITY CITY', 'the entire AI industry, alive around you');
    };
    document.getElementById('enterBtn').addEventListener('click', () => {
        G.quality = qSel ? qSel.value : G.quality;
        if (G.quality !== (qOverride || 'medium')) {
            localStorage.setItem('sc_fp_quality', G.quality);
            location.reload();
            return;
        }
        startGame._gesture = true;
        startGame();
    });
    // ?autostart=1 — skip the start screen (embeds, kiosks, headless testing)
    const params = new URLSearchParams(location.search);
    if (params.get('autostart') === '1') { startGame._gesture = false; startGame(); }
    // dev/test params: ?dp=0.5 freeze time of day · ?x= &z= &yaw= teleport
    if (params.get('dp') !== null) G.fixedPhase = parseFloat(params.get('dp'));
    if (params.get('x') !== null && params.get('z') !== null) {
        Player.teleport(parseFloat(params.get('x')), parseFloat(params.get('z')),
            params.get('yaw') !== null ? parseFloat(params.get('yaw')) : undefined);
        Player.spawn = { x: parseFloat(params.get('x')), z: parseFloat(params.get('z')) };
    }

    // ?sim=<seconds> — fast-forward citizens and traffic before the first
    // frame, so a screenshot catches a city that has been living for a while
    // instead of one where everybody is still standing on their doorstep
    const sim = parseFloat(params.get('sim') || '0');
    if (sim > 0) {
        for (let t = 0; t < sim; t += 1 / 30) {
            G.time = t;                     // signal phase follows the clock
            Citizens.update(1 / 30);
            ChatBubbles.update(1 / 30);
            Birds.update(1 / 30, t);
            CitizenOfDay.update(1 / 30);
            Traffic.update(1 / 30, t);
            Signals.update(1 / 30);
            VCDealFlow.update(1 / 30);
            ResearchPapers.update(1 / 30);
            Metro.update(1 / 30);
            Jail.update(1 / 30);
            Court.update(1 / 30);
        }
    }

    // ?wx=<state> — force a weather state (dev/testing)
    const wx = params.get('wx');
    if (wx) { Weather.set(wx); Weather._timer = 1e9; Weather.intensity = 1; }

    // ?inside=<buildingId> — boot straight into that building's lobby
    const insideId = params.get('inside');
    if (insideId && G.bldById[insideId]) Interior.enter(G.bldById[insideId]);

    // ?debug=1 — report draw calls / triangles after the scene warms up
    if (params.get('debug') === '1') {
        setTimeout(() => {
            const i = renderer.info.render;
            console.log(`[SC-FP DEBUG] drawCalls=${i.calls} triangles=${i.triangles} geometries=${renderer.info.memory.geometries} textures=${renderer.info.memory.textures}`);
        }, 3500);
    }

    // ── main loop ──
    const clock = new THREE.Clock();
    let fpsAcc = 0, fpsN = 0, fpsT = 0;

    renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 0.1);
        G.tick++;
        G.time = clock.elapsedTime;
        G.dayPhase = computeDayPhase(dt);
        CityStore.syncSim({
            dayPhase: G.dayPhase,
            timeScale: G.timeScale,
            weatherState: Weather.state,
            weatherIntensity: Weather.intensity,
            climate: Weather.climate
        });

        if (G.started && CityStore.getView() !== 'map') {
            if (!G.orbitMode && !G.terminalOpen) Player.update(dt);
            Tour.update(dt);
            Interact.update(dt);
            Citizens.update(dt);
            ChatBubbles.update(dt);
            Birds.update(dt, G.time);
            CitizenOfDay.update(dt);
            Traffic.update(dt, G.time);
            Signals.update(dt);
            Weather.update(dt, G.time);
            World.update(dt, G.time);
            VCDealFlow.update(dt);
            ResearchPapers.update(dt);
            Metro.update(dt);
            Jail.update(dt);
            Court.update(dt);
            OrbitMode.update(dt);
            XrayMode.update(dt);
            Holomap.update(dt);
            Conference.update(dt);
            Seasonal.update(dt);
            Kardashev.update(dt);
            Wetness.update(dt);
            Terminal.update(dt);
            UI.update(dt);
            {
                const snap = CityStore.getSnapshot();
                if (G.ui && typeof snap.aiIndex === 'number') {
                    G.ui.aiIndex = snap.aiIndex;
                    G.ui.aiDelta = snap.aiDelta || 0;
                }
            }
            Audio.setWeatherBeds(Weather.state, Weather.intensity, 1 - Math.max(0, Math.sin((G.dayPhase - 0.25) * Math.PI * 2)));
        }

        renderer.render(G.scene, G.camera);

        // perf tracking (also drives nothing — purely informational for now)
        fpsAcc += dt; fpsN++; fpsT += dt;
        if (fpsT >= 2) { G.fps = Math.round(fpsN / fpsAcc); G.frameMs = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0; fpsT = 0; }
    });
}

boot().catch(err => {
    console.error(err);
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#0a0e1a;color:#f472b6;font:14px monospace;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;z-index:999';
    el.textContent = 'Failed to boot Singularity City: ' + err.message;
    document.body.appendChild(el);
});



