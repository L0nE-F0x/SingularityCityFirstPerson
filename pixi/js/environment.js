/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENVIRONMENT LAYER (v16.3.1 - Visibility Culling, Dirty-Flag, CacheAsBitmap)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Environment = {
    // ─── WEATHER STATE (v16.4 overhaul) ───
    // `weather` is the current visible state. Extended vocabulary:
    //   clear, partly_cloudy, overcast, fog, drizzle, rain, thunderstorm, snow, cherry, leaves
    // Existing external checks for 'rain'/'snow'/'cherry' continue to work;
    // use the helpers isRainy()/isSnowing()/isCloudy() for the extended categories.
    weather: 'clear',
    weatherIntensity: 0,         // 0..1, current render intensity (smooth-lerped)
    weatherTargetIntensity: 0,   // where intensity wants to move toward
    weatherPending: null,        // queued next weather — swap when intensity hits 0
    wind: { x: 0, y: 0 },        // wind vector (x = horizontal, y unused for now)
    _windSeed: Math.random() * 1000,
    lightningFlash: 0,           // 0..1 brightness of current lightning flash
    _nextLightningTick: 0,
    _fogGfx: null,               // lazy-created overlay for fog wash
    _flashGfx: null,             // lazy-created overlay for lightning

    desertWeather: 'clear',
    nextWeatherTick: 800,
    nextDesertWeatherTick: 1200,
    season: 'spring',
    rainDrops: [], snowFlakes: [], petals: [], sandParticles: [],
    rainSplashes: [],            // transient rain-impact rings (drained by age)
    puddles: null,               // lazily-seeded persistent puddle spots (deterministic)
    _wetness: 0,                 // 0..1 ground wetness — fades puddles in/out with rain
    _groundFxGfx: null,          // lazy layer BELOW characters: puddles, cloud shadows, splashes
    _boltPath: null, _boltLife: 0, // lightning bolt polyline + frames remaining
    _portWaterCont: null,        // lazy rippling-water reflection layer (DisplacementFilter)
    _portWaterGfx: null, _waterDispSprite: null, _waterFilter: null,
    _snowAccum: 0,               // 0..1 settled-snow depth — builds during snow, melts after
    _snowGfx: null,              // lazy layer for accumulated snow (ground blanket + roof caps)
    _ditherGfx: null,            // cached pixel-art shadow-side dither overlay (rebuilt with buildings)

    starsLayer: null, celestialGfx: null, cloudLayer: null,
    bldLayer: null, groundGfx: null, reflectionLayer: null, refMask: null,
    staticLightsGfx: null, lightLayer: null, fxGfx: null,
    dataPulses: [],

    // ─── WEATHER TYPE METADATA ───
    // peak: peak intensity for full-strength rendering (0..1)
    // hasParticles: whether drawWeather spawns particles
    // category: used for isRainy/isCloudy etc.
    _WEATHER_INFO: {
        clear:         { peak: 0,    hasParticles: false, category: 'clear'   },
        partly_cloudy: { peak: 0,    hasParticles: false, category: 'clear'   },
        overcast:      { peak: 0,    hasParticles: false, category: 'cloudy'  },
        fog:           { peak: 0.7,  hasParticles: false, category: 'cloudy'  },
        drizzle:       { peak: 0.35, hasParticles: true,  category: 'rainy'   },
        rain:          { peak: 0.85, hasParticles: true,  category: 'rainy'   },
        thunderstorm:  { peak: 1.0,  hasParticles: true,  category: 'rainy'   },
        snow:          { peak: 0.8,  hasParticles: true,  category: 'snowy'   },
        cherry:        { peak: 0.7,  hasParticles: true,  category: 'bloom'   },
        leaves:        { peak: 0.7,  hasParticles: true,  category: 'bloom'   },
    },

    // ─── CLIMATE ZONES ───
    // The sim detects the player's Köppen-lite climate from their IANA timezone
    // and picks weather from a climate-specific Markov chain. Five profiles:
    //   • temperate   — 4 distinct seasons, cherry + leaves (default)
    //   • continental — harsher winters, heavier snow, shorter mild seasons
    //   • polar       — near year-round snow, brief summer with cool rain
    //   • tropical    — wet/dry seasons, thunderstorms, no snow/cherry/leaves
    //   • arid        — one "season", mostly clear, rare rain
    // Southern-hemisphere temperate/continental/polar zones flip the season
    // calendar so Sydney's July is winter, not summer.
    climate: 'temperate',     // set by _detectClimate() in init()
    hemisphere: 'N',          // 'N' or 'S' — flips season calendar

    _CLIMATE_PROFILES: {
        temperate:   { seasons: ['spring', 'summer', 'autumn', 'winter'], calendar: 4 },
        continental: { seasons: ['spring', 'summer', 'autumn', 'winter'], calendar: 4 },
        polar:       { seasons: ['spring', 'summer', 'autumn', 'winter'], calendar: 4 },
        tropical:    { seasons: ['wet', 'dry'], calendar: 2 },
        arid:        { seasons: ['arid'], calendar: 1 },
    },

    // Timezone-to-climate regexes. First match wins. Fallback: temperate.
    // Not exhaustive — approximates the Köppen bands using major IANA zones.
    // Note: Pacific\/ excludes Auckland/Chatham (NZ — temperate). Most other
    // Pacific island nations sit within the tropical latitudinal band.
    _TZ_TROPICAL: /^Pacific\/(?!Auckland|Chatham)|^Indian\/(Mauritius|Reunion|Mahe|Antananarivo|Comoro|Mayotte|Chagos|Cocos|Christmas|Maldives)|^Asia\/(Jakarta|Makassar|Jayapura|Pontianak|Dili|Manila|Bangkok|Ho_Chi_Minh|Phnom_Penh|Vientiane|Singapore|Kuala_Lumpur|Kuching|Brunei|Colombo|Dhaka|Rangoon|Yangon|Kathmandu|Kolkata|Calcutta|Bombay|Mumbai)|^America\/(Bogota|Caracas|Lima|Guayaquil|Panama|Belize|San_Salvador|Tegucigalpa|Managua|Costa_Rica|Guatemala|Merida|Cancun|Mexico_City|Havana|Port_au_Prince|Santo_Domingo|Jamaica|Puerto_Rico|Martinique|Barbados|Grenada|St_Lucia|St_Vincent|Trinidad|Port_of_Spain|Paramaribo|Cayenne|Manaus|Bahia|Recife|Fortaleza|Belem)|^Africa\/(Lagos|Accra|Abidjan|Dakar|Bamako|Conakry|Freetown|Monrovia|Douala|Libreville|Kinshasa|Brazzaville|Bangui|Nairobi|Dar_es_Salaam|Kampala|Kigali|Bujumbura|Addis_Ababa|Djibouti|Mogadishu|Luanda|Lubumbashi|Malabo|Sao_Tome|Porto-Novo|Lome|Ouagadougou|Niamey|Ndjamena)|^Australia\/Darwin/,
    _TZ_ARID: /^Asia\/(Riyadh|Dubai|Kuwait|Qatar|Bahrain|Baghdad|Amman|Damascus|Tehran|Ashgabat|Kabul|Tashkent|Samarkand|Dushanbe|Muscat|Aden|Jerusalem|Tel_Aviv|Nicosia|Beirut)|^Africa\/(Cairo|Tripoli|Algiers|Tunis|Casablanca|El_Aaiun|Nouakchott|Bissau|Gaborone|Khartoum|Asmara|Juba|Windhoek)|^Australia\/(Perth|Adelaide|Broken_Hill|Eucla)|^America\/Phoenix/,
    _TZ_POLAR: /^Atlantic\/Reykjavik|^Antarctica\/|^Europe\/(Helsinki|Tallinn|Riga|Stockholm|Oslo|Vilnius)|^Asia\/(Yakutsk|Magadan|Anadyr|Kamchatka|Srednekolymsk|Khandyga|Ust-Nera|Vladivostok|Sakhalin|Chita)|^America\/(Anchorage|Nome|Iqaluit|Yellowknife|Whitehorse|Dawson|Inuvik|Resolute|Rankin_Inlet|Cambridge_Bay|Nuuk|Godthab|Thule)|^Arctic\//,
    _TZ_CONTINENTAL: /^Europe\/(Moscow|Warsaw|Prague|Budapest|Minsk|Kiev|Kyiv|Bucharest|Sofia|Belgrade|Zagreb|Sarajevo|Skopje|Chisinau|Volgograd|Samara|Saratov|Ulyanovsk|Astrakhan|Kirov)|^Asia\/(Novosibirsk|Yekaterinburg|Omsk|Krasnoyarsk|Irkutsk|Novokuznetsk|Barnaul|Tomsk|Ulaanbaatar|Choibalsan|Hovd|Harbin|Shanghai|Chongqing|Seoul|Pyongyang|Beijing|Urumqi|Almaty|Qyzylorda|Bishkek)|^America\/(Winnipeg|Chicago|Denver|Regina|Edmonton|Calgary|Saskatoon|Boise|Detroit|Indianapolis|Minneapolis|Milwaukee|Fargo|North_Dakota)/,
    _TZ_SOUTH: /^Australia\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Port_Moresby|Guadalcanal|Rarotonga|Niue|Wallis|Efate|Norfolk)|^Antarctica\/|^Africa\/(Johannesburg|Maputo|Maseru|Mbabane|Gaborone|Harare|Lusaka|Windhoek|Luanda|Kinshasa|Brazzaville|Nairobi|Dar_es_Salaam|Lilongwe|Bujumbura|Kigali|Lubumbashi|Mogadishu)|^America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Bahia|Recife|Fortaleza|Manaus|Cayenne|Paramaribo|Port_of_Spain|Punta_Arenas)|^Asia\/(Jakarta|Makassar|Jayapura|Pontianak|Dili)|^Indian\/(Mauritius|Reunion|Mahe|Antananarivo|Comoro|Mayotte)/,

    _detectClimate() {
        // localStorage override first — lets players pick a climate manually.
        try {
            const override = localStorage.getItem('sc_climate');
            if (override && this._CLIMATE_PROFILES[override]) return override;
        } catch (_) {}
        let tz = '';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
        if (this._TZ_TROPICAL.test(tz))    return 'tropical';
        if (this._TZ_ARID.test(tz))        return 'arid';
        if (this._TZ_POLAR.test(tz))       return 'polar';
        if (this._TZ_CONTINENTAL.test(tz)) return 'continental';
        return 'temperate';
    },

    _detectHemisphere() {
        try {
            const override = localStorage.getItem('sc_hemisphere');
            if (override === 'N' || override === 'S') return override;
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            return this._TZ_SOUTH.test(tz) ? 'S' : 'N';
        } catch (_) { return 'N'; }
    },

    // ─── MARKOV TRANSITION WEIGHTS (per climate, per season) ───
    // Structure: _MARKOV[climate][season][currentWeather] = [[nextWeather, weight], ...]
    // Selection is a weighted random draw across the row.
    _MARKOV: {
        temperate: {
            spring: {
                clear:         [['clear', 4], ['partly_cloudy', 2], ['cherry', 1]],
                partly_cloudy: [['clear', 2], ['partly_cloudy', 2], ['overcast', 2], ['cherry', 1]],
                overcast:      [['partly_cloudy', 2], ['drizzle', 2], ['rain', 1], ['fog', 1]],
                fog:           [['fog', 1], ['overcast', 2], ['partly_cloudy', 2], ['clear', 1]],
                drizzle:       [['drizzle', 1], ['rain', 2], ['overcast', 2]],
                rain:          [['rain', 2], ['drizzle', 2], ['thunderstorm', 0.5], ['overcast', 1]],
                thunderstorm:  [['rain', 3], ['overcast', 1]],
                cherry:        [['cherry', 2], ['clear', 2], ['partly_cloudy', 1]],
            },
            summer: {
                clear:         [['clear', 5], ['partly_cloudy', 2]],
                partly_cloudy: [['clear', 3], ['partly_cloudy', 2], ['overcast', 1]],
                overcast:      [['partly_cloudy', 2], ['rain', 1], ['thunderstorm', 1]],
                fog:           [['fog', 1], ['clear', 3]],
                drizzle:       [['rain', 2], ['overcast', 1]],
                rain:          [['rain', 2], ['thunderstorm', 1], ['overcast', 1]],
                thunderstorm:  [['rain', 2], ['overcast', 2]],
            },
            autumn: {
                clear:         [['clear', 3], ['partly_cloudy', 2], ['leaves', 1]],
                partly_cloudy: [['clear', 2], ['overcast', 2], ['leaves', 1], ['fog', 1]],
                overcast:      [['partly_cloudy', 2], ['drizzle', 2], ['rain', 1], ['fog', 1]],
                fog:           [['fog', 2], ['overcast', 2], ['partly_cloudy', 1]],
                drizzle:       [['drizzle', 1], ['rain', 2], ['overcast', 1]],
                rain:          [['rain', 2], ['drizzle', 2], ['overcast', 1]],
                leaves:        [['leaves', 2], ['clear', 1], ['partly_cloudy', 1], ['overcast', 1]],
            },
            winter: {
                clear:         [['clear', 3], ['partly_cloudy', 2], ['fog', 1]],
                partly_cloudy: [['clear', 2], ['overcast', 2], ['snow', 1]],
                overcast:      [['partly_cloudy', 2], ['snow', 2], ['drizzle', 1], ['fog', 1]],
                fog:           [['fog', 2], ['overcast', 2], ['partly_cloudy', 1]],
                drizzle:       [['drizzle', 1], ['overcast', 2], ['snow', 1]],
                snow:          [['snow', 3], ['overcast', 1]],
            },
        },
        // Continental: harsher than temperate. Shorter mild seasons, heavier winter.
        continental: {
            spring: {
                clear:         [['clear', 3], ['partly_cloudy', 3], ['overcast', 2]],
                partly_cloudy: [['clear', 2], ['overcast', 2], ['rain', 1], ['thunderstorm', 0.5]],
                overcast:      [['partly_cloudy', 2], ['rain', 2], ['drizzle', 1], ['fog', 1]],
                drizzle:       [['drizzle', 1], ['rain', 1], ['overcast', 2]],
                rain:          [['rain', 2], ['thunderstorm', 0.5], ['drizzle', 1], ['overcast', 1]],
                thunderstorm:  [['rain', 2], ['overcast', 1]],
                fog:           [['fog', 1], ['overcast', 2], ['partly_cloudy', 1]],
            },
            summer: {
                clear:         [['clear', 4], ['partly_cloudy', 3]],
                partly_cloudy: [['clear', 2], ['partly_cloudy', 2], ['thunderstorm', 1]],
                overcast:      [['partly_cloudy', 2], ['thunderstorm', 2], ['rain', 1]],
                rain:          [['rain', 1], ['thunderstorm', 2], ['partly_cloudy', 2]],
                thunderstorm:  [['rain', 2], ['partly_cloudy', 1], ['clear', 1]],
            },
            autumn: {
                clear:         [['clear', 2], ['partly_cloudy', 3], ['leaves', 2]],
                partly_cloudy: [['overcast', 3], ['leaves', 1], ['fog', 1]],
                overcast:      [['partly_cloudy', 1], ['rain', 2], ['drizzle', 2], ['fog', 2]],
                rain:          [['rain', 2], ['drizzle', 1], ['overcast', 1], ['snow', 0.3]],
                drizzle:       [['drizzle', 1], ['rain', 1], ['overcast', 2]],
                fog:           [['fog', 2], ['overcast', 2]],
                leaves:        [['leaves', 3], ['partly_cloudy', 1], ['overcast', 1]],
            },
            winter: {
                clear:         [['clear', 1], ['partly_cloudy', 2], ['snow', 2], ['fog', 1]],
                partly_cloudy: [['overcast', 3], ['snow', 2]],
                overcast:      [['overcast', 2], ['snow', 4], ['fog', 2]],
                snow:          [['snow', 5], ['overcast', 2]],
                fog:           [['fog', 3], ['overcast', 2]],
            },
        },
        // Polar: snow-dominated year-round, brief cool summer.
        polar: {
            spring: {
                clear:         [['clear', 1], ['partly_cloudy', 2], ['overcast', 2], ['snow', 2]],
                partly_cloudy: [['overcast', 2], ['snow', 2]],
                overcast:      [['overcast', 2], ['snow', 3], ['fog', 2]],
                snow:          [['snow', 4], ['overcast', 2]],
                fog:           [['fog', 3], ['overcast', 2]],
            },
            summer: {
                clear:         [['clear', 2], ['partly_cloudy', 3], ['overcast', 2], ['fog', 1]],
                partly_cloudy: [['clear', 2], ['overcast', 2], ['rain', 1]],
                overcast:      [['partly_cloudy', 2], ['rain', 2], ['fog', 2], ['drizzle', 1]],
                rain:          [['rain', 1], ['overcast', 2], ['drizzle', 1]],
                drizzle:       [['drizzle', 1], ['overcast', 1]],
                fog:           [['fog', 3], ['overcast', 2]],
            },
            autumn: {
                clear:         [['clear', 1], ['partly_cloudy', 1], ['overcast', 2], ['snow', 2]],
                partly_cloudy: [['overcast', 3], ['snow', 2]],
                overcast:      [['overcast', 3], ['snow', 3], ['fog', 2]],
                snow:          [['snow', 4], ['overcast', 2]],
                fog:           [['fog', 3], ['snow', 1]],
            },
            winter: {
                clear:         [['clear', 1], ['overcast', 3], ['snow', 3], ['fog', 2]],
                overcast:      [['overcast', 2], ['snow', 5], ['fog', 3]],
                snow:          [['snow', 6], ['overcast', 2]],
                fog:           [['fog', 4], ['overcast', 2], ['snow', 1]],
            },
        },
        // Tropical: wet/dry binary. Lots of afternoon thunderstorms in wet season.
        tropical: {
            wet: {
                clear:         [['clear', 1], ['partly_cloudy', 3], ['overcast', 1]],
                partly_cloudy: [['partly_cloudy', 2], ['overcast', 3], ['thunderstorm', 2], ['rain', 2]],
                overcast:      [['overcast', 2], ['rain', 3], ['thunderstorm', 3], ['partly_cloudy', 1]],
                drizzle:       [['drizzle', 1], ['rain', 2], ['overcast', 2]],
                rain:          [['rain', 2], ['thunderstorm', 2], ['overcast', 2], ['drizzle', 1]],
                thunderstorm:  [['rain', 3], ['overcast', 2], ['thunderstorm', 1]],
                fog:           [['fog', 1], ['overcast', 2], ['partly_cloudy', 1]],
            },
            dry: {
                clear:         [['clear', 5], ['partly_cloudy', 3]],
                partly_cloudy: [['clear', 3], ['partly_cloudy', 3], ['overcast', 1], ['thunderstorm', 0.5]],
                overcast:      [['partly_cloudy', 3], ['clear', 1], ['rain', 1]],
                rain:          [['rain', 1], ['partly_cloudy', 2], ['overcast', 1]],
                thunderstorm:  [['rain', 2], ['partly_cloudy', 2], ['clear', 1]],
                drizzle:       [['drizzle', 1], ['partly_cloudy', 2]],
                fog:           [['fog', 1], ['clear', 3]],
            },
        },
        // Arid: one perpetual "season". Mostly clear, rare rain, no snow/cherry/leaves.
        arid: {
            arid: {
                clear:         [['clear', 8], ['partly_cloudy', 1]],
                partly_cloudy: [['clear', 4], ['partly_cloudy', 2], ['overcast', 1]],
                overcast:      [['clear', 2], ['partly_cloudy', 2], ['overcast', 1], ['rain', 0.5], ['thunderstorm', 0.3]],
                rain:          [['rain', 1], ['overcast', 1], ['clear', 2]],
                thunderstorm:  [['rain', 1], ['overcast', 1], ['clear', 2]],
            },
        },
    },

    // ─── WEATHER CATEGORY HELPERS (used by external modules) ───
    isRainy()   { return this._WEATHER_INFO[this.weather]?.category === 'rainy'; },
    isSnowing() { return this.weather === 'snow'; },
    isCloudy()  { const c = this._WEATHER_INFO[this.weather]?.category; return c === 'cloudy' || c === 'rainy' || c === 'snowy'; },
    isWet()     { return this.isRainy(); },  // alias — for reflection/trail decisions
    hasPrecipitation() { return !!this._WEATHER_INFO[this.weather]?.hasParticles; },

    // Season is climate-aware. For 4-season climates it also respects hemisphere.
    //   arid     → always 'arid'
    //   tropical → 'wet' or 'dry' (wet = warm half of year for the hemisphere)
    //   4-season → 'spring'|'summer'|'autumn'|'winter' (SH flipped 6 months)
    getSeason() {
        const profile = this._CLIMATE_PROFILES[this.climate] || this._CLIMATE_PROFILES.temperate;
        if (profile.calendar === 1) return 'arid';
        const m = new Date().getMonth();
        // Normalize month to "NH equivalent" if in southern hemisphere.
        const nm = this.hemisphere === 'S' ? (m + 6) % 12 : m;
        if (profile.calendar === 2) {
            // Tropical: wet = warm half (May–Oct NH, Nov–Apr SH).
            return (nm >= 4 && nm <= 9) ? 'wet' : 'dry';
        }
        // 4-season calendar.
        if (nm >= 2 && nm <= 4) return 'spring';
        if (nm >= 5 && nm <= 7) return 'summer';
        if (nm >= 8 && nm <= 10) return 'autumn';
        return 'winter';
    },

    init(layers) {
        this.climate = this._detectClimate();
        this.hemisphere = this._detectHemisphere();
        this.season = this.getSeason();
        this.starsLayer = layers.starsLayer; this.celestialGfx = layers.celestialGfx; this.cloudLayer = layers.cloudLayer;
        this.bldLayer = layers.bldLayer; this.groundGfx = layers.groundGfx; this.reflectionLayer = layers.reflectionLayer;
        this.staticLightsGfx = layers.staticLightsGfx; this.lightLayer = layers.lightLayer; this.fxGfx = layers.fxGfx;
        this.buildStars(); this.buildGround(); this.buildDataPulses(); this.buildClouds(); this.buildBuildings();
        // Announce climate once per session — delayed so UI has time to mount.
        setTimeout(() => {
            if (typeof UI === 'undefined' || !UI.addToast) return;
            const icons = { tropical: '🌴', arid: '🏜️', temperate: '🍃', continental: '🌲', polar: '🧊' };
            const labels = { tropical: 'Tropical', arid: 'Arid', temperate: 'Temperate', continental: 'Continental', polar: 'Polar' };
            UI.addToast(`${icons[this.climate] || '🌍'} Climate: ${labels[this.climate] || this.climate} (${this.hemisphere === 'S' ? 'Southern' : 'Northern'} Hemisphere)`);
        }, 1500);
    },

    buildStars() {
      this.starsLayer.removeChildren();
      // Store star data for twinkling without 100 individual Graphics objects
      this._starData = [];
      // Deterministic placement (seeded noise) — the sky no longer reshuffles
      // between boots/rebuilds; twinkle still animates via phase at runtime.
      for (let i = 0; i < 100; i++) {
        this._starData.push({
            x: this._labNoise(i * 5 + 1) * G.cityW,
            y: this._labNoise(i * 5 + 2) * G.vpH * .5,
            sz: .5 + this._labNoise(i * 5 + 3) * 1.5,
            phase: this._labNoise(i * 5 + 4) * Math.PI * 2,
            baseAlpha: .15 + this._labNoise(i * 5 + 5) * .5
        });
      }
      // Single Graphics object draws all stars
      this._starsGfx = new PIXI.Graphics();
      this._drawStars();
      this.starsLayer.addChild(this._starsGfx);
    },

    _drawStars(tick) {
      const g = this._starsGfx;
      if (!g) return;
      g.clear();
      const stars = this._starData;
      if (!stars) return;
      const t = tick || 0;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = t > 0 ? (.15 + Math.abs(Math.sin(t * .03 + s.phase)) * .5) : s.baseAlpha;
        g.beginFill(0xffffff, a);
        g.drawCircle(s.x, s.y, s.sz);
        g.endFill();
      }
    },

    buildGround() {
      const g = this.groundGfx;
      g.clear(); const gy = G.groundY;
      // Absolute bottom fill — below tunnel cavity (gy+70 to gy+170 must stay transparent for undergroundLayer)
      g.beginFill(0x0a0a0f); g.drawRect(-4000, gy + 170, G.cityW + 8000, 3000); g.endFill();
      this.staticLightsGfx.clear(); 
      
      if (!this.refMask) {
          this.refMask = new PIXI.Graphics();
          this.reflectionLayer.addChild(this.refMask);
          this.reflectionLayer.mask = this.refMask;
      }
      this.refMask.clear();
      this.refMask.beginFill(0xffffff);
      this.refMask.drawRect(-2000, gy, G.cityW + 4000, 32); 
      this.refMask.endFill();

      // ─── Determine port zone X range ───
      let portStartX = Infinity, portEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('port_')) {
              if (b.x < portStartX) portStartX = b.x;
              if (b.x + b.w > portEndX) portEndX = b.x + b.w;
          }
      });
      const hasPortZone = portStartX < Infinity && portEndX > 0;
      if (hasPortZone) { portStartX = Math.max(0, portStartX - 80); portEndX += 40; }

      // ─── Determine power zone X range ───
      let powerStartX = Infinity, powerEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('power_')) {
              if (b.x < powerStartX) powerStartX = b.x;
              if (b.x + b.w > powerEndX) powerEndX = b.x + b.w;
          }
      });
      const hasPowerZone = powerStartX < Infinity && powerEndX > 0;
      if (hasPowerZone) { powerStartX -= 120; powerEndX += 40; }

      // ─── Determine space zone X range ───
      let spaceStartX = Infinity, spaceEndX = 0;
      if (typeof SPACE_BLDS !== 'undefined') {
          BLDS.forEach(b => {
              if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
                  if (b.x < spaceStartX) spaceStartX = b.x;
                  if (b.x + b.w > spaceEndX) spaceEndX = b.x + b.w;
              }
          });
          // Extend desert to cover gaps between pads
          if (spaceStartX < Infinity) {
              spaceStartX = Math.max(0, spaceStartX - 60);
              spaceEndX += 60;
          }
      }
      const hasSpaceZone = spaceStartX < Infinity && spaceEndX > 0;

      // ─── Determine backbone zone X range ───
      let backboneStartX = Infinity, backboneEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('backbone_')) {
              if (b.x < backboneStartX) backboneStartX = b.x;
              if (b.x + b.w > backboneEndX) backboneEndX = b.x + b.w;
          }
      });
      const hasBackboneZone = backboneStartX < Infinity && backboneEndX > 0;
      if (hasBackboneZone) { backboneStartX -= 60; backboneEndX += 40; }

      // ─── Determine agent district X range ───
      let agentsStartX = Infinity, agentsEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('agents_')) {
              if (b.x < agentsStartX) agentsStartX = b.x;
              if (b.x + b.w > agentsEndX) agentsEndX = b.x + b.w;
          }
      });
      const hasAgentsZone = agentsStartX < Infinity && agentsEndX > 0;
      if (hasAgentsZone) { agentsStartX -= 60; agentsEndX += 40; }

      // ─── CITY TERRAIN (skip space zone range) ───
      const drawCityTerrain = (startX, endX) => {
          if (startX >= endX) return;
          const w = endX - startX;
          g.beginFill(0x2a2a42); g.drawRect(startX, gy - 24, w, 24); g.endFill();
          g.beginFill(0x33334a); g.drawRect(startX, gy - 24, w, 12); g.endFill();
          g.beginFill(0x44445a); g.drawRect(startX, gy - 24, w, 2); g.endFill();
          for (let x = startX; x < endX; x += 30) { 
              g.beginFill(0x3a3a50, 0.3); g.drawRect(x, gy - 22, 1, 20); g.endFill(); 
          }
          g.beginFill(0x1e1e32); g.drawRect(startX, gy, w, 32); g.endFill();
          g.beginFill(0x22223a); g.drawRect(startX, gy, w, 16); g.endFill();
          g.beginFill(0x2a2a3e); g.drawRect(startX, gy, w, 2); g.endFill();
          for (let x = startX; x < endX; x += 40) { 
              g.beginFill(0x50506a); g.drawRect(x, gy + 14, 20, 3); g.endFill(); 
          }
          g.beginFill(0x50506a, 0.3); g.drawRect(startX, gy + 2, w, 1); g.endFill();
          g.beginFill(0x50506a, 0.3); g.drawRect(startX, gy + 29, w, 1); g.endFill();
      };

      // ─── PORT ZONE OCEAN TERRAIN ───
      if (hasPortZone) {
          const pw = portEndX - portStartX + 40;
          const psx = 0;
          // Deep ocean surface
          g.beginFill(0x0a1628); g.drawRect(psx, gy - 24, pw, 24); g.endFill();
          g.beginFill(0x0c1e3a); g.drawRect(psx, gy - 18, pw, 18); g.endFill();
          g.beginFill(0x1a5a8a, 0.25); g.drawRect(psx, gy - 6, pw, 4); g.endFill();
          // Wooden dock planks
          g.beginFill(0x5a4a3a); g.drawRect(portStartX, gy - 3, portEndX - portStartX, 5); g.endFill();
          for (let dx = portStartX; dx < portEndX; dx += 12) { g.beginFill(0x4a3a2a); g.drawRect(dx, gy - 3, 1, 5); g.endFill(); }
          // Dock posts + bollards
          for (let pp = portStartX + 30; pp < portEndX; pp += 60) { g.beginFill(0x3a2a1a); g.drawRect(pp, gy + 2, 5, 14); g.endFill(); }
          for (let bb = portStartX + 50; bb < portEndX - 40; bb += 80) { g.beginFill(0xfbbf24); g.drawCircle(bb, gy - 5, 3); g.endFill(); }
          // Water SOLID FILL covering ALL underground
          g.beginFill(0x061220); g.drawRect(psx, gy, pw, 600); g.endFill();
          g.beginFill(0x0e2240, 0.5); g.drawRect(psx, gy, pw, 8); g.endFill();
          for (let wx = psx; wx < psx + pw; wx += 18) { g.beginFill(0x2a7aaa, 0.12); g.drawRect(wx, gy + 2, 10, 1); g.endFill(); }
          // ─── COASTLINE (port → desert) ───
          const coastX = portEndX - 10;
          g.beginFill(0x8a7a5a); g.drawRect(coastX, gy - 6, 20, 22); g.endFill();
          g.beginFill(0xa8956a); g.drawRect(coastX + 20, gy - 4, 25, 20); g.endFill();
          g.beginFill(0xc4a872); g.drawRect(coastX + 45, gy - 3, 30, 18); g.endFill();
          g.beginFill(0xd4b882, 0.5); g.drawRect(coastX + 75, gy - 2, 25, 16); g.endFill();
          g.beginFill(0xffffff, 0.12); g.drawRect(coastX - 2, gy - 2, 5, 1); g.endFill();
          // Palm trees (proper polygon fronds)
          for (let ptx = coastX + 18; ptx < coastX + 65; ptx += 25) {
              g.beginFill(0x6b4226); g.moveTo(ptx+4,gy-4); g.lineTo(ptx+1,gy-28); g.lineTo(ptx-2,gy-50); g.lineTo(ptx+2,gy-50); g.lineTo(ptx+5,gy-28); g.lineTo(ptx+8,gy-4); g.closePath(); g.endFill();
              g.beginFill(0x7a5030, 0.4); for(let ty=gy-46;ty<gy-8;ty+=6){g.drawRect(ptx-1,ty,6,2);} g.endFill();
              g.beginFill(0x2d8a4e, 0.8);
              g.drawPolygon([ptx,gy-50, ptx-18,gy-38, ptx-14,gy-42, ptx-1,gy-48]);
              g.drawPolygon([ptx+4,gy-50, ptx+22,gy-38, ptx+18,gy-42, ptx+5,gy-48]);
              g.endFill();
              g.beginFill(0x38a85e, 0.7);
              g.drawPolygon([ptx+1,gy-52, ptx-10,gy-46, ptx-6,gy-50, ptx,gy-50]);
              g.drawPolygon([ptx+3,gy-52, ptx+14,gy-46, ptx+10,gy-50, ptx+4,gy-50]);
              g.drawPolygon([ptx+2,gy-50, ptx-5,gy-34, ptx-1,gy-38, ptx+1,gy-48]);
              g.drawPolygon([ptx+2,gy-50, ptx+9,gy-34, ptx+5,gy-38, ptx+3,gy-48]);
              g.endFill();
              g.beginFill(0x5a3a1a); g.drawCircle(ptx+1,gy-47,2); g.drawCircle(ptx+4,gy-46,2); g.endFill();
          }
      }

      // ─── POWER ZONE INDUSTRIAL TERRAIN ───
      if (hasPowerZone) {
          const pw = G.cityW + 200 - powerStartX; // Extend to map edge
          // Road + sidewalk (matches city terrain)
          g.beginFill(0x2a2a42); g.drawRect(powerStartX, gy - 24, pw, 24); g.endFill();
          g.beginFill(0x33334a); g.drawRect(powerStartX, gy - 24, pw, 12); g.endFill();
          g.beginFill(0x44445a); g.drawRect(powerStartX, gy - 24, pw, 2); g.endFill();
          // Sidewalk cracks
          for (let x = powerStartX; x < powerStartX + pw; x += 30) { g.beginFill(0x3a3a50, 0.3); g.drawRect(x, gy - 22, 1, 20); g.endFill(); }
          // Road
          g.beginFill(0x1e1e32); g.drawRect(powerStartX, gy, pw, 32); g.endFill();
          g.beginFill(0x22223a); g.drawRect(powerStartX, gy, pw, 16); g.endFill();
          g.beginFill(0x2a2a3e); g.drawRect(powerStartX, gy, pw, 2); g.endFill();
          // Road dashes
          for (let x = powerStartX; x < powerStartX + pw; x += 40) { g.beginFill(0x50506a); g.drawRect(x, gy + 14, 20, 3); g.endFill(); }
          g.beginFill(0x50506a, 0.3); g.drawRect(powerStartX, gy + 2, pw, 1); g.endFill();
          g.beginFill(0x50506a, 0.3); g.drawRect(powerStartX, gy + 29, pw, 1); g.endFill();
          // (Underground fill drawn AFTER all city infrastructure — see power zone overpaint below)
          // (Power line poles handled by city-wide pole system below)
          // Dead grass / scrub between buildings
          const powerBlds = BLDS.filter(b => b.id.startsWith('power_'));
          for (let sx = powerStartX + 110; sx < powerEndX + 100; sx += 25 + this._labNoise(sx) * 20) {
              if (!powerBlds.some(b => sx > b.x - 5 && sx < b.x + b.w + 5)) {
                  g.beginFill(0x5a5530, 0.4); g.drawRect(sx, gy - 8, 1, 4 + this._labNoise(sx + 1) * 4); g.drawRect(sx + 3, gy - 6, 1, 3 + this._labNoise(sx + 2) * 3); g.endFill();
              }
          }
          // Chain link fence at zone entrance
          g.beginFill(0x6b7280, 0.3); g.drawRect(powerStartX + 100, gy - 22, 2, 18); g.drawRect(powerStartX + 100, gy - 20, 20, 1); g.endFill();
      }

      // ─── BACKBONE ZONE TERRAIN — dark metallic with fiber glow ───
      if (hasBackboneZone) {
          const bkw = backboneEndX - backboneStartX;
          // Dark metallic sidewalk
          g.beginFill(0x0c1525); g.drawRect(backboneStartX, gy - 24, bkw, 24); g.endFill();
          g.beginFill(0x111e30); g.drawRect(backboneStartX, gy - 24, bkw, 12); g.endFill();
          g.beginFill(0x1a2a40); g.drawRect(backboneStartX, gy - 24, bkw, 2); g.endFill();
          // Fiber glow lines embedded in sidewalk
          for (let fx = backboneStartX; fx < backboneEndX; fx += 50) {
              g.beginFill(0x22d3ee, 0.08); g.drawRect(fx, gy - 20, 25, 1); g.endFill();
              g.beginFill(0x4ade80, 0.06); g.drawRect(fx + 30, gy - 16, 15, 1); g.endFill();
          }
          // Dark road
          g.beginFill(0x0a1220); g.drawRect(backboneStartX, gy, bkw, 32); g.endFill();
          g.beginFill(0x0e1828); g.drawRect(backboneStartX, gy, bkw, 16); g.endFill();
          // Cyan fiber center line (data running under road)
          g.beginFill(0x22d3ee, 0.12); g.drawRect(backboneStartX, gy + 14, bkw, 3); g.endFill();
          g.beginFill(0x4ade80, 0.08); g.drawRect(backboneStartX, gy + 12, bkw, 1); g.endFill();
          // Road dashes
          for (let x = backboneStartX; x < backboneEndX; x += 40) {
              g.beginFill(0x1a3050, 0.5); g.drawRect(x, gy + 14, 20, 3); g.endFill();
          }
          // Edge glow accents
          g.beginFill(0x22d3ee, 0.06); g.drawRect(backboneStartX, gy + 2, bkw, 1); g.endFill();
          g.beginFill(0x22d3ee, 0.06); g.drawRect(backboneStartX, gy + 29, bkw, 1); g.endFill();
      }

      // ─── AGENT DISTRICT terrain (dark rose-tinted ground) ───
      if (hasAgentsZone) {
          const agw = agentsEndX - agentsStartX;
          // Dark sidewalk with rose tint
          g.beginFill(0x0e0a1a); g.drawRect(agentsStartX, gy - 24, agw, 24); g.endFill();
          g.beginFill(0x14101e); g.drawRect(agentsStartX, gy - 24, agw, 12); g.endFill();
          g.beginFill(0x1e1530); g.drawRect(agentsStartX, gy - 24, agw, 2); g.endFill();
          // Data flow lines in sidewalk (rose/amber)
          for (let fx = agentsStartX; fx < agentsEndX; fx += 50) {
              g.beginFill(0xf43f5e, 0.06); g.drawRect(fx, gy - 20, 25, 1); g.endFill();
              g.beginFill(0xfbbf24, 0.05); g.drawRect(fx + 30, gy - 16, 15, 1); g.endFill();
          }
          // Dark road
          g.beginFill(0x0a0818); g.drawRect(agentsStartX, gy, agw, 32); g.endFill();
          g.beginFill(0x0e0c1e); g.drawRect(agentsStartX, gy, agw, 16); g.endFill();
          // Rose-tinted center line
          g.beginFill(0xf43f5e, 0.10); g.drawRect(agentsStartX, gy + 14, agw, 3); g.endFill();
          g.beginFill(0xa855f7, 0.06); g.drawRect(agentsStartX, gy + 12, agw, 1); g.endFill();
          // Road dashes
          for (let x = agentsStartX; x < agentsEndX; x += 40) {
              g.beginFill(0x1e1535, 0.5); g.drawRect(x, gy + 14, 20, 3); g.endFill();
          }
          // Edge accents
          g.beginFill(0xf43f5e, 0.05); g.drawRect(agentsStartX, gy + 2, agw, 1); g.endFill();
          g.beginFill(0xf43f5e, 0.05); g.drawRect(agentsStartX, gy + 29, agw, 1); g.endFill();
      }

      if (hasSpaceZone) {
          // Desert terrain for space zone
          if (typeof SpaceEnvironment !== 'undefined') {
              SpaceEnvironment.buildDesertTerrain(g, gy, spaceStartX, spaceEndX);
              SpaceEnvironment.buildDesertScenery(g, gy, spaceStartX, spaceEndX);
          }
          // City terrain: skip port zone, space zone, power zone, and backbone zone
          const cityEndX = hasBackboneZone ? backboneStartX : (hasPowerZone ? powerStartX : G.cityW);
          if (hasPortZone) {
              drawCityTerrain(portEndX, spaceStartX);
          } else {
              drawCityTerrain(0, spaceStartX);
          }
          drawCityTerrain(spaceEndX, cityEndX);
          if (hasBackboneZone && hasPowerZone) drawCityTerrain(backboneEndX, powerStartX);
      } else {
          const cityEndX = hasBackboneZone ? backboneStartX : (hasPowerZone ? powerStartX : G.cityW);
          if (hasPortZone) {
              drawCityTerrain(portEndX, cityEndX);
          } else {
              drawCityTerrain(0, cityEndX);
          }
          if (hasBackboneZone && hasPowerZone) drawCityTerrain(backboneEndX, powerStartX);
      }

      // Underground base (skip special zones)
      if (hasSpaceZone || hasPortZone) {
          const segments = [];
          let cursor = -2000;
          if (hasPortZone) { segments.push([cursor, portStartX]); cursor = portEndX; }
          if (hasSpaceZone) { segments.push([cursor, spaceStartX]); cursor = spaceEndX; }
          segments.push([cursor, G.cityW + 4000]);
          segments.forEach(([s, e]) => { if (e > s) { g.beginFill(0x0a0a0f); g.drawRect(s, gy + 32, e - s, 38); g.endFill(); } });
      } else {
          g.beginFill(0x0a0a0f); g.drawRect(-2000, gy + 32, G.cityW + 4000, 38); g.endFill();
      }

      // Helper: draw a horizontal element only in city zones (skip desert)
      const drawCityH = (y, h, col, alpha) => {
          const a = alpha != null ? alpha : 1;
          // Draw in segments, skipping port and space zones
          const zones = [];
          if (hasPortZone) zones.push([portStartX, portEndX]);
          if (hasSpaceZone) zones.push([spaceStartX, spaceEndX]);
          zones.sort((a, b) => a[0] - b[0]);
          let cursor = -2000;
          zones.forEach(([zs, ze]) => { if (cursor < zs) { g.beginFill(col, a); g.drawRect(cursor, y, zs - cursor, h); g.endFill(); } cursor = ze; });
          g.beginFill(col, a); g.drawRect(cursor, y, G.cityW + 4000 - cursor, h); g.endFill();
      };
      // Helper: is X in a non-city zone?
      const inSpecialZone = (x) => (hasSpaceZone && x >= spaceStartX && x <= spaceEndX) || (hasPortZone && x >= portStartX && x <= portEndX) || (hasPowerZone && x >= powerStartX && x <= powerEndX) || (hasBackboneZone && x >= backboneStartX && x <= backboneEndX) || (hasAgentsZone && x >= agentsStartX && x <= agentsEndX);

      const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
      const cableEndX = hasPowerZone ? powerStartX : G.cityW + 2000;
      let cableStartX = -2000;
      if (hasPortZone) cableStartX = Math.max(cableStartX, portEndX);
      if (hasSpaceZone) cableStartX = Math.max(cableStartX, spaceEndX);

      // Dark cable tray background (same as Backbone)
      g.beginFill(0x060a14); g.drawRect(cableStartX, gy + 32, cableEndX - cableStartX, 38); g.endFill();

      // Dense fiber trunk — 10 neat horizontal rows (identical to Backbone style)
      for (let fi = 0; fi < 10; fi++) {
          const fy = gy + 35 + fi * 3;
          const col = cableCols[fi % cableCols.length];
          g.beginFill(col, 0.35 + this._labNoise(fi + 11) * 0.25);
          g.drawRect(cableStartX + 10, fy, cableEndX - cableStartX - 20, 2);
          g.endFill();
      }

      // Cable node dots — junction points (same size/alpha as Backbone)
      for (let ni = 0; ni < 60; ni++) {
          const nx = cableStartX + 30 + this._labNoise(ni * 4 + 1) * (cableEndX - cableStartX - 60);
          if (inSpecialZone(nx)) continue;
          const ny = gy + 36 + this._labNoise(ni * 4 + 2) * 28;
          g.beginFill(cableCols[Math.floor(this._labNoise(ni * 4 + 3) * cableCols.length)], 0.5);
          g.drawCircle(nx, ny, 1.5 + this._labNoise(ni * 4 + 4) * 2);
          g.endFill();
      }

      // Vertical risers from buildings down to fiber trunk
      const cityBlds = BLDS.filter(b => !b.id.startsWith('backbone_') && !b.id.startsWith('port_') && !b.id.startsWith('power_') && !b.id.startsWith('space_') && !b.id.startsWith('agents_') && !inSpecialZone(b.x + b.w / 2) && b.x > cableStartX && b.x < cableEndX);
      cityBlds.forEach(bb => {
          const cx = bb.x + bb.w / 2;
          g.beginFill(0x1a2540); g.drawRect(cx - 4, gy + 32, 8, 20); g.endFill();
          g.beginFill(0x22d3ee, 0.2); g.drawRect(cx - 2, gy + 34, 4, 16); g.endFill();
          g.beginFill(0x1a2a40); g.drawRect(cx - 6, gy + 30, 12, 5); g.endFill();
          g.beginFill(0x22d3ee, 0.4); g.drawCircle(cx - 2, gy + 32, 1.2); g.endFill();
          g.beginFill(0x4ade80, 0.4); g.drawCircle(cx + 2, gy + 32, 1.2); g.endFill();
      });

      // gy+70 to gy+170 = tunnel cavity — left TRANSPARENT so undergroundLayer shows through
      // gy+170 downward = infrastructure depth — filled solid
      drawCityH(gy + 170, 100, 0x0a0a0f);
      
      let mEast = window.BLDS ? window.BLDS.find(b => b.id === 'metro_east') : null;
      let mLong = window.BLDS ? window.BLDS.find(b => b.id === 'metro_longevity') : null;
      // Extend tunnel to the easternmost station (metro_longevity if present)
      let tunnelEndX = mLong ? mLong.x + (mLong.w / 2) + 160
                      : mEast ? mEast.x + (mEast.w / 2) + 160
                      : G.cityW;

      // Rock/earth fill AFTER the tunnel ends — covers gy+70 to gy+270 (stop before power zone)
      const rockEndX = G.cityW + 4000;
      g.beginFill(0x2d1a11); 
      g.drawRect(tunnelEndX, gy + 70, rockEndX - tunnelEndX, 200); 
      g.endFill();

      let rockSeed = 99;
      const rRand = () => { rockSeed = (rockSeed * 16807) % 2147483647; return (rockSeed - 1) / 2147483646; };
      for (let rx = tunnelEndX; rx < rockEndX; rx += 12) {
          for (let ry = gy + 70; ry < gy + 270; ry += 12) {
              if (rRand() > 0.4) {
                  g.beginFill(rRand() > 0.5 ? 0x3d261a : 0x1f100a, 0.8);
                  g.drawRect(rx + rRand() * 8, ry + rRand() * 8, 2 + rRand() * 4, 2 + rRand() * 3);
                  g.endFill();
              }
              if (rRand() > 0.96) {
                  g.beginFill(rRand() > 0.5 ? 0xb45309 : 0xfacc15, 0.6);
                  g.drawRect(rx + rRand() * 10, ry + rRand() * 10, 1 + rRand() * 2, 1);
                  g.endFill();
              }
          }
      }

      // Metro tunnel, water, sewer — city zones only
      drawCityH(gy + 180, 30, 0x1a202c);
      drawCityH(gy + 185, 20, 0x0f172a);
      drawCityH(gy + 220, 8, 0x0369a1);
      drawCityH(gy + 222, 4, 0x0284c7);
      drawCityH(gy + 235, 12, 0xb45309);
      drawCityH(gy + 237, 8, 0xd97706);

      // Junction boxes — skip desert
      for(let px = -500; px < G.cityW + 500; px += 200) {
          if (inSpecialZone(px)) continue;
          g.beginFill(0x334155); g.drawRect(px, gy + 175, 15, 40); g.endFill(); 
          g.beginFill(0x0ea5e9); g.drawRect(px + 50, gy + 218, 10, 12); g.endFill(); 
          g.beginFill(0xf59e0b); g.drawRect(px + 100, gy + 233, 10, 16); g.endFill(); 
      }
      
      // ─── PORT ZONE: Deep ocean cover (drawn AFTER all underground to cover any leftover textures) ───
      if (hasPortZone) {
          const pw = portEndX - portStartX;
          // Solid deep ocean covers entire underground area
          g.beginFill(0x061220); g.drawRect(portStartX - 20, gy + 32, pw + 40, 250); g.endFill();
          // Water gradient layers
          g.beginFill(0x081830, 0.8); g.drawRect(portStartX - 20, gy + 32, pw + 40, 40); g.endFill();
          g.beginFill(0x0a2040, 0.5); g.drawRect(portStartX - 20, gy + 70, pw + 40, 30); g.endFill();
          // Sandy ocean floor
          g.beginFill(0x2a2218); g.drawRect(portStartX - 20, gy + 230, pw + 40, 20); g.endFill();
          g.beginFill(0x3a3228, 0.5); g.drawRect(portStartX - 20, gy + 225, pw + 40, 8); g.endFill();
          // Coral reef patches
          let coralSeed = 77;
          const cr = () => { coralSeed = (coralSeed * 16807) % 2147483647; return (coralSeed - 1) / 2147483646; };
          const coralCols = [0xff6b6b, 0xff9a76, 0xffd166, 0xa8e6cf, 0xf4845f, 0xf78ca0, 0x7ec8e3, 0xc5a3ff];
          for (let cx = portStartX + 20; cx < portEndX - 20; cx += 30 + cr() * 40) {
              const cc = coralCols[Math.floor(cr() * coralCols.length)];
              const ch = 8 + cr() * 18;
              const cw = 6 + cr() * 12;
              const cy = gy + 210 - ch;
              // Coral branches
              g.beginFill(cc, 0.5 + cr() * 0.3);
              if (cr() > 0.5) {
                  // Fan coral
                  g.drawEllipse(cx, cy + ch/2, cw, ch/2);
              } else {
                  // Branch coral
                  g.drawRect(cx, cy, cw * 0.3, ch);
                  g.drawRect(cx - cw * 0.3, cy + ch * 0.3, cw * 0.7, ch * 0.15);
                  g.drawRect(cx + cw * 0.2, cy + ch * 0.5, cw * 0.6, ch * 0.12);
              }
              g.endFill();
          }
          // (Fish schools and algae are animated in port_env.js)
          // Air bubbles
          for (let bi = 0; bi < 12; bi++) {
              const bx = portStartX + 30 + cr() * (pw - 60);
              const by = gy + 50 + cr() * 150;
              g.beginFill(0x88ccff, 0.15 + cr() * 0.15);
              g.drawCircle(bx, by, 1 + cr() * 3);
              g.endFill();
          }
          // Light rays from surface
          for (let ri = 0; ri < 4; ri++) {
              const rx = portStartX + 60 + ri * (pw / 4);
              g.beginFill(0x4488cc, 0.03);
              g.moveTo(rx, gy + 32); g.lineTo(rx - 20, gy + 200); g.lineTo(rx + 20, gy + 200);
              g.closePath(); g.endFill();
          }
      }

      // ─── BACKBONE ZONE: Dense underground fiber nexus ───
      if (hasBackboneZone) {
          const bkw = backboneEndX - backboneStartX;
          // Dark fiber infrastructure underground (extend +/-2px so it overlaps neighboring city cable tray seamlessly)
          g.beginFill(0x060a14); g.drawRect(backboneStartX - 2, gy + 32, bkw + 4, 38); g.endFill();
          // Dense fiber trunk (the main nexus where all cables converge) — extend edge-to-edge with slight overlap
          // so cables meet main city cables (same Y positions, same colors) without any visible gap.
          for (let fi = 0; fi < 10; fi++) {
              const fy = gy + 35 + fi * 3;
              const col = cableCols[fi % cableCols.length];
              g.beginFill(col, 0.35 + this._labNoise(fi + 501) * 0.25);
              g.drawRect(backboneStartX - 2, fy, bkw + 4, 2);
              g.endFill();
          }
          // Cable node dots (junction points)
          for (let ni = 0; ni < 30; ni++) {
              const nx = backboneStartX + 20 + this._labNoise(ni * 4 + 501) * (bkw - 40);
              const ny = gy + 36 + this._labNoise(ni * 4 + 502) * 28;
              g.beginFill(cableCols[Math.floor(this._labNoise(ni * 4 + 503) * cableCols.length)], 0.5);
              g.drawCircle(nx, ny, 1.5 + this._labNoise(ni * 4 + 504) * 2);
              g.endFill();
          }
          // Vertical risers from buildings down to fiber trunk
          const bkBlds = BLDS.filter(b => b.id.startsWith('backbone_'));
          bkBlds.forEach(bb => {
              const cx = bb.x + bb.w / 2;
              // Main riser conduit
              g.beginFill(0x1a2540); g.drawRect(cx - 4, gy + 32, 8, 20); g.endFill();
              // Fiber glow inside riser
              g.beginFill(0x22d3ee, 0.2); g.drawRect(cx - 2, gy + 34, 4, 16); g.endFill();
              // Junction box at top
              g.beginFill(0x1a2a40); g.drawRect(cx - 6, gy + 30, 12, 5); g.endFill();
              g.beginFill(0x22d3ee, 0.4); g.drawCircle(cx - 2, gy + 32, 1.2); g.endFill();
              g.beginFill(0x4ade80, 0.4); g.drawCircle(cx + 2, gy + 32, 1.2); g.endFill();
          });
          // Slim dark band just below the tunnel cavity (tunnel is gy+70..gy+170).
          // Below that we let the city-wide deep-earth + soil + water + sewer layers
          // (drawn earlier via drawCityH at line 321/354-359) show through naturally,
          // so water and sewage pipes connect to their counterparts on the other side.
          g.beginFill(0x0a0f1a); g.drawRect(backboneStartX, gy + 170, bkw, 10); g.endFill();
          // Thin fiber conduit accents in the deep-soil band (above water pipe at gy+220)
          for (let di = 0; di < 3; di++) {
              const dy = gy + 192 + di * 8;
              const col = cableCols[di % cableCols.length];
              g.beginFill(col, 0.18); g.drawRect(backboneStartX, dy, bkw, 1); g.endFill();
          }
          // Junction box + risers where Backbone joins the city utility trunks
          // (normal city junction boxes skip this zone via inSpecialZone)
          for (let jx = backboneStartX + 40; jx < backboneEndX; jx += 180) {
              g.beginFill(0x334155); g.drawRect(jx, gy + 175, 12, 40); g.endFill();
              g.beginFill(0x22d3ee, 0.5); g.drawCircle(jx + 6, gy + 178, 1.5); g.endFill();
              g.beginFill(0x0ea5e9); g.drawRect(jx + 50, gy + 218, 8, 12); g.endFill();
              g.beginFill(0xf59e0b); g.drawRect(jx + 100, gy + 233, 8, 16); g.endFill();
          }
      }

      // ─── AGENT DISTRICT: Underground data mesh ───
      if (hasAgentsZone) {
          const agw = agentsEndX - agentsStartX;
          // Dark data infrastructure underground (extend +/-2px for seamless overlap with neighboring cable tray)
          g.beginFill(0x06040e); g.drawRect(agentsStartX - 2, gy + 32, agw + 4, 38); g.endFill();
          // Agent communication bus lines (rose/purple tinted) — 10 rows at main-city Y positions so they line up
          // across zone boundaries; extend edge-to-edge with slight overlap so there's no visible gap.
          const agentCols = [0xf43f5e, 0xa855f7, 0xfbbf24, 0x4ade80, 0x22d3ee, 0x8b5cf6];
          for (let fi = 0; fi < 10; fi++) {
              const fy = gy + 35 + fi * 3;
              const col = agentCols[fi % agentCols.length];
              g.beginFill(col, 0.30 + this._labNoise(fi + 901) * 0.2);
              g.drawRect(agentsStartX - 2, fy, agw + 4, 2);
              g.endFill();
          }
          // Node junction dots (agent endpoints)
          for (let ni = 0; ni < 20; ni++) {
              const nx = agentsStartX + 20 + this._labNoise(ni * 4 + 901) * (agw - 40);
              const ny = gy + 36 + this._labNoise(ni * 4 + 902) * 28;
              g.beginFill(agentCols[Math.floor(this._labNoise(ni * 4 + 903) * agentCols.length)], 0.4);
              g.drawCircle(nx, ny, 1.5 + this._labNoise(ni * 4 + 904) * 1.5);
              g.endFill();
          }
          // Vertical risers from buildings
          const agBlds = BLDS.filter(b => b.id.startsWith('agents_'));
          agBlds.forEach(ab => {
              const cx = ab.x + ab.w / 2;
              g.beginFill(0x1a1530); g.drawRect(cx - 4, gy + 32, 8, 20); g.endFill();
              g.beginFill(0xf43f5e, 0.15); g.drawRect(cx - 2, gy + 34, 4, 16); g.endFill();
              g.beginFill(0x1a1530); g.drawRect(cx - 6, gy + 30, 12, 5); g.endFill();
              g.beginFill(0xf43f5e, 0.4); g.drawCircle(cx - 2, gy + 32, 1.2); g.endFill();
              g.beginFill(0xa855f7, 0.4); g.drawCircle(cx + 2, gy + 32, 1.2); g.endFill();
          });
          g.beginFill(0x06040e); g.drawRect(agentsStartX, gy + 170, agw, 10); g.endFill();
          for (let di = 0; di < 3; di++) {
              const dy = gy + 192 + di * 8;
              const col = agentCols[di % agentCols.length];
              g.beginFill(col, 0.12); g.drawRect(agentsStartX, dy, agw, 1); g.endFill();
          }
      }

      // ─── POWER ZONE: Underground overpaint (drawn AFTER all city infrastructure) ───
      if (hasPowerZone) {
          const ppw = G.cityW + 200 - powerStartX;

          // ─── Terminal boxes where data cables meet the power zone boundary ───
          const termX = powerStartX - 8;
          const termW = 16, termH = 36;
          // Main terminal enclosure (dark steel box)
          g.beginFill(0x1a1a2a); g.drawRect(termX, gy + 33, termW, termH); g.endFill();
          g.beginFill(0x252540); g.drawRect(termX + 1, gy + 34, termW - 2, 2); g.endFill(); // top edge highlight
          g.beginFill(0x101020); g.drawRect(termX + 1, gy + 33 + termH - 2, termW - 2, 2); g.endFill(); // bottom edge
          // Vertical divider lines (panel look)
          g.beginFill(0x0a0a18); g.drawRect(termX + 5, gy + 36, 1, termH - 6); g.endFill();
          g.beginFill(0x0a0a18); g.drawRect(termX + 10, gy + 36, 1, termH - 6); g.endFill();
          // Status LEDs on terminal
          const ledCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
          for (let li = 0; li < 6; li++) {
              g.beginFill(ledCols[li], 0.8); g.drawCircle(termX + 3 + (li % 3) * 5, gy + 40 + Math.floor(li / 3) * 8, 1.2); g.endFill();
          }
          // Cable entry points (small colored stubs entering the box from the left)
          for (let si = 0; si < 5; si++) {
              const sc = ledCols[si % ledCols.length];
              g.beginFill(sc, 0.4); g.drawRect(termX - 6, gy + 37 + si * 6, 8, 2); g.endFill();
          }
          // Mounting bolts
          g.beginFill(0x444460); g.drawCircle(termX + 2, gy + 34, 1.5); g.endFill();
          g.beginFill(0x444460); g.drawCircle(termX + termW - 2, gy + 34, 1.5); g.endFill();
          g.beginFill(0x444460); g.drawCircle(termX + 2, gy + 33 + termH - 1, 1.5); g.endFill();
          g.beginFill(0x444460); g.drawCircle(termX + termW - 2, gy + 33 + termH - 1, 1.5); g.endFill();
          // "JUNCTION" label (tiny)
          // Ground-level terminal cap (visible on the road surface)
          g.beginFill(0x2a2a3a); g.drawRect(termX - 2, gy + 30, termW + 4, 4); g.endFill();
          g.beginFill(0xfbbf24, 0.3); g.drawRect(termX, gy + 30, termW, 1); g.endFill(); // caution stripe

          // Solid fill covers metro tunnel, data cables, everything
          g.beginFill(0x0a0a0f); g.drawRect(powerStartX, gy + 32, ppw, 38); g.endFill();
          g.beginFill(0x2d1a11); g.drawRect(powerStartX, gy + 70, ppw, 200); g.endFill();
          // Rock texture
          let prs = 77;
          const prr = () => { prs = (prs * 16807) % 2147483647; return (prs - 1) / 2147483646; };
          for (let rx = powerStartX; rx < powerStartX + ppw; rx += 14) {
              for (let ry = gy + 70; ry < gy + 270; ry += 14) {
                  if (prr() > 0.5) { g.beginFill(prr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7); g.drawRect(rx+prr()*8, ry+prr()*8, 2+prr()*3, 2+prr()*2); g.endFill(); }
              }
          }
          // Water trunk (blue at gy+220 — matches city)
          g.beginFill(0x0369a1); g.drawRect(powerStartX, gy + 220, ppw, 8); g.endFill();
          g.beginFill(0x0284c7); g.drawRect(powerStartX, gy + 222, ppw, 4); g.endFill();
          // Power trunk (orange at gy+235 — matches city)
          g.beginFill(0xb45309); g.drawRect(powerStartX, gy + 235, ppw, 12); g.endFill();
          g.beginFill(0xd97706); g.drawRect(powerStartX, gy + 237, ppw, 8); g.endFill();
          // Vertical risers
          const pwrBlds = BLDS.filter(b => b.id.startsWith('power_'));
          pwrBlds.forEach(pb => {
              const cx = pb.x + pb.w / 2;
              // Water riser (blue, from gy+32 down to water trunk at gy+220)
              g.beginFill(0x0284c7, 0.4); g.drawRect(cx - 2, gy + 32, 3, 188); g.endFill();
              g.beginFill(0x0369a1, 0.6); g.drawRect(cx - 4, gy + 218, 7, 5); g.endFill();
              // Power riser (orange, from gy+32 down to power trunk at gy+235)
              g.beginFill(0xd97706, 0.5); g.drawRect(cx + 10, gy + 32, 4, 203); g.endFill();
              g.beginFill(0xb45309, 0.7); g.drawRect(cx + 8, gy + 233, 8, 6); g.endFill();
              g.beginFill(0xfbbf24, 0.5); g.drawCircle(cx + 12, gy + 236, 3); g.endFill();
          });
      }
  
      let wildStart = 1500;
      let wildEnd = 3400;

      if (window.BLDS) {
          let maxResX = 0;
          window.BLDS.forEach(b => {
              if (b.id.startsWith('res_') || b.id === 'metro_res') {
                  if (b.x + b.w > maxResX) maxResX = b.x + b.w;
              }
          });

          let minTechX = Infinity;
          window.BLDS.forEach(b => {
              const isSpace = b.id.startsWith('pad_') || b.id === 'mission_control' || b.id === 'space_assembly' || b.id === 'tracking_station' || b.id === 'forest_space';
              if (!b.id.startsWith('res_') && b.id !== 'metro_res' && b.id !== 'forest_0' && b.id !== 'forest_1' && !b.id.startsWith('house_') && b.id !== 'metro_east' && !isSpace) {
                  if (b.x < minTechX) minTechX = b.x;
              }
          });

          if (maxResX > 0) wildStart = maxResX;
          if (minTechX !== Infinity) wildEnd = minTechX;
      }

      const blocked = [];
      if (window.BLDS) {
          window.BLDS.forEach(b => { blocked.push({ l: b.x + 5, r: b.x + b.w - 5 }); });
      }
      const isClear = (x) => !blocked.some(z => x > z.l && x < z.r);
      let seed = 42;
      const sr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      
      for (let tx = 20; tx < G.cityW; tx += 45) {
        seed = tx * 7 + 13;
        if (!isClear(tx)) { tx += 20; continue; }
        if (inSpecialZone(tx)) continue; // Skip desert zone — SpaceEnvironment draws its own scenery
        
        const isWilderness = tx > wildStart && tx < wildEnd;
        const sz = isWilderness ? (8 + sr() * 10) : (5 + sr() * 4);
        
        g.beginFill(0x000000, 0.06);
        g.drawEllipse(tx, gy - 18, sz + 4, 3); g.endFill();
        
        if (isWilderness && sr() > 0.2) {
            g.beginFill(0x4a2e1a); g.drawRect(tx - 2, gy - 24 - sz * 1.5, 4, sz * 1.5 + 6); g.endFill();
            const cy = gy - 24 - sz * 1.5;
            g.beginFill(0x1b4332);
            g.drawPolygon([tx, cy - sz*2.5, tx - sz*1.2, cy + sz, tx + sz*1.2, cy + sz]);
            g.beginFill(0x2d6a4f);
            g.drawPolygon([tx, cy - sz*3.5, tx - sz*1.0, cy, tx + sz*1.0, cy]);
            g.beginFill(0x4ade80, 0.1);
            g.drawPolygon([tx, cy - sz*3.5, tx, cy + sz, tx + sz*1.2, cy + sz]);
            g.endFill();
        } else if (tx < wildStart && !isWilderness) {
            const cy = gy - 24 - sz * 1.5;
            if (tx < 450) { 
                g.beginFill(0x1b4332);
                g.drawPolygon([tx, cy - sz*2.5, tx - sz*1.2, cy + sz, tx + sz*1.2, cy + sz]);
                g.beginFill(0x2d6a4f);
                g.drawPolygon([tx, cy - sz*3.5, tx - sz*1.0, cy, tx + sz*1.0, cy]);
                g.endFill();
            } else if (tx >= 450 && tx < 800) {
                g.beginFill(0x3d2914); g.drawRect(tx-2, cy, 4, sz*1.5); g.endFill(); 
                g.beginFill(0xffb7c5); g.drawCircle(tx, cy - sz, sz*1.2); 
                g.drawCircle(tx - sz*0.8, cy - sz*0.5, sz); g.drawCircle(tx + sz*0.8, cy - sz*0.5, sz);
                g.endFill();
                g.beginFill(0xff99a8, 0.5); g.drawCircle(tx, cy - sz, sz*0.8); g.endFill();
            } else {
                g.beginFill(0x3d2914); g.drawRect(tx-2, cy, 4, sz*1.5); g.endFill(); 
                g.beginFill(0x2d6a4f); g.drawCircle(tx, cy - sz, sz*1.3); g.endFill();
                g.beginFill(0x1b4332); g.drawCircle(tx - sz*0.5, cy - sz*0.2, sz*0.8); g.endFill();
            }
        } else {
            g.beginFill(0x4a2e1a); g.drawRect(tx - 2, gy - 24 - sz * 1.5, 4, sz * 1.5 + 6); g.endFill();
            const cy = gy - 26 - sz * 1.8;
            g.beginFill(0x1b4332); g.drawEllipse(tx - 3, cy + 2, sz + 1, sz - 1); g.endFill();
            g.beginFill(0x2d6a4f); g.drawEllipse(tx + 2, cy - 1, sz, sz + 1); g.endFill();
            g.beginFill(0x3d8a5f); g.drawEllipse(tx - 1, cy - 2, sz - 1, sz - 2); g.endFill();
            g.beginFill(0x4ade80, 0.12); g.drawCircle(tx - 2, cy - 3, 1.5); g.drawCircle(tx + 3, cy - 1, 1); g.endFill();
        }
      }
      
      for (let lx = 45; lx < G.cityW; lx += 95) {
        seed = lx * 3 + 7;
        if (!isClear(lx)) { lx += 35; continue; }
        
        if (lx > wildStart && lx < wildEnd) continue; 

        const isRight = (lx % 2 === 0);
        g.beginFill(0x444444); g.drawRect(lx - 3, gy - 24, 6, 3); g.endFill();
        g.beginFill(0x444444); g.drawRect(lx - 1.5, gy - 58, 3, 34); g.endFill();
        g.beginFill(0x505050); g.drawRect(lx - 1, gy - 58, 2, 34); g.endFill();
        if (isRight) {
            g.beginFill(0x555555);
            g.drawRect(lx - 1, gy - 60, 8, 2); g.endFill();
            g.beginFill(0x606060); g.drawRect(lx + 4, gy - 62, 6, 4); g.endFill();
            g.beginFill(0xffeaa7, 0.9); g.drawRect(lx + 5, gy - 59, 4, 3); g.endFill();
        } else {
            g.beginFill(0x555555);
            g.drawRect(lx - 7, gy - 60, 8, 2); g.endFill();
            g.beginFill(0x606060); g.drawRect(lx - 10, gy - 62, 6, 4); g.endFill();
            g.beginFill(0xffeaa7, 0.9); g.drawRect(lx - 9, gy - 59, 4, 3); g.endFill();
        }
      }

      // ─── CITY-WIDE POWER LINE POLES ───
      const poleBlocked = [];
      if (window.BLDS) BLDS.forEach(b => { poleBlocked.push({ l: b.x - 35, r: b.x + b.w + 35 }); });
      const forestBlds = BLDS ? BLDS.filter(b => b.id === 'forest_0' || b.id === 'forest_1' || b.id === 'forest_space') : [];
      forestBlds.forEach(f => { poleBlocked.push({ l: f.x - 40, r: f.x + f.w + 40 }); });
      if (hasPortZone) poleBlocked.push({ l: portStartX - 20, r: portEndX + 20 });
      if (hasSpaceZone) poleBlocked.push({ l: spaceStartX - 20, r: spaceEndX + 20 });
      const poleClear = (x) => !poleBlocked.some(z => x > z.l && x < z.r);
      const polePositions = [];
      const poleStart = hasSpaceZone ? spaceEndX + 100 : (hasPortZone ? portEndX + 100 : 200);
      const poleEnd = hasPowerZone ? powerEndX : G.cityW;
      for (let px = poleStart; px < poleEnd; px += 120) {
          if (!poleClear(px)) continue;
          polePositions.push(px);
          g.beginFill(0x5a4a3a); g.drawRect(px - 2, gy - 58, 4, 34); g.endFill();
          g.beginFill(0x6a5a4a); g.drawRect(px - 1, gy - 58, 2, 34); g.endFill();
          g.beginFill(0x5a4a3a); g.drawRect(px - 10, gy - 56, 20, 2); g.endFill();
          g.beginFill(0xd1d5db); g.drawRect(px - 9, gy - 58, 2, 3); g.drawRect(px + 7, gy - 58, 2, 3); g.endFill();
          g.beginFill(0x5a4a3a); g.drawRect(px - 7, gy - 48, 14, 2); g.endFill();
          g.beginFill(0xd1d5db); g.drawRect(px - 6, gy - 50, 2, 3); g.drawRect(px + 4, gy - 50, 2, 3); g.endFill();
      }
      for (let i = 0; i < polePositions.length - 1; i++) {
          const x1 = polePositions[i], x2 = polePositions[i + 1];
          if (x2 - x1 > 400) continue;
          g.lineStyle(1, 0x4b5563, 0.35);
          const sagT = Math.min(6, (x2 - x1) * 0.02);
          g.moveTo(x1 + 8, gy - 55); g.quadraticCurveTo((x1+x2)/2, gy - 55 + sagT, x2 - 8, gy - 55);
          g.moveTo(x1 - 8, gy - 55); g.quadraticCurveTo((x1+x2)/2, gy - 54 + sagT, x2 + 8, gy - 55);
          const sagB = Math.min(5, (x2 - x1) * 0.018);
          g.moveTo(x1 + 5, gy - 47); g.quadraticCurveTo((x1+x2)/2, gy - 47 + sagB, x2 - 5, gy - 47);
          g.moveTo(x1 - 5, gy - 47); g.quadraticCurveTo((x1+x2)/2, gy - 46 + sagB, x2 + 5, gy - 47);
          g.lineStyle(0);
      }
    },

    buildDataPulses() {
        // Animated fiber pulse blips traveling along the city data cables
        this.dataPulses.forEach(p => { if (p && !p.destroyed) p.destroy(); });
        this.dataPulses = [];
        const gy = G.groundY;
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
        const parent = this.groundGfx.parent;
        if (!parent) return;

        // Determine cable zone bounds (same logic as buildGround)
        const hasPowerZone = typeof PowerZone !== 'undefined' && PowerZone.zoneStartX;
        const hasPortZone = typeof PortZone !== 'undefined' && PortZone.zoneStartX;
        const hasSpaceZone = typeof SpaceEnvironment !== 'undefined' && SpaceEnvironment.zoneStartX;
        let startX = -2000;
        if (hasPortZone) startX = Math.max(startX, PortZone.zoneEndX || PortZone.zoneStartX + 800);
        if (hasSpaceZone) startX = Math.max(startX, SpaceEnvironment.zoneEndX || SpaceEnvironment.zoneStartX + 800);
        const endX = hasPowerZone ? PowerZone.zoneStartX : G.cityW + 2000;

        for (let i = 0; i < 30; i++) {
            const p = new PIXI.Graphics();
            const col = cableCols[i % cableCols.length];
            p.beginFill(col, 0.7 + Math.random() * 0.3);
            p.drawCircle(0, 0, 1.2 + Math.random() * 1.2);
            p.endFill();
            p.x = startX + Math.random() * (endX - startX);
            p.y = gy + 38 + Math.random() * 25;
            p._speed = (1.5 + Math.random() * 2.5) * (Math.random() > 0.5 ? 1 : -1);
            p._baseY = p.y;
            p._startX = startX;
            p._endX = endX;
            parent.addChild(p);
            this.dataPulses.push(p);
        }
    },

    buildClouds() {
      this.cloudLayer.removeChildren();
      const numClouds = Math.ceil(G.cityW / 150) + 5;
      for (let i = 0; i < numClouds; i++) {
        const c = new PIXI.Graphics();
        const w = 40 + (i % 7) * 12;
        const h = 8 + (i % 4) * 3;
        c.beginFill(0xffffff);
        c.drawEllipse(0, 0, w / 2, h);
        c.drawEllipse(-w / 3, -h * 0.4, w / 3, h * 0.7);
        c.drawEllipse(w / 3, -h * 0.3, w / 3.5, h * 0.6);
        if (w > 55) c.drawEllipse(w / 6, -h * 0.5, w / 4, h * 0.5);
        c.endFill();
        c._bx = i * 150 + this._labNoise(i * 3 + 1) * 100 - 50;
        // Spread clouds between just above buildings and mid-sky (visible range)
        c.y = G.groundY - 100 - (i % 6) * 22 - this._labNoise(i * 3 + 2) * 50;
        c.alpha = 0.10 + this._labNoise(i * 3 + 3) * 0.06;
        c._i = i;
        c._w = w;   // half-span used to size this cloud's ground shadow
        c._drift = 0.002 + this._labNoise(i * 3 + 4) * 0.003;
        this.cloudLayer.addChild(c);
      }
    },

    /* Compute a visual fingerprint for the current building state.
       If nothing visual changed, buildBuildings() can skip the full rebuild. */
    _buildFingerprint() {
        if (!window.BLDS) return '';
        let fp = BLDS.length + ':' + (G.models ? G.models.length : 0) + ':';
        for (let i = 0; i < BLDS.length; i++) {
            const b = BLDS[i];
            fp += (b.dynamicFl || b.fl || 0);
            if (b.isTopLab) fp += 'T';
            if (b.isCheapest) fp += 'C';
            if (b.dcData) fp += (b.dcData.status || '').charAt(0);
            fp += ',';
        }
        return fp;
    },

    // Per-firm geometric rooftop emblem for VC Row towers (drawn into cached gfx).
    _drawVCEmblem(gfx, b, cx, cy, bc) {
        switch (b.id) {
            case 'vcrow_horizon': // Sequoia — a redwood tree
                gfx.beginFill(0x5a3a22); gfx.drawRect(cx - 1.5, cy - 2, 3, 10); gfx.endFill();
                gfx.beginFill(bc);
                gfx.drawPolygon([cx - 8, cy + 2, cx, cy - 8, cx + 8, cy + 2]);
                gfx.drawPolygon([cx - 6, cy - 2, cx, cy - 11, cx + 6, cy - 2]);
                gfx.drawPolygon([cx - 4, cy - 6, cx, cy - 13, cx + 4, cy - 6]);
                gfx.endFill();
                break;
            case 'vcrow_titan': // SoftBank — the twin silver bars ("=")
                gfx.beginFill(bc); gfx.drawRoundedRect(cx - 12, cy - 4, 24, 3, 1.5); gfx.drawRoundedRect(cx - 12, cy + 2, 24, 3, 1.5); gfx.endFill();
                gfx.beginFill(0xffffff, 0.4); gfx.drawRect(cx - 12, cy - 4, 24, 1); gfx.endFill();
                break;
            case 'vcrow_mgx': // MGX — a gold diamond
                gfx.beginFill(bc); gfx.drawPolygon([cx, cy - 10, cx + 8, cy, cx, cy + 10, cx - 8, cy]); gfx.endFill();
                gfx.beginFill(0xffffff, 0.35); gfx.drawPolygon([cx, cy - 10, cx + 8, cy, cx, cy]); gfx.endFill();
                break;
            case 'vcrow_thrive': // Thrive — an upward growth chevron
                gfx.lineStyle(3, bc, 1);
                gfx.moveTo(cx - 9, cy + 5); gfx.lineTo(cx - 2, cy - 4); gfx.lineTo(cx + 3, cy + 1); gfx.lineTo(cx + 10, cy - 7);
                gfx.lineStyle(0);
                gfx.beginFill(bc); gfx.drawPolygon([cx + 10, cy - 7, cx + 4, cy - 7, cx + 10, cy - 1]); gfx.endFill();
                break;
            case 'vcrow_foundersfund': // Founders Fund — a rising rocket arrow
                gfx.beginFill(bc);
                gfx.drawPolygon([cx, cy - 10, cx + 4, cy + 2, cx, cy - 1, cx - 4, cy + 2]);
                gfx.endFill();
                gfx.beginFill(0xef4444, 0.9); gfx.drawPolygon([cx, cy + 1, cx + 2, cy + 7, cx - 2, cy + 7]); gfx.endFill();
                break;
            case 'vcrow_launchpad': // Y Combinator — the orange square with a Y
                gfx.beginFill(bc); gfx.drawRoundedRect(cx - 9, cy - 9, 18, 18, 3); gfx.endFill();
                gfx.lineStyle(2, 0xffffff, 0.95);
                gfx.moveTo(cx - 4, cy - 4); gfx.lineTo(cx, cy + 1);
                gfx.moveTo(cx + 4, cy - 4); gfx.lineTo(cx, cy + 1);
                gfx.moveTo(cx, cy + 1); gfx.lineTo(cx, cy + 5);
                gfx.lineStyle(0);
                break;
            case 'vcrow_apex': // a16z — bold monogram bar
                gfx.beginFill(bc); gfx.drawRoundedRect(cx - 12, cy - 6, 24, 12, 2); gfx.endFill();
                gfx.beginFill(0x0c1420);
                gfx.drawRect(cx - 8, cy - 2, 3, 5); gfx.drawRect(cx - 1, cy - 2, 3, 5); gfx.drawRect(cx + 6, cy - 2, 3, 5);
                gfx.endFill();
                break;
            default: // Exchange / Cryptex etc. — a simple market spark
                gfx.beginFill(bc); gfx.drawCircle(cx, cy, 4); gfx.endFill();
                gfx.beginFill(0xffffff, 0.4); gfx.drawCircle(cx - 1, cy - 1, 1.5); gfx.endFill();
        }
    },

    // ─── LAB HQ ARCHITECTURAL DNA ───
    // Labs are dynamic (live scanner adds new ones), so facades are procedural-by-identity:
    // a deterministic hash of the lab id picks one of six architectural styles, weighted by
    // region. Famous labs get a fixed iconic style; brand-new labs style themselves forever.
    _labHash(labId) {
        let hsh = 0;
        const s = String(labId || 'lab');
        for (let i = 0; i < s.length; i++) hsh = ((hsh << 5) - hsh + s.charCodeAt(i)) | 0;
        return Math.abs(hsh);
    },

    _labStyleFor(labId, lab) {
        // Iconic fixed assignments for the famous few (stable brand identity)
        const FIXED = {
            openai: 'monolith', anthropic: 'campus', google: 'campus', meta: 'monolith',
            xai: 'brutalist', microsoft: 'setback', deepseek: 'pagoda', mistral: 'euro',
            nvidia: 'monolith', amazon: 'setback', ibm: 'setback', apple: 'monolith'
        };
        if (FIXED[labId]) return FIXED[labId];
        const hsh = this._labHash(labId);
        const region = (lab && lab.region) || 'us';
        if (region === 'cn') return ['pagoda', 'monolith', 'setback'][hsh % 3];
        if (region === 'eu' || region === 'uk' || region === 'fr') return ['euro', 'setback', 'monolith'][hsh % 3];
        return ['monolith', 'setback', 'campus', 'brutalist'][hsh % 4];
    },

    // Deterministic 0..1 noise — stable per (lab, pane) so windows stop reshuffling
    // on every rebuild the way Math.random() did.
    _labNoise(seed) {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    },

    // Geometric brand emblem for famous labs (drawn into cached gfx — no PIXI.Text).
    // Unknown labs simply get no emblem, so newly-scanned labs never break.
    // `s` scales the mark (plaques call with ~1.5 so emblems read when zoomed out).
    _drawLabEmblem(gfx, labId, cx, cy, colHex, s = 1) {
        switch (labId) {
            case 'openai': // hexagonal knot approximation
                gfx.lineStyle(1.6 * s, 0xffffff, 0.95);
                for (let i = 0; i < 6; i++) {
                    const a1 = i * Math.PI / 3 - Math.PI / 6, a2 = a1 + Math.PI / 3;
                    gfx.moveTo(cx + Math.cos(a1) * 6 * s, cy + Math.sin(a1) * 6 * s);
                    gfx.lineTo(cx + Math.cos(a2) * 6 * s, cy + Math.sin(a2) * 6 * s);
                }
                for (let i = 0; i < 3; i++) {
                    const a = i * Math.PI * 2 / 3 + Math.PI / 6;
                    gfx.moveTo(cx + Math.cos(a) * 6 * s, cy + Math.sin(a) * 6 * s);
                    gfx.lineTo(cx - Math.cos(a) * 3 * s, cy - Math.sin(a) * 3 * s);
                }
                gfx.lineStyle(0);
                break;
            case 'anthropic': // minimal geometric "A"
                gfx.beginFill(0xd97757);
                gfx.drawPolygon([cx - 6.5 * s, cy + 6 * s, cx - 1.8 * s, cy - 6 * s, cx + 1 * s, cy - 6 * s, cx - 3.6 * s, cy + 6 * s]);
                gfx.drawPolygon([cx + 6.5 * s, cy + 6 * s, cx + 1.8 * s, cy - 6 * s, cx - 1 * s, cy - 6 * s, cx + 3.6 * s, cy + 6 * s]);
                gfx.endFill();
                gfx.beginFill(0xd97757); gfx.drawRect(cx - 2.6 * s, cy + 0.5 * s, 5.2 * s, 2.2 * s); gfx.endFill();
                break;
            case 'google': // four dots
                [[0x4285f4, -6.5], [0xea4335, -2.2], [0xfbbc05, 2.2], [0x34a853, 6.5]].forEach(([c, ox]) => {
                    gfx.beginFill(c); gfx.drawCircle(cx + ox * s, cy, 1.9 * s); gfx.endFill();
                });
                break;
            case 'meta': // infinity loop
                gfx.lineStyle(2 * s, 0x0866ff, 0.95);
                gfx.drawEllipse(cx - 3.2 * s, cy, 3.4 * s, 4.6 * s);
                gfx.drawEllipse(cx + 3.2 * s, cy, 3.4 * s, 4.6 * s);
                gfx.lineStyle(0);
                break;
            case 'xai': // bold X
                gfx.beginFill(0xffffff, 0.95);
                gfx.drawPolygon([cx - 6 * s, cy - 6 * s, cx - 3.4 * s, cy - 6 * s, cx + 6 * s, cy + 6 * s, cx + 3.4 * s, cy + 6 * s]);
                gfx.drawPolygon([cx + 6 * s, cy - 6 * s, cx + 3.4 * s, cy - 6 * s, cx - 6 * s, cy + 6 * s, cx - 3.4 * s, cy + 6 * s]);
                gfx.endFill();
                break;
            case 'microsoft': // 2×2 squares
                gfx.beginFill(0xf25022); gfx.drawRect(cx - 6 * s, cy - 6 * s, 5.4 * s, 5.4 * s); gfx.endFill();
                gfx.beginFill(0x7fba00); gfx.drawRect(cx + 0.6 * s, cy - 6 * s, 5.4 * s, 5.4 * s); gfx.endFill();
                gfx.beginFill(0x00a4ef); gfx.drawRect(cx - 6 * s, cy + 0.6 * s, 5.4 * s, 5.4 * s); gfx.endFill();
                gfx.beginFill(0xffb900); gfx.drawRect(cx + 0.6 * s, cy + 0.6 * s, 5.4 * s, 5.4 * s); gfx.endFill();
                break;
            case 'deepseek': // whale swoosh
                gfx.beginFill(0x4d6bfe);
                gfx.drawEllipse(cx, cy + 1 * s, 6.5 * s, 3.6 * s);
                gfx.drawPolygon([cx + 5 * s, cy, cx + 9 * s, cy - 4 * s, cx + 8 * s, cy + 2 * s]);
                gfx.endFill();
                gfx.beginFill(0x0a1420); gfx.drawEllipse(cx - 1 * s, cy + 2.2 * s, 4.5 * s, 2 * s); gfx.endFill();
                break;
            case 'mistral': // stepped pixel-M in orange gradient
                [[0xffd800, 0], [0xffaf00, 1], [0xff8205, 2], [0xfa500f, 3]].forEach(([c, r]) => {
                    gfx.beginFill(c);
                    gfx.drawRect(cx - 7 * s, cy + (-6 + r * 3) * s, 3 * s, 3 * s);
                    gfx.drawRect(cx + 4 * s, cy + (-6 + r * 3) * s, 3 * s, 3 * s);
                    if (r === 1) gfx.drawRect(cx - 1.5 * s, cy - 3 * s, 3 * s, 3 * s);
                    gfx.endFill();
                });
                gfx.beginFill(0xfa500f); gfx.drawRect(cx - 7 * s, cy + 6 * s, 14 * s, 2 * s); gfx.endFill();
                break;
            case 'nvidia': { // eye swoosh
                gfx.lineStyle(2 * s, 0x76b900, 0.95);
                const nvA = Math.PI * 0.75;
                gfx.moveTo(cx + Math.cos(nvA) * 5.5 * s, cy + Math.sin(nvA) * 5.5 * s);
                gfx.arc(cx, cy, 5.5 * s, nvA, Math.PI * 2.05);
                gfx.lineStyle(0);
                gfx.beginFill(0x76b900); gfx.drawCircle(cx + 1 * s, cy, 2.2 * s); gfx.endFill();
                break;
            }
            case 'amazon': { // smile + arrow
                gfx.lineStyle(2 * s, 0xff9900, 0.95);
                const amA = Math.PI * 0.15;
                gfx.moveTo(cx + Math.cos(amA) * 6 * s, cy - 1.5 * s + Math.sin(amA) * 6 * s);
                gfx.arc(cx, cy - 1.5 * s, 6 * s, amA, Math.PI * 0.85);
                gfx.lineStyle(0);
                gfx.beginFill(0xff9900); gfx.drawPolygon([cx + 5.4 * s, cy + 2.4 * s, cx + 7.4 * s, cy + 4.6 * s, cx + 4.2 * s, cy + 4.4 * s]); gfx.endFill();
                break;
            }
            case 'ibm': // horizontal bars
                gfx.beginFill(0x0f62fe);
                for (let r = 0; r < 4; r++) gfx.drawRect(cx - 6.5 * s, cy + (-6 + r * 3.4) * s, 13 * s, 1.8 * s);
                gfx.endFill();
                break;
            default:
                // No emblem for unknown labs — the plaque shows the lab color chip instead.
                gfx.beginFill(colHex, 0.9); gfx.drawCircle(cx, cy, 3 * s); gfx.endFill();
                gfx.beginFill(0xffffff, 0.35); gfx.drawCircle(cx - 1 * s, cy - 1 * s, 1.2 * s); gfx.endFill();
        }
    },

    // Per-building rooftop emblem for Agent District (drawn into cached gfx).
    _drawAgentEmblem(gfx, b, cx, cy, ac) {
        switch (b.id) {
            case 'agents_orchestrator': // conductor node — hub with spokes
                gfx.lineStyle(1.5, ac, 0.9);
                for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; gfx.moveTo(cx, cy); gfx.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); }
                gfx.lineStyle(0);
                gfx.beginFill(ac); gfx.drawCircle(cx, cy, 3.5); gfx.endFill();
                for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; gfx.beginFill(ac, 0.8); gfx.drawCircle(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 1.8); gfx.endFill(); }
                break;
            case 'agents_toolshop': // puzzle piece
                gfx.beginFill(ac); gfx.drawRoundedRect(cx - 8, cy - 6, 16, 12, 2); gfx.endFill();
                gfx.beginFill(ac); gfx.drawCircle(cx + 8, cy, 3); gfx.endFill();
                gfx.beginFill(0x0c0a18); gfx.drawCircle(cx - 3, cy, 3); gfx.endFill();
                break;
            case 'agents_sandbox': // trophy / benchmark bars
                gfx.beginFill(ac);
                gfx.drawRect(cx - 9, cy + 4, 5, -6); gfx.drawRect(cx - 2, cy + 4, 5, -11); gfx.drawRect(cx + 5, cy + 4, 5, -8);
                gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawCircle(cx + 7.5, cy - 8, 1.6); gfx.endFill();
                break;
            case 'agents_deploy': // rocket
                gfx.beginFill(ac); gfx.drawPolygon([cx, cy - 9, cx + 4, cy + 3, cx, cy, cx - 4, cy + 3]); gfx.endFill();
                gfx.beginFill(0xef4444, 0.9); gfx.drawPolygon([cx, cy + 1, cx + 2, cy + 7, cx - 2, cy + 7]); gfx.endFill();
                break;
            case 'agents_memory': // brain / memory rings
                gfx.lineStyle(1.5, ac, 0.9); gfx.drawCircle(cx, cy, 8); gfx.drawCircle(cx, cy, 4.5); gfx.lineStyle(0);
                gfx.beginFill(ac); gfx.drawCircle(cx, cy, 2); gfx.endFill();
                break;
            default:
                gfx.beginFill(ac); gfx.drawCircle(cx, cy, 3.5); gfx.endFill();
        }
    },

    // Signature facade motif per Longevity building (drawn into cached gfx).
    _drawLongevityMotif(gfx, b, ac, h) {
        const cx = b.w / 2, cy = h * 0.42;
        // Dark medallion backing so the emblem reads over the window grid
        gfx.beginFill(0x060d14, 0.82); gfx.drawRoundedRect(cx - 22, cy - 20, 44, 40, 5); gfx.endFill();
        gfx.lineStyle(1, ac, 0.5); gfx.drawRoundedRect(cx - 22, cy - 20, 44, 40, 5); gfx.lineStyle(0);
        switch (b.id) {
            case 'longevity_protein': { // AlphaFold ribbon — folded chain of nodes
                gfx.lineStyle(2, ac, 0.9);
                for (let i = 0; i < 7; i++) {
                    const nx = cx - 15 + i * 5, ny = cy + Math.sin(i * 1.1) * 11;
                    if (i === 0) gfx.moveTo(nx, ny); else gfx.lineTo(nx, ny);
                }
                gfx.lineStyle(0);
                for (let i = 0; i < 7; i++) {
                    const nx = cx - 15 + i * 5, ny = cy + Math.sin(i * 1.1) * 11;
                    gfx.beginFill(i % 2 ? 0x22d3ee : ac); gfx.drawCircle(nx, ny, 2); gfx.endFill();
                }
                break;
            }
            case 'longevity_discovery': { // Benzene-ring molecule
                gfx.lineStyle(2, ac, 0.9);
                const r = 12;
                const pts = [];
                for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
                for (let i = 0; i < 6; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 6]; gfx.moveTo(x1, y1); gfx.lineTo(x2, y2); }
                gfx.lineStyle(0);
                for (const [x, y] of pts) { gfx.beginFill(ac); gfx.drawCircle(x, y, 2.2); gfx.endFill(); }
                gfx.beginFill(0x22d3ee, 0.6); gfx.drawCircle(cx, cy, 3); gfx.endFill();
                break;
            }
            case 'longevity_trials': { // Medical cross + heartbeat trace
                gfx.beginFill(ac); gfx.drawRect(cx - 4, cy - 12, 8, 24); gfx.drawRect(cx - 12, cy - 4, 24, 8); gfx.endFill();
                gfx.beginFill(0xffffff, 0.25); gfx.drawRect(cx - 4, cy - 12, 8, 3); gfx.endFill();
                gfx.lineStyle(1.5, 0x4ade80, 0.9);
                gfx.moveTo(cx - 18, cy + 16); gfx.lineTo(cx - 8, cy + 16); gfx.lineTo(cx - 4, cy + 9);
                gfx.lineTo(cx, cy + 22); gfx.lineTo(cx + 5, cy + 16); gfx.lineTo(cx + 18, cy + 16);
                gfx.lineStyle(0);
                break;
            }
            case 'longevity_genomics': { // DNA double helix
                gfx.lineStyle(2, ac, 0.85);
                for (let s = 0; s < 2; s++) {
                    const off = s * Math.PI;
                    for (let i = 0; i <= 16; i++) {
                        const yy = cy - 15 + i * 1.9, xx = cx + Math.sin(i * 0.5 + off) * 10;
                        if (i === 0) gfx.moveTo(xx, yy); else gfx.lineTo(xx, yy);
                    }
                }
                gfx.lineStyle(0);
                const rungCols = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444];
                for (let i = 2; i < 15; i += 3) {
                    const yy = cy - 15 + i * 1.9;
                    const x1 = cx + Math.sin(i * 0.5) * 10, x2 = cx + Math.sin(i * 0.5 + Math.PI) * 10;
                    gfx.lineStyle(1.2, rungCols[(i / 3) % 4], 0.8); gfx.moveTo(x1, yy); gfx.lineTo(x2, yy); gfx.lineStyle(0);
                }
                break;
            }
            case 'longevity_cryo': { // Frost crystal + vault ring
                gfx.lineStyle(1, ac, 0.5); gfx.drawCircle(cx, cy, 16); gfx.lineStyle(0);
                gfx.lineStyle(2, ac, 0.9);
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3;
                    gfx.moveTo(cx, cy); gfx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
                    // barbs
                    const bx = cx + Math.cos(a) * 8, by = cy + Math.sin(a) * 8;
                    gfx.moveTo(bx, by); gfx.lineTo(bx + Math.cos(a + 0.6) * 4, by + Math.sin(a + 0.6) * 4);
                    gfx.moveTo(bx, by); gfx.lineTo(bx + Math.cos(a - 0.6) * 4, by + Math.sin(a - 0.6) * 4);
                }
                gfx.lineStyle(0);
                gfx.beginFill(0xffffff, 0.7); gfx.drawCircle(cx, cy, 2.5); gfx.endFill();
                break;
            }
        }
    },

    // ─── SOCIAL STRIP FACADES ───
    // The café/gym/arena/open-source-hub/newspaper block sits in the busiest
    // stretch of the map, so each gets a hand-built exterior that mirrors its
    // interior identity — same playbook as the lab HQ towers: deterministic
    // noise (no Math.random reshuffle) and pure-geometry draws so
    // cacheAsBitmap batches the whole facade into one sprite.
    _drawSocialFacade(gfx, container, b, h, floors) {
        const seed = this._labHash(b.id);
        const n = (i) => this._labNoise(seed + i);
        // Right-edge depth shadow (shared with every other facade style)
        gfx.beginFill(0x000000, 0.14); gfx.drawRect(b.w, 4, 6, h - 4); gfx.endFill();
        if (b.id === 'cafe') this._drawCafeExt(gfx, b, h, floors, n);
        else if (b.id === 'gym') this._drawGymExt(gfx, b, h, floors, n);
        else if (b.id === 'arena') this._drawArenaExt(gfx, b, h, floors, n);
        else if (b.id === 'open_square') this._drawOpenSquareExt(gfx, b, h, floors, n);
        else this._drawTimesExt(gfx, container, b, h, floors, n);
        // Base ambient occlusion
        gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, h - 1, b.w, 3); gfx.endFill();
    },

    // API Café — warm brick coffee house: awning, shopfront, sidewalk terrace,
    // rooftop planters (mirrors the interior's cafe/lounge/kitchen/rooftop floors).
    _drawCafeExt(gfx, b, h, floors, n) {
        const AC = 0xf59e0b, CREAM = 0xf5e6c8;
        // Warm brick body
        gfx.beginFill(0x241410); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(AC, 0.07); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 8, 3, h - 8); gfx.endFill();
        gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 4, 8, 4, h - 8); gfx.endFill();
        // Brick coursing: mortar lines + staggered joints
        gfx.beginFill(0x000000, 0.13);
        for (let my = 12; my < h - 30; my += 7) gfx.drawRect(2, my, b.w - 4, 1);
        gfx.endFill();
        gfx.beginFill(0x000000, 0.10);
        for (let my = 12, r = 0; my < h - 34; my += 7, r++)
            for (let mx = (r % 2 ? 6 : 13); mx < b.w - 6; mx += 14) gfx.drawRect(mx, my, 1, 7);
        gfx.endFill();
        // Cream parapet + amber trim
        gfx.beginFill(CREAM, 0.9); gfx.drawRect(0, 0, b.w, 6); gfx.endFill();
        gfx.beginFill(AC, 0.9); gfx.drawRect(0, 6, b.w, 2.5); gfx.endFill();
        gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, 8.5, b.w, 2); gfx.endFill();
        // Rooftop terrace: railing + planters (mirrors the cafe_rooftop floor)
        gfx.beginFill(0x8a6a4a);
        for (let rx = 3; rx < b.w - 2; rx += 8) gfx.drawRect(rx, -6, 1.2, 6);
        gfx.endFill();
        gfx.beginFill(0xa9825a); gfx.drawRect(0, -7, b.w, 1.5); gfx.endFill();
        [6, b.w - 24].forEach((px) => {
            gfx.beginFill(0x7c2d12); gfx.drawRect(px, -4, 18, 4); gfx.endFill();
            gfx.beginFill(0x2d6a4f);
            gfx.drawCircle(px + 4, -6, 3); gfx.drawCircle(px + 9, -7, 3.5); gfx.drawCircle(px + 14, -6, 3);
            gfx.endFill();
        });
        // Arched upper windows, warm-lit, some with flower boxes
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 14 > h - 32) break;
            const cols = Math.max(2, Math.floor((b.w - 16) / 26));
            const gap = (b.w - cols * 16) / (cols + 1);
            for (let c = 0; c < cols; c++) {
                const wx = gap + c * (16 + gap);
                gfx.beginFill(0x000000, 0.25); gfx.drawRoundedRect(wx - 1.5, wy - 1.5, 19, 15, 6); gfx.endFill();
                const lit = n(f * 31 + c * 7) < 0.8;
                gfx.beginFill(lit ? 0xffd9a0 : 0x14100c, lit ? 0.9 : 1);
                gfx.drawRoundedRect(wx, wy, 16, 12, 5); gfx.endFill();
                gfx.beginFill(AC, 0.5); gfx.drawRect(wx - 1, wy + 12.5, 18, 1.5); gfx.endFill();
                if (n(f * 17 + c * 5) < 0.4) {
                    gfx.beginFill(0x2d6a4f); gfx.drawRect(wx + 1, wy + 10, 14, 2); gfx.endFill();
                    gfx.beginFill(0xef4444, 0.9); gfx.drawCircle(wx + 4, wy + 10, 1); gfx.drawCircle(wx + 11, wy + 10, 1); gfx.endFill();
                }
            }
        }
        // Scalloped awning over the shopfront
        const awnY = h - 30;
        for (let ax = 4, i2 = 0; ax < b.w - 4; ax += 12, i2++) {
            const sw = Math.min(12, b.w - 4 - ax);
            gfx.beginFill(i2 % 2 ? CREAM : AC, 0.95);
            gfx.drawRect(ax, awnY, sw, 5);
            gfx.drawCircle(ax + sw / 2, awnY + 5, sw / 2);
            gfx.endFill();
        }
        gfx.beginFill(0x000000, 0.18); gfx.drawRect(4, awnY + 12, b.w - 8, 2); gfx.endFill();
        // Shopfront glass: warm glow, pendant lamps, pastry-case silhouettes
        gfx.beginFill(0x1a1208); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(0xffd9a0, 0.45);
        for (let gx = 8; gx < b.w - 26; gx += 24) gfx.drawRect(gx, h - 19, 18, 17);
        gfx.endFill();
        gfx.beginFill(0x3a2a18, 0.9);
        for (let gx = 10; gx < b.w - 24; gx += 48) gfx.drawRect(gx, h - 9, 14, 7);
        gfx.endFill();
        gfx.beginFill(0xffe9a8, 0.9);
        for (let gx = 16; gx < b.w - 16; gx += 24) { gfx.drawRect(gx, h - 19, 0.8, 4); gfx.drawCircle(gx + 0.4, h - 14, 1.8); }
        gfx.endFill();
        // Entrance
        gfx.beginFill(0x140d06); gfx.drawRect(b.w / 2 - 9, h - 20, 18, 18); gfx.endFill();
        gfx.beginFill(AC, 0.6); gfx.drawRect(b.w / 2 - 9, h - 20, 18, 2); gfx.endFill();
        gfx.beginFill(0xffe9a8, 0.8); gfx.drawCircle(b.w / 2 + 6, h - 11, 1); gfx.endFill();
        // Projecting shingle sign: steaming coffee cup on a round board
        const sx = -9, sy = h - 46;
        gfx.beginFill(0x5a3a22); gfx.drawRect(-14, sy - 11, 15, 2); gfx.endFill();
        gfx.beginFill(0x0e0a06, 0.95); gfx.drawCircle(sx, sy, 10); gfx.endFill();
        gfx.lineStyle(1.2, AC, 0.9); gfx.drawCircle(sx, sy, 10); gfx.lineStyle(0);
        gfx.beginFill(CREAM); gfx.drawRoundedRect(sx - 4, sy - 1, 8, 6, 1.5); gfx.endFill();
        gfx.lineStyle(1.2, CREAM, 0.9); gfx.drawCircle(sx + 5, sy + 2, 2); gfx.lineStyle(0);
        gfx.lineStyle(1, AC, 0.8);
        gfx.moveTo(sx - 2, sy - 3); gfx.lineTo(sx - 1, sy - 6);
        gfx.moveTo(sx + 1, sy - 3); gfx.lineTo(sx + 2, sy - 6);
        gfx.lineStyle(0);
        // Sidewalk terrace: striped umbrellas + tables flanking the entrance
        [18, b.w - 34].forEach((tx) => {
            gfx.beginFill(0x8a6a4a); gfx.drawRect(tx + 7.5, h - 26, 1.5, 26); gfx.endFill();
            for (let sg = 0; sg < 4; sg++) {
                gfx.beginFill(sg % 2 ? CREAM : AC);
                gfx.drawPolygon([tx - 6 + sg * 7, h - 26, tx + 1 + sg * 7, h - 26, tx + 8, h - 33]);
                gfx.endFill();
            }
            gfx.beginFill(0x3a2a18);
            gfx.drawRect(tx + 4, h - 8, 8, 1.5); gfx.drawRect(tx + 7.5, h - 8, 1, 8);
            gfx.drawRect(tx - 1, h - 5, 4, 1.2); gfx.drawRect(tx + 0.5, h - 5, 1, 5);
            gfx.drawRect(tx + 13, h - 5, 4, 1.2); gfx.drawRect(tx + 14.5, h - 5, 1, 5);
            gfx.endFill();
        });
    },

    // RLHF Gym — glass training atrium with per-floor activity silhouettes,
    // rooftop lap pool (the interior's 5th floor), hanging dumbbell banner.
    _drawGymExt(gfx, b, h, floors, n) {
        const AC = 0x22d3ee, GLASS = 0xd6f6ff;
        // Athletic dark body
        gfx.beginFill(0x101822); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(AC, 0.05); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 8, 3, h - 8); gfx.endFill();
        gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 4, 8, 4, h - 8); gfx.endFill();
        // Cyan crown
        gfx.beginFill(AC, 0.92); gfx.drawRect(0, 0, b.w, 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.18); gfx.drawRect(0, 0, b.w, 2); gfx.endFill();
        gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, 8, b.w, 2); gfx.endFill();
        // Rooftop lap pool (left) with lane glints + ladder, HVAC on the right
        const poolW = b.w * 0.26;
        gfx.beginFill(0x0e7490); gfx.drawRect(6, -6, poolW, 6); gfx.endFill();
        gfx.beginFill(0x38bdf8, 0.8); gfx.drawRect(6, -6, poolW, 4.5); gfx.endFill();
        gfx.beginFill(0xffffff, 0.5);
        for (let px = 12; px < poolW - 4; px += 14) gfx.drawRect(px, -4.5, 6, 0.8);
        gfx.endFill();
        gfx.beginFill(0xe2e8f0);
        gfx.drawRect(6 + poolW - 3, -8, 1, 8); gfx.drawRect(6 + poolW, -8, 1, 8);
        gfx.drawRect(6 + poolW - 3, -6.5, 4, 0.8); gfx.drawRect(6 + poolW - 3, -3.5, 4, 0.8);
        gfx.endFill();
        gfx.beginFill(0x475569); gfx.drawRect(b.w - 34, -5, 12, 5); gfx.endFill();
        gfx.beginFill(0x64748b, 0.7); gfx.drawRect(b.w - 32.5, -3.8, 9, 1); gfx.drawRect(b.w - 32.5, -2, 9, 1); gfx.endFill();
        // Full-height glass atrium (left) — training silhouettes per floor
        const atX = 8, atW = Math.max(52, b.w * 0.30);
        gfx.beginFill(0x0a1220); gfx.drawRect(atX, 12, atW, h - 34); gfx.endFill();
        gfx.beginFill(GLASS, 0.14); gfx.drawRect(atX, 12, atW, h - 34); gfx.endFill();
        for (let f = 0; f < floors - 1; f++) {
            const by = 16 + f * 18;
            if (by + 12 > h - 24) break;
            gfx.beginFill(GLASS, 0.55); gfx.drawRect(atX + 2, by, atW - 4, 12); gfx.endFill();
            gfx.beginFill(AC, 0.2); gfx.drawRect(atX + 2, by, atW - 4, 2.5); gfx.endFill();
            const cx2 = atX + atW / 2;
            gfx.beginFill(0x06121c, 0.95);
            const kind = f % 4;
            if (kind === 0) { // treadmill runner
                gfx.drawPolygon([cx2 - 10, by + 11, cx2 + 10, by + 11, cx2 + 8, by + 8.5, cx2 - 8, by + 8.5]);
                gfx.drawCircle(cx2, by + 3.5, 1.8);
                gfx.drawRect(cx2 - 1.2, by + 5, 2.4, 4);
            } else if (kind === 1) { // barbell rack
                gfx.drawRect(cx2 - 9, by + 6, 18, 1.4);
                gfx.drawCircle(cx2 - 8, by + 6.7, 2.6); gfx.drawCircle(cx2 + 8, by + 6.7, 2.6);
                gfx.drawRect(cx2 - 1.2, by + 7.5, 2.4, 3.5);
            } else if (kind === 2) { // heavy bag
                gfx.drawRect(cx2 - 0.6, by, 1.2, 3);
                gfx.drawRoundedRect(cx2 - 2.5, by + 3, 5, 7, 2);
            } else { // yoga pose
                gfx.drawCircle(cx2, by + 4, 1.8);
                gfx.drawPolygon([cx2 - 5, by + 11, cx2 + 5, by + 11, cx2, by + 5.5]);
            }
            gfx.endFill();
        }
        gfx.beginFill(0x0a0e18, 0.9); gfx.drawRect(atX + atW / 2 - 0.7, 12, 1.4, h - 34); gfx.endFill();
        // Hanging banner with dumbbell mark (right edge)
        const bnX = b.w - 24;
        gfx.beginFill(0x0c4a6e, 0.95); gfx.drawRect(bnX, 12, 16, 46); gfx.endFill();
        gfx.beginFill(AC, 0.9); gfx.drawRect(bnX, 12, 16, 3); gfx.endFill();
        gfx.beginFill(0x101822); gfx.drawPolygon([bnX, 58, bnX + 16, 58, bnX + 8, 52]); gfx.endFill();
        gfx.beginFill(0xffffff, 0.9);
        gfx.drawRect(bnX + 3, 30, 10, 1.6);
        gfx.drawRect(bnX + 2, 27, 2.4, 8); gfx.drawRect(bnX + 11.6, 27, 2.4, 8);
        gfx.endFill();
        // Window grid on the right wing (clear of atrium + banner)
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 12 > h - 24) break;
            for (let wx = atX + atW + 10; wx + 15 < bnX - 4; wx += 22) {
                if (wy < 60 && wx + 15 > bnX - 4) continue;
                const lit = n(f * 43 + wx) < 0.62;
                gfx.beginFill(0x000000, 0.25); gfx.drawRect(wx - 1, wy - 1, 16, 13); gfx.endFill();
                gfx.beginFill(lit ? GLASS : 0x0a1018, lit ? 0.8 : 1); gfx.drawRect(wx, wy, 14, 11); gfx.endFill();
                if (lit) { gfx.beginFill(AC, 0.25); gfx.drawRect(wx, wy, 14, 2.5); gfx.endFill(); }
            }
        }
        // Reception floor: glass, turnstiles, cyan canopy
        gfx.beginFill(0x0a141e); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(AC, 0.14); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(AC, 0.8); gfx.drawRect(4, h - 22, b.w - 8, 2); gfx.endFill();
        gfx.beginFill(GLASS, 0.35);
        for (let lx = 12; lx < b.w - 28; lx += 26) gfx.drawRect(lx, h - 18, 16, 13);
        gfx.endFill();
        gfx.beginFill(0x05090f); gfx.drawRect(b.w / 2 - 10, h - 19, 20, 17); gfx.endFill();
        gfx.beginFill(AC, 0.55); gfx.drawRect(b.w / 2 - 10, h - 19, 20, 2); gfx.endFill();
        gfx.beginFill(0x94a3b8, 0.8); gfx.drawRect(b.w / 2 - 6, h - 9, 4, 1.2); gfx.drawRect(b.w / 2 + 2, h - 9, 4, 1.2); gfx.endFill();
        gfx.beginFill(AC, 0.85); gfx.drawRect(b.w / 2 - 15, h - 21, 30, 2.5); gfx.endFill();
    },

    // LMSYS Arena — e-sports stadium: giant jumbotron with a bot-vs-bot match,
    // floodlight masts, championship pennants, grand arched gate + ticket booths.
    _drawArenaExt(gfx, b, h, floors, n) {
        const AC = 0xef4444, GOLD = 0xfbbf24;
        // Stadium body (lowered roofline at the edges, raised centre bay)
        gfx.beginFill(0x1c1016); gfx.drawRect(0, 14, b.w, h - 14); gfx.endFill();
        gfx.beginFill(AC, 0.05); gfx.drawRect(0, 14, b.w, h - 14); gfx.endFill();
        gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 14, 3, h - 14); gfx.endFill();
        gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 4, 14, 4, h - 14); gfx.endFill();
        gfx.beginFill(AC, 0.85); gfx.drawRect(0, 14, b.w, 2); gfx.endFill();
        const jbW = Math.min(b.w - 56, 150), jbX = (b.w - jbW) / 2;
        gfx.beginFill(0x140a10); gfx.drawRect(jbX - 6, 2, jbW + 12, 14); gfx.endFill();
        gfx.beginFill(AC, 0.9); gfx.drawRect(jbX - 6, 0, jbW + 12, 3); gfx.endFill();
        // ── JUMBOTRON — the arena's signature match screen ──
        const scrY = 16, scrH = Math.min(34, h - 60);
        gfx.beginFill(0x05070d); gfx.drawRect(jbX, scrY, jbW, scrH); gfx.endFill();
        gfx.lineStyle(1.5, 0x334155, 1); gfx.drawRect(jbX, scrY, jbW, scrH); gfx.lineStyle(0);
        gfx.beginFill(0x0ea5e9, 0.06);
        for (let sy2 = scrY + 2; sy2 < scrY + scrH - 2; sy2 += 4) gfx.drawRect(jbX + 2, sy2, jbW - 4, 1.5);
        gfx.endFill();
        // Two fighter bots + gold VS
        const p1x = jbX + jbW * 0.22, p2x = jbX + jbW * 0.78, pcy = scrY + scrH * 0.42;
        gfx.beginFill(0x3b82f6, 0.9); gfx.drawRoundedRect(p1x - 12, pcy - 8, 24, 16, 3); gfx.endFill();
        gfx.beginFill(AC, 0.9); gfx.drawRoundedRect(p2x - 12, pcy - 8, 24, 16, 3); gfx.endFill();
        gfx.beginFill(0xffffff, 0.9);
        gfx.drawRect(p1x - 5, pcy - 3, 3, 3); gfx.drawRect(p1x + 2, pcy - 3, 3, 3); gfx.drawRect(p1x - 4, pcy + 3, 8, 1.5);
        gfx.drawRect(p2x - 5, pcy - 3, 3, 3); gfx.drawRect(p2x + 2, pcy - 3, 3, 3); gfx.drawRect(p2x - 4, pcy + 3, 8, 1.5);
        gfx.endFill();
        const vx = jbX + jbW / 2;
        gfx.lineStyle(2.2, GOLD, 1);
        gfx.moveTo(vx - 8, pcy - 6); gfx.lineTo(vx - 4.5, pcy + 4); gfx.lineTo(vx - 1, pcy - 6);
        gfx.moveTo(vx + 8, pcy - 6); gfx.lineTo(vx + 3, pcy - 6); gfx.lineTo(vx + 3, pcy - 1);
        gfx.lineTo(vx + 8, pcy - 1); gfx.lineTo(vx + 8, pcy + 4); gfx.lineTo(vx + 3, pcy + 4);
        gfx.lineStyle(0);
        // ELO ticker pixels along the screen's bottom edge (deterministic)
        for (let tx2 = jbX + 3, i2 = 0; tx2 < jbX + jbW - 8; tx2 += 7, i2++) {
            gfx.beginFill([0x4ade80, 0xfbbf24, 0x38bdf8, 0xf87171][Math.floor(n(i2) * 4)], 0.85);
            gfx.drawRect(tx2, scrY + scrH - 5, 4 + n(i2 + 99) * 2, 2);
            gfx.endFill();
        }
        // Championship pennants flanking the screen
        [[jbX - 18, AC], [jbX + jbW + 6, 0x3b82f6]].forEach(([px, pc]) => {
            if (px < 4 || px + 12 > b.w - 4) return;
            gfx.beginFill(pc, 0.92); gfx.drawRect(px, 18, 12, 26); gfx.endFill();
            gfx.beginFill(0x1c1016); gfx.drawPolygon([px, 44, px + 12, 44, px + 6, 38]); gfx.endFill();
            gfx.beginFill(GOLD, 0.95); gfx.drawCircle(px + 6, 26, 3); gfx.endFill();
            gfx.beginFill(GOLD, 0.7); gfx.drawRect(px + 2, 33, 8, 1.5); gfx.endFill();
        });
        // Floodlight masts at both roof edges
        [12, b.w - 12].forEach((mx) => {
            gfx.beginFill(0x64748b); gfx.drawRect(mx - 1, -2, 2, 16); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(mx - 7, -8, 14, 6); gfx.endFill();
            gfx.beginFill(0xfef9c3, 0.9);
            gfx.drawRect(mx - 6, -7, 3, 4); gfx.drawRect(mx - 1.5, -7, 3, 4); gfx.drawRect(mx + 3, -7, 3, 4);
            gfx.endFill();
        });
        // Concourse windows below the screen
        for (let f = 2; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy < scrY + scrH + 2 || wy + 11 > h - 24) continue;
            for (let wx = 10; wx < b.w - 24; wx += 24) {
                const lit = n(f * 57 + wx) < 0.55;
                gfx.beginFill(0x000000, 0.25); gfx.drawRect(wx - 1, wy - 1, 16, 12); gfx.endFill();
                gfx.beginFill(lit ? 0xffd9c0 : 0x0e0a10, lit ? 0.8 : 1); gfx.drawRect(wx, wy, 14, 10); gfx.endFill();
            }
        }
        // Concourse floor: gold trim, grand arch gate, ticket booths
        gfx.beginFill(0x0e0a10); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(AC, 0.10); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(GOLD, 0.7); gfx.drawRect(4, h - 22, b.w - 8, 1.5); gfx.endFill();
        gfx.beginFill(0x05070d); gfx.drawRect(b.w / 2 - 12, h - 16, 24, 16); gfx.drawCircle(b.w / 2, h - 16, 12); gfx.endFill();
        gfx.lineStyle(1.5, GOLD, 0.8); gfx.drawCircle(b.w / 2, h - 16, 12); gfx.lineStyle(0);
        gfx.beginFill(0xffe9a8, 0.5); gfx.drawCircle(b.w / 2, h - 16, 2); gfx.endFill();
        [b.w * 0.22, b.w * 0.78 - 16].forEach((bx2) => {
            gfx.beginFill(0x1a1420); gfx.drawRect(bx2, h - 18, 16, 16); gfx.endFill();
            gfx.beginFill(AC, 0.85); gfx.drawRect(bx2 - 1, h - 19, 18, 2.5); gfx.endFill();
            gfx.beginFill(0xffe9a8, 0.75); gfx.drawRect(bx2 + 3, h - 14, 10, 7); gfx.endFill();
            gfx.beginFill(0x05070d, 0.8); gfx.drawRect(bx2 + 3, h - 9, 10, 1.5); gfx.endFill();
        });
    },

    // Open Source Hub — converted warehouse: giant live-code terminal wall,
    // git-branch emblem, hackathon pennants, graffiti + poster wall at street level.
    _drawOpenSquareExt(gfx, b, h, floors, n) {
        const AC = 0xa855f7, CODE = 0x4ade80;
        const pcols = [0x4ade80, 0xfbbf24, 0x38bdf8, 0xf87171, 0xa855f7];
        // Converted-warehouse body
        gfx.beginFill(0x161020); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(AC, 0.06); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 8, 3, h - 8); gfx.endFill();
        gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 4, 8, 4, h - 8); gfx.endFill();
        // Parapet
        gfx.beginFill(AC, 0.9); gfx.drawRect(0, 0, b.w, 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.15); gfx.drawRect(0, 0, b.w, 2); gfx.endFill();
        gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, 8, b.w, 2); gfx.endFill();
        // Hackathon pennant string across the roof + self-hosted dish
        gfx.lineStyle(1, 0x94a3b8, 0.7); gfx.moveTo(4, -8); gfx.lineTo(b.w - 4, -8); gfx.lineStyle(0);
        for (let fx = 8, i2 = 0; fx < b.w - 8; fx += 12, i2++) {
            gfx.beginFill(pcols[i2 % 5], 0.9); gfx.drawPolygon([fx, -8, fx + 8, -8, fx + 4, -2]); gfx.endFill();
        }
        gfx.beginFill(0x94a3b8); gfx.drawRect(14, -14, 1.5, 6); gfx.endFill();
        gfx.beginFill(0xcbd5e1, 0.9); gfx.drawEllipse(11, -15, 5, 3.5); gfx.endFill();
        // ── LIVE CODE WALL — giant terminal pane, the hub's signature ──
        const twX = 10, twW = Math.max(64, b.w * 0.34), twY = 15, twH = Math.min(42, h - 44);
        gfx.beginFill(0x04070d); gfx.drawRect(twX, twY, twW, twH); gfx.endFill();
        gfx.lineStyle(1.2, CODE, 0.5); gfx.drawRect(twX, twY, twW, twH); gfx.lineStyle(0);
        gfx.beginFill(0xf87171); gfx.drawCircle(twX + 4, twY + 3.5, 1.2); gfx.endFill();
        gfx.beginFill(0xfbbf24); gfx.drawCircle(twX + 8, twY + 3.5, 1.2); gfx.endFill();
        gfx.beginFill(0x4ade80); gfx.drawCircle(twX + 12, twY + 3.5, 1.2); gfx.endFill();
        const nLines = Math.floor((twH - 12) / 3.6);
        for (let li = 0; li < nLines; li++) {
            const ly = twY + 8 + li * 3.6;
            const indent = [0, 4, 8, 8, 4, 0, 4, 8, 4][li % 9];
            const lw = 10 + n(li * 13) * (twW - 26 - indent);
            gfx.beginFill(li % 4 === 3 ? AC : CODE, li % 4 === 3 ? 0.85 : 0.7);
            gfx.drawRect(twX + 4 + indent, ly, lw, 1.8);
            gfx.endFill();
        }
        gfx.beginFill(CODE, 0.95); gfx.drawRect(twX + 4, twY + 8 + nLines * 3.6, 4, 2); gfx.endFill();
        // Git-branch emblem medallion (right of the code wall)
        const gx2 = twX + twW + (b.w - twX - twW) / 2, gy2 = 34;
        gfx.beginFill(0x0a0714, 0.85); gfx.drawRoundedRect(gx2 - 16, gy2 - 16, 32, 32, 5); gfx.endFill();
        gfx.lineStyle(1, AC, 0.6); gfx.drawRoundedRect(gx2 - 16, gy2 - 16, 32, 32, 5); gfx.lineStyle(0);
        gfx.lineStyle(2, 0xe2e8f0, 0.9);
        gfx.moveTo(gx2 - 6, gy2 - 9); gfx.lineTo(gx2 - 6, gy2 + 9);
        gfx.moveTo(gx2 - 6, gy2 - 2); gfx.lineTo(gx2 + 7, gy2 - 9);
        gfx.lineStyle(0);
        gfx.beginFill(CODE); gfx.drawCircle(gx2 - 6, gy2 - 9, 3); gfx.endFill();
        gfx.beginFill(AC); gfx.drawCircle(gx2 - 6, gy2 + 9, 3); gfx.endFill();
        gfx.beginFill(0xfbbf24); gfx.drawCircle(gx2 + 7, gy2 - 9, 3); gfx.endFill();
        // Hackathon windows — nearly all lit, mixed warm/cool/purple
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 11 > h - 24) break;
            const startX = (wy < twY + twH + 4) ? twX + twW + 8 : 10;
            for (let wx = startX; wx < b.w - 24; wx += 24) {
                if (wy < gy2 + 18 && wy + 12 > gy2 - 16 && wx + 15 > gx2 - 18 && wx < gx2 + 18) continue;
                const rr = n(f * 71 + wx);
                const lit = rr < 0.85;
                gfx.beginFill(0x000000, 0.25); gfx.drawRect(wx - 1, wy - 1, 16, 12); gfx.endFill();
                gfx.beginFill(lit ? (rr < 0.3 ? 0xd6ecff : rr < 0.6 ? 0xffe9c0 : 0xe9d5ff) : 0x0c0916, lit ? 0.85 : 1);
                gfx.drawRect(wx, wy, 14, 10); gfx.endFill();
            }
        }
        // Street level: roll-up door, graffiti tags, meetup poster wall
        gfx.beginFill(0x0d0a16); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(AC, 0.10); gfx.drawRect(4, h - 22, b.w - 8, 20); gfx.endFill();
        gfx.beginFill(AC, 0.7); gfx.drawRect(4, h - 22, b.w - 8, 1.5); gfx.endFill();
        [[0x22d3ee, b.w * 0.14, 8], [0xf472b6, b.w * 0.2, 5], [0x4ade80, b.w * 0.82, 7]].forEach(([gc, gx3, gr]) => {
            gfx.beginFill(gc, 0.30); gfx.drawEllipse(gx3, h - 10, gr, gr * 0.55); gfx.endFill();
            gfx.beginFill(gc, 0.18); gfx.drawEllipse(gx3 + gr * 0.8, h - 13, gr * 0.5, gr * 0.3); gfx.endFill();
        });
        // "</>" tag over the left graffiti
        const tgx = b.w * 0.16, tgy = h - 12;
        gfx.lineStyle(1.5, 0xf8fafc, 0.9);
        gfx.moveTo(tgx - 6, tgy - 3); gfx.lineTo(tgx - 9, tgy); gfx.lineTo(tgx - 6, tgy + 3);
        gfx.moveTo(tgx + 6, tgy - 3); gfx.lineTo(tgx + 9, tgy); gfx.lineTo(tgx + 6, tgy + 3);
        gfx.moveTo(tgx + 2, tgy - 4); gfx.lineTo(tgx - 2, tgy + 4);
        gfx.lineStyle(0);
        for (let pi = 0; pi < 4; pi++) {
            const px2 = b.w * 0.62 + pi * 13;
            if (px2 + 10 > b.w - 6) break;
            gfx.beginFill([0x1e293b, 0x312e81, 0x3f1d38, 0x1a2e05][pi % 4], 0.95);
            gfx.drawRect(px2, h - 19, 10, 13);
            gfx.endFill();
            gfx.beginFill(pcols[pi % 5], 0.8); gfx.drawRect(px2 + 1.5, h - 17.5, 7, 3); gfx.endFill();
            gfx.beginFill(0x94a3b8, 0.6); gfx.drawRect(px2 + 1.5, h - 12, 7, 1); gfx.drawRect(px2 + 1.5, h - 10, 5, 1); gfx.endFill();
        }
        gfx.beginFill(0x05070d); gfx.drawRect(b.w / 2 - 11, h - 19, 22, 17); gfx.endFill();
        gfx.beginFill(0x1e293b, 0.9);
        for (let dy2 = h - 17; dy2 < h - 4; dy2 += 3) gfx.drawRect(b.w / 2 - 10, dy2, 20, 1);
        gfx.endFill();
        gfx.beginFill(CODE, 0.6); gfx.drawRect(b.w / 2 - 11, h - 19, 22, 1.5); gfx.endFill();
    },

    // Singularity City Times — classical newspaper office: serif masthead band,
    // street clock, printing press behind the ground-floor glass, news kiosk.
    _drawTimesExt(gfx, container, b, h, floors, n) {
        const INK = 0x14141c, CREAM = 0xd8d3c8, RED = 0xb91c1c;
        // Stone body with per-floor cornice lines
        gfx.beginFill(0x262229); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(CREAM, 0.08); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
        gfx.beginFill(0xffffff, 0.05); gfx.drawRect(0, 8, 3, h - 8); gfx.endFill();
        gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 4, 8, 4, h - 8); gfx.endFill();
        gfx.beginFill(CREAM, 0.18);
        for (let f = 1; f < floors; f++) gfx.drawRect(2, 14 + f * 18 - 1, b.w - 4, 1.5);
        gfx.endFill();
        // ── MASTHEAD — ink band with the paper's serif name ──
        gfx.beginFill(INK, 0.98); gfx.drawRect(0, 0, b.w, 14); gfx.endFill();
        gfx.beginFill(CREAM, 0.9); gfx.drawRect(0, 0, b.w, 1.2); gfx.drawRect(0, 12.8, b.w, 1.2); gfx.endFill();
        const mast = new PIXI.Text(b.name || 'Singularity City Times', {
            fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 10, fontWeight: 'bold',
            fill: 0xf5f0e6, fontStyle: 'italic'
        });
        mast.anchor.set(0.5, 0.5); mast.x = b.w / 2; mast.y = 7;
        if (mast.width > b.w - 12) mast.scale.set((b.w - 12) / mast.width);
        container.addChild(mast);
        // Street clock under the masthead
        const ccx = b.w / 2, ccy = 25;
        gfx.beginFill(0x0d0d12); gfx.drawCircle(ccx, ccy, 7); gfx.endFill();
        gfx.lineStyle(1.2, CREAM, 0.85); gfx.drawCircle(ccx, ccy, 7); gfx.lineStyle(0);
        gfx.lineStyle(1, 0xf5f0e6, 0.9);
        gfx.moveTo(ccx, ccy); gfx.lineTo(ccx, ccy - 4.5);
        gfx.moveTo(ccx, ccy); gfx.lineTo(ccx + 3.2, ccy + 1.5);
        gfx.lineStyle(0);
        // Sash windows (newsroom floors)
        for (let f = 0; f < floors - 1; f++) {
            const wy = 18 + f * 18;
            if (wy + 12 > h - 26) break;
            for (let wx = 10; wx < b.w - 20; wx += 24) {
                if (f === 0 && wx + 14 > ccx - 10 && wx < ccx + 10) continue;
                const lit = n(f * 29 + wx) < 0.7;
                gfx.beginFill(0x000000, 0.25); gfx.drawRect(wx - 1, wy - 1, 16, 13); gfx.endFill();
                gfx.beginFill(lit ? 0xf5eeda : 0x121016, lit ? 0.85 : 1); gfx.drawRect(wx, wy, 14, 11); gfx.endFill();
                gfx.beginFill(0x000000, 0.3); gfx.drawRect(wx, wy + 5, 14, 1); gfx.endFill();
            }
        }
        // ── PRESS HALL — printing press behind the ground-floor glass ──
        gfx.beginFill(0x0f0d12); gfx.drawRect(4, h - 24, b.w - 8, 22); gfx.endFill();
        gfx.beginFill(0xf5eeda, 0.10); gfx.drawRect(4, h - 24, b.w - 8, 22); gfx.endFill();
        gfx.beginFill(CREAM, 0.6); gfx.drawRect(4, h - 24, b.w - 8, 1.5); gfx.endFill();
        const prX = 10, prW = Math.max(46, b.w * 0.34);
        gfx.beginFill(0xe7e2d4, 0.85);
        gfx.drawPolygon([prX, h - 14, prX + prW * 0.25, h - 19, prX + prW * 0.55, h - 12, prX + prW * 0.85, h - 18, prX + prW, h - 13,
                         prX + prW, h - 11, prX + prW * 0.85, h - 16, prX + prW * 0.55, h - 10, prX + prW * 0.25, h - 17, prX, h - 12]);
        gfx.endFill();
        [[prX + prW * 0.25, h - 19], [prX + prW * 0.55, h - 11], [prX + prW * 0.85, h - 17]].forEach(([rx2, ry2]) => {
            gfx.beginFill(0x3f3f46); gfx.drawCircle(rx2, ry2, 3.5); gfx.endFill();
            gfx.beginFill(0x71717a, 0.9); gfx.drawCircle(rx2, ry2, 1.5); gfx.endFill();
        });
        gfx.beginFill(0x27272e); gfx.drawRect(prX + 2, h - 8, prW - 4, 6); gfx.endFill();
        gfx.beginFill(RED, 0.8); gfx.drawRect(prX + 2, h - 8, prW - 4, 1.2); gfx.endFill();
        // Entrance + fresh paper bundle
        gfx.beginFill(0x0a0a10); gfx.drawRect(b.w / 2 - 9, h - 20, 18, 18); gfx.endFill();
        gfx.beginFill(RED, 0.7); gfx.drawRect(b.w / 2 - 9, h - 20, 18, 2); gfx.endFill();
        gfx.beginFill(0xffe9a8, 0.7); gfx.drawCircle(b.w / 2 + 6, h - 11, 1); gfx.endFill();
        gfx.beginFill(0xe7e2d4, 0.9); gfx.drawRect(b.w / 2 + 12, h - 5, 9, 5); gfx.endFill();
        gfx.beginFill(0x9ca3af, 0.9); gfx.drawRect(b.w / 2 + 12, h - 3.5, 9, 0.8); gfx.endFill();
        // News kiosk (right wing) with red awning + racked papers
        const kx = b.w - 34;
        gfx.beginFill(0x1e3a2f); gfx.drawRect(kx, h - 16, 22, 16); gfx.endFill();
        gfx.beginFill(RED, 0.9); gfx.drawRect(kx - 2, h - 18, 26, 3); gfx.endFill();
        gfx.beginFill(0xf5eeda, 0.85); gfx.drawRect(kx + 2, h - 12, 5, 7); gfx.drawRect(kx + 9, h - 12, 5, 7); gfx.endFill();
        gfx.beginFill(0x0a0a10, 0.8); gfx.drawRect(kx + 3, h - 11, 3, 1); gfx.drawRect(kx + 10, h - 11, 3, 1); gfx.endFill();
        // Rooftop wire-service mast with beacon
        gfx.beginFill(0x64748b); gfx.drawRect(b.w - 22, -14, 1.5, 14); gfx.drawRect(b.w - 26, -8, 9, 1); gfx.endFill();
        gfx.beginFill(RED, 0.9); gfx.drawCircle(b.w - 21.2, -14.5, 1.5); gfx.endFill();
    },

    buildBuildings() {
      // ─── DIRTY CHECK: skip entire rebuild if no visual state changed ───
      if (window.BLDS && this.bldLayer.children.length > 0) {
          const fp = this._buildFingerprint();
          if (fp && this._lastBuildFP === fp) return;
          this._lastBuildFP = fp;
      }

      // Clear building references before destroying PIXI objects
      if (window.BLDS) {
          BLDS.forEach(b => {
              b._container = null;
              b._beacon = null;
              b._stockTicker = null;
              b._tickerW = null;
              b._vcTicker = null;
              b._vcTickerW = null;
              b._bkTicker = null;
              b._bkTickerW = null;
              b._sign = null;
          });
      }
      // Destroy old building PIXI objects to free GPU memory
      while (this.bldLayer.children.length > 0) {
          const child = this.bldLayer.children[0];
          this.bldLayer.removeChild(child);
          child.destroy({ children: true, texture: false, baseTexture: false });
      }
      // reflectionLayer: removeChildren then re-add surviving refs
      this.reflectionLayer.removeChildren();

      const ghostLights = [];
      this.lightLayer.children.forEach(c => { if (c !== this.staticLightsGfx) ghostLights.push(c); });
      ghostLights.forEach(c => { this.lightLayer.removeChild(c); c.destroy(); });

      if (this.refMask) this.reflectionLayer.addChild(this.refMask);
      // Re-attach CEO car reflections that survived the rebuild
      if (G.ceoRefs) { Object.values(G.ceoRefs).forEach(ceo => { if (ceo && ceo.refCont && !ceo.refCont.destroyed) this.reflectionLayer.addChild(ceo.refCont); }); }
      // Re-attach truck reflections
      if (G.cars) { G.cars.forEach(c => { if (c && c.ref && !c.ref.destroyed) this.reflectionLayer.addChild(c.ref); }); }

      const emojiFontStack = '"Twemoji Mozilla", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';

      BLDS.forEach(b => {
        const lab = b.lab ? LABS[b.lab] : null;
        const colHex = lab ? parseInt(lab.color.slice(1), 16) : parseInt((b.color || '#6b7280').slice(1), 16);
        const floors = b.dynamicFl || b.fl; 
        const h = floors * 18 + 24; 
        
        const bx = b.x; const by = G.groundY - 24;
        const container = new PIXI.Container(); container.x = bx;
        // Black Market renders underground — below ground level
        if (b.id === 'black_market' && typeof BlackMarket !== 'undefined') {
            container.y = G.groundY + BlackMarket.DEPTH - h;
        } else {
            container.y = by - h;
        }
        const gfx = new PIXI.Graphics();
        
        // ─── SPACE ZONE BUILDINGS: delegate to SpaceEnvironment ───
        if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
            if (typeof SpaceEnvironment !== 'undefined') {
                SpaceEnvironment.buildSpaceBuildings(this.bldLayer, b, G.groundY);
            }
            return; // skip normal rendering
        }
  
        if (b.id.startsWith('forest_') || b.id === 'forest_space') {
            gfx.beginFill(0x1b4332); gfx.drawRect(0, h-6, b.w, 6); gfx.endFill();
            gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h-8, b.w, 2); gfx.endFill();

            let treeSeed = 42 + b.x;
            const sr = () => { treeSeed = (treeSeed * 16807) % 2147483647; return (treeSeed - 1) / 2147483646; };
            
            for (let tx = 10; tx < b.w - 10; tx += 15 + sr() * 20) {
                const th = 40 + sr() * 80; 
                const tw = 25 + sr() * 25; 
                
                gfx.beginFill(0x000000, 0.2); gfx.drawEllipse(tx, h - 2, tw*0.6, 4); gfx.endFill();
                gfx.beginFill(0x3d2914); gfx.drawRect(tx - 3, h - 10 - th*0.3, 6, th*0.3 + 10); gfx.endFill();
                
                gfx.beginFill(0x064e3b); 
                gfx.drawPolygon([tx - tw*0.6, h - th*0.2, tx, h - th*0.8, tx + tw*0.6, h - th*0.2]);
                gfx.beginFill(0x065f46); 
                gfx.drawPolygon([tx - tw*0.5, h - th*0.4, tx, h - th*0.9, tx + tw*0.5, h - th*0.4]);
                gfx.beginFill(0x047857); 
                gfx.drawPolygon([tx - tw*0.4, h - th*0.6, tx, h - th, tx + tw*0.4, h - th*0.6]);
                gfx.endFill();
            }
        } 
        else if (b.id.startsWith('house_')) {
            // ─── CEO ESTATES: 7 Architectural Styles by Lab Identity ───
            const labRegion = (LABS[b.lab] && LABS[b.lab].region) ? LABS[b.lab].region : 'eu';
            let estateStyle = 'modern';
            if (b.lab === 'xai') estateStyle = 'brutalist';
            else if (b.lab === 'openai' || b.lab === 'anthropic') estateStyle = 'penthouse';
            else if (b.lab === 'google' || b.lab === 'meta') estateStyle = 'villa';
            else if (b.lab === 'microsoft' || b.lab === 'amazon' || b.lab === 'apple' || b.lab === 'nvidia' || b.lab === 'ibm') estateStyle = 'colonial';
            else if (labRegion === 'eu') estateStyle = 'chateau';
            else if (labRegion === 'cn') estateStyle = 'pagoda';

            // Lawn
            gfx.beginFill(0x1b4332); gfx.drawRect(0, h - 6, b.w, 6); gfx.endFill();
            gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 4, b.w, 2); gfx.endFill();

            if (estateStyle === 'brutalist') {
                // ── xAI: Brutalist Fortress — raw concrete, laser slits, radar dish ──
                gfx.beginFill(0x475569); gfx.drawRect(30, h-80, b.w-60, 80); gfx.endFill();
                gfx.beginFill(0x334155); gfx.drawRect(10, h-55, 50, 55); gfx.endFill();
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-20, h-80, 40, 80); gfx.endFill();
                // Cantilevered overhang
                gfx.beginFill(0x3f4f63); gfx.drawRect(5, h-58, b.w-10, 4); gfx.endFill();
                // Radar dish
                gfx.beginFill(0x0f172a); gfx.drawEllipse(35, h-86, 22, 5); gfx.endFill();
                gfx.lineStyle(2, colHex); gfx.drawCircle(35, h-86, 8); gfx.lineStyle(0);
                // Accent stripe
                gfx.beginFill(colHex); gfx.drawRect(30, h-80, b.w-60, 2); gfx.endFill();
                // Laser slit windows
                for(var sy=h-70; sy<h-10; sy+=14) {
                    gfx.beginFill(0xf87171, 0.3); gfx.drawRect(40, sy, b.w-80, 5); gfx.endFill();
                    gfx.beginFill(0xfca5a5, 0.7); gfx.drawRect(42, sy+1, b.w-84, 2); gfx.endFill();
                }
                // Security bollards
                gfx.beginFill(0x334155);
                for(var boll=0; boll<b.w; boll+=20) { gfx.drawRect(boll, h-8, 4, 8); }
                gfx.endFill();

            } else if (estateStyle === 'penthouse') {
                // ── OpenAI/Anthropic: Glass Penthouse Tower — vertical, premium, illuminated ──
                var pw = b.w - 30;
                gfx.beginFill(0x0f172a); gfx.drawRect(15, h-90, pw, 90); gfx.endFill();
                // Glass curtain wall
                gfx.beginFill(0x1e293b); gfx.drawRect(18, h-86, pw-6, 82); gfx.endFill();
                // Floor-to-ceiling windows (3 floors)
                for(var pf=0; pf<3; pf++) {
                    var wy = h - 82 + pf * 28;
                    gfx.beginFill(0x38bdf8, 0.25); gfx.drawRect(22, wy, pw-14, 22); gfx.endFill();
                    gfx.beginFill(0x7dd3fc, 0.15); gfx.drawRect(22, wy, pw-14, 8); gfx.endFill();
                    // Floor dividers
                    gfx.beginFill(0x334155); gfx.drawRect(18, wy+24, pw-6, 3); gfx.endFill();
                }
                // Rooftop terrace railing
                gfx.beginFill(0xcbd5e1); gfx.drawRect(10, h-92, pw+10, 2); gfx.endFill();
                gfx.lineStyle(1, 0x94a3b8, 0.5);
                for(var rx=14; rx<pw+20; rx+=8) { gfx.moveTo(rx, h-92); gfx.lineTo(rx, h-98); }
                gfx.lineStyle(0);
                // Accent crown
                gfx.beginFill(colHex); gfx.drawRect(15, h-90, pw, 2); gfx.endFill();
                // Rooftop glow
                gfx.beginFill(colHex, 0.15); gfx.drawRect(10, h-98, pw+10, 6); gfx.endFill();
                // Entrance portico
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-20, h-10, 40, 10); gfx.endFill();
                gfx.beginFill(0x38bdf8, 0.3); gfx.drawRect(b.w/2-15, h-8, 30, 6); gfx.endFill();

            } else if (estateStyle === 'villa') {
                // ── Google/Meta: California Villa — warm, open, terracotta, pool accent ──
                // Main body
                gfx.beginFill(0xfef3c7); gfx.drawRect(15, h-55, b.w-30, 55); gfx.endFill();
                gfx.beginFill(0xfde68a); gfx.drawRect(15, h-55, b.w-30, 3); gfx.endFill();
                // Terracotta roof
                gfx.beginFill(0x92400e); gfx.drawRect(10, h-60, b.w-20, 8); gfx.endFill();
                gfx.beginFill(0x78350f); gfx.drawRect(10, h-60, b.w-20, 2); gfx.endFill();
                // Side wing
                gfx.beginFill(0xfef3c7); gfx.drawRect(b.w-45, h-45, 40, 45); gfx.endFill();
                gfx.beginFill(0x92400e); gfx.drawRect(b.w-50, h-50, 48, 7); gfx.endFill();
                // Arched windows
                gfx.beginFill(0x7dd3fc, 0.4);
                for(var vx=28; vx<b.w-50; vx+=24) {
                    gfx.drawRect(vx, h-42, 14, 18);
                    gfx.drawCircle(vx+7, h-42, 7);
                }
                gfx.endFill();
                // Pool accent (small blue rectangle in yard)
                gfx.beginFill(0x22d3ee, 0.4); gfx.drawRoundedRect(5, h-12, 30, 8, 2); gfx.endFill();
                gfx.beginFill(0x67e8f9, 0.3); gfx.drawRect(7, h-11, 26, 3); gfx.endFill();
                // Palm tree silhouette
                gfx.beginFill(0x5c4033); gfx.drawRect(b.w-15, h-30, 3, 24); gfx.endFill();
                gfx.beginFill(0x166534); gfx.drawEllipse(b.w-13, h-32, 12, 6); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(10, h-60, b.w-20, 2); gfx.endFill();

            } else if (estateStyle === 'colonial') {
                // ── Microsoft/Amazon/Apple/Nvidia: Colonial Estate — symmetrical, columned, dignified ──
                // Foundation
                gfx.beginFill(0x94a3b8); gfx.drawRect(10, h-8, b.w-20, 8); gfx.endFill();
                // Main body
                gfx.beginFill(0xf1f5f9); gfx.drawRect(15, h-58, b.w-30, 50); gfx.endFill();
                // Shadow depth
                gfx.beginFill(0xcbd5e1); gfx.drawRect(15, h-58, 3, 50); gfx.endFill();
                // Triangular pediment
                gfx.beginFill(0xe2e8f0);
                gfx.drawPolygon([12, h-58, b.w/2, h-78, b.w-12, h-58]);
                gfx.endFill();
                gfx.beginFill(0x94a3b8);
                gfx.drawPolygon([16, h-58, b.w/2, h-74, b.w-16, h-58]);
                gfx.endFill();
                gfx.beginFill(0xe2e8f0);
                gfx.drawPolygon([20, h-58, b.w/2, h-72, b.w-20, h-58]);
                gfx.endFill();
                // Columns
                gfx.beginFill(0xffffff, 0.7);
                for(var cx=25; cx<b.w-20; cx+=Math.floor((b.w-50)/4)) {
                    gfx.drawRect(cx, h-56, 5, 48);
                    gfx.drawRect(cx-2, h-56, 9, 3);
                    gfx.drawRect(cx-2, h-10, 9, 3);
                }
                gfx.endFill();
                // Symmetrical windows
                gfx.beginFill(0x1e293b, 0.7);
                for(var wx2=35; wx2<b.w-30; wx2+=Math.floor((b.w-70)/3)) {
                    gfx.drawRect(wx2, h-46, 12, 16);
                    gfx.drawRect(wx2, h-26, 12, 12);
                }
                gfx.endFill();
                gfx.beginFill(0xfde68a, 0.4);
                for(var wx3=35; wx3<b.w-30; wx3+=Math.floor((b.w-70)/3)) {
                    gfx.drawRect(wx3+1, h-44, 10, 12);
                }
                gfx.endFill();
                // Grand door
                gfx.beginFill(0x78350f); gfx.drawRect(b.w/2-8, h-22, 16, 14); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawCircle(b.w/2+4, h-15, 1.5); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(12, h-58, b.w-24, 2); gfx.endFill();

            } else if (estateStyle === 'chateau') {
                // ── EU Labs: French Château — mansard roof, dormer windows, stone pillars ──
                // Stone base
                gfx.beginFill(0xe2e8f0); gfx.drawRect(10, h-52, b.w-20, 52); gfx.endFill();
                gfx.beginFill(0xcbd5e1); gfx.drawRect(10, h-52, b.w-20, 3); gfx.drawRect(10, h-52, 3, 52); gfx.endFill();
                // Mansard roof
                gfx.beginFill(0x1e293b);
                gfx.drawPolygon([5, h-52, b.w/2, h-82, b.w-5, h-52]);
                gfx.endFill();
                // Roof shingle texture
                gfx.lineStyle(1, 0x334155, 0.4);
                for(var ry=h-52; ry>h-80; ry-=5) {
                    var xOff = (h-52-ry) * 0.6;
                    gfx.moveTo(7+xOff, ry); gfx.lineTo(b.w-7-xOff, ry);
                }
                gfx.lineStyle(0);
                // Dormer windows (small gabled projections)
                var dw = 16;
                for(var dx=b.w*0.25; dx<b.w*0.8; dx+=b.w*0.25) {
                    gfx.beginFill(0x334155);
                    gfx.drawPolygon([dx-dw/2, h-60, dx, h-70, dx+dw/2, h-60]);
                    gfx.endFill();
                    gfx.beginFill(0xfde68a, 0.6); gfx.drawRect(dx-4, h-60, 8, 8); gfx.endFill();
                }
                // Stone pillars
                gfx.beginFill(0xffffff, 0.3);
                for(var px2=18; px2<b.w-15; px2+=28) { gfx.drawRect(px2, h-52, 5, 52); }
                gfx.endFill();
                // Arched windows with warm glow
                gfx.beginFill(0xfde047, 0.5);
                for(var ax=28; ax<b.w-20; ax+=28) {
                    gfx.drawRect(ax, h-38, 10, 18);
                    gfx.drawCircle(ax+5, h-38, 5);
                }
                gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(5, h-52, b.w-10, 2); gfx.endFill();
                // Topiary hedges
                gfx.beginFill(0x166534);
                gfx.drawCircle(8, h-10, 8); gfx.drawCircle(b.w-8, h-10, 8);
                gfx.endFill();
                gfx.beginFill(0x1b4332);
                gfx.drawCircle(8, h-10, 6); gfx.drawCircle(b.w-8, h-10, 6);
                gfx.endFill();

            } else if (estateStyle === 'pagoda') {
                // ── Chinese Labs: Pagoda Mansion — tiered roofs, red/gold, lanterns ──
                // Main body (dark wood)
                gfx.beginFill(0x44403c); gfx.drawRect(15, h-55, b.w-30, 55); gfx.endFill();
                // Inner wall (warm)
                gfx.beginFill(0x7c2d12, 0.6); gfx.drawRect(18, h-52, b.w-36, 48); gfx.endFill();
                // Solid roof body (dark fill behind all tiers so no sky bleeds through)
                gfx.beginFill(0x1c1917);
                gfx.drawPolygon([10, h-55, b.w/2, h-55-42, b.w-10, h-55]);
                gfx.endFill();
                // Tiered roof layers
                for(var tier=0; tier<3; tier++) {
                    var ty = h - 55 - tier * 14;
                    var tw = (b.w - 10) - tier * 20;
                    var tx = (b.w - tw) / 2;
                    // Curved eaves
                    gfx.beginFill(0x292524);
                    gfx.drawRect(tx, ty, tw, 6);
                    gfx.endFill();
                    // Upturned tips
                    gfx.beginFill(0x292524);
                    gfx.drawPolygon([tx-4, ty+6, tx+6, ty, tx+6, ty+6]);
                    gfx.drawPolygon([tx+tw+4, ty+6, tx+tw-6, ty, tx+tw-6, ty+6]);
                    gfx.endFill();
                    // Gold trim
                    gfx.beginFill(0xfbbf24, 0.7); gfx.drawRect(tx+2, ty+5, tw-4, 1); gfx.endFill();
                }
                // Lattice windows
                gfx.beginFill(0xfde68a, 0.4);
                for(var lx=25; lx<b.w-25; lx+=22) { gfx.drawRect(lx, h-40, 14, 20); }
                gfx.endFill();
                // Window lattice cross-hatching
                gfx.lineStyle(1, 0x44403c, 0.6);
                for(var lx2=25; lx2<b.w-25; lx2+=22) {
                    gfx.moveTo(lx2+7, h-40); gfx.lineTo(lx2+7, h-20);
                    gfx.moveTo(lx2, h-30); gfx.lineTo(lx2+14, h-30);
                }
                gfx.lineStyle(0);
                // Red lanterns
                gfx.beginFill(0xdc2626);
                gfx.drawCircle(20, h-58, 4); gfx.drawCircle(b.w-20, h-58, 4);
                gfx.endFill();
                gfx.beginFill(0xfbbf24, 0.8);
                gfx.drawCircle(20, h-58, 2); gfx.drawCircle(b.w-20, h-58, 2);
                gfx.endFill();
                // Grand red door
                gfx.beginFill(0xb91c1c); gfx.drawRect(b.w/2-10, h-18, 20, 12); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawCircle(b.w/2, h-12, 2); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(15, h-55, b.w-30, 2); gfx.endFill();

            } else {
                // ── Fallback: Minimalist Modern — clean lines, flat roof, subtle glass ──
                gfx.beginFill(0xf8fafc); gfx.drawRect(20, h-55, b.w-40, 55); gfx.endFill();
                gfx.beginFill(0xe2e8f0); gfx.drawRect(20, h-55, b.w-40, 3); gfx.drawRect(20, h-55, 3, 55); gfx.endFill();
                // Flat roof with parapet
                gfx.beginFill(0x0f172a); gfx.drawRect(15, h-58, b.w-30, 5); gfx.endFill();
                // Feature wall (darker accent block)
                gfx.beginFill(0x334155); gfx.drawRect(b.w-50, h-48, 30, 42); gfx.endFill();
                // Panoramic window
                gfx.beginFill(0x38bdf8, 0.35); gfx.drawRect(28, h-44, b.w-80, 22); gfx.endFill();
                gfx.beginFill(0x7dd3fc, 0.15); gfx.drawRect(28, h-44, b.w-80, 8); gfx.endFill();
                // Window mullion
                gfx.beginFill(0xcbd5e1); gfx.drawRect(b.w/2-1, h-44, 2, 22); gfx.endFill();
                // Entrance
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-12, h-14, 24, 8); gfx.endFill();
                gfx.beginFill(0x38bdf8, 0.2); gfx.drawRect(b.w/2-10, h-13, 20, 6); gfx.endFill();
                // Hedges
                gfx.beginFill(0x166534); gfx.drawRoundedRect(2, h-10, 24, 8, 3); gfx.drawRoundedRect(b.w-26, h-12, 24, 10, 3); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(15, h-58, b.w-30, 2); gfx.endFill();
            }
            
            gfx.lineStyle(0); // Safety reset before sign
            const signBg = new PIXI.Graphics();
            signBg.beginFill(0x0a0a1a, 0.8); signBg.lineStyle(1, colHex, 0.5);
            signBg.drawRoundedRect(b.w/2 - 40, h - 10, 80, 8, 2); signBg.endFill();
            container.addChild(signBg);
            
            const signTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 6, fill: colHex, fontWeight: 'bold', dropShadow: true, dropShadowColor: colHex, dropShadowBlur: 0, dropShadowDistance: 0 });
            signTxt.anchor.set(0.5, 0.5); signTxt.x = b.w/2; signTxt.y = h - 6;
            container.addChild(signTxt); b._stationSign = signTxt; b._stationCol = colHex;
        }
        // ─── DATA CENTER BUILDINGS ───
        else if (b.id.startsWith('dc_')) {
            const dc = b.dcData || {};
            const isConstruction = dc.status === 'construction';
            const opCol = colHex || 0x64748b;
            
            if (isConstruction) {
                // ── CONSTRUCTION SITE ──
                // Dirt/foundation
                gfx.beginFill(0x78582e); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
                gfx.beginFill(0x92703a); gfx.drawRect(0, h-6, b.w, 2); gfx.endFill();
                // Partial structure (steel frame)
                gfx.beginFill(0x475569, 0.6); gfx.drawRect(10, h-50, b.w-20, 42); gfx.endFill();
                // Steel beams
                gfx.beginFill(0x64748b);
                for (var cx2=15; cx2<b.w-15; cx2+=25) { gfx.drawRect(cx2, h-50, 4, 42); }
                for (var cy=h-48; cy<h-10; cy+=14) { gfx.drawRect(10, cy, b.w-20, 2); }
                gfx.endFill();
                // Crane
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.7, h-95, 4, 87); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.5, h-95, b.w*0.3, 3); gfx.endFill();
                // Crane cable
                gfx.lineStyle(1, 0x94a3b8); gfx.moveTo(b.w*0.55, h-92); gfx.lineTo(b.w*0.55, h-60); gfx.lineStyle(0);
                // Dangling steel beam
                gfx.beginFill(0x64748b); gfx.drawRect(b.w*0.52, h-62, 8, 3); gfx.endFill();
                // Safety barriers
                gfx.beginFill(0xef4444);
                for (var bx2=0; bx2<b.w; bx2+=20) { gfx.drawRect(bx2, h-10, 8, 2); }
                gfx.endFill();
                // Completion label
                if (dc.completion) {
                    gfx.beginFill(0x000000, 0.7); gfx.drawRect(b.w/2-30, h-30, 60, 12); gfx.endFill();
                }
                // Accent
                gfx.beginFill(opCol); gfx.drawRect(10, h-50, b.w-20, 2); gfx.endFill();
            } else {
                // ── OPERATIONAL DATA CENTER ──
                // Main structure — industrial, heavy
                gfx.beginFill(0x334155); gfx.drawRect(5, h-65, b.w-10, 65); gfx.endFill();
                gfx.beginFill(0x1e293b); gfx.drawRect(8, h-62, b.w-16, 56); gfx.endFill();
                // Roof equipment
                gfx.beginFill(0x475569); gfx.drawRect(5, h-68, b.w-10, 5); gfx.endFill();
                // HVAC units on roof
                gfx.beginFill(0x64748b);
                for (var hvx=15; hvx<b.w-30; hvx+=30) { gfx.drawRect(hvx, h-75, 16, 8); gfx.drawRect(hvx+4, h-78, 8, 4); }
                gfx.endFill();
                // Server room windows (blue glow strips)
                for (var wy2=h-58; wy2<h-12; wy2+=14) {
                    gfx.beginFill(0x06b6d4, 0.3); gfx.drawRect(12, wy2, b.w-24, 8); gfx.endFill();
                    gfx.beginFill(0x22d3ee, 0.15); gfx.drawRect(12, wy2, b.w-24, 3); gfx.endFill();
                }
                // Loading dock
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-15, h-12, 30, 6); gfx.endFill();
                gfx.beginFill(0x475569); gfx.drawRect(b.w/2-12, h-11, 24, 4); gfx.endFill();
                // Security fence posts
                gfx.beginFill(0x475569);
                gfx.drawRect(0, h-8, 3, 8); gfx.drawRect(b.w-3, h-8, 3, 8);
                gfx.endFill();
                // Accent stripe
                gfx.beginFill(opCol); gfx.drawRect(5, h-65, b.w-10, 2); gfx.endFill();
                // Power indicator LEDs
                gfx.beginFill(0x4ade80);
                for (var ledx=20; ledx<b.w-20; ledx+=18) { gfx.drawCircle(ledx, h-64, 1.5); }
                gfx.endFill();
            }
            
            // Name sign — positioned well above roof vents
            var dcSignW = Math.min(b.w - 4, 150);
            var dcSign = new PIXI.Graphics();
            dcSign.beginFill(0x0a0a1a, 0.9); dcSign.lineStyle(1, opCol, 0.6);
            dcSign.drawRoundedRect(b.w/2 - dcSignW/2, -30, dcSignW, 18, 3); dcSign.endFill();
            dcSign.beginFill(0x333333); dcSign.lineStyle(0); dcSign.drawRect(b.w/2 - 10, -12, 4, 12); dcSign.drawRect(b.w/2 + 6, -12, 4, 12); dcSign.endFill();
            container.addChild(dcSign);
            var dcTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 9, fill: opCol, fontWeight: 'bold', letterSpacing: 1, dropShadow: true, dropShadowColor: opCol, dropShadowBlur: 0, dropShadowDistance: 0 });
            dcTxt.anchor.set(0.5, 0.5); dcTxt.x = b.w/2; dcTxt.y = -21;
            if (dcTxt.width > dcSignW - 8) dcTxt.scale.set((dcSignW - 8) / dcTxt.width);
            container.addChild(dcTxt);
            b._dcSign = dcTxt; b._dcCol = opCol;
            if (isConstruction && dc.completion) {
                var compTxt = new PIXI.Text(`EST. ${dc.completion}`, { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xfbbf24 });
                compTxt.anchor.set(0.5, 0.5); compTxt.x = b.w/2; compTxt.y = h-24;
                container.addChild(compTxt);
            }
        }
        // ─── CHIP FAB BUILDINGS ───
        else if (b.id.startsWith('fab_')) {
            const dc = b.dcData || {};
            const isConstruction = dc.status === 'construction';
            const opCol = colHex || 0x64748b;
            
            if (isConstruction) {
                // Construction site (same as DC construction)
                gfx.beginFill(0x78582e); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
                gfx.beginFill(0x475569, 0.6); gfx.drawRect(10, h-50, b.w-20, 42); gfx.endFill();
                gfx.beginFill(0x64748b);
                for (var fx=15; fx<b.w-15; fx+=25) { gfx.drawRect(fx, h-50, 4, 42); }
                gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.6, h-85, 4, 77); gfx.drawRect(b.w*0.4, h-85, b.w*0.3, 3); gfx.endFill();
                gfx.beginFill(opCol); gfx.drawRect(10, h-50, b.w-20, 2); gfx.endFill();
            } else {
                // ── OPERATIONAL CHIP FAB — cleanroom white, precise, sterile ──
                gfx.beginFill(0xe2e8f0); gfx.drawRect(5, h-60, b.w-10, 60); gfx.endFill();
                gfx.beginFill(0xf8fafc); gfx.drawRect(8, h-57, b.w-16, 51); gfx.endFill();
                // Cleanroom yellow lighting strips
                for (var fy2=h-52; fy2<h-10; fy2+=12) {
                    gfx.beginFill(0xfbbf24, 0.2); gfx.drawRect(12, fy2, b.w-24, 6); gfx.endFill();
                    gfx.beginFill(0xfbbf24, 0.1); gfx.drawRect(12, fy2, b.w-24, 2); gfx.endFill();
                }
                // Filtered air intakes on roof
                gfx.beginFill(0xcbd5e1); gfx.drawRect(5, h-63, b.w-10, 5); gfx.endFill();
                gfx.beginFill(0x94a3b8);
                for (var ax=12; ax<b.w-20; ax+=20) { gfx.drawRect(ax, h-68, 12, 6); }
                gfx.endFill();
                // Hazmat markings
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w/2-15, h-8, 30, 2); gfx.endFill();
                // Accent
                gfx.beginFill(opCol); gfx.drawRect(5, h-60, b.w-10, 2); gfx.endFill();
            }
            
            // Name sign
            var fabSignW = Math.min(b.w - 4, 150);
            var fabSign = new PIXI.Graphics();
            fabSign.beginFill(0x0a0a1a, 0.9); fabSign.lineStyle(1, opCol, 0.6);
            fabSign.drawRoundedRect(b.w/2 - fabSignW/2, -30, fabSignW, 18, 3); fabSign.endFill();
            fabSign.beginFill(0x333333); fabSign.lineStyle(0); fabSign.drawRect(b.w/2 - 10, -12, 4, 12); fabSign.drawRect(b.w/2 + 6, -12, 4, 12); fabSign.endFill();
            container.addChild(fabSign);
            var fabTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 9, fill: opCol, fontWeight: 'bold', letterSpacing: 1, dropShadow: true, dropShadowColor: opCol, dropShadowBlur: 0, dropShadowDistance: 0 });
            fabTxt.anchor.set(0.5, 0.5); fabTxt.x = b.w/2; fabTxt.y = -21;
            if (fabTxt.width > fabSignW - 8) fabTxt.scale.set((fabSignW - 8) / fabTxt.width);
            container.addChild(fabTxt);
            b._dcSign = fabTxt; b._dcCol = opCol;
            if (isConstruction && dc.completion) {
                var fabCompTxt = new PIXI.Text(`EST. ${dc.completion}`, { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xfbbf24 });
                fabCompTxt.anchor.set(0.5, 0.5); fabCompTxt.x = b.w/2; fabCompTxt.y = h-24;
                container.addChild(fabCompTxt);
            }
        }
        else if (b.id === 'park') {
          gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 12, b.w, 12); gfx.endFill();
          gfx.beginFill(0x3d7a5f); gfx.drawRect(0, h - 12, b.w, 4); gfx.endFill();
          gfx.lineStyle(2, 0x666666); gfx.moveTo(14, h - 12); gfx.lineTo(22, h - 42); gfx.lineTo(30, h - 12); gfx.moveTo(18, h - 40); gfx.lineTo(26, h - 40); gfx.lineStyle(1, 0x888888); gfx.moveTo(21, h - 39); gfx.lineTo(19, h - 22); gfx.moveTo(23, h - 39); gfx.lineTo(25, h - 22); gfx.lineStyle(0);
          gfx.beginFill(0x8b5cf6); gfx.drawRect(17, h - 22, 10, 3);
          gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 55, h - 12, 4, 30); gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 45, h - 12, 4, 30);
          gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 20, 12, 2); gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 28, 12, 2);
          gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 36, 12, 2); gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 54, h - 42, 14, 4);
          gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.8); gfx.moveTo(b.w - 42, h - 40); gfx.lineTo(b.w - 20, h - 14);
          gfx.lineTo(b.w - 16, h - 14); gfx.lineTo(b.w - 40, h - 40); gfx.closePath(); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.5);
          gfx.drawRect(b.w - 20, h - 16, 6, 4); gfx.endFill();
          
          const monW = 60; const monH = 80;
          gfx.beginFill(0x1a1a30);
          gfx.drawRect(b.w / 2 - monW/2, h - monH, monW, monH); gfx.endFill();
          gfx.beginFill(0x2a2a42);
          gfx.drawRect(b.w / 2 - monW/2 + 4, h - monH + 4, monW - 8, monH - 8); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.8); gfx.drawRect(b.w / 2 - 2, h - monH + 10, 4, monH - 20); gfx.endFill();
          gfx.beginFill(0xfacc15, 0.8);
          gfx.drawRect(b.w / 2 - monW/2 - 4, h - 14, monW + 8, 4); gfx.endFill();
          
          gfx.lineStyle(2, 0xfacc15, 0.5);
          gfx.drawEllipse(b.w / 2, h - monH - 10, 30, 8); 
          gfx.lineStyle(2, 0x22d3ee, 0.5);
          gfx.drawEllipse(b.w / 2, h - monH - 20, 20, 5); gfx.lineStyle(0);
          const monIcon = new PIXI.Text('🏆', { fontFamily: emojiFontStack, fontSize: 28, fill: 0xfacc15, dropShadow: true, dropShadowColor: 0xfacc15, dropShadowBlur: 10, dropShadowDistance: 0 });
          monIcon.anchor.set(0.5, 0.5); monIcon.x = b.w / 2; monIcon.y = h - monH - 25; 
          container.addChild(monIcon); b._monIcon = monIcon;
          b.tip = "Benchmark Monument: Awaiting Scores...";
          
        } else if (b.id === 'black_market') {
          // ── BLACK MARKET — Delegated to BlackMarket module ──
          if (typeof BlackMarket !== 'undefined') {
              BlackMarket.drawZone(gfx, container, b, h);
          }

        } else if (b.id === 'ai_index') {
          // ── GLOBAL AI INDEX BILLBOARD — Delegated to AIIndex module ──
          if (typeof AIIndex !== 'undefined') {
              AIIndex.drawBillboard(gfx, container, b, h);
          }

        } else if (b.id === 'city_park') {
          // ── CENTRAL PARK — Delegated to CityPark module ──
          if (typeof CityPark !== 'undefined') {
              CityPark.drawPark(gfx, container, b, h);
              CityPark.initLampGlows(container, b);
          }

        } else if (b.id === 'graveyard') {
          // ── MEMORIAL PARK — Redesigned graveyard with per-model headstones ──
          // Dark earth ground
          gfx.beginFill(0x111118); gfx.drawRect(0, h - 12, b.w, 12); gfx.endFill();
          gfx.beginFill(0x1a1a28); gfx.drawRect(0, h - 14, b.w, 4); gfx.endFill();
          // Stone path
          gfx.beginFill(0x2a2a3a); gfx.drawRect(10, h - 8, b.w - 20, 4); gfx.endFill();
          for (let px = 12; px < b.w - 20; px += 8) {
              gfx.beginFill(0x333344); gfx.drawRect(px, h - 7, 6, 2); gfx.endFill();
          }
          // Wrought iron fence posts
          gfx.beginFill(0x333344);
          gfx.drawRect(0, h - 30, 3, 20); gfx.drawRect(b.w - 3, h - 30, 3, 20);
          for (let fx = 20; fx < b.w; fx += 20) { gfx.drawRect(fx, h - 28, 2, 16); }
          gfx.endFill();
          // Fence rails
          gfx.beginFill(0x2a2a3a); gfx.drawRect(0, h - 26, b.w, 1); gfx.drawRect(0, h - 18, b.w, 1); gfx.endFill();
          // Fog overlay
          gfx.beginFill(0x444466, 0.06); gfx.drawEllipse(b.w / 2, h - 10, b.w / 2, 14); gfx.endFill();
          
          // Eternal flame (center)
          const flameX = b.w / 2;
          gfx.beginFill(0x333344); gfx.drawRect(flameX - 6, h - 22, 12, 10); gfx.endFill(); // pedestal
          gfx.beginFill(0x444455); gfx.drawRect(flameX - 8, h - 24, 16, 4); gfx.endFill(); // rim
          const flame = new PIXI.Graphics();
          flame.beginFill(0xff6600, 0.7); flame.drawPolygon([flameX - 3, h - 24, flameX, h - 34, flameX + 3, h - 24]); flame.endFill();
          flame.beginFill(0xffaa00, 0.5); flame.drawPolygon([flameX - 2, h - 24, flameX, h - 30, flameX + 2, h - 24]); flame.endFill();
          container.addChild(flame); b._flame = flame;
          
          // Willow trees (left and right)
          for (const wx of [14, b.w - 14]) {
              gfx.beginFill(0x2a2218); gfx.drawRect(wx - 2, h - 55, 4, 43); gfx.endFill();
              // Drooping branches
              gfx.beginFill(0x1b4332, 0.6);
              for (let br = 0; br < 7; br++) {
                  const bx = wx + (br - 3) * 5;
                  const by = h - 55 + br * 1.5;
                  gfx.drawRect(bx - 1, by, 2, 20 + br * 3);
              }
              gfx.endFill();
              gfx.beginFill(0x166534, 0.4);
              gfx.drawEllipse(wx, h - 52, 18, 8); gfx.endFill();
          }
          
          // Per-model headstones
          const retired = G.models ? G.models.filter(m => {
              const stg = getStage(m.rel, m.ret, m.phase);
              return stg === 'retired';
          }) : [];
          const maxStones = Math.min(retired.length, Math.floor((b.w - 60) / 22));
          const stoneStartX = 30;
          b._headstones = [];
          for (let si = 0; si < maxStones; si++) {
              const rm = retired[si];
              const sx = stoneStartX + si * 22;
              const sh = 16 + (si % 3) * 6;
              const labCol = (LABS[rm.lab] && LABS[rm.lab].color) ? parseInt(LABS[rm.lab].color.replace('#',''), 16) : 0x666688;
              // Stone
              gfx.beginFill(0x3a3a4a); gfx.drawRoundedRect(sx, h - 14 - sh, 16, sh, 3); gfx.endFill();
              gfx.beginFill(0x4a4a5a); gfx.drawRoundedRect(sx + 1, h - 13 - sh, 14, sh - 2, 2); gfx.endFill();
              // Cross or lab accent
              gfx.beginFill(labCol, 0.5); gfx.drawRect(sx + 6, h - 12 - sh, 4, 2); gfx.endFill();
              gfx.beginFill(labCol, 0.3); gfx.drawRect(sx + 7, h - 14 - sh + 3, 2, 6); gfx.endFill();
              // Name lines (tiny)
              gfx.beginFill(0x8888aa, 0.3);
              gfx.drawRect(sx + 3, h - 6 - sh + 10, 10, 1);
              gfx.drawRect(sx + 4, h - 6 - sh + 13, 8, 1);
              gfx.endFill();
              b._headstones.push({ x: sx, y: h - 14 - sh, w: 16, h: sh, model: rm });
          }
          
          // Headstone click zones
          const hsHit = new PIXI.Graphics(); hsHit.eventMode = 'static'; hsHit.cursor = 'pointer';
          hsHit.beginFill(0xffffff, 0.001); hsHit.drawRect(stoneStartX, h - 40, maxStones * 22, 30); hsHit.endFill();
          hsHit.on('pointertap', (e) => {
              const lx = e.data.getLocalPosition(container).x;
              const idx = Math.floor((lx - stoneStartX) / 22);
              if (idx >= 0 && idx < maxStones && b._headstones[idx]) {
                  const rm = b._headstones[idx].model;
                  if (typeof UI !== 'undefined') UI.selectModel(rm);
              }
          });
          hsHit.on('pointerover', (e) => {
              const lx = e.data.getLocalPosition(container).x;
              const idx = Math.floor((lx - stoneStartX) / 22);
              if (idx >= 0 && idx < maxStones && b._headstones[idx]) {
                  const rm = b._headstones[idx].model;
                  const elo = BM[rm.id] && BM[rm.id].ELO ? BM[rm.id].ELO : null;
                  const retDate = rm.ret ? new Date(rm.ret).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?';
                  if (typeof UI !== 'undefined') UI.showTooltip(e, `👻 ${rm.name}`, `Retired ${retDate}${elo ? ' · ELO ' + elo : ''}`);
              }
          });
          hsHit.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
          container.addChild(hsHit);
          
          // Count label
          const countTxt = new PIXI.Text(`${retired.length} retired`, { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x6666aa });
          countTxt.anchor.set(0.5, 0); countTxt.x = b.w / 2; countTxt.y = h - 60;
          container.addChild(countTxt); b._graveTxt = countTxt;
          
        } else if (b.id.startsWith('backbone_')) {
          // ── THE BACKBONE: Network Infrastructure Buildings ──
          const bkCol = {
              backbone_landing: 0x0866ff, backbone_ixp: 0x76b900, backbone_ground: 0x22d3ee,
              backbone_cdn: 0xf6821f, backbone_noc: 0xef4444
          }[b.id] || 0x22d3ee;
          // Dark metallic base
          gfx.beginFill(0x0a1020); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          gfx.beginFill(bkCol, 0.04); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          // Subtle panel lines
          for (let px = 0; px < b.w; px += 30) { gfx.beginFill(0x111e30); gfx.drawRect(px, 0, 1, h); gfx.endFill(); }
          // Brand crown band
          gfx.beginFill(bkCol, 0.9); gfx.drawRect(0, 0, b.w, 5); gfx.endFill();
          gfx.beginFill(0xffffff, 0.14); gfx.drawRect(0, 0, b.w, 1); gfx.endFill();
          gfx.beginFill(bkCol, 0.1); gfx.drawRect(0, 5, b.w, 2); gfx.endFill();
          // Floor slabs
          for (let fi = 1; fi < floors; fi++) {
              const fy = fi * 18;
              gfx.beginFill(0x1a2540); gfx.drawRect(0, fy, b.w, 2); gfx.endFill();
          }
          // Windows with cool-toned internal glow
          for (let fi = 0; fi < floors; fi++) {
              for (let wx = 8; wx < b.w - 12; wx += 22) {
                  const wy = fi * 18 + 6;
                  gfx.beginFill(0x0a1830); gfx.drawRect(wx, wy, 16, 10); gfx.endFill();
                  // Screen/LED glow inside (seeded per pane — no rebuild reshuffle)
                  const wn = this._labNoise((b.x | 0) + fi * 131 + wx * 7);
                  const glowCol = [0x22d3ee, 0x4ade80, 0x3b82f6, 0x8b5cf6][Math.floor(wn * 4)];
                  gfx.beginFill(glowCol, 0.08 + this._labNoise((b.x | 0) + fi * 131 + wx * 7 + 1) * 0.1);
                  gfx.drawRect(wx + 1, wy + 1, 14, 8); gfx.endFill();
              }
          }
          // Building-specific features
          if (b.id === 'backbone_landing') {
              // Armored cable entry points at base
              for (let ci = 0; ci < 4; ci++) {
                  const cx = 20 + ci * 40;
                  gfx.beginFill(0x1a2540); gfx.drawRect(cx, h-16, 24, 16); gfx.endFill();
                  gfx.beginFill([0x22d3ee, 0x4ade80, 0xfacc15, 0xf43f5e][ci], 0.3);
                  gfx.drawRect(cx+4, h-12, 16, 3); gfx.endFill();
              }
              // Armored cable stub coming from ground
              gfx.beginFill(0x333850); gfx.drawRect(b.w/2-20, h-8, 40, 8); gfx.endFill();
          } else if (b.id === 'backbone_ixp') {
              // Central hub: data convergence symbol
              gfx.beginFill(bkCol, 0.12); gfx.drawRect(b.w/2-30, h/2-15, 60, 30); gfx.endFill();
              gfx.beginFill(bkCol, 0.06); gfx.drawRect(b.w/2-40, h/2-5, 80, 10); gfx.endFill();
              // Cable junction strips
              for (let si = 0; si < 6; si++) {
                  const sy = h - 20 + si * 3;
                  const col = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6][si];
                  gfx.beginFill(col, 0.2); gfx.drawRect(0, sy, b.w, 2); gfx.endFill();
              }
          } else if (b.id === 'backbone_ground') {
              // Satellite dishes on roof
              for (let di = 0; di < 3; di++) {
                  const dx = 30 + di * 55;
                  // Dish mount
                  gfx.beginFill(0x64748b); gfx.drawRect(dx+10, 6, 4, 16); gfx.endFill();
                  // Dish
                  gfx.beginFill(0xcbd5e1, 0.25);
                  gfx.drawEllipse(dx+12, 6, 22, 8); gfx.endFill();
                  gfx.beginFill(0xe2e8f0, 0.15);
                  gfx.drawEllipse(dx+12, 6, 18, 6); gfx.endFill();
                  // Feed horn
                  gfx.beginFill(0xa855f7, 0.5); gfx.drawCircle(dx+12, 6, 2); gfx.endFill();
              }
          } else if (b.id === 'backbone_cdn') {
              // Edge cache indicators
              for (let ri = 0; ri < 5; ri++) {
                  const ry = 10 + ri * (floors * 18) / 5;
                  gfx.beginFill(0xf97316, 0.08); gfx.drawRect(4, ry, b.w-8, 8); gfx.endFill();
                  // Status bar
                  const fill = 0.4 + this._labNoise((b.x | 0) + ri * 47) * 0.6;
                  gfx.beginFill(0x4ade80, 0.2); gfx.drawRect(6, ry+2, (b.w-12)*fill, 4); gfx.endFill();
              }
          } else if (b.id === 'backbone_noc') {
              // Large NOC: monitoring screens visible through windows
              for (let fi = 1; fi < floors - 1; fi++) {
                  const fy = fi * 18 + 4;
                  // Large screen arrays
                  for (let sx = 10; sx < b.w - 20; sx += 35) {
                      gfx.beginFill(0x0a0818); gfx.drawRect(sx, fy, 28, 12); gfx.endFill();
                      gfx.beginFill(bkCol, 0.06); gfx.drawRect(sx+1, fy+1, 26, 10); gfx.endFill();
                  }
              }
              // Rooftop antenna array
              for (let ai = 0; ai < 3; ai++) {
                  const ax = 40 + ai * 65;
                  gfx.beginFill(0x64748b); gfx.drawRect(ax, -8, 3, 12); gfx.endFill();
                  gfx.beginFill(0x94a3b8); gfx.drawRect(ax-5, -4, 13, 2); gfx.endFill();
                  gfx.beginFill(0xef4444, 0.5); gfx.drawCircle(ax+1, -8, 1.5); gfx.endFill();
              }
          }
          // Base / foundation
          gfx.beginFill(0x111e30); gfx.drawRect(0, h-4, b.w, 4); gfx.endFill();
          gfx.beginFill(bkCol, 0.1); gfx.drawRect(0, h-4, b.w, 1); gfx.endFill();

        } else if (b.id.startsWith('agents_')) {
          // ── AGENT DISTRICT BUILDINGS — per-facility accent + rooftop emblem ──
          const agCol = {
              agents_orchestrator: 0x22d3ee, agents_toolshop: 0xa855f7,
              agents_sandbox: 0x4ade80, agents_deploy: 0xf97316, agents_memory: 0x8b5cf6
          }[b.id] || 0xf43f5e;
          // Dark base with tinted accent
          gfx.beginFill(0x0c0a18); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          gfx.beginFill(agCol, 0.05); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          // Vertical panel lines (circuit board feel)
          for (let px = 0; px < b.w; px += 28) { gfx.beginFill(0x14101e); gfx.drawRect(px, 0, 1, h); gfx.endFill(); }
          // Brand crown band
          gfx.beginFill(agCol, 0.9); gfx.drawRect(0, 0, b.w, 5); gfx.endFill();
          gfx.beginFill(0xffffff, 0.14); gfx.drawRect(0, 0, b.w, 1); gfx.endFill();
          gfx.beginFill(agCol, 0.1); gfx.drawRect(0, 5, b.w, 3); gfx.endFill();
          // Left edge highlight (glass tube read)
          gfx.beginFill(0xffffff, 0.03); gfx.drawRect(0, 8, 3, h - 8); gfx.endFill();
          // Floor slabs
          for (let fi = 1; fi < floors; fi++) {
              const fy = fi * 18;
              gfx.beginFill(0x1a1530); gfx.drawRect(0, fy, b.w, 2); gfx.endFill();
          }
          // Windows — warm rose/amber glow (distinct from backbone's cyan)
          for (let fi = 0; fi < floors; fi++) {
              for (let wx = 8; wx < b.w - 12; wx += 22) {
                  const wy = fi * 18 + 6;
                  gfx.beginFill(0x0a0818); gfx.drawRect(wx, wy, 16, 10); gfx.endFill();
                  const glowCols = [0xf43f5e, 0xfbbf24, 0xa855f7, 0x4ade80, 0x22d3ee];
                  const gn = this._labNoise((b.x | 0) + fi * 131 + wx * 7);
                  const gc = glowCols[Math.floor(gn * glowCols.length)];
                  gfx.beginFill(gc, 0.08 + this._labNoise((b.x | 0) + fi * 131 + wx * 7 + 1) * 0.12);
                  gfx.drawRect(wx+2, wy+2, 12, 6); gfx.endFill();
              }
          }
          // Building-specific details
          if (b.id === 'agents_orchestrator') {
              // Workflow graph etched on facade (3 connected nodes)
              const cy = h * 0.5;
              gfx.beginFill(agCol, 0.12); gfx.drawCircle(b.w*0.25, cy, 6); gfx.drawCircle(b.w*0.5, cy-6, 6); gfx.drawCircle(b.w*0.75, cy, 6); gfx.endFill();
              gfx.lineStyle(1, agCol, 0.08); gfx.moveTo(b.w*0.25+6, cy); gfx.lineTo(b.w*0.5-6, cy-6); gfx.moveTo(b.w*0.5+6, cy-6); gfx.lineTo(b.w*0.75-6, cy); gfx.lineStyle(0);
          } else if (b.id === 'agents_sandbox') {
              // Arena bars — benchmark indicator
              for (let bi = 0; bi < 5; bi++) {
                  const bh = 6 + this._labNoise((b.x | 0) + bi * 29) * 12;
                  const bc = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e, 0x8b5cf6][bi];
                  gfx.beginFill(bc, 0.12); gfx.drawRect(b.w*0.2 + bi*14, h*0.6-bh, 8, bh); gfx.endFill();
              }
          } else if (b.id === 'agents_memory') {
              // Memory rings (concentric circles)
              for (let ri = 0; ri < 3; ri++) {
                  gfx.lineStyle(1, 0xa855f7, 0.08 + ri * 0.04);
                  gfx.drawCircle(b.w/2, h*0.5, 10+ri*8);
              }
              gfx.lineStyle(0);
          } else if (b.id === 'agents_toolshop') {
              // Tool rack lines (horizontal slots)
              for (let ti = 0; ti < 4; ti++) {
                  gfx.beginFill(0xfbbf24, 0.06); gfx.drawRect(b.w*0.15, h*0.3+ti*12, b.w*0.7, 2); gfx.endFill();
              }
          }
          // Rooftop antenna array (agent communication)
          if (b.id === 'agents_orchestrator' || b.id === 'agents_sandbox') {
              for (let ai = 0; ai < 3; ai++) {
                  const ax = 30 + ai * 60;
                  gfx.beginFill(0x64748b); gfx.drawRect(ax, -8, 2, 12); gfx.endFill();
                  gfx.beginFill(agCol, 0.5); gfx.drawCircle(ax+1, -9, 1.5); gfx.endFill();
              }
          }
          // Per-building rooftop emblem
          this._drawAgentEmblem(gfx, b, b.w / 2, -14, agCol);
          // Base / foundation
          gfx.beginFill(0x14101e); gfx.drawRect(0, h-4, b.w, 4); gfx.endFill();
          gfx.beginFill(agCol, 0.1); gfx.drawRect(0, h-4, b.w, 1); gfx.endFill();

        } else if (b.id.startsWith('power_')) {
          // ── POWER GRID ZONE BUILDINGS — each modeled on a real 2026 AI-energy facility ──
          if (b.id === 'power_solar') {
            // Ground pad with dust gradient
            gfx.beginFill(0x2a2a20); gfx.drawRect(0, h-10, b.w, 10); gfx.endFill();
            gfx.beginFill(0x3a3a2c); gfx.drawRect(0, h-10, b.w, 3); gfx.endFill();
            // Perimeter fence posts
            gfx.beginFill(0x4b5563, 0.6);
            for (let fx2 = 2; fx2 < b.w; fx2 += 16) gfx.drawRect(fx2, h-16, 1.5, 7);
            gfx.endFill();
            gfx.beginFill(0x64748b, 0.25); gfx.drawRect(0, h-15, b.w, 1); gfx.endFill();
            // Megapack-style battery containers (the BESS half of Solar + Storage)
            for (let bi = 0; bi < 2; bi++) {
                const bx2 = b.w - 78 + bi * 30;
                gfx.beginFill(0xe5e7eb); gfx.drawRect(bx2, h-32, 26, 22); gfx.endFill();
                gfx.beginFill(0xcbd5e1); gfx.drawRect(bx2, h-32, 26, 3); gfx.endFill();
                gfx.beginFill(0x9ca3af); gfx.drawRect(bx2, h-14, 26, 2); gfx.endFill();
                // Vent slats + charge LED
                gfx.beginFill(0x94a3b8, 0.6);
                for (let vy2 = h-27; vy2 < h-15; vy2 += 4) gfx.drawRect(bx2 + 3, vy2, 20, 1.5);
                gfx.endFill();
                gfx.beginFill(0x4ade80); gfx.drawCircle(bx2 + 22, h-29, 1.5); gfx.endFill();
            }
            // Inverter shed
            gfx.beginFill(0x475569); gfx.drawRect(b.w-40, h-52, 32, 18); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(b.w-40, h-54, 32, 3); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.4); gfx.drawRect(b.w-33, h-48, 9, 7); gfx.endFill();
            gfx.beginFill(0x64748b); gfx.drawRect(b.w-24, h-34, 3, 2); gfx.endFill(); // conduit
            // Sun-tracking panel rows
            const dp = G.getDayPhase();
            const tilt = dp < 0.25 || dp > 0.83 ? 0 : Math.sin(((dp - 0.25) / 0.58) * Math.PI) * 0.4;
            for (let px = 8; px < b.w - 90; px += 32) {
                gfx.beginFill(0x64748b); gfx.drawRect(px + 13, h - 38, 3, 28); gfx.endFill();
                gfx.beginFill(0x64748b); gfx.drawRect(px + 4, h - 38, 22, 2); gfx.endFill();
                const py = h - 44 - tilt * 8;
                gfx.beginFill(0x1e3a8a); gfx.drawRect(px, py, 28, 10); gfx.endFill();
                gfx.beginFill(0x2563eb, 0.5); gfx.drawRect(px + 1, py + 1, 12, 8); gfx.drawRect(px + 15, py + 1, 12, 8); gfx.endFill();
                // Glass glint tracks the sun
                gfx.beginFill(0x93c5fd, 0.35); gfx.drawRect(px + 2 + tilt * 30, py + 1, 5, 8); gfx.endFill();
                gfx.beginFill(0x3b82f6, 0.3); gfx.drawRect(px, py, 28, 2); gfx.endFill();
            }
          } else if (b.id === 'power_wind') {
            // Grassy ridge base
            gfx.beginFill(0x2a2a20); gfx.drawRect(0, h-10, b.w, 10); gfx.endFill();
            gfx.beginFill(0x2d4a2d, 0.7); gfx.drawRect(0, h-11, b.w, 4); gfx.endFill();
            gfx.beginFill(0x3a5c3a, 0.5);
            for (let gx2 = 6; gx2 < b.w; gx2 += 14) gfx.drawRect(gx2, h-13, 2, 3);
            gfx.endFill();
            // Control cabin
            gfx.beginFill(0x475569); gfx.drawRect(5, h-26, 25, 16); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(5, h-28, 25, 3); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(10, h-22, 8, 6); gfx.endFill();
            // Towers (hubs stay at h-72 — PowerEnv blade anchors depend on it)
            for (let ti = 0; ti < 3; ti++) {
                const tx = 40 + ti * 45;
                // Foundation
                gfx.beginFill(0x94a3b8); gfx.drawRect(tx - 7, h - 12, 14, 4); gfx.endFill();
                gfx.beginFill(0x6b7280); gfx.drawRect(tx - 5, h - 13, 10, 2); gfx.endFill();
                // Tapered tower with shade side
                gfx.beginFill(0xf1f5f9, 0.9);
                gfx.moveTo(tx - 4.5, h - 10); gfx.lineTo(tx - 2, h - 72); gfx.lineTo(tx + 2, h - 72); gfx.lineTo(tx + 4.5, h - 10);
                gfx.closePath(); gfx.endFill();
                gfx.beginFill(0xcbd5e1, 0.7);
                gfx.moveTo(tx + 1, h - 10); gfx.lineTo(tx + 1.2, h - 72); gfx.lineTo(tx + 2, h - 72); gfx.lineTo(tx + 4.5, h - 10);
                gfx.closePath(); gfx.endFill();
                // Access door
                gfx.beginFill(0x475569); gfx.drawRect(tx - 2, h - 18, 4, 8); gfx.endFill();
                // Nacelle + hub + red aviation beacon
                gfx.beginFill(0xe2e8f0); gfx.drawRoundedRect(tx - 6, h - 76, 12, 7, 2); gfx.endFill();
                gfx.beginFill(0xb6c2ce); gfx.drawRect(tx - 6, h - 70.5, 12, 1.5); gfx.endFill();
                gfx.beginFill(0x94a3b8); gfx.drawCircle(tx, h - 72, 4); gfx.endFill();
                gfx.beginFill(0xef4444, 0.8); gfx.drawCircle(tx, h - 77.5, 1.3); gfx.endFill();
            }
          } else if (b.id === 'power_nuclear') {
            // ── CRANE CLEAN ENERGY CENTER (Three Mile Island Unit 1 restart) ──
            gfx.beginFill(0x6b7280); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            gfx.beginFill(0x7d8896); gfx.drawRect(0, h-8, b.w, 2); gfx.endFill();
            // Twin hyperboloid cooling towers (the TMI skyline)
            [26, 78].forEach(cx2 => {
                // Waisted profile
                gfx.beginFill(0xd6d9dd);
                gfx.moveTo(cx2 - 22, h - 8);
                gfx.lineTo(cx2 - 12, h - 62); gfx.lineTo(cx2 - 15, h - 108);
                gfx.lineTo(cx2 + 15, h - 108); gfx.lineTo(cx2 + 12, h - 62);
                gfx.lineTo(cx2 + 22, h - 8);
                gfx.closePath(); gfx.endFill();
                // Shade side
                gfx.beginFill(0xaab2bb, 0.8);
                gfx.moveTo(cx2 + 6, h - 8);
                gfx.lineTo(cx2 + 5, h - 62); gfx.lineTo(cx2 + 7, h - 108);
                gfx.lineTo(cx2 + 15, h - 108); gfx.lineTo(cx2 + 12, h - 62);
                gfx.lineTo(cx2 + 22, h - 8);
                gfx.closePath(); gfx.endFill();
                // Rim + interior dark lip
                gfx.beginFill(0x8d949c); gfx.drawRect(cx2 - 15, h - 110, 30, 4); gfx.endFill();
                gfx.beginFill(0x565e66); gfx.drawRect(cx2 - 12, h - 108, 24, 2); gfx.endFill();
                // Horizontal band lines
                gfx.beginFill(0xb9bfc6, 0.5);
                gfx.drawRect(cx2 - 19, h - 30, 38, 1.5);
                gfx.drawRect(cx2 - 14, h - 62, 28, 1.5);
                gfx.drawRect(cx2 - 14, h - 88, 29, 1.5);
                gfx.endFill();
            });
            // Containment dome (Unit 1 — the one that runs)
            gfx.beginFill(0xc7ccd1); gfx.drawCircle(b.w - 42, h - 44, 24); gfx.endFill();
            gfx.beginFill(0x9aa2ab, 0.7); gfx.drawCircle(b.w - 36, h - 40, 20); gfx.endFill();
            gfx.beginFill(0xc7ccd1); gfx.drawCircle(b.w - 44, h - 46, 19); gfx.endFill();
            gfx.beginFill(0x565e66); gfx.drawRect(b.w - 66, h - 44, 48, 36); gfx.endFill();
            // Turbine hall connecting dome to towers
            gfx.beginFill(0x334155); gfx.drawRect(b.w - 78, h - 36, 70, 28); gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(b.w - 78, h - 38, 70, 3); gfx.endFill();
            for (let wx = b.w - 72; wx < b.w - 14; wx += 15) { gfx.beginFill(0x22d3ee, 0.35); gfx.drawRect(wx, h - 30, 9, 8); gfx.endFill(); }
            // Microsoft PPA accent — the whole plant is sold to one buyer
            gfx.beginFill(0x0ea5e9, 0.55); gfx.drawRect(b.w - 78, h - 40, 70, 2); gfx.endFill();
            // Switchyard: transformer + bushings
            gfx.beginFill(0x374151); gfx.drawRect(104, h - 26, 18, 18); gfx.endFill();
            gfx.beginFill(0x6b7280); gfx.drawRect(106, h - 32, 2, 6); gfx.drawRect(112, h - 32, 2, 6); gfx.drawRect(118, h - 32, 2, 6); gfx.endFill();
            gfx.beginFill(0xe5e7eb, 0.8); gfx.drawCircle(107, h - 33, 1.2); gfx.drawCircle(113, h - 33, 1.2); gfx.drawCircle(119, h - 33, 1.2); gfx.endFill();
            // Radiological warning placard
            gfx.beginFill(0xfbbf24, 0.85); gfx.drawRect(126, h - 22, 10, 10); gfx.endFill();
            gfx.beginFill(0x1f2937); gfx.drawCircle(131, h - 17, 2.4); gfx.endFill();
            gfx.beginFill(0xfbbf24); gfx.drawCircle(131, h - 17, 1); gfx.endFill();
          } else if (b.id === 'power_coal') {
            // ── GAS TURBINE ARRAY (the Colossus Memphis pattern) ──
            gfx.beginFill(0x4b5563); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            gfx.beginFill(0x5b6673); gfx.drawRect(0, h-8, b.w, 2); gfx.endFill();
            // Rows of mobile turbine gensets: intake box + turbine can + exhaust stack
            for (let gi = 0; gi < 4; gi++) {
                const gx2 = 6 + gi * 30;
                // Intake filter house
                gfx.beginFill(0x9ca3af); gfx.drawRect(gx2, h - 34, 10, 26); gfx.endFill();
                gfx.beginFill(0x6b7280, 0.7);
                for (let ly2 = h - 31; ly2 < h - 12; ly2 += 4) gfx.drawRect(gx2 + 1.5, ly2, 7, 1.5);
                gfx.endFill();
                // Turbine container (white trailer unit)
                gfx.beginFill(0xe5e7eb); gfx.drawRect(gx2 + 10, h - 26, 16, 18); gfx.endFill();
                gfx.beginFill(0xf3f4f6); gfx.drawRect(gx2 + 10, h - 26, 16, 3); gfx.endFill();
                gfx.beginFill(0x9ca3af); gfx.drawRect(gx2 + 10, h - 10, 16, 2); gfx.endFill();
                // Exhaust stack with heat-darkened tip
                gfx.beginFill(0xb0b7bf); gfx.drawRect(gx2 + 17, h - 58, 7, 32); gfx.endFill();
                gfx.beginFill(0x8a929b); gfx.drawRect(gx2 + 21.5, h - 58, 2.5, 32); gfx.endFill();
                gfx.beginFill(0x4b5563); gfx.drawRect(gx2 + 16, h - 62, 9, 5); gfx.endFill();
                gfx.beginFill(0xef4444, 0.7); gfx.drawCircle(gx2 + 20.5, h - 63.5, 1.2); gfx.endFill();
            }
            // Substation transformer feeding the campus next door
            gfx.beginFill(0x374151); gfx.drawRect(b.w - 34, h - 30, 22, 22); gfx.endFill();
            gfx.beginFill(0x6b7280); gfx.drawRect(b.w - 31, h - 36, 2, 6); gfx.drawRect(b.w - 24, h - 36, 2, 6); gfx.drawRect(b.w - 17, h - 36, 2, 6); gfx.endFill();
            gfx.beginFill(0xfbbf24, 0.6); gfx.drawRect(b.w - 34, h - 30, 22, 2); gfx.endFill();
            // Hazard chevrons on the pad
            gfx.beginFill(0xfbbf24, 0.25);
            for (let sx2 = 0; sx2 < b.w; sx2 += 14) gfx.drawRect(sx2, h - 10, 7, 3);
            gfx.endFill();
          } else if (b.id === 'power_hydro') {
            // ── COLUMBIA HYDRO — stepped gravity dam with live spillways ──
            // Reservoir hint behind crest
            gfx.beginFill(0x155e75, 0.5); gfx.drawRect(0, h - 78, b.w, 6); gfx.endFill();
            // Dam face (stepped concrete, wider at base)
            gfx.beginFill(0x9aa5b1);
            gfx.moveTo(5, h - 74); gfx.lineTo(14, h - 52); gfx.lineTo(20, h - 30); gfx.lineTo(25, h - 8);
            gfx.lineTo(b.w - 25, h - 8); gfx.lineTo(b.w - 20, h - 30); gfx.lineTo(b.w - 14, h - 52); gfx.lineTo(b.w - 5, h - 74);
            gfx.closePath(); gfx.endFill();
            // Shade side + expansion joint lines
            gfx.beginFill(0x7d8896, 0.6);
            gfx.moveTo(b.w * 0.62, h - 74); gfx.lineTo(b.w * 0.66, h - 8); gfx.lineTo(b.w - 25, h - 8);
            gfx.lineTo(b.w - 14, h - 52); gfx.lineTo(b.w - 5, h - 74);
            gfx.closePath(); gfx.endFill();
            gfx.beginFill(0x6e7987, 0.5);
            for (let jx = 40; jx < b.w - 40; jx += 24) gfx.drawRect(jx, h - 70, 1.5, 60);
            gfx.endFill();
            // Crest road + railing + gantry crane
            gfx.beginFill(0x64748b); gfx.drawRect(2, h - 78, b.w - 4, 5); gfx.endFill();
            gfx.beginFill(0x94a3b8, 0.7);
            for (let rx2 = 6; rx2 < b.w - 6; rx2 += 10) gfx.drawRect(rx2, h - 82, 1.2, 4);
            gfx.endFill();
            gfx.beginFill(0xfbbf24); gfx.drawRect(b.w * 0.3, h - 92, 3, 14); gfx.drawRect(b.w * 0.3 - 6, h - 92, 16, 3); gfx.endFill();
            // Spillway gates with falling water + stilling-basin foam
            [b.w * 0.32, b.w * 0.5, b.w * 0.68].forEach(sx3 => {
                gfx.beginFill(0x334155); gfx.drawRect(sx3 - 7, h - 68, 14, 8); gfx.endFill();
                gfx.beginFill(0x7dd3fc, 0.55); gfx.drawRect(sx3 - 5, h - 60, 10, 50); gfx.endFill();
                gfx.beginFill(0xe0f2fe, 0.5); gfx.drawRect(sx3 - 2, h - 60, 3, 50); gfx.endFill();
                gfx.beginFill(0xffffff, 0.45); gfx.drawEllipse(sx3, h - 9, 9, 3.5); gfx.endFill();
            });
            // Powerhouse at the toe with lit windows
            gfx.beginFill(0x475569); gfx.drawRect(b.w/2 - 22, h - 26, 44, 18); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(b.w/2 - 22, h - 28, 44, 3); gfx.endFill();
            gfx.beginFill(0xfbbf24, 0.5); gfx.drawRect(b.w/2 - 16, h - 21, 8, 6); gfx.drawRect(b.w/2 - 4, h - 21, 8, 6); gfx.drawRect(b.w/2 + 8, h - 21, 8, 6); gfx.endFill();
          } else if (b.id === 'power_smr') {
            // ── HERMES 2 SMR (Kairos × Google) — under construction ──
            gfx.beginFill(0x8b7355, 0.5); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill(); // dirt site
            gfx.beginFill(0x6b7280); gfx.drawRect(4, h-10, b.w-8, 3); gfx.endFill();
            // Reactor hall (modern, teal-trimmed)
            gfx.beginFill(0x334155); gfx.drawRect(10, h - 48, 66, 40); gfx.endFill();
            gfx.beginFill(0x2dd4bf, 0.6); gfx.drawRect(10, h - 50, 66, 3); gfx.endFill();
            for (let wx = 16; wx < 68; wx += 16) { gfx.beginFill(0x2dd4bf, 0.3); gfx.drawRect(wx, h - 42, 10, 8); gfx.endFill(); }
            // Google offtake accent — four dots
            [[0x4285f4, 22], [0xea4335, 32], [0xfbbc05, 42], [0x34a853, 52]].forEach(([dc, dx2]) => {
                gfx.beginFill(dc, 0.9); gfx.drawCircle(dx2, h - 20, 2); gfx.endFill();
            });
            // Twin reactor modules with dome caps (one still skeletal)
            gfx.beginFill(0xd1d5db); gfx.drawRect(86, h - 40, 18, 32); gfx.endFill();
            gfx.beginFill(0xd1d5db); gfx.drawCircle(95, h - 40, 9); gfx.endFill();
            gfx.beginFill(0x9ca3af, 0.6); gfx.drawRect(99, h - 40, 5, 32); gfx.endFill();
            // Second module: scaffolding lattice only
            gfx.lineStyle(1, 0xf59e0b, 0.7);
            gfx.drawRect(112, h - 38, 18, 30);
            gfx.moveTo(112, h - 38); gfx.lineTo(130, h - 8);
            gfx.moveTo(130, h - 38); gfx.lineTo(112, h - 8);
            gfx.moveTo(112, h - 23); gfx.lineTo(130, h - 23);
            gfx.lineStyle(0);
            // Tower crane over the site
            gfx.beginFill(0xf59e0b); gfx.drawRect(120, h - 74, 3, 66); gfx.endFill();
            gfx.beginFill(0xf59e0b); gfx.drawRect(96, h - 74, 52, 3); gfx.endFill();
            gfx.beginFill(0xf59e0b, 0.7); gfx.drawRect(142, h - 71, 2, 8); gfx.endFill(); // counter-jib tie
            gfx.beginFill(0x94a3b8); gfx.drawRect(103, h - 71, 1.5, 16); gfx.endFill(); // hook cable
            gfx.beginFill(0x6b7280); gfx.drawRect(100, h - 55, 8, 3); gfx.endFill();   // hook block
            gfx.beginFill(0xef4444, 0.8); gfx.drawCircle(121.5, h - 76, 1.5); gfx.endFill();
          } else if (b.id === 'power_fusion') {
            // ── POLARIS FUSION (Helion × Microsoft) — pulsed FRC machine hall ──
            gfx.beginFill(0x1f2430); gfx.drawRect(0, h - 8, b.w, 8); gfx.endFill();
            // Sleek dark hall
            gfx.beginFill(0x171c28); gfx.drawRect(8, h - 54, b.w - 16, 46); gfx.endFill();
            gfx.beginFill(0x232a3a); gfx.drawRect(8, h - 54, b.w - 16, 4); gfx.endFill();
            // Roofline LED strip (Helion purple)
            gfx.beginFill(0xc084fc, 0.7); gfx.drawRect(8, h - 56, b.w - 16, 2); gfx.endFill();
            // Capacitor bank containers flanking the porthole
            [[16, h - 34], [b.w - 44, h - 34]].forEach(([cx3, cy3]) => {
                gfx.beginFill(0x374151); gfx.drawRect(cx3, cy3, 28, 26); gfx.endFill();
                gfx.beginFill(0x4b5563); gfx.drawRect(cx3, cy3, 28, 3); gfx.endFill();
                gfx.beginFill(0xc084fc, 0.5);
                for (let ly3 = cy3 + 6; ly3 < cy3 + 22; ly3 += 5) gfx.drawRect(cx3 + 3, ly3, 22, 1.5);
                gfx.endFill();
                gfx.beginFill(0xfbbf24, 0.8); gfx.drawCircle(cx3 + 24, cy3 + 4.5, 1.2); gfx.endFill();
            });
            // Central porthole revealing the FRC plasma (glow ring animated by PowerEnv)
            const pcx = b.w / 2, pcy = h - 32;
            gfx.beginFill(0x0b0e16); gfx.drawCircle(pcx, pcy, 15); gfx.endFill();
            gfx.lineStyle(2, 0x475569, 0.9); gfx.drawCircle(pcx, pcy, 15); gfx.lineStyle(0);
            gfx.beginFill(0xf0abfc, 0.25); gfx.drawCircle(pcx, pcy, 11); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.35); gfx.drawCircle(pcx, pcy, 7); gfx.endFill();
            gfx.beginFill(0xffffff, 0.5); gfx.drawCircle(pcx, pcy, 2.5); gfx.endFill();
            // Pulsing plasma halo — registered with PowerEnv for animation
            const plasmaGlow = new PIXI.Graphics();
            plasmaGlow.beginFill(0xe879f9, 0.5); plasmaGlow.drawCircle(0, 0, 13); plasmaGlow.endFill();
            plasmaGlow.beginFill(0x22d3ee, 0.4); plasmaGlow.drawCircle(0, 0, 8); plasmaGlow.endFill();
            plasmaGlow.blendMode = PIXI.BLEND_MODES.ADD;
            plasmaGlow.x = pcx; plasmaGlow.y = pcy;
            container.addChild(plasmaGlow);
            if (typeof PowerEnv !== 'undefined') {
                if (!PowerEnv.fusionGlows) PowerEnv.fusionGlows = [];
                PowerEnv.fusionGlows.push(plasmaGlow);
            }
          }
          gfx.beginFill(0x000000, 0.1); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          
        } else if (b.id.startsWith('port_')) {
          // ── PORT / TRADE ZONE BUILDINGS — the 2026 chip-war waterfront ──
          if (b.id === 'port_authority') {
            // Port Authority — official maritime tower with harbor radar
            gfx.beginFill(0x1a2838); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
            gfx.beginFill(0x223848); gfx.drawRect(0, 0, 8, h); gfx.drawRect(b.w-8, 0, 8, h); gfx.endFill();
            gfx.beginFill(0x2a4858); gfx.drawRect(-2, -4, b.w+4, 8); gfx.endFill();
            // Pilot-boat orange band (international harbor authority stripe)
            gfx.beginFill(0xf97316, 0.7); gfx.drawRect(0, 8, b.w, 3); gfx.endFill();
            for (let fy = 16; fy < h-12; fy += 18) for (let fx = 16; fx < b.w-16; fx += 20) { gfx.beginFill(0xfbbf24, 0.5); gfx.drawRect(fx, fy, 12, 10); gfx.endFill(); }
            // Top-floor harbor-control glazing (cyan, watching the quay)
            gfx.beginFill(0x22d3ee, 0.35); gfx.drawRect(12, 14, b.w-24, 9); gfx.endFill();
            gfx.beginFill(0x0a1628); gfx.drawRect(b.w/2-10, h-16, 20, 16); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(b.w/2-8, h-14, 16, 2); gfx.endFill();
            // Radar mast + dish and signal halyard
            gfx.beginFill(0x94a3b8); gfx.drawRect(b.w/2-1.5, -20, 3, 16); gfx.endFill();
            gfx.beginFill(0xe2e8f0); gfx.drawPolygon([b.w/2-8, -18, b.w/2, -24, b.w/2+8, -18]); gfx.endFill();
            gfx.beginFill(0xef4444, 0.9); gfx.drawCircle(b.w/2, -25.5, 1.5); gfx.endFill();
            gfx.beginFill(0xef4444); gfx.drawRect(b.w-24, -14, 7, 5); gfx.endFill();  // signal flags
            gfx.beginFill(0xfbbf24); gfx.drawRect(b.w-24, -8, 7, 5); gfx.endFill();
            gfx.beginFill(0x64748b); gfx.drawRect(b.w-18, -16, 1.5, 16); gfx.endFill();
            // Quay bollards
            gfx.beginFill(0x334155); gfx.drawRect(6, h-6, 5, 6); gfx.drawRect(b.w-11, h-6, 5, 6); gfx.endFill();
            const anch = new PIXI.Text('⚓', { fontFamily: emojiFontStack, fontSize: 14 }); anch.anchor.set(0.5,0.5); anch.x=b.w/2; anch.y=-32; container.addChild(anch);
          } else if (b.id === 'port_customs') {
            // Export Control Office — federal navy facade, barrier gate, gold seal
            gfx.beginFill(0x14213d); gfx.drawRect(0, 0, b.w-26, h); gfx.endFill();
            gfx.beginFill(0x1d2d50); gfx.drawRect(0, 0, 6, h); gfx.drawRect(b.w-32, 0, 6, h); gfx.endFill();
            gfx.beginFill(0xe5e7eb, 0.9); gfx.drawRect(-2, -4, b.w-22, 6); gfx.endFill(); // white cornice
            // Portico columns
            gfx.beginFill(0xd1d5db, 0.85);
            for (let cx2 = 12; cx2 < b.w-38; cx2 += 18) gfx.drawRect(cx2, h-26, 4, 26);
            gfx.endFill();
            gfx.beginFill(0xd1d5db, 0.85); gfx.drawRect(8, h-28, b.w-46, 3); gfx.endFill();
            // Lit paperwork windows (the licenses never sleep)
            for (let fy = 10; fy < h-32; fy += 16) for (let fx = 14; fx < b.w-42; fx += 18) {
                gfx.beginFill(0xfef3c7, 0.55); gfx.drawRect(fx, fy, 11, 9); gfx.endFill();
            }
            // Gold department seal
            gfx.beginFill(0xca8a04); gfx.drawCircle((b.w-26)/2, h*0.42, 7); gfx.endFill();
            gfx.beginFill(0xfbbf24); gfx.drawCircle((b.w-26)/2, h*0.42, 5); gfx.endFill();
            gfx.beginFill(0x14213d); gfx.drawPolygon([(b.w-26)/2, h*0.42-3.5, (b.w-26)/2-3, h*0.42+2.5, (b.w-26)/2+3, h*0.42+2.5]); gfx.endFill();
            // Inspection lane + striped barrier arm
            gfx.beginFill(0x374151); gfx.drawRect(b.w-24, h-6, 24, 6); gfx.endFill();
            gfx.beginFill(0x4b5563); gfx.drawRect(b.w-22, h-18, 5, 12); gfx.endFill();
            gfx.beginFill(0xef4444); gfx.drawRect(b.w-18, h-17, 18, 3); gfx.endFill();
            gfx.beginFill(0xffffff);
            for (let bx2 = b.w-16; bx2 < b.w-2; bx2 += 6) gfx.drawRect(bx2, h-17, 3, 3);
            gfx.endFill();
            gfx.beginFill(0xef4444, 0.9); gfx.drawCircle(b.w-19.5, h-21, 1.5); gfx.endFill();
          } else if (b.id === 'port_warehouse') {
            // GPU Warehouse — bonded corrugated hall, guarded 24/7
            gfx.beginFill(0x1e293b); gfx.drawRect(0, 6, b.w, h-6); gfx.endFill();
            gfx.beginFill(0x27364a, 0.8); gfx.drawRect(0, 6, b.w, 10); gfx.endFill();
            // Corrugated roof + skylight strip + HVAC
            gfx.beginFill(0x334155); for (let rx = 0; rx < b.w; rx += 8) { gfx.drawRect(rx, 0, 4, 8); } gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(0, 0, b.w, 4); gfx.endFill();
            gfx.beginFill(0x38bdf8, 0.25); gfx.drawRect(20, 2, b.w-90, 3); gfx.endFill();
            gfx.beginFill(0x64748b); gfx.drawRect(b.w-52, -6, 16, 8); gfx.drawRect(b.w-30, -6, 16, 8); gfx.endFill();
            gfx.beginFill(0x94a3b8, 0.6); gfx.drawRect(b.w-50, -4, 12, 1.5); gfx.drawRect(b.w-28, -4, 12, 1.5); gfx.endFill();
            // Wall stencil: big GPU crate label
            gfx.beginFill(0x76b900, 0.18); gfx.drawRect(b.w/2-26, 16, 52, 14); gfx.endFill();
            gfx.beginFill(0x76b900, 0.5); gfx.drawRect(b.w/2-26, 16, 52, 2); gfx.endFill();
            // Loading bay doors with status lights
            let doorIdx = 0;
            for (let dx = 15; dx < b.w-30; dx += 50) {
                gfx.beginFill(0x0a1628); gfx.drawRect(dx, h-30, 35, 30); gfx.endFill();
                gfx.beginFill(0xf59e0b, 0.2); gfx.drawRect(dx+2, h-28, 31, 2); gfx.drawRect(dx+2, h-20, 31, 2); gfx.drawRect(dx+2, h-12, 31, 2); gfx.endFill();
                gfx.beginFill(doorIdx % 2 === 0 ? 0x4ade80 : 0xf59e0b, 0.9); gfx.drawCircle(dx + 32, h-32, 1.8); gfx.endFill();
                doorIdx++;
            }
            // Guard booth + camera
            gfx.beginFill(0x334155); gfx.drawRect(b.w-16, h-18, 14, 18); gfx.endFill();
            gfx.beginFill(0xfef3c7, 0.6); gfx.drawRect(b.w-13, h-15, 8, 6); gfx.endFill();
            gfx.beginFill(0x94a3b8); gfx.drawRect(2, 8, 2, 4); gfx.endFill();
            gfx.beginFill(0x1f2937); gfx.drawRect(1, 6, 5, 3); gfx.endFill();
            gfx.beginFill(0xef4444, 0.9); gfx.drawCircle(5.5, 7.5, 0.8); gfx.endFill();
            // NVIDIA green accent
            gfx.beginFill(0x76b900, 0.3); gfx.drawRect(0, h-2, b.w, 4); gfx.endFill();
          } else if (b.id === 'port_container') {
            // Container Terminal — brand-color steel stacks + reach stacker
            gfx.beginFill(0x2b3646); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            gfx.beginFill(0xfbbf24, 0.35); // lane markings
            for (let lx = 4; lx < b.w; lx += 22) gfx.drawRect(lx, h-6, 12, 1.5);
            gfx.endFill();
            // Container stacks (brand palette: NVIDIA green / SK orange / TSMC red / maersk blue)
            const stackCols = [[0x76b900, 0x3b82f6, 0xf59e0b], [0xef4444, 0x76b900, 0x22d3ee], [0xf59e0b, 0xa855f7, 0x76b900], [0x3b82f6, 0xef4444, 0xf59e0b]];
            stackCols.forEach((stack, siIdx) => {
                const sx2 = 8 + siIdx * 34;
                stack.forEach((scol, r) => {
                    gfx.beginFill(scol); gfx.drawRect(sx2, h-22-r*14, 30, 12); gfx.endFill();
                    gfx.beginFill(0x000000, 0.18); gfx.drawRect(sx2, h-22-r*14, 30, 2); gfx.endFill();
                    gfx.beginFill(0xffffff, 0.1);
                    for (let cx3 = sx2+3; cx3 < sx2+28; cx3 += 5) gfx.drawRect(cx3, h-20-r*14, 1.5, 8);
                    gfx.endFill();
                });
            });
            // Reach stacker lifting a container
            const rsx = b.w - 20;
            gfx.beginFill(0xfbbf24); gfx.drawRect(rsx-14, h-18, 22, 10); gfx.endFill();
            gfx.beginFill(0x1f2937); gfx.drawCircle(rsx-9, h-7, 4); gfx.drawCircle(rsx+3, h-7, 4); gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(rsx-12, h-26, 6, 9); gfx.endFill();  // cab
            gfx.beginFill(0xfef3c7, 0.6); gfx.drawRect(rsx-11, h-25, 4, 4); gfx.endFill();
            gfx.beginFill(0x94a3b8); gfx.drawPolygon([rsx-4, h-16, rsx+14, h-34, rsx+16, h-31, rsx-1, h-14]); gfx.endFill(); // boom
            gfx.beginFill(0x76b900); gfx.drawRect(rsx+8, h-32, 18, 9); gfx.endFill();  // lifted box
            gfx.beginFill(0x000000, 0.15); gfx.drawRect(rsx+8, h-32, 18, 1.5); gfx.endFill();
            // Floodlight mast
            gfx.beginFill(0x64748b); gfx.drawRect(2, h-52, 3, 44); gfx.endFill();
            gfx.beginFill(0xfef3c7, 0.9); gfx.drawRect(-2, h-56, 11, 4); gfx.endFill();
            gfx.beginFill(0xfef3c7, 0.08); gfx.drawPolygon([-2, h-52, 9, h-52, 26, h-8, -14, h-8]); gfx.endFill();
          } else if (b.id === 'port_fuel') {
            // Fuel & Gas Depot — cryo helium sphere + horizontal diesel tank
            gfx.beginFill(0x1e293b); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            // Cryogenic LHe sphere on legs, frosted crown
            const spx = 30, spy = h-34;
            gfx.beginFill(0x334155); gfx.drawRect(spx-14, h-14, 4, 8); gfx.drawRect(spx+10, h-14, 4, 8); gfx.endFill();
            gfx.beginFill(0xf1f5f9); gfx.drawCircle(spx, spy, 22); gfx.endFill();
            gfx.beginFill(0xdbeafe, 0.8); gfx.drawCircle(spx-6, spy-7, 12); gfx.endFill();
            gfx.beginFill(0x93c5fd, 0.5); gfx.drawEllipse(spx, spy-16, 14, 5); gfx.endFill(); // frost crown
            gfx.beginFill(0x1d4ed8, 0.8); gfx.drawRect(spx-20, spy-2, 40, 5); gfx.endFill(); // LHe band
            gfx.beginFill(0xffffff, 0.35); gfx.drawCircle(spx-24, spy-18, 2.5); gfx.drawCircle(spx-27, spy-13, 1.8); gfx.endFill(); // boil-off wisps
            // Horizontal diesel tank
            gfx.beginFill(0x6b7280); gfx.drawRoundedRect(62, h-30, 50, 20, 9); gfx.endFill();
            gfx.beginFill(0x9ca3af, 0.6); gfx.drawRoundedRect(62, h-30, 50, 6, 3); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(68, h-11, 5, 3); gfx.drawRect(100, h-11, 5, 3); gfx.endFill();
            // Hazard diamond
            gfx.beginFill(0xef4444); gfx.drawPolygon([87, h-27, 92, h-22, 87, h-17, 82, h-22]); gfx.endFill();
            gfx.beginFill(0xffffff, 0.9); gfx.drawRect(85.5, h-24, 3, 4); gfx.endFill();
            // Manifold pipes linking sphere → tank → quay
            gfx.beginFill(0x475569); gfx.drawRect(spx+20, h-16, 44, 3); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.4); gfx.drawRect(spx+20, h-15.5, 44, 1); gfx.endFill();
            gfx.beginFill(0x374151); gfx.drawRect(56, h-19, 4, 8); gfx.endFill();
            gfx.beginFill(0xef4444); gfx.drawCircle(58, h-20, 1.8); gfx.endFill();
            // Hazard stripes
            gfx.beginFill(0xfbbf24); for (let sx = 0; sx < b.w; sx += 12) { gfx.drawRect(sx, h-10, 6, 3); } gfx.endFill();
          } else if (b.id === 'port_crane') {
            // Ship-to-shore gantry crane — braced legs, machinery house, water-side boom
            // Legs with cross-bracing
            gfx.beginFill(0xf59e0b); gfx.drawRect(10, h-8, 8, -70); gfx.drawRect(b.w-18, h-8, 8, -70); gfx.endFill();
            gfx.lineStyle(2, 0xd97706, 0.8);
            gfx.moveTo(14, h-14); gfx.lineTo(b.w-14, h-44);
            gfx.moveTo(b.w-14, h-14); gfx.lineTo(14, h-44);
            gfx.moveTo(14, h-44); gfx.lineTo(b.w-14, h-72);
            gfx.lineStyle(0);
            // Main beam extends over the water (left)
            gfx.beginFill(0xfbbf24); gfx.drawRect(-26, h-78, b.w+26, 8); gfx.endFill();
            gfx.beginFill(0xd97706); gfx.drawRect(-26, h-71, b.w+26, 2); gfx.endFill();
            // A-frame apex + tie bars holding the boom
            gfx.beginFill(0xf59e0b); gfx.drawPolygon([b.w/2-4, h-100, b.w/2+4, h-100, b.w/2+8, h-78, b.w/2-8, h-78]); gfx.endFill();
            gfx.lineStyle(1.5, 0xd97706, 0.9);
            gfx.moveTo(b.w/2, h-98); gfx.lineTo(-22, h-76);
            gfx.moveTo(b.w/2, h-98); gfx.lineTo(b.w-6, h-76);
            gfx.lineStyle(0);
            gfx.beginFill(0xef4444, 0.9); gfx.drawCircle(b.w/2, h-102, 2); gfx.endFill();
            // Machinery house + operator cab
            gfx.beginFill(0x475569); gfx.drawRect(b.w-34, h-92, 22, 12); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(4, h-70, 12, 9); gfx.endFill();
            gfx.beginFill(0x38bdf8, 0.6); gfx.drawRect(6, h-68, 8, 5); gfx.endFill();
            // (Trolley, cable, hook + lifted container are animated by PortEnv._animateCrane)
          }
          gfx.beginFill(0x000000, 0.15); gfx.drawRect(0, h-2, b.w, 4); gfx.endFill();
          
        } else if (b.id.startsWith('npc_apt_')) {
          // ── NPC WORKER APARTMENTS — Simple residential blocks ──
          // Main structure
          gfx.beginFill(0x1a2030); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          // Side walls
          gfx.beginFill(0x222a38); gfx.drawRect(0, 0, 6, h); gfx.drawRect(b.w - 6, 0, 6, h); gfx.endFill();
          // Roof parapet
          gfx.beginFill(0x334155); gfx.drawRect(-2, -4, b.w + 4, 8); gfx.endFill();
          gfx.beginFill(0x475569); gfx.drawRect(-2, -4, b.w + 4, 3); gfx.endFill();
          // Floor lines
          for (let fy = 16; fy < h; fy += 18) {
              gfx.beginFill(0x222a38); gfx.drawRect(6, fy, b.w - 12, 2); gfx.endFill();
          }
          // Windows with warm glow
          const cols = Math.floor((b.w - 20) / 20);
          for (let f = 0; f < floors; f++) {
              for (let c2 = 0; c2 < cols; c2++) {
                  const wx = 12 + c2 * 20, wy = 6 + f * 18;
                  const lit = this._labNoise((b.x | 0) + f * 131 + c2 * 17) > 0.4;
                  gfx.beginFill(0x000000, 0.15); gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
                  if (lit) { gfx.beginFill(0xfbbf24, 0.5); } else { gfx.beginFill(0x0a0a18); }
                  gfx.drawRect(wx, wy, 12, 10); gfx.endFill();
                  gfx.lineStyle(1, 0x334155, 0.3); gfx.drawRect(wx, wy, 12, 10); gfx.lineStyle(0);
              }
          }
          // Door
          gfx.beginFill(0x0a0a18); gfx.drawRect(b.w / 2 - 8, h - 16, 16, 16); gfx.endFill();
          gfx.beginFill(0x334155); gfx.drawRect(b.w / 2 - 8, h - 16, 16, 2); gfx.endFill();
          gfx.beginFill(0xfbbf24, 0.4); gfx.drawCircle(b.w / 2 + 4, h - 8, 1); gfx.endFill();
          // Awning over door
          gfx.beginFill(0x475569); gfx.drawRect(b.w / 2 - 14, h - 20, 28, 3); gfx.endFill();
          // Worker icon badge
          const badge = new PIXI.Text('🏬', { fontFamily: emojiFontStack, fontSize: 14, fill: 0xffffff });
          badge.anchor.set(0.5, 0.5); badge.x = b.w / 2; badge.y = -14;
          container.addChild(badge);
          // Shadow
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, 4, 5, h - 4); gfx.endFill();
          gfx.beginFill(0x000000, 0.15); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();

        } else if (b.id.startsWith('suburb_')) {
          // ── MIDDLE-CLASS SUBURBAN TOWNHOMES (VC Row commuter belt) ──
          // Each building gets a signature palette so the block has variety
          const idNum = parseInt(b.id.replace('suburb_', '')) || 1;
          const palettes = [
              { wall: 0xd4a574, trim: 0x8b5a2b, roof: 0x7c2d12, window: 0xfde68a, door: 0x5c3317 }, // warm tan
              { wall: 0xe2e8f0, trim: 0x64748b, roof: 0x334155, window: 0xfef3c7, door: 0x1e3a5f }, // grey slate
              { wall: 0xb8917a, trim: 0x6b4423, roof: 0x4a2c17, window: 0xfef08a, door: 0x3d2914 }, // brick
              { wall: 0xfef3c7, trim: 0xa16207, roof: 0x78350f, window: 0xfde68a, door: 0x713f12 }, // cream
              { wall: 0xc5e1c5, trim: 0x4a7c59, roof: 0x2d5a3f, window: 0xfde68a, door: 0x2d3d2d }  // sage green
          ];
          const p = palettes[(idNum - 1) % palettes.length];

          // Front lawn base
          gfx.beginFill(0x1b4332); gfx.drawRect(0, h - 6, b.w, 6); gfx.endFill();
          gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 4, b.w, 2); gfx.endFill();

          // Picket fence
          gfx.beginFill(0xf5f5dc);
          for (let fx = 4; fx < b.w - 4; fx += 8) {
              gfx.drawRect(fx, h - 12, 2, 8);
              gfx.drawPolygon([fx - 1, h - 12, fx + 1, h - 14, fx + 3, h - 12]);
          }
          gfx.drawRect(2, h - 10, b.w - 4, 1);
          gfx.endFill();

          // Main house body (two-story)
          const bodyH = h - 14;
          const bodyTop = 14;
          gfx.beginFill(p.wall); gfx.drawRect(10, bodyTop, b.w - 20, bodyH - bodyTop); gfx.endFill();
          // Side shadow
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w - 14, bodyTop, 4, bodyH - bodyTop); gfx.endFill();
          // Trim corners
          gfx.beginFill(p.trim);
          gfx.drawRect(10, bodyTop, 3, bodyH - bodyTop);
          gfx.drawRect(b.w - 13, bodyTop, 3, bodyH - bodyTop);
          gfx.endFill();

          // Gabled pitched roof
          gfx.beginFill(p.roof);
          gfx.drawPolygon([6, bodyTop + 2, b.w / 2, 0, b.w - 6, bodyTop + 2]);
          gfx.endFill();
          // Roof highlight
          gfx.beginFill(0xffffff, 0.1);
          gfx.drawPolygon([6, bodyTop + 2, b.w / 2, 2, b.w / 2, bodyTop + 2]);
          gfx.endFill();
          // Roof shingle lines
          gfx.lineStyle(1, 0x000000, 0.25);
          for (let ry = bodyTop; ry > 2; ry -= 4) {
              const inset = (bodyTop - ry + 2) * ((b.w - 12) / 2) / bodyTop;
              gfx.moveTo(6 + inset, ry); gfx.lineTo(b.w - 6 - inset, ry);
          }
          gfx.lineStyle(0);

          // Chimney
          gfx.beginFill(0x78716c); gfx.drawRect(b.w - 36, 4, 8, bodyTop - 4); gfx.endFill();
          gfx.beginFill(0x44403c); gfx.drawRect(b.w - 37, 3, 10, 3); gfx.endFill();

          // Attic gable window (circle)
          gfx.beginFill(p.window, 0.8); gfx.drawCircle(b.w / 2, bodyTop - 6, 4); gfx.endFill();
          gfx.lineStyle(1, p.trim, 0.8); gfx.drawCircle(b.w / 2, bodyTop - 6, 4);
          gfx.moveTo(b.w / 2 - 4, bodyTop - 6); gfx.lineTo(b.w / 2 + 4, bodyTop - 6);
          gfx.moveTo(b.w / 2, bodyTop - 10); gfx.lineTo(b.w / 2, bodyTop - 2);
          gfx.lineStyle(0);

          // Upper floor windows (2 across)
          const upWinY = bodyTop + 8;
          [0.28, 0.72].forEach(frac => {
              const wx = Math.round(b.w * frac) - 7;
              gfx.beginFill(p.trim); gfx.drawRect(wx - 1, upWinY - 1, 16, 14); gfx.endFill();
              const lit = this._labNoise((b.x | 0) + wx * 13) > 0.5;
              gfx.beginFill(lit ? p.window : 0x0a0a18, lit ? 0.85 : 1);
              gfx.drawRect(wx, upWinY, 14, 12); gfx.endFill();
              // Window mullions
              gfx.lineStyle(1, p.trim, 0.8);
              gfx.moveTo(wx + 7, upWinY); gfx.lineTo(wx + 7, upWinY + 12);
              gfx.moveTo(wx, upWinY + 6); gfx.lineTo(wx + 14, upWinY + 6);
              gfx.lineStyle(0);
              // Shutters
              gfx.beginFill(p.trim); gfx.drawRect(wx - 4, upWinY, 3, 12); gfx.drawRect(wx + 15, upWinY, 3, 12); gfx.endFill();
          });

          // Ground floor: big front window (left) + door (center-right)
          const gWinX = 18, gWinY = bodyTop + 30;
          gfx.beginFill(p.trim); gfx.drawRect(gWinX - 2, gWinY - 2, 30, 20); gfx.endFill();
          const gLit = this._labNoise((b.x | 0) + 71) > 0.4;
          gfx.beginFill(gLit ? p.window : 0x0a0a18, gLit ? 0.85 : 1); gfx.drawRect(gWinX, gWinY, 26, 16); gfx.endFill();
          gfx.lineStyle(1, p.trim, 0.8);
          gfx.moveTo(gWinX + 13, gWinY); gfx.lineTo(gWinX + 13, gWinY + 16);
          gfx.moveTo(gWinX, gWinY + 8); gfx.lineTo(gWinX + 26, gWinY + 8);
          gfx.lineStyle(0);

          // Front door with small porch
          const doorX = b.w - 38, doorY = h - 30;
          gfx.beginFill(p.trim); gfx.drawRect(doorX - 2, doorY - 2, 16, 18); gfx.endFill();
          gfx.beginFill(p.door); gfx.drawRect(doorX, doorY, 12, 16); gfx.endFill();
          gfx.beginFill(0xfbbf24, 0.9); gfx.drawCircle(doorX + 9, doorY + 9, 1); gfx.endFill(); // knob
          // Porch light glow
          gfx.beginFill(0xfbbf24, 0.35); gfx.drawCircle(doorX + 6, doorY - 6, 5); gfx.endFill();
          gfx.beginFill(0xfbbf24); gfx.drawCircle(doorX + 6, doorY - 6, 1.2); gfx.endFill();
          // Porch step
          gfx.beginFill(0x78716c); gfx.drawRect(doorX - 4, doorY + 16, 20, 3); gfx.endFill();

          // Driveway + garage hint
          gfx.beginFill(0x52525b); gfx.drawRect(b.w - 18, h - 10, 14, 10); gfx.endFill();
          gfx.beginFill(0x3f3f46); gfx.drawRect(b.w - 18, h - 8, 14, 2); gfx.endFill();

          // Small shrub by door
          gfx.beginFill(0x166534); gfx.drawCircle(doorX - 6, h - 10, 3); gfx.endFill();
          gfx.beginFill(0x14532d); gfx.drawCircle(doorX - 6, h - 11, 2); gfx.endFill();

          // Tree on lawn
          const treeX = 20;
          gfx.beginFill(0x5c4033); gfx.drawRect(treeX, h - 20, 3, 14); gfx.endFill();
          gfx.beginFill(0x166534); gfx.drawCircle(treeX + 1, h - 24, 7); gfx.endFill();
          gfx.beginFill(0x15803d); gfx.drawCircle(treeX + 1, h - 25, 5); gfx.endFill();
          gfx.beginFill(0x22c55e); gfx.drawCircle(treeX + 1, h - 26, 3); gfx.endFill();

          // House number plaque
          gfx.beginFill(0x1c1917); gfx.drawRect(doorX - 6, doorY - 14, 10, 5); gfx.endFill();
          const plate = new PIXI.Text(String(100 + idNum * 4), { fontFamily: 'JetBrains Mono', fontSize: 4, fill: 0xf5f5f4 });
          plate.anchor.set(0.5, 0.5); plate.x = doorX - 1; plate.y = doorY - 11;
          container.addChild(plate);

          // Overall shadow
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, 4, 4, h - 4); gfx.endFill();

        } else if (b.type === 'university' && typeof UniversityEnv !== 'undefined') {
          // University buildings rendered by dedicated module (uses local coords: 0=top, h=ground)
          UniversityEnv.buildBuilding(gfx, b, h);

        } else if (b.type === 'court' && typeof CourtEnv !== 'undefined') {
          // Court buildings rendered by dedicated module
          CourtEnv.buildBuilding(gfx, b, h);

        } else if (b.type === 'jail' && typeof JailEnv !== 'undefined') {
          // AI Detention Center rendered by dedicated module
          JailEnv.buildBuilding(gfx, b, h);

        } else if (b.id === 'convention_center' && typeof ConferenceEnv !== 'undefined') {
          // Conference center rendered by dedicated module
          ConferenceEnv.buildBuilding(gfx, b, h);

        } else if (b.id.startsWith('res_')) {
          gfx.beginFill(0x1e1e2f); gfx.drawRect(0, 0, b.w, h); gfx.endFill();

          gfx.beginFill(0x2a2a40);
          gfx.drawRect(0, 0, b.w, 14);
          gfx.drawRect(0, 0, 8, h);
          gfx.drawRect(b.w - 8, 0, 8, h);
          gfx.endFill();

          const cols = Math.floor((b.w - 16) / 24);
          const rows = floors;
          for (let f = 0; f < rows; f++) {
              for (let c = 0; c < cols; c++) {
                  if (f === rows - 1 && (c === Math.floor(cols/2) || c === Math.floor(cols/2)-1)) continue;
                  const wx = 16 + c * 24, wy = 20 + f * 18;
                  const lit = this._labNoise((b.x | 0) + f * 131 + c * 17) > 0.4;

                  gfx.beginFill(0x05050a, 0.8); gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
                  gfx.beginFill(lit ? 0xeab308 : 0x111122, lit ? 0.7 : 1);
                  gfx.drawRect(wx, wy, 12, 10); gfx.endFill();

                  if (lit) {
                      gfx.beginFill(0xeab308, 0.15); gfx.drawRect(wx - 2, wy - 2, 16, 14); gfx.endFill();
                  }
              }
          }
          
          gfx.beginFill(0x0f172a);
          gfx.drawRect(b.w/2 - 24, h - 30, 48, 30); gfx.endFill();
          gfx.beginFill(0x38bdf8, 0.2);
          gfx.drawRect(b.w/2 - 20, h - 25, 18, 25);
          gfx.drawRect(b.w/2 + 2, h - 25, 18, 25); gfx.endFill();
          gfx.beginFill(0xffffff, 0.5); 
          gfx.drawRect(b.w/2 - 4, h - 15, 2, 8);
          gfx.drawRect(b.w/2 + 2, h - 15, 2, 8);
          gfx.endFill();
    
          gfx.beginFill(0x11111a); gfx.drawRect(10, -10, 40, 10); gfx.drawRect(b.w - 50, -10, 40, 10); gfx.endFill();
          
          if (b.id === 'res_cn') {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 3, 10); gfx.drawRect(b.w - 31, -20, 3, 10); gfx.endFill();
              gfx.beginFill(0xffb7c5); 
              gfx.drawCircle(29, -25, 14); gfx.drawCircle(19, -18, 10); gfx.drawCircle(39, -18, 10);
              gfx.drawCircle(b.w - 29, -25, 14); gfx.drawCircle(b.w - 19, -18, 10); gfx.drawCircle(b.w - 39, -18, 10);
              gfx.endFill();
          } else if (b.id === 'res_us') {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 4, 10); gfx.drawRect(b.w - 32, -20, 4, 10); gfx.endFill();
              gfx.beginFill(0x2d6a4f); 
              gfx.drawPolygon([30, -50, 10, -10, 50, -10]); 
              gfx.drawPolygon([b.w - 30, -50, b.w - 50, -10, b.w - 10, -10]); 
              gfx.endFill();
          } else {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 4, 10); gfx.drawRect(b.w - 32, -20, 4, 10); gfx.endFill();
              gfx.beginFill(0x3d8a5f); 
              gfx.drawCircle(30, -30, 14); gfx.drawCircle(18, -20, 12); gfx.drawCircle(42, -20, 12);
              gfx.drawCircle(b.w - 30, -30, 14); gfx.drawCircle(b.w - 18, -20, 12); gfx.drawCircle(b.w - 42, -20, 12);
              gfx.endFill();
          }
          
        } else if (b.id.startsWith('metro_')) {
          gfx.beginFill(0x1a1a24); gfx.drawRect(0, h - 40, b.w, 40); gfx.endFill(); 
          gfx.beginFill(0x2a2a3e); gfx.drawRect(0, h - 45, b.w, 5); gfx.endFill(); 
          
          gfx.beginFill(0x22d3ee, 0.15);
          gfx.drawPolygon([0, h-45, b.w, h-45, b.w-20, h-70, 20, h-70]);
          gfx.endFill();
          gfx.lineStyle(2, 0x22d3ee, 0.4);
          gfx.moveTo(0, h-45); gfx.lineTo(20, h-70); gfx.lineTo(b.w-20, h-70); gfx.lineTo(b.w, h-45);
          gfx.lineStyle(0);
          
          gfx.beginFill(0x050508); gfx.drawRect(b.w/2 - 30, h - 30, 60, 30); gfx.endFill();
          gfx.beginFill(0x222233);
          for(let sy=0; sy<30; sy+=4) { gfx.drawRect(b.w/2 - 30, h - 30 + sy, 60, 2); }
          gfx.endFill();
          
          const mSign = new PIXI.Text('🚇 METRO', { fontFamily: emojiFontStack, fontSize: 12, fill: 0x4ade80, dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 8, dropShadowDistance: 0 });
          mSign.anchor.set(0.5, 0.5); mSign.x = b.w / 2; mSign.y = h - 85;
          container.addChild(mSign); b._metroSign = mSign;
          b.tip = b.desc;

        } else if (b.id === 'visitor_monument') {
          // ── VISITOR MONUMENT — Digital obelisk with live counter ──
          // Base platform
          gfx.beginFill(0x1a1a2e); gfx.drawRect(5, h - 8, b.w - 10, 8); gfx.endFill();
          gfx.beginFill(0x222240); gfx.drawRect(8, h - 10, b.w - 16, 4); gfx.endFill();
          // Obelisk body (dark stone, tapers slightly)
          gfx.beginFill(0x111128);
          gfx.drawPolygon([15, h - 10, 20, -30, b.w - 20, -30, b.w - 15, h - 10]);
          gfx.endFill();
          // Inner face (slightly lighter)
          gfx.beginFill(0x1a1a38);
          gfx.drawPolygon([18, h - 12, 22, -26, b.w - 22, -26, b.w - 18, h - 12]);
          gfx.endFill();
          // Capstone (glowing pyramid tip)
          gfx.beginFill(0x22d3ee);
          gfx.drawPolygon([22, -26, b.w / 2, -45, b.w - 22, -26]);
          gfx.endFill();
          gfx.beginFill(0x06b6d4, 0.5);
          gfx.drawPolygon([24, -24, b.w / 2, -40, b.w - 24, -24]);
          gfx.endFill();
          // Digital screen area (where counter shows)
          gfx.beginFill(0x050510); gfx.drawRect(20, -10, b.w - 40, 40); gfx.endFill();
          gfx.beginFill(0x0a0a20); gfx.drawRect(22, -8, b.w - 44, 36); gfx.endFill();
          // Screen border glow
          gfx.lineStyle(1, 0x22d3ee, 0.4); gfx.drawRect(20, -10, b.w - 40, 40); gfx.lineStyle(0);
          // Globe icon at top
          const globe = new PIXI.Text('🌐', { fontFamily: emojiFontStack, fontSize: 14, fill: 0xffffff });
          globe.anchor.set(0.5, 0.5); globe.x = b.w / 2; globe.y = -18;
          container.addChild(globe);
          // Counter text (big number)
          const counterTxt = new PIXI.Text('0', {
              fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 'bold', fill: '#22d3ee',
              dropShadow: true, dropShadowColor: '#22d3ee', dropShadowBlur: 6, dropShadowDistance: 0
          });
          counterTxt.anchor.set(0.5, 0.5); counterTxt.x = b.w / 2; counterTxt.y = 8;
          container.addChild(counterTxt);
          b._counterTxt = counterTxt;
          // Label
          const labelTxt = new PIXI.Text('UNIQUE VISITORS', {
              fontFamily: 'JetBrains Mono', fontSize: 5, fill: '#94a3b8', letterSpacing: 1
          });
          labelTxt.anchor.set(0.5, 0.5); labelTxt.x = b.w / 2; labelTxt.y = 20;
          container.addChild(labelTxt);
          // Visits sub-counter
          const visitsTxt = new PIXI.Text('0 visits', {
              fontFamily: 'JetBrains Mono', fontSize: 5, fill: '#64748b'
          });
          visitsTxt.anchor.set(0.5, 0.5); visitsTxt.x = b.w / 2; visitsTxt.y = 28;
          container.addChild(visitsTxt);
          b._visitsTxt = visitsTxt;
          // Decorative light rings on obelisk
          gfx.beginFill(0x22d3ee, 0.15); gfx.drawRect(22, 35, b.w - 44, 2); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.10); gfx.drawRect(20, 55, b.w - 40, 2); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.08); gfx.drawRect(18, h - 25, b.w - 36, 2); gfx.endFill();
          // Shadow
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          // Capstone glow (additive)
          const capGlow = new PIXI.Graphics();
          capGlow.beginFill(0x22d3ee, 0.08); capGlow.drawEllipse(b.w / 2, -35, 20, 12); capGlow.endFill();
          capGlow.blendMode = PIXI.BLEND_MODES.ADD;
          container.addChild(capGlow);
          b._capGlow = capGlow;
          
          // Trigger initial count display
          if (typeof VisitorTracker !== 'undefined') VisitorTracker._updateMonument();

        } else if (b.id === 'neon_bar') {
          // ── NEON BAR — Dark facade, neon strips, cocktail sign, stage ──
          // Dark brick facade
          gfx.beginFill(0x0f0a18); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          gfx.beginFill(0x1a1028); gfx.drawRect(4, 4, b.w - 8, h - 4); gfx.endFill();
          // Brick texture
          for (let by = 8; by < h - 4; by += 6) {
              const off = (by % 12 === 0) ? 0 : 8;
              for (let bx = off + 4; bx < b.w - 8; bx += 16) {
                  gfx.beginFill(0x1e1430, 0.5); gfx.drawRect(bx, by, 14, 5); gfx.endFill();
              }
          }
          // Neon accent strips on facade
          gfx.beginFill(0xff00ff, 0.15); gfx.drawRect(0, 0, b.w, 3); gfx.endFill();
          gfx.beginFill(0x00ffff, 0.12); gfx.drawRect(0, h * 0.4, b.w, 2); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.10); gfx.drawRect(0, h * 0.7, b.w, 2); gfx.endFill();
          // Side neon tubes (vertical)
          gfx.beginFill(0xff69b4, 0.3); gfx.drawRect(2, 10, 2, h - 20); gfx.endFill();
          gfx.beginFill(0x00ffff, 0.3); gfx.drawRect(b.w - 4, 10, 2, h - 20); gfx.endFill();
          // Windows with colored glow (bar interior visible)
          for (let wx = 15; wx < b.w - 20; wx += 28) {
              gfx.beginFill(0x000000); gfx.drawRect(wx, h * 0.3, 20, 22); gfx.endFill();
              const wCol = [0xff00ff, 0x00ffff, 0xff6b9d, 0xa855f7][Math.floor(wx / 28) % 4];
              gfx.beginFill(wCol, 0.25); gfx.drawRect(wx + 1, h * 0.3 + 1, 18, 20); gfx.endFill();
          }
          // Stage area (ground floor)
          gfx.beginFill(0x2a1040); gfx.drawRect(b.w / 2 - 25, h - 28, 50, 28); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.2); gfx.drawRect(b.w / 2 - 22, h - 25, 44, 22); gfx.endFill();
          // Microphone stand
          gfx.beginFill(0x888888); gfx.drawRect(b.w / 2 - 1, h - 22, 2, 14); gfx.endFill();
          gfx.beginFill(0xcccccc); gfx.drawCircle(b.w / 2, h - 23, 3); gfx.endFill();
          // Door
          gfx.beginFill(0x1a0a28); gfx.drawRect(10, h - 18, 16, 18); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.4); gfx.drawRect(10, h - 18, 16, 2); gfx.endFill();
          gfx.beginFill(0xfbbf24); gfx.drawCircle(22, h - 9, 1.5); gfx.endFill();
          // Cocktail emoji sign
          const cSign = new PIXI.Text('🍸', { fontFamily: emojiFontStack, fontSize: 20, fill: 0xffffff });
          cSign.anchor.set(0.5, 0.5); cSign.x = b.w - 20; cSign.y = h * 0.15;
          container.addChild(cSign);
          // Shadow
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();

        } else if (b.type === 'alignment') {
          // ── ALIGNMENT FOREST — Wooden research cabin nestled in a pine forest ──
          // Replaces the old glass-pavilion look. Each institute is a small log-cabin lodge
          // with a pitched shingle roof, stone chimney (smoke at night), warm lit windows,
          // wooden name plaque, and 6–8 flanking pine trees that extend outside the building
          // footprint — creating a continuous woodland between cabins when the zone scrolls by.
          const accentCol = b.shield || 0x6ab868; // kept `b.shield` as the accent hook — each
                                                  // institute still gets its identifying color.

          // Deterministic tree scatter using b.x as seed — same cabin renders identical trees
          // every rebuild (so trees don't flicker on rebuild), but different cabins get
          // different arrangements.
          let treeSeed = 1013904223 + (b.x | 0);
          const sr = () => { treeSeed = (treeSeed * 1664525 + 1013904223) >>> 0; return (treeSeed & 0xffffff) / 0x1000000; };

          // ── FOREST FLOOR: moss / forest-duff ground strip extending beyond footprint ──
          // Drawn first (behind everything) so trees and cabin sit on it. Extends left/right
          // beyond b.w so adjacent cabins' floor strips join up into a seamless forest ground.
          gfx.beginFill(0x1a3321); gfx.drawRect(-55, h - 6, b.w + 110, 6); gfx.endFill();
          gfx.beginFill(0x264a30); gfx.drawRect(-55, h - 4, b.w + 110, 2); gfx.endFill();
          // Moss tufts dotted along the floor
          for (let mx = -50; mx < b.w + 55; mx += 8 + sr() * 6) {
              gfx.beginFill(0x4a8a4e, 0.55);
              gfx.drawCircle(mx, h - 3, 1 + sr() * 1.2);
              gfx.endFill();
          }
          // A fallen log off to one side, every other cabin (adds organic randomness)
          if (sr() > 0.5) {
              const lgX = -40 + sr() * 30;
              gfx.beginFill(0x3a2a18); gfx.drawRect(lgX, h - 7, 26, 3); gfx.endFill();
              gfx.beginFill(0x5a4028); gfx.drawRect(lgX, h - 7, 26, 1); gfx.endFill();
              gfx.beginFill(0x2a5a30); gfx.drawCircle(lgX + 2, h - 7, 1.8); gfx.endFill(); // moss on the log
          }

          // ── BACKGROUND PINES (left flank, behind cabin) ──
          const drawPine = (tx, scale) => {
              const trunkH = 18 * scale;
              const canopyH = 42 * scale;
              const canopyW = 18 * scale;
              const baseY = h - 4;
              // Trunk
              gfx.beginFill(0x3a2818); gfx.drawRect(tx - 1.5 * scale, baseY - trunkH, 3 * scale, trunkH); gfx.endFill();
              gfx.beginFill(0x26170a); gfx.drawRect(tx + 0.5 * scale, baseY - trunkH, 1 * scale, trunkH); gfx.endFill();
              // Three-tier canopy — dark at base, lit at tip, for that coniferous depth
              const capBase = baseY - trunkH + 4 * scale;
              gfx.beginFill(0x0e3b20);
              gfx.drawPolygon([tx - canopyW * 0.55, capBase, tx, capBase - canopyH * 0.4, tx + canopyW * 0.55, capBase]);
              gfx.endFill();
              gfx.beginFill(0x154a28);
              gfx.drawPolygon([tx - canopyW * 0.45, capBase - canopyH * 0.25, tx, capBase - canopyH * 0.65, tx + canopyW * 0.45, capBase - canopyH * 0.25]);
              gfx.endFill();
              gfx.beginFill(0x1f6030);
              gfx.drawPolygon([tx - canopyW * 0.35, capBase - canopyH * 0.5, tx, capBase - canopyH * 0.95, tx + canopyW * 0.35, capBase - canopyH * 0.5]);
              gfx.endFill();
              // A dab of sunlit highlight
              gfx.beginFill(0x6fbb6f, 0.55); gfx.drawCircle(tx - canopyW * 0.15, capBase - canopyH * 0.6, 1 * scale); gfx.endFill();
          };

          // 3 pines on the left (beyond the cabin's left edge)
          drawPine(-48 + sr() * 6, 0.95 + sr() * 0.25);
          drawPine(-28 + sr() * 4, 0.85 + sr() * 0.2);
          drawPine(-10 + sr() * 4, 0.7 + sr() * 0.15); // closer to cabin, smaller
          // 3 pines on the right
          drawPine(b.w + 10 + sr() * 4, 0.7 + sr() * 0.15);
          drawPine(b.w + 30 + sr() * 4, 0.85 + sr() * 0.2);
          drawPine(b.w + 52 + sr() * 6, 0.95 + sr() * 0.25);

          // ── CABIN BODY: stacked horizontal logs ──
          const bodyTop = Math.max(h * 0.3, 18); // leaves headroom for the roof
          const bodyH = h - 8 - bodyTop;          // footprint from bodyTop down to a 4px porch step
          // Cabin sits inset 10px from each side so trees read as "beside" the cabin
          const cbX = 10, cbW = b.w - 20;
          // Shadow under the cabin
          gfx.beginFill(0x000000, 0.22); gfx.drawEllipse(b.w / 2, h - 4, cbW * 0.48, 3); gfx.endFill();
          // Log rows — alternating two wood tones for that chinked-log cabin look
          const logH = 7;
          for (let ly = bodyTop; ly < h - 8; ly += logH) {
              const darker = ((ly - bodyTop) / logH) % 2 < 1;
              gfx.beginFill(darker ? 0x5a3d24 : 0x6b4a2c); gfx.drawRect(cbX, ly, cbW, logH); gfx.endFill();
              // Chinking highlight between logs
              gfx.beginFill(0x2a1a0e); gfx.drawRect(cbX, ly + logH - 1, cbW, 1); gfx.endFill();
              // End-grain circles at log tips for that stacked-log "notched corner" read
              gfx.beginFill(0x3a240e); gfx.drawCircle(cbX + 2, ly + logH / 2, 1.6); gfx.drawCircle(cbX + cbW - 2, ly + logH / 2, 1.6); gfx.endFill();
          }

          // ── PORCH STEP ──
          gfx.beginFill(0x3a2818); gfx.drawRect(cbX - 4, h - 8, cbW + 8, 4); gfx.endFill();
          gfx.beginFill(0x4a3020); gfx.drawRect(cbX - 4, h - 8, cbW + 8, 1); gfx.endFill();

          // ── WARM LIT WINDOWS (two per cabin, symmetric) ──
          const winW = 14, winH = 16;
          const winY = bodyTop + Math.floor(bodyH * 0.35);
          const winL = cbX + 14, winR = cbX + cbW - winW - 14;
          for (const wx of [winL, winR]) {
              // Frame (dark wood)
              gfx.beginFill(0x2a1a0e); gfx.drawRect(wx - 2, winY - 2, winW + 4, winH + 4); gfx.endFill();
              // Warm glow — amber at night, soft yellow by day
              gfx.beginFill(0xffd37a, 0.92); gfx.drawRect(wx, winY, winW, winH); gfx.endFill();
              gfx.beginFill(0xffeaa0, 0.55); gfx.drawRect(wx, winY, winW, winH * 0.4); gfx.endFill();
              // Cross mullions (little wooden lattice)
              gfx.beginFill(0x2a1a0e);
              gfx.drawRect(wx + winW / 2 - 0.5, winY, 1, winH);
              gfx.drawRect(wx, winY + winH / 2 - 0.5, winW, 1);
              gfx.endFill();
              // Sill
              gfx.beginFill(0x3a240e); gfx.drawRect(wx - 3, winY + winH, winW + 6, 2); gfx.endFill();
          }

          // ── DOOR (warm wood, slightly inset, with glow spill) ──
          const doorW = 16, doorH = 24;
          const doorX = b.w / 2 - doorW / 2;
          const doorY = h - doorH - 8;
          // Glow spill on the porch floor
          gfx.beginFill(0xffd37a, 0.18); gfx.drawEllipse(b.w / 2, h - 6, 20, 3); gfx.endFill();
          // Door frame
          gfx.beginFill(0x2a1a0e); gfx.drawRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4); gfx.endFill();
          // Door leaves
          gfx.beginFill(0x4a2e18); gfx.drawRect(doorX, doorY, doorW, doorH); gfx.endFill();
          gfx.beginFill(0x5a3a20); gfx.drawRect(doorX + 1, doorY + 1, winW / 3, doorH - 2); gfx.endFill();
          // Vertical plank lines
          gfx.beginFill(0x2a1a0e);
          gfx.drawRect(doorX + doorW / 3 - 0.5, doorY, 1, doorH);
          gfx.drawRect(doorX + 2 * doorW / 3 - 0.5, doorY, 1, doorH);
          gfx.endFill();
          // Brass doorknob
          gfx.beginFill(0xfbbf24); gfx.drawCircle(doorX + doorW - 3, doorY + doorH / 2, 1.3); gfx.endFill();
          // Accent lantern above the door — institute-colored glow
          gfx.beginFill(0x2a1a0e); gfx.drawRect(doorX + doorW / 2 - 3, doorY - 7, 6, 6); gfx.endFill();
          gfx.beginFill(accentCol, 0.9); gfx.drawRect(doorX + doorW / 2 - 2, doorY - 6, 4, 4); gfx.endFill();
          gfx.beginFill(accentCol, 0.25); gfx.drawCircle(doorX + doorW / 2, doorY - 4, 6); gfx.endFill();

          // ── PITCHED SHINGLE ROOF ──
          // Overhangs the cabin body by 6px each side. Two slopes meeting at a ridge.
          const roofEaveY = bodyTop;
          const roofPeakY = Math.max(-8, bodyTop - Math.min(bodyTop - 2, 26));
          const roofOH = 6;
          // Underside shadow
          gfx.beginFill(0x0a0805); gfx.drawPolygon([
              cbX - roofOH, roofEaveY,
              b.w / 2, roofPeakY + 2,
              cbX + cbW + roofOH, roofEaveY,
              cbX + cbW + roofOH, roofEaveY + 3,
              cbX - roofOH, roofEaveY + 3
          ]); gfx.endFill();
          // Main roof surface
          gfx.beginFill(0x3a2a1a); gfx.drawPolygon([
              cbX - roofOH, roofEaveY,
              b.w / 2, roofPeakY,
              cbX + cbW + roofOH, roofEaveY
          ]); gfx.endFill();
          // Shingle rows (horizontal stripes on the pitched triangle)
          const rowCount = 4;
          for (let rr = 1; rr <= rowCount; rr++) {
              const ty = roofPeakY + (roofEaveY - roofPeakY) * (rr / (rowCount + 1));
              const tw = (cbX + cbW + roofOH) - (cbX - roofOH);
              const widthFrac = (ty - roofPeakY) / (roofEaveY - roofPeakY);
              const rowLeft = b.w / 2 - (tw / 2) * widthFrac;
              gfx.beginFill(0x2a1d10, 0.9);
              gfx.drawRect(rowLeft + 1, ty, tw * widthFrac - 2, 1);
              gfx.endFill();
              gfx.beginFill(0x4a3824, 0.5);
              gfx.drawRect(rowLeft + 1, ty + 1, tw * widthFrac - 2, 0.8);
              gfx.endFill();
          }
          // Ridge cap
          gfx.beginFill(0x1a110a); gfx.drawRect(b.w / 2 - 4, roofPeakY - 1, 8, 2); gfx.endFill();

          // ── STONE CHIMNEY (right of centre, puffs of smoke drift off static here) ──
          const chimX = cbX + cbW - 22;
          const chimBaseY = roofEaveY + (roofPeakY - roofEaveY) * 0.45;
          const chimTopY = roofPeakY - 8;
          const chimW = 10;
          gfx.beginFill(0x4a4a4a); gfx.drawRect(chimX, chimTopY, chimW, chimBaseY - chimTopY); gfx.endFill();
          // Stone dappling
          gfx.beginFill(0x3a3a3a);
          gfx.drawRect(chimX, chimTopY + 2, chimW, 2);
          gfx.drawRect(chimX, chimTopY + 8, chimW, 2);
          gfx.drawRect(chimX, chimTopY + 14, chimW, 2);
          gfx.endFill();
          gfx.beginFill(0x5a5a5a); gfx.drawRect(chimX, chimTopY, chimW, 1); gfx.endFill();
          gfx.beginFill(0x2a2a2a); gfx.drawRect(chimX - 1, chimTopY - 2, chimW + 2, 2); gfx.endFill(); // cap
          // Soft smoke puff
          gfx.beginFill(0xe5e7eb, 0.35); gfx.drawCircle(chimX + chimW / 2 + 1, chimTopY - 6, 3.5); gfx.endFill();
          gfx.beginFill(0xd1d5db, 0.22); gfx.drawCircle(chimX + chimW / 2 + 3, chimTopY - 10, 3); gfx.endFill();

          // ── FOREGROUND PINES (smaller, cast in front of cabin edges for depth) ──
          // Drawn AFTER cabin body so they partially occlude the corners, selling depth.
          drawPine(-6 + sr() * 2, 0.55 + sr() * 0.1);
          drawPine(b.w + 4 + sr() * 2, 0.55 + sr() * 0.1);

          // ── WOODEN NAME PLAQUE (carved sign on a post, next to the door) ──
          const plaqueW = Math.max(72, Math.min(b.w - 30, 96));
          const plaqueH = 14;
          const plaqueY = doorY - 18;
          const plaqueX = b.w / 2 - plaqueW / 2;
          // Sign post
          gfx.beginFill(0x3a2818); gfx.drawRect(b.w / 2 - 1.5, plaqueY + plaqueH, 3, 6); gfx.endFill();
          // Wooden sign background
          gfx.beginFill(0x3a2818); gfx.drawRect(plaqueX - 1, plaqueY - 1, plaqueW + 2, plaqueH + 2); gfx.endFill();
          gfx.beginFill(0x5a3a20); gfx.drawRect(plaqueX, plaqueY, plaqueW, plaqueH); gfx.endFill();
          gfx.beginFill(0x4a2e18); gfx.drawRect(plaqueX, plaqueY + plaqueH - 2, plaqueW, 2); gfx.endFill();
          // Two small brass nails
          gfx.beginFill(0xfbbf24);
          gfx.drawCircle(plaqueX + 3, plaqueY + 2, 0.6);
          gfx.drawCircle(plaqueX + plaqueW - 3, plaqueY + 2, 0.6);
          gfx.endFill();
          const plaqueTxt = new PIXI.Text((b.name || '').toUpperCase(), {
              fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 'bold',
              fill: 0x1a0f06, letterSpacing: 0.8, padding: 2
          });
          plaqueTxt.anchor.set(0.5, 0.5);
          plaqueTxt.x = b.w / 2;
          plaqueTxt.y = plaqueY + plaqueH / 2;
          if (plaqueTxt.width > plaqueW - 8) plaqueTxt.scale.set((plaqueW - 8) / plaqueTxt.width);
          container.addChild(plaqueTxt);

          // Keep the module's particle hook live but drop the visible ring — the cabin is the
          // statement now. If we want fireflies later, alignment_forest.update() still has the
          // update loop wired up and will just no-op while b._shieldParticles stays null.
          b._shieldParticles = null;

        } else if (b.type === 'embassy') {
          // ── EMBASSY — Classical columned facade with flying flag ──
          const flagCols = b.flagColors || [0xcccccc];
          const accent = (typeof b.accent === 'number') ? b.accent : flagCols[0];

          // Marble/ivory facade
          gfx.beginFill(0xe9e4d2); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          gfx.beginFill(0xf4efdc); gfx.drawRect(3, 3, b.w - 6, h - 6); gfx.endFill();

          // Triangular pediment (roof)
          gfx.beginFill(0xd3cdb4);
          gfx.drawPolygon([0, 0, b.w / 2, -16, b.w, 0]);
          gfx.endFill();
          gfx.beginFill(accent, 0.55);
          gfx.drawPolygon([8, -2, b.w / 2, -12, b.w - 8, -2]);
          gfx.endFill();
          // Pediment trim
          gfx.lineStyle(1, 0xa8a288, 0.7);
          gfx.moveTo(0, 0); gfx.lineTo(b.w / 2, -16); gfx.lineTo(b.w, 0);
          gfx.lineStyle(0);

          // Horizontal flag-color accent stripe across architrave
          const stripeH = 3;
          const stripeW = (b.w - 16) / flagCols.length;
          flagCols.forEach((c, i) => {
              gfx.beginFill(c, 0.9);
              gfx.drawRect(8 + i * stripeW, 3, stripeW, stripeH);
              gfx.endFill();
          });

          // Columns (classical doric — evenly spaced across facade)
          const nCols = 5;
          const colW = 7;
          const colInset = 14;
          const colSpacing = (b.w - colInset * 2) / (nCols - 1);
          for (let i = 0; i < nCols; i++) {
              const cx = colInset + i * colSpacing - colW / 2;
              // Shaft
              gfx.beginFill(0xf8f3df); gfx.drawRect(cx, 10, colW, h - 22); gfx.endFill();
              // Shadow on right side (adds depth)
              gfx.beginFill(0xc6bfa2, 0.7); gfx.drawRect(cx + colW - 2, 10, 2, h - 22); gfx.endFill();
              // Highlight on left
              gfx.beginFill(0xfffbe8, 0.5); gfx.drawRect(cx + 1, 10, 1, h - 22); gfx.endFill();
              // Capital (top)
              gfx.beginFill(0xd6d0b6); gfx.drawRect(cx - 2, 8, colW + 4, 3); gfx.endFill();
              // Base
              gfx.beginFill(0xd6d0b6); gfx.drawRect(cx - 2, h - 14, colW + 4, 3); gfx.endFill();
          }

          // Base steps (two tiers)
          gfx.beginFill(0xccc5ac); gfx.drawRect(-4, h - 10, b.w + 8, 5); gfx.endFill();
          gfx.beginFill(0xbab396); gfx.drawRect(-2, h - 5, b.w + 4, 5); gfx.endFill();

          // Grand entrance
          const doorW = 22, doorH = 26;
          const doorX = b.w / 2 - doorW / 2;
          const doorY = h - doorH - 10;
          gfx.beginFill(0x000000, 0.35); gfx.drawRect(doorX - 2, doorY, doorW + 4, doorH); gfx.endFill();
          gfx.beginFill(0x2e2014); gfx.drawRect(doorX, doorY, doorW, doorH); gfx.endFill();
          gfx.beginFill(0x4a3422); gfx.drawRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4); gfx.endFill();
          // Door split (double doors)
          gfx.lineStyle(1, 0x1a1008, 0.8);
          gfx.moveTo(doorX + doorW / 2, doorY + 2); gfx.lineTo(doorX + doorW / 2, doorY + doorH);
          gfx.lineStyle(0);
          // Brass knobs
          gfx.beginFill(0xfbbf24); gfx.drawCircle(doorX + doorW / 2 - 3, doorY + doorH / 2, 0.9); gfx.endFill();
          gfx.beginFill(0xfbbf24); gfx.drawCircle(doorX + doorW / 2 + 3, doorY + doorH / 2, 0.9); gfx.endFill();
          // Accent lintel above door
          gfx.beginFill(accent, 0.85);
          gfx.drawRect(doorX - 2, doorY - 2, doorW + 4, 2);
          gfx.endFill();

          // Small lanterns flanking door
          for (const lx of [doorX - 8, doorX + doorW + 8]) {
              gfx.beginFill(0x333333); gfx.drawRect(lx - 1, doorY + 4, 2, 4); gfx.endFill();
              gfx.beginFill(0xfbbf24, 0.9); gfx.drawCircle(lx, doorY + 10, 2); gfx.endFill();
              gfx.beginFill(0xfffbe8, 0.7); gfx.drawCircle(lx, doorY + 10, 1); gfx.endFill();
          }

          // Windows flanking the door (elegant, small panes)
          const winY = 16;
          const winH = h - 40;
          for (const wx of [b.w / 2 - 50, b.w / 2 + 30]) {
              if (wx < 18 || wx + 20 > b.w - 18) continue;
              gfx.beginFill(0x1a1a28); gfx.drawRect(wx, winY, 20, winH); gfx.endFill();
              gfx.beginFill(0xffe9a8, 0.55); gfx.drawRect(wx + 1, winY + 1, 18, winH - 2); gfx.endFill();
              gfx.lineStyle(0.6, 0xa8a288, 0.8);
              gfx.moveTo(wx + 10, winY + 1); gfx.lineTo(wx + 10, winY + winH - 1);
              gfx.moveTo(wx + 1, winY + winH / 2); gfx.lineTo(wx + 19, winY + winH / 2);
              gfx.lineStyle(0);
          }

          // Shadow
          gfx.beginFill(0x000000, 0.22); gfx.drawRect(0, h - 1, b.w, 3); gfx.endFill();

          // Flag pole with flying flag on rooftop — added as its own container for animation
          const flagCont = new PIXI.Container();
          flagCont.x = b.w * 0.5;
          flagCont.y = -16;
          // Pole
          const pole = new PIXI.Graphics();
          pole.beginFill(0x7a7a7a); pole.drawRect(-1, -28, 2, 30); pole.endFill();
          pole.beginFill(0xfbbf24); pole.drawCircle(0, -28, 1.8); pole.endFill();
          flagCont.addChild(pole);
          // Flag rectangle — country-accurate (Union Jack, Stars & Stripes, etc.)
          const flag = new PIXI.Graphics();
          const fw = 22, fh = 13;
          if (typeof EmbassyRow !== 'undefined' && EmbassyRow.drawCountryFlag) {
              EmbassyRow.drawCountryFlag(flag, b.country, fw, fh);
          } else {
              // Defensive fallback: simple stripes if helper missing
              const sh = fh / Math.max(1, flagCols.length);
              flagCols.forEach((c, i) => { flag.beginFill(c); flag.drawRect(0, i * sh, fw, sh); flag.endFill(); });
          }
          flag.x = 1;
          flag.y = -26;
          flag.pivot.set(0, fh * 0.5);
          flagCont.addChild(flag);
          container.addChild(flagCont);
          b._flagGfx = flag;

          // Embassy name plaque on facade (small, over the door)
          const plaque = new PIXI.Graphics();
          plaque.beginFill(0x1a1a28, 0.9);
          plaque.drawRoundedRect(-42, -6, 84, 12, 2);
          plaque.endFill();
          plaque.lineStyle(0.8, accent, 0.85);
          plaque.drawRoundedRect(-42, -6, 84, 12, 2);
          plaque.lineStyle(0);
          plaque.x = b.w / 2;
          plaque.y = doorY - 10;
          container.addChild(plaque);
          const plaqueTxt = new PIXI.Text((b.name || '').toUpperCase(), {
              fontFamily: 'JetBrains Mono', fontSize: 5.5, fontWeight: 'bold',
              fill: 0xfffbe8, letterSpacing: 0.6
          });
          plaqueTxt.anchor.set(0.5, 0.5);
          plaqueTxt.x = b.w / 2;
          plaqueTxt.y = doorY - 10;
          if (plaqueTxt.width > 78) plaqueTxt.scale.set(78 / plaqueTxt.width);
          container.addChild(plaqueTxt);

        } else if (b.type === 'diplomat_villa' && typeof EmbassyQuarter !== 'undefined') {
          // ── DIPLOMAT VILLA — country-themed ambassador's residence ──
          // Delegates to EmbassyQuarter.renderExterior so each country's architectural
          // vernacular (Georgian, pagoda, Haussmann, Victorian, haveli, Arabian) stays
          // together in embassy_quarter.js rather than sprawling across this file.
          EmbassyQuarter.renderExterior(b, container, gfx, h);
          // Shadow (consistent with other buildings)
          gfx.beginFill(0x000000, 0.22); gfx.drawRect(0, h - 1, b.w, 3); gfx.endFill();

        } else if (b.type === 'vcrow') {
          // ── VC ROW — brand-colored glass financial towers ──
          const bc = colHex; // brand accent from b.color
          // Right-edge depth shadow
          gfx.beginFill(0x000000, 0.14); gfx.drawRect(b.w, 4, 6, h - 4); gfx.endFill();
          // Dark glass curtain-wall body
          gfx.beginFill(0x0c1420); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
          gfx.beginFill(bc, 0.06); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
          // Left pilaster highlight + right shade (glassy tube read)
          gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 8, 4, h - 8); gfx.endFill();
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(b.w - 5, 8, 5, h - 8); gfx.endFill();
          // Brand crown band across the parapet
          gfx.beginFill(bc, 0.92); gfx.drawRect(0, 0, b.w, 9); gfx.endFill();
          gfx.beginFill(0xffffff, 0.18); gfx.drawRect(0, 0, b.w, 2); gfx.endFill();
          gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, 9, b.w, 2); gfx.endFill();
          // Curtain-wall grid: vertical mullions + horizontal spandrels + lit glass
          const glassTop = 16, glassBot = h - 22;
          const colW = 20;
          const nCols = Math.max(2, Math.floor((b.w - 12) / colW));
          const gutter = (b.w - 12 - nCols * (colW - 4)) / (nCols + 1);
          let gseed = (b.x | 0) + b.w;
          const rnd = () => { gseed = (gseed * 16807) % 2147483647; return (gseed - 1) / 2147483646; };
          for (let ci = 0; ci < nCols; ci++) {
              const wx = 6 + gutter + ci * (colW - 4 + gutter);
              for (let wy = glassTop; wy < glassBot; wy += 15) {
                  const lit = rnd() > 0.42;
                  // Pane
                  gfx.beginFill(lit ? 0xfff4d6 : 0x101c2c, lit ? 0.72 : 1);
                  gfx.drawRect(wx, wy, colW - 6, 11);
                  gfx.endFill();
                  // Brand reflection streak on lit panes
                  if (lit) { gfx.beginFill(bc, 0.18); gfx.drawRect(wx, wy, colW - 6, 3); gfx.endFill(); }
              }
              // Vertical mullion
              gfx.beginFill(0x0a1018, 0.9); gfx.drawRect(wx - 2, glassTop, 2, glassBot - glassTop); gfx.endFill();
          }
          // Horizontal spandrel belts (floor slabs)
          gfx.beginFill(bc, 0.10);
          for (let sy = glassTop - 2; sy < glassBot; sy += 15) gfx.drawRect(6, sy, b.w - 12, 2);
          gfx.endFill();
          // Two-story glass lobby with brand portal
          const lobbyH = 20;
          gfx.beginFill(0x0a1622); gfx.drawRect(6, h - lobbyH - 2, b.w - 12, lobbyH); gfx.endFill();
          gfx.beginFill(bc, 0.16); gfx.drawRect(6, h - lobbyH - 2, b.w - 12, lobbyH); gfx.endFill();
          gfx.beginFill(bc, 0.8); gfx.drawRect(6, h - lobbyH - 2, b.w - 12, 2); gfx.endFill();
          // Lobby mullions + warm interior glow
          gfx.beginFill(0xffe9a8, 0.35);
          for (let lx = 14; lx < b.w - 14; lx += 22) gfx.drawRect(lx, h - lobbyH, 14, lobbyH - 6);
          gfx.endFill();
          // Revolving-door entrance
          gfx.beginFill(0x060b12); gfx.drawRect(b.w / 2 - 11, h - 18, 22, 18); gfx.endFill();
          gfx.beginFill(bc, 0.5); gfx.drawRect(b.w / 2 - 11, h - 18, 22, 2); gfx.endFill();
          gfx.lineStyle(1, bc, 0.6);
          gfx.moveTo(b.w / 2, h - 16); gfx.lineTo(b.w / 2, h);
          gfx.moveTo(b.w / 2 - 9, h - 9); gfx.lineTo(b.w / 2 + 9, h - 9);
          gfx.lineStyle(0);
          // Canopy
          gfx.beginFill(bc, 0.85); gfx.drawRect(b.w / 2 - 16, h - 20, 32, 2.5); gfx.endFill();
          // Rooftop setback + mechanical penthouse
          gfx.beginFill(0x0a1018); gfx.drawRect(b.w * 0.5 - 24, -8, 48, 10); gfx.endFill();
          gfx.beginFill(bc, 0.3); gfx.drawRect(b.w * 0.5 - 24, -8, 48, 2); gfx.endFill();
          // Per-firm rooftop emblem (geometric so it survives cacheAsBitmap)
          this._drawVCEmblem(gfx, b, b.w * 0.5, -18, bc);
          // Base shadow
          gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, h - 1, b.w, 3); gfx.endFill();

        } else if (b.type === 'longevity') {
          // ── LONGEVITY WING — AI-bio research facilities ──
          const pal = {
            longevity_protein:   { body: 0x0b1424, acc: 0x3b82f6, glass: 0x1e3a8a },
            longevity_discovery: { body: 0x0c1e18, acc: 0x22c55e, glass: 0x14532d },
            longevity_trials:    { body: 0x101a26, acc: 0xec4899, glass: 0x155e63 },
            longevity_genomics:  { body: 0x140e22, acc: 0x8b5cf6, glass: 0x3b2564 },
            longevity_cryo:      { body: 0x0e1e28, acc: 0x67e8f9, glass: 0x155e75 },
          }[b.id] || { body: 0x101820, acc: 0x22c55e, glass: 0x14532d };
          const ac = pal.acc;
          // Right-edge depth + body
          gfx.beginFill(0x000000, 0.14); gfx.drawRect(b.w, 4, 6, h - 4); gfx.endFill();
          gfx.beginFill(pal.body); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
          gfx.beginFill(ac, 0.05); gfx.drawRect(0, 8, b.w, h - 8); gfx.endFill();
          gfx.beginFill(0xffffff, 0.04); gfx.drawRect(0, 8, 4, h - 8); gfx.endFill();
          gfx.beginFill(0x000000, 0.16); gfx.drawRect(b.w - 5, 8, 5, h - 8); gfx.endFill();
          // Crown band
          gfx.beginFill(ac, 0.9); gfx.drawRect(0, 0, b.w, 9); gfx.endFill();
          gfx.beginFill(0xffffff, 0.16); gfx.drawRect(0, 0, b.w, 2); gfx.endFill();
          // Lab window grid (lit clean-room panes)
          const wTop = 16, wBot = h - 20;
          let lseed = (b.x | 0) + b.w * 3;
          const lr = () => { lseed = (lseed * 16807) % 2147483647; return (lseed - 1) / 2147483646; };
          for (let wx = 8; wx < b.w - 14; wx += 20) {
              for (let wy = wTop; wy < wBot; wy += 15) {
                  const lit = lr() > 0.35;
                  gfx.beginFill(lit ? 0xeafff4 : 0x0e1a20, lit ? 0.7 : 1); gfx.drawRect(wx, wy, 13, 11); gfx.endFill();
                  if (lit) { gfx.beginFill(ac, 0.22); gfx.drawRect(wx, wy, 13, 3); gfx.endFill(); }
              }
              gfx.beginFill(0x000000, 0.85); gfx.drawRect(wx - 2, wTop, 2, wBot - wTop); gfx.endFill();
          }
          // Clean-room lobby
          gfx.beginFill(0x0a1620); gfx.drawRect(6, h - 20, b.w - 12, 18); gfx.endFill();
          gfx.beginFill(ac, 0.15); gfx.drawRect(6, h - 20, b.w - 12, 18); gfx.endFill();
          gfx.beginFill(ac, 0.8); gfx.drawRect(6, h - 20, b.w - 12, 2); gfx.endFill();
          gfx.beginFill(0xeafff4, 0.3);
          for (let lx = 14; lx < b.w - 14; lx += 22) gfx.drawRect(lx, h - 17, 14, 12);
          gfx.endFill();
          // Airlock entrance
          gfx.beginFill(0x060d14); gfx.drawRect(b.w / 2 - 10, h - 17, 20, 17); gfx.endFill();
          gfx.beginFill(ac, 0.5); gfx.drawRect(b.w / 2 - 10, h - 17, 20, 2); gfx.endFill();
          gfx.beginFill(ac, 0.7); gfx.drawCircle(b.w / 2 + 6, h - 9, 1); gfx.endFill();
          // Per-building signature motif
          this._drawLongevityMotif(gfx, b, ac, h);
          // Base shadow
          gfx.beginFill(0x000000, 0.2); gfx.drawRect(0, h - 1, b.w, 3); gfx.endFill();

        } else if (b.id === 'cafe' || b.id === 'gym' || b.id === 'arena' || b.id === 'open_square' || b.id === 'times_hq') {
          // ── SOCIAL STRIP — bespoke facades for the city's gathering places ──
          this._drawSocialFacade(gfx, container, b, h, floors);

        } else if (lab) {
          // ── AI LAB HQ TOWERS — procedural architectural identity ──
          // Style is deterministic per lab (hash + region, iconic fixed picks for the
          // famous few) so the dynamic scanner can add labs forever without art debt.
          const style = this._labStyleFor(b.lab, lab);
          const labSeed = this._labHash(b.lab);
          const famous = ['openai','anthropic','google','meta','xai','microsoft','deepseek','mistral','nvidia','amazon','ibm','apple'].includes(b.lab);
          const hasLobby = floors >= 2;
          const lobbyH = hasLobby ? 24 : 0;

          // Per-row horizontal inset — this is what shapes the massing per style
          const insetFor = (f) => {
              if (style === 'setback') {
                  // Art-deco tiers: top third narrowest, middle third mid, base full
                  if (f < floors / 3) return 14;
                  if (f < (floors * 2) / 3) return 7;
                  return 0;
              }
              if (style === 'campus') {
                  // Podium (bottom 2 floors full width) + slimmer tower above
                  return (f < floors - 2) ? 12 : 0;
              }
              return 0;
          };

          // ── Body massing (solid — the old facade was translucent) ──
          const bodyCol = style === 'brutalist' ? 0x161a22
                        : style === 'euro'      ? 0x171522
                        : style === 'pagoda'    ? 0x14101a
                        : 0x0d1322;
          // Everything edge-hugging is drawn PER floor-band with that band's own
          // inset — a full-height strip using the top tier's inset paints a stray
          // line across the wider lower tiers of setback/campus towers.
          for (let f = 0; f < floors; f++) {
              const ins = insetFor(f);
              const by2 = 14 + f * 18;
              gfx.beginFill(bodyCol); gfx.drawRect(ins, by2, b.w - ins * 2, 18); gfx.endFill();
              gfx.beginFill(colHex, 0.07); gfx.drawRect(ins, by2, b.w - ins * 2, 18); gfx.endFill();
              // Depth: left highlight + right shade, hugging this band's edges
              gfx.beginFill(0xffffff, 0.05); gfx.drawRect(ins, by2, 3, 18); gfx.endFill();
              gfx.beginFill(0x000000, 0.18); gfx.drawRect(b.w - ins - 5, by2, 5, 18); gfx.endFill();
              // Right-edge drop shadow cast beside this band
              gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w - ins, by2, 6, 18); gfx.endFill();
          }
          // Ground band under the last floor (h-24..h always exists: h = floors*18+24)
          const gndY = 14 + floors * 18;
          gfx.beginFill(bodyCol); gfx.drawRect(0, gndY, b.w, h - gndY); gfx.endFill();
          gfx.beginFill(colHex, 0.07); gfx.drawRect(0, gndY, b.w, h - gndY); gfx.endFill();
          gfx.beginFill(0xffffff, 0.05); gfx.drawRect(0, gndY, 3, h - gndY); gfx.endFill();
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(b.w - 5, gndY, 5, h - gndY); gfx.endFill();
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, gndY, 6, h - gndY); gfx.endFill();

          const topIns = insetFor(0);

          // ── Crown band (rooftop stock-ticker sits over 0..14 when present) ──
          gfx.beginFill(colHex, 0.95); gfx.drawRect(topIns, 0, b.w - topIns * 2, 10); gfx.endFill();
          gfx.beginFill(0xffffff, 0.16); gfx.drawRect(topIns, 0, b.w - topIns * 2, 2); gfx.endFill();
          gfx.beginFill(0x000000, 0.25); gfx.drawRect(topIns, 10, b.w - topIns * 2, 4); gfx.endFill();
          if (famous) { // double brand stripe for the famous few
              gfx.beginFill(0xffffff, 0.25); gfx.drawRect(topIns, 6, b.w - topIns * 2, 1.5); gfx.endFill();
          }

          // ── Style-specific facade texture ──
          if (style === 'brutalist') {
              // Concrete ribs
              gfx.beginFill(0x0c0f16, 0.8);
              for (let rx = 8; rx < b.w - 8; rx += 16) gfx.drawRect(rx, 14, 3, h - 14 - lobbyH);
              gfx.endFill();
          } else if (style === 'monolith') {
              // Continuous curtain-wall mullions
              gfx.beginFill(0x0a0e18, 0.9);
              for (let rx = 20; rx < b.w - 10; rx += 20) gfx.drawRect(rx, 14, 1.5, h - 14 - lobbyH);
              gfx.endFill();
          } else if (style === 'pagoda') {
              // Protruding eave cornices every 3 floors, with upturned corner tips
              for (let f = 3; f < floors; f += 3) {
                  const ey = 14 + f * 18;
                  gfx.beginFill(colHex, 0.55); gfx.drawRect(-4, ey - 2, b.w + 8, 3); gfx.endFill();
                  gfx.beginFill(colHex, 0.8);
                  gfx.drawPolygon([-4, ey - 2, -8, ey - 6, -3, ey - 2]);
                  gfx.drawPolygon([b.w + 4, ey - 2, b.w + 8, ey - 6, b.w + 3, ey - 2]);
                  gfx.endFill();
              }
          } else if (style === 'euro') {
              // Stone cornice line per floor + lighter facade wash
              gfx.beginFill(0xd8d3c8, 0.06); gfx.drawRect(0, 14, b.w, h - 14); gfx.endFill();
              gfx.beginFill(0xd8d3c8, 0.14);
              for (let f = 1; f < floors; f++) gfx.drawRect(2, 14 + f * 18 - 1, b.w - 4, 1.5);
              gfx.endFill();
          }
          // Setback tier caps
          if (style === 'setback') {
              for (let f = 1; f < floors; f++) {
                  if (insetFor(f) !== insetFor(f - 1)) {
                      const ty2 = 14 + f * 18;
                      gfx.beginFill(colHex, 0.5); gfx.drawRect(insetFor(f), ty2 - 2, b.w - insetFor(f) * 2, 2.5); gfx.endFill();
                  }
              }
          }
          // Campus podium terrace: railing + two tiny trees on the podium roof
          if (style === 'campus' && floors >= 4) {
              const podY = 14 + (floors - 2) * 18;
              gfx.beginFill(colHex, 0.5); gfx.drawRect(0, podY - 2, 12, 2); gfx.drawRect(b.w - 12, podY - 2, 12, 2); gfx.endFill();
              gfx.beginFill(0x94a3b8, 0.6);
              for (let rx2 = 2; rx2 < 11; rx2 += 3) gfx.drawRect(rx2, podY - 6, 1, 4);
              for (let rx2 = b.w - 11; rx2 < b.w - 2; rx2 += 3) gfx.drawRect(rx2, podY - 6, 1, 4);
              gfx.endFill();
              gfx.beginFill(0x2d6a4f);
              gfx.drawPolygon([5, podY - 3, 8, podY - 11, 11, podY - 3]);
              gfx.drawPolygon([b.w - 11, podY - 3, b.w - 8, podY - 11, b.w - 5, podY - 3]);
              gfx.endFill();
          }

          // ── Windows: deterministic, warm/cool mix, occasional wide meeting-room pane ──
          const lastWinRow = hasLobby ? floors - 1 : floors; // bottom floor becomes the lobby
          for (let f = 0; f < lastWinRow; f++) {
              const ins = insetFor(f);
              const rowW = b.w - ins * 2;
              const cols2 = Math.max(1, Math.floor((rowW - 8) / 22));
              const gap = (rowW - cols2 * 14) / (cols2 + 1);
              for (let c = 0; c < cols2; c++) {
                  const n = this._labNoise(labSeed + f * 131 + c * 17);
                  const wx = ins + gap + c * (14 + gap);
                  const wy = 20 + f * 18;
                  // Meeting-room pane: merge with the next column occasionally
                  const wide = n > 0.92 && c < cols2 - 1;
                  const pw = wide ? 14 + gap + 14 : (style === 'brutalist' ? 11 : 14);
                  const ph = style === 'brutalist' ? 8 : style === 'euro' ? 11 : 10;
                  // Deep frame
                  gfx.beginFill(0x000000, style === 'brutalist' ? 0.45 : 0.2);
                  gfx.drawRect(wx - 1.5, wy - 1.5, pw + 3, ph + 3); gfx.endFill();
                  const lit = n < 0.62;
                  if (lit) {
                      const warm = this._labNoise(labSeed * 3 + f * 47 + c * 13) < 0.72;
                      gfx.beginFill(warm ? 0xfff2cf : 0xd6ecff, wide ? 0.95 : 0.85);
                  } else {
                      gfx.beginFill(0x0a0e1a);
                  }
                  if (style === 'euro' && f === 0) {
                      gfx.drawRoundedRect(wx, wy, pw, ph, 4); // arched attic row
                  } else {
                      gfx.drawRect(wx, wy, pw, ph);
                  }
                  gfx.endFill();
                  if (lit) { gfx.beginFill(colHex, 0.14); gfx.drawRect(wx, wy, pw, 2.5); gfx.endFill(); }
                  if (wide) c++; // consume the merged column
              }
          }

          // ── Two-story glass lobby + canopy + revolving door ──
          if (hasLobby) {
              gfx.beginFill(0x0a121e); gfx.drawRect(4, h - lobbyH, b.w - 8, lobbyH - 2); gfx.endFill();
              gfx.beginFill(colHex, 0.12); gfx.drawRect(4, h - lobbyH, b.w - 8, lobbyH - 2); gfx.endFill();
              gfx.beginFill(colHex, 0.75); gfx.drawRect(4, h - lobbyH, b.w - 8, 2); gfx.endFill();
              // Warm reception glow panes
              gfx.beginFill(0xffe9a8, 0.35);
              for (let lx = 12; lx < b.w - 20; lx += 20) gfx.drawRect(lx, h - lobbyH + 4, 13, lobbyH - 9);
              gfx.endFill();
              // Revolving door
              gfx.beginFill(0x060b12); gfx.drawRect(b.w / 2 - 9, h - 18, 18, 16); gfx.endFill();
              gfx.lineStyle(1, colHex, 0.55);
              gfx.moveTo(b.w / 2, h - 17); gfx.lineTo(b.w / 2, h - 3);
              gfx.moveTo(b.w / 2 - 8, h - 10); gfx.lineTo(b.w / 2 + 8, h - 10);
              gfx.lineStyle(0);
              // Canopy
              gfx.beginFill(colHex, 0.85); gfx.drawRect(b.w / 2 - 15, h - 20, 30, 2.5); gfx.endFill();
              gfx.beginFill(0x000000, 0.25); gfx.drawRect(b.w / 2 - 15, h - 17.5, 30, 1.5); gfx.endFill();
          } else {
              gfx.beginFill(0x0a0a18); gfx.drawRect(b.w / 2 - 6, h - 18, 12, 18); gfx.endFill();
              gfx.beginFill(colHex, 0.3); gfx.drawRect(b.w / 2 - 6, h - 18, 12, 2); gfx.endFill();
          }

          // ── Brand plaque + emblem (top-left of facade, under the crown) ──
          // Sized to still read at far zoom-out — the emblem is the lab's street identity.
          const px2 = topIns + 5;
          gfx.beginFill(0x070b12, 0.92); gfx.drawRoundedRect(px2, 17, 32, 32, 4); gfx.endFill();
          gfx.lineStyle(1.2, colHex, 0.7); gfx.drawRoundedRect(px2, 17, 32, 32, 4); gfx.lineStyle(0);
          this._drawLabEmblem(gfx, b.lab, px2 + 16, 33, colHex, 1.5);
          // Famous labs also get a vertical brand fin down the right edge —
          // drawn per floor-band so it steps with setback/campus tiers.
          if (famous) {
              gfx.beginFill(colHex, 0.55);
              for (let f = 0; f < (hasLobby ? floors - 1 : floors); f++) {
                  gfx.drawRect(b.w - insetFor(f) - 8, 14 + f * 18, 3, 18);
              }
              gfx.endFill();
          }

          // ── Rooftop furniture by hash (left side — helipad/logo board own the rest) ──
          if (b.w >= 110) {
              const fx3 = Math.max(10, b.w * 0.22) + topIns;
              const kind = labSeed % 4;
              if (kind === 0) { // HVAC pair
                  gfx.beginFill(0x475569); gfx.drawRect(fx3, -6, 12, 6); gfx.drawRect(fx3 + 16, -5, 10, 5); gfx.endFill();
                  gfx.beginFill(0x64748b, 0.7); gfx.drawRect(fx3 + 1.5, -4.5, 9, 1.2); gfx.drawRect(fx3 + 1.5, -2.5, 9, 1.2); gfx.endFill();
              } else if (kind === 1) { // water tank
                  gfx.beginFill(0x334155); gfx.drawRect(fx3 + 2, -1.5, 10, 1.5); gfx.endFill();
                  gfx.beginFill(0x6b7280); gfx.drawRoundedRect(fx3 + 1, -9, 12, 8, 2); gfx.endFill();
                  gfx.beginFill(0x9ca3af, 0.5); gfx.drawRect(fx3 + 2.5, -8, 2, 6); gfx.endFill();
              } else if (kind === 2) { // antenna cluster
                  gfx.beginFill(0x64748b);
                  gfx.drawRect(fx3, -9, 1.5, 9); gfx.drawRect(fx3 + 7, -12, 1.5, 12); gfx.drawRect(fx3 + 14, -7, 1.5, 7);
                  gfx.endFill();
                  gfx.beginFill(0xef4444, 0.8); gfx.drawCircle(fx3 + 7.7, -12.8, 1.2); gfx.endFill();
              } else { // roof garden
                  gfx.beginFill(0x1b4332); gfx.drawRect(fx3, -3, 26, 3); gfx.endFill();
                  gfx.beginFill(0x2d6a4f);
                  gfx.drawPolygon([fx3 + 4, -3, fx3 + 7, -10, fx3 + 10, -3]);
                  gfx.drawPolygon([fx3 + 15, -3, fx3 + 18, -8, fx3 + 21, -3]);
                  gfx.endFill();
              }
          }

          // Base ambient occlusion
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();

          if (b.isCheapest) {
            const neon = new PIXI.Text('SALE', { fontFamily: emojiFontStack, fontSize: 8, fill: 0x4ade80, fontStyle: 'italic', fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 5, dropShadowDistance: 0, padding: 8 });
            neon.x = b.w + 2; neon.y = 40; neon.rotation = Math.PI / 2;
            container.addChild(neon); b._neonSign = neon;
          }

        } else {
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, 4, 6, h - 4);
          gfx.endFill();
          gfx.beginFill(colHex, 0.85); gfx.drawRect(0, 0, b.w, 14); gfx.endFill();
          gfx.beginFill(colHex, 1); gfx.drawRect(0, 0, b.w, 3); gfx.endFill();
          gfx.beginFill(0x000000, 0.15);
          gfx.drawRect(0, 11, b.w, 3); gfx.endFill();
          gfx.beginFill(colHex, 0.12); gfx.drawRect(0, 14, b.w, h - 14); gfx.endFill();
          gfx.beginFill(colHex, 0.06);
          gfx.drawRect(0, 14, b.w / 3, h - 14); gfx.endFill();
          gfx.beginFill(0xffffff, 0.02);
          gfx.drawRect(b.w * 2 / 3, 14, b.w / 3, h - 14); gfx.endFill();
          gfx.lineStyle(2, colHex, 0.3);
          gfx.drawRect(0, 14, b.w, h - 14); gfx.lineStyle(0);
          
          gfx.lineStyle(1, 0x000000, 0.2);
          for(let ty = 14; ty < h; ty += 18) { gfx.moveTo(0, ty); gfx.lineTo(b.w, ty);
          }
          for(let tx = 24; tx < b.w; tx += 24) { gfx.moveTo(tx, 14);
          gfx.lineTo(tx, h); }
          gfx.lineStyle(0);

          const cols = Math.floor(b.w / 24);
          const doorL = b.w / 2 - 8, doorR = b.w / 2 + 8;

          // Draw windows top-down (visual rendering order)
          for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
            const lit = this._labNoise((b.x | 0) + f * 131 + c * 17) > .35;
            const wx = 10 + c * 24, wy = 20 + f * 18;
            if (f === floors - 1 && wx + 12 > doorL && wx < doorR) continue;

            gfx.beginFill(0x000000, 0.15);
            gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
            if (lit) { gfx.beginFill(0xffffff, 0.9); } else { gfx.beginFill(0x0a0a18);
            }
            gfx.drawRect(wx, wy, 12, 10); gfx.endFill();
            gfx.lineStyle(1, colHex, 0.15);
            gfx.drawRect(wx, wy, 12, 10); gfx.lineStyle(0);
            gfx.beginFill(colHex, 0.12); gfx.drawRect(wx, wy + 4, 12, 1); gfx.endFill();
            gfx.beginFill(colHex, 0.12);
            gfx.drawRect(wx + 5, wy, 1, 10); gfx.endFill();
          }

          gfx.beginFill(0x0a0a18);
          gfx.drawRect(b.w / 2 - 6, h - 18, 12, 18); gfx.endFill();
          gfx.beginFill(colHex, 0.3);
          gfx.drawRect(b.w / 2 - 6, h - 18, 12, 2); gfx.endFill();
          gfx.beginFill(0xffeaa7, 0.4);
          gfx.drawCircle(b.w / 2 + 3, h - 9, 1); gfx.endFill();
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          if (b.isCheapest) {
            const neon = new PIXI.Text('SALE', { fontFamily: emojiFontStack, fontSize: 8, fill: 0x4ade80, fontStyle: 'italic', fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 5, dropShadowDistance: 0, padding: 8 });
            neon.x = b.w + 2; neon.y = 40; neon.rotation = Math.PI / 2;
            container.addChild(neon); b._neonSign = neon;
          }
        }
        
        container.addChildAt(gfx, 0);
        // Add overlay text elements ON TOP of gfx for special buildings
        if (b.id === 'black_market' && typeof BlackMarket !== 'undefined') {
            BlackMarket.drawOverlay(container, b, h);
        }
        // Cache building body as bitmap — converts all Graphics draw calls into a single batched sprite
        // Skip cacheAsBitmap for underground buildings — they're offscreen at render time,
        // and PIXI may produce a blank texture for offscreen cached graphics
        if (b.id !== 'black_market') gfx.cacheAsBitmap = true;

        // ─── ROOFTOP HELIPAD for HQ buildings with founders ───
        if (!b.id.startsWith('house_') && !b.id.startsWith('res_') && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && !b.id.startsWith('suburb_') && !b.id.startsWith('npc_apt_') && b.id !== 'park' && b.id !== 'graveyard' && b.id !== 'city_park' && b.id !== 'ai_index' && b.id !== 'black_market') {
            const hasFounder = G.ceoRefs && G.ceoRefs[b.lab];
            if (hasFounder) {
                const hpGfx = new PIXI.Graphics();
                const hpX = b.w - 35;
                const hpY = 2; // Just above the roof line
                // Pad surface
                hpGfx.beginFill(0x334155, 0.8); hpGfx.drawEllipse(hpX, hpY, 16, 5); hpGfx.endFill();
                // H marking
                hpGfx.beginFill(0xffffff, 0.5);
                hpGfx.drawRect(hpX - 5, hpY - 3, 2, 6);
                hpGfx.drawRect(hpX + 3, hpY - 3, 2, 6);
                hpGfx.drawRect(hpX - 5, hpY - 0.5, 10, 1);
                hpGfx.endFill();
                // Corner lights
                hpGfx.beginFill(0xfbbf24, 0.7);
                hpGfx.drawCircle(hpX - 14, hpY, 1.5);
                hpGfx.drawCircle(hpX + 14, hpY, 1.5);
                hpGfx.endFill();
                container.addChild(hpGfx);
            }
        }
        
        if (b.isTopLab && !b.id.startsWith('house_') && !b.id.startsWith('forest_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_')) {
            const beaconCont = new PIXI.Container();
            beaconCont.y = -22; 
            const beam = new PIXI.Graphics();
            beam.beginFill(0x22d3ee, 0.15); beam.drawRect(b.w/2 - 15, -2000, 30, 2000); beam.endFill();
            beam.beginFill(0xffffff, 0.2);
            beam.drawRect(b.w/2 - 5, -2000, 10, 2000); beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD; beaconCont.addChild(beam);
            const crown = new PIXI.Text('👑', { fontFamily: emojiFontStack, fontSize: 32, fill: 0xfacc15, dropShadow: true, dropShadowColor: 0xfacc15, dropShadowBlur: 15, dropShadowDistance: 0, padding: 20 });
            crown.anchor.set(0.5, 0.5); crown.x = b.w / 2; crown.y = -120;
            beaconCont.addChild(crown);
            
            const emitter = new PIXI.Graphics();
            emitter.beginFill(0x22d3ee, 0.8);
            emitter.drawEllipse(b.w/2, 0, 24, 6); emitter.endFill();
            beaconCont.addChild(emitter);
            container.addChild(beaconCont); b._beacon = { beam, emitter, crown };
        }

        // Fab/DC buildings: look up ticker from supplementary map if lab has none
        const FAB_TICKERS = { tsmc: 'TSM', asml: 'ASML', intel: 'INTC', samsung: '005930.KS' };
        const tickerSym = (lab && lab.ticker) ? lab.ticker : (b.lab && FAB_TICKERS[b.lab]) ? FAB_TICKERS[b.lab] : null;
        const isFabOrDC = b.id.startsWith('fab_') || b.id.startsWith('dc_');
        const isConstruction = isFabOrDC && b.dcData && b.dcData.status === 'construction';
        if (tickerSym && !b.id.startsWith('house_') && !b.id.startsWith('forest_') && !isConstruction) {
            const tickCont = new PIXI.Container();
            // Fab/DC: position below HVAC vents; regular labs: top rim
            tickCont.y = isFabOrDC ? 16 : 0;
            const tickBg = new PIXI.Graphics();
            tickBg.beginFill(0x000000, 0.85); tickBg.drawRect(0, 0, b.w, 14); tickBg.endFill();
            tickCont.addChild(tickBg);
            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff); mask.drawRect(0, -5, b.w, 24); mask.endFill();
            tickCont.addChild(mask); tickCont.mask = mask;
            const tickTxt = new PIXI.Text(`${tickerSym} AWAITING TELEMETRY`, {
                fontFamily: 'monospace', fontSize: 10, fontWeight: '900', strokeThickness: 1,
                fill: 0x888888, stroke: 0x888888, dropShadow: true, dropShadowColor: 0x888888, dropShadowBlur: 10, dropShadowDistance: 0, padding: 10
            });
            tickTxt.y = 1; tickTxt.x = b.w; tickTxt.blendMode = PIXI.BLEND_MODES.ADD;
            tickCont.addChild(tickTxt); b._stockTicker = tickTxt; b._tickerW = b.w; b._tickerSym = tickerSym;
            container.addChild(tickCont);
        }

        // ─── BACKBONE: Network status ticker on IXP building ───
        if (b.id === 'backbone_ixp' && typeof BackboneZone !== 'undefined') {
            const bkTickCont = new PIXI.Container();
            bkTickCont.y = 0;
            const bkTickBg = new PIXI.Graphics();
            bkTickBg.beginFill(0x000000, 0.9); bkTickBg.drawRect(0, 0, b.w, 14); bkTickBg.endFill();
            bkTickCont.addChild(bkTickBg);
            const bkMask = new PIXI.Graphics();
            bkMask.beginFill(0xffffff); bkMask.drawRect(0, -5, b.w, 24); bkMask.endFill();
            bkTickCont.addChild(bkMask); bkTickCont.mask = bkMask;
            const bkTickTxt = new PIXI.Text(BackboneZone.getNextTickerItem(), {
                fontFamily: 'monospace', fontSize: 10, fontWeight: '900', strokeThickness: 1,
                fill: 0x22d3ee, stroke: 0x22d3ee, dropShadow: true, dropShadowColor: 0x22d3ee, dropShadowBlur: 10, dropShadowDistance: 0, padding: 10
            });
            bkTickTxt.y = 1; bkTickTxt.x = b.w; bkTickTxt.blendMode = PIXI.BLEND_MODES.ADD;
            bkTickCont.addChild(bkTickTxt); b._bkTicker = bkTickTxt; b._bkTickerW = b.w;
            container.addChild(bkTickCont);
        }

        // ─── VC ROW: Deal ticker on rooftop (same pattern as HQ stock tickers above) ───
        // Cryptex Exchange gets a live crypto feed (bitcoin-orange) instead of the deal ticker.
        if (b.type === 'vcrow' && typeof VCRow !== 'undefined') {
            const isCrypto = b.id === 'vcrow_cryptex';
            const tickColor = isCrypto ? 0xf7931a : 0x4ade80; // BTC orange vs VC green
            const initialText = isCrypto ? VCRow.getNextCryptoTickerItem() : VCRow.getNextTickerItem();
            const vTickCont = new PIXI.Container();
            vTickCont.y = 0;
            const vTickBg = new PIXI.Graphics();
            vTickBg.beginFill(0x000000, 0.9); vTickBg.drawRect(0, 0, b.w, 14); vTickBg.endFill();
            vTickCont.addChild(vTickBg);
            const vMask = new PIXI.Graphics();
            vMask.beginFill(0xffffff); vMask.drawRect(0, -5, b.w, 24); vMask.endFill();
            vTickCont.addChild(vMask); vTickCont.mask = vMask;
            const vTickTxt = new PIXI.Text(initialText, {
                fontFamily: 'monospace', fontSize: 10, fontWeight: '900', strokeThickness: 1,
                fill: tickColor, stroke: tickColor, dropShadow: true, dropShadowColor: tickColor, dropShadowBlur: 10, dropShadowDistance: 0, padding: 10
            });
            vTickTxt.y = 1; vTickTxt.x = b.w; vTickTxt.blendMode = PIXI.BLEND_MODES.ADD;
            vTickCont.addChild(vTickTxt); b._vcTicker = vTickTxt; b._vcTickerW = b.w;
            b._vcTickerIsCrypto = isCrypto;
            container.addChild(vTickCont);
        }

        if (b.id !== 'park' && b.id !== 'graveyard' && b.id !== 'city_park' && b.id !== 'ai_index' && b.id !== 'black_market' && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('house_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && !b.id.startsWith('suburb_')) {
            const sign = new PIXI.Text(b.name, { fontFamily: 'Silkscreen', fontSize: 7, fill: 0x9898c0, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            if (sign.width > b.w - 4) sign.scale.set((b.w - 4) / sign.width);
            container.addChild(sign); b._sign = sign;
            if (lab) {
                const boardW = b.w * 0.8;
                const boardH = 24; const boardX = b.w / 2 - boardW / 2; const boardY = -boardH - 10;
                gfx.beginFill(0x111111); gfx.lineStyle(2, colHex, 0.8); 
                gfx.drawRect(boardX, boardY, boardW, boardH); gfx.endFill(); gfx.lineStyle(0);
                gfx.beginFill(0x333333); gfx.drawRect(boardX + 10, boardY + boardH, 4, 10);
                gfx.drawRect(boardX + boardW - 14, boardY + boardH, 4, 10); gfx.endFill();
                const logoTxt = new PIXI.Text(lab.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 1, dropShadow: true, dropShadowColor: colHex, dropShadowBlur: 8, dropShadowDistance: 0 });
                logoTxt.anchor.set(0.5, 0.5); logoTxt.x = b.w / 2; logoTxt.y = boardY + boardH / 2;
                if (logoTxt.width > boardW - 8) logoTxt.scale.set((boardW - 8) / logoTxt.width);
                container.addChild(logoTxt);
                b._boardTxt = logoTxt; b._boardCol = colHex;
            } else {
                // All non-lab buildings get neon signs (no more old emoji badges)
            }
        }
        
        // ─── NEON SIGNS for social buildings (visible at night only) ───
        const neonConfig = {
            'cafe': { text: '☕ API CAFÉ', col: 0xf59e0b, speed: 0.08, flicker: 0.3 },
            'gym': { text: '🏋️ RLHF GYM', col: 0x22d3ee, speed: 0.12, flicker: 0.4 },
            'arena': { text: '⚔️ LMSYS ARENA', col: 0xef4444, speed: 0.06, flicker: 0.25 },
            'open_square': { text: '💻 OPEN SOURCE HUB', col: 0xa855f7, speed: 0.10, flicker: 0.35 },
            'neon_bar': { text: '🍸 NEON BAR', col: 0xff00ff, speed: 0.15, flicker: 0.45 },
            'uni_dorm': { text: '🎓 DORMITORY', col: 0x60a5fa, speed: 0.07, flicker: 0.2 }
        };
        // Auto-generate neon sign for any non-lab, non-special building
        let nc = neonConfig[b.id];
        if (!nc && !lab && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('house_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && !b.id.startsWith('npc_apt_') && !b.id.startsWith('suburb_') && !b.id.startsWith('res_') && !b.id.startsWith('embassy_') && !b.id.startsWith('align_') && b.id !== 'graveyard' && b.id !== 'visitor_monument' && b.id !== 'park' && b.id !== 'city_park' && b.id !== 'ai_index' && b.id !== 'black_market' && b.id !== 'times_hq') {
            nc = { text: (b.emoji || '🏢') + ' ' + (b.name || '').toUpperCase(), col: 0x6688aa, speed: 0.06, flicker: 0.2 };
        }
        if (nc) {
            const neonCont = new PIXI.Container();
            // Neon text (create first to measure width)
            const colHexStr = '#' + nc.col.toString(16).padStart(6, '0');
            const neonTxt = new PIXI.Text(nc.text, {
                fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 'bold',
                fill: colHexStr, letterSpacing: 1,
                dropShadow: true, dropShadowColor: colHexStr, dropShadowBlur: 10, dropShadowDistance: 0, padding: 4
            });
            neonTxt.anchor.set(0.5, 0.5);
            // Scale down if text is wider than building
            const maxW = b.w - 10;
            if (neonTxt.width > maxW) neonTxt.scale.set(maxW / neonTxt.width);
            // Sign backing board sized to text
            const brdW = Math.min(maxW + 8, Math.max(neonTxt.width + 16, 60));
            const board = new PIXI.Graphics();
            board.beginFill(0x0a0a14, 0.85);
            board.drawRoundedRect(-brdW/2, -10, brdW, 18, 3);
            board.endFill();
            board.lineStyle(1, nc.col, 0.4);
            board.drawRoundedRect(-brdW/2, -10, brdW, 18, 3);
            board.lineStyle(0);
            neonCont.addChild(board);
            neonCont.addChild(neonTxt);
            // Glow halo behind sign
            const glow = new PIXI.Graphics();
            glow.beginFill(nc.col, 0.06);
            glow.drawEllipse(0, 0, brdW/2 + 8, 16);
            glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            neonCont.addChildAt(glow, 0);
            // Position on building facade
            neonCont.x = b.w / 2;
            neonCont.y = -6;
            neonCont.visible = true;
            container.addChild(neonCont);
            b._neonCont = neonCont;
            b._neonGlow = glow;
            b._neonTxt = neonTxt;
            b._neonSpeed = nc.speed;
            b._neonFlicker = nc.flicker;
            b._neonCol = nc.col;
        }
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.hitArea = new PIXI.Rectangle(0, 0, b.w, h + 10);
        container.on('pointertap', () => {
            if (b.id.startsWith('port_') && typeof PortEnv !== 'undefined') {
                PortEnv.showManifest();
            } else if (typeof UI !== 'undefined') {
                UI.selectBld(b);
            }
        });
        container.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, b.name, b.tip || b.desc); });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
  
        // Underground buildings go on charLayer so they render ABOVE ground/trains
        if (b.id === 'black_market' && G.charLayer) {
            G.charLayer.addChild(container);
        } else {
            this.bldLayer.addChild(container);
        }
        b._container = container;
      });

      // Create Black Market dumpster entrance beside Neon Bar
      if (typeof BlackMarket !== 'undefined') {
          BlackMarket.createDumpster(this.bldLayer);
      }

      // Pixel-art shadow-side dithering over the city towers.
      this._buildFacadeDither();

      // Store fingerprint after build so subsequent calls can compare
      this._lastBuildFP = this._buildFingerprint();
    },

    // Ordered-dither shadow gradient down the shadow (right) side of the city
    // towers — the classic pixel-art way to shade a flat facade, giving the
    // skyline depth without touching each bespoke facade branch. Drawn once
    // into a cached overlay above the buildings (below the ground/characters);
    // skips organic/low structures where a hard shadow band would look wrong.
    //
    // The overlay is split into horizontal CHUNKS so each cacheAsBitmap texture
    // stays within the GPU's MAX_TEXTURE_SIZE. A single graphic spanning the
    // whole ~39k-px-wide city would cache to a texture far wider than the limit
    // (16384 on most GPUs, ×renderer.resolution on retina) — PIXI then renders a
    // clamped/garbled bitmap that showed up as a dark rectangular block floating
    // in the sky over the tall-tower district. Chunking keeps every cache legal.
    _buildFacadeDither() {
        if (!window.BLDS || !this.bldLayer || !this.bldLayer.parent) return;
        // (Re)create the overlay layer just above bldLayer.
        if (this._ditherGfx && !this._ditherGfx.destroyed) {
            this._ditherGfx.destroy({ children: true });
        }
        const SKIP = ['forest_', 'house_', 'res_', 'metro_', 'dc_', 'fab_', 'npc_apt_', 'suburb_', 'port_'];
        const SKIP_IDS = { park: 1, city_park: 1, graveyard: 1, ai_index: 1, black_market: 1, visitor_monument: 1 };
        const SPACE_TYPES = { launchpad: 1, mission_control: 1, assembly: 1, tracking: 1 };
        const gy = G.groundY;

        // Safe world-space chunk width: the cached bitmap is rendered at
        // renderer.resolution, so texture_px = worldWidth × resolution must stay
        // under MAX_TEXTURE_SIZE. Leave a margin for tower widths straddling a
        // boundary. Falls back to a conservative 4096 if the limit is unreadable.
        const rnd = G.app.renderer;
        const res = rnd.resolution || 1;
        let maxTex = 4096;
        try { maxTex = rnd.gl.getParameter(rnd.gl.MAX_TEXTURE_SIZE) || 4096; } catch (e) { /* no gl */ }
        const chunkW = Math.max(1024, Math.floor(maxTex / res) - 256);

        // Bucket each building's dither into the chunk its shadow band lives in.
        const chunks = new Map();  // chunkIndex -> PIXI.Graphics
        const chunkFor = (worldX) => {
            const idx = Math.floor(worldX / chunkW);
            let g = chunks.get(idx);
            if (!g) { g = new PIXI.Graphics(); g.beginFill(0x000000); chunks.set(idx, g); }
            return g;
        };

        for (let i = 0; i < BLDS.length; i++) {
            const b = BLDS[i];
            if (!b._container || SKIP_IDS[b.id] || (b.type && SPACE_TYPES[b.type])) continue;
            if (SKIP.some(p => b.id.startsWith(p))) continue;
            const floors = b.dynamicFl || b.fl || 3;
            const h = floors * 18 + 24;
            const topY = gy - 24 - h;      // world-Y of the building top
            const baseY = gy - 24;         // groundline
            // Shadow side = right ~38% of the facade, 3px ordered-dither grid.
            const shX = b.x + b.w * 0.62;
            const shW = b.w * 0.38;
            const g = chunkFor(shX);       // all of one tower's band shares a chunk
            for (let yy = topY + 14, row = 0; yy < baseY - 2; yy += 3, row++) {
                // Density ramps left→right (deeper shadow toward the outer edge)
                // via a Bayer-ish checker threshold — the ordered-dither look.
                for (let xx = shX, col = 0; xx < shX + shW; xx += 3, col++) {
                    const across = (xx - shX) / shW;           // 0 at inner edge, 1 at outer
                    const on = ((row + col) & 1) === 0 ? across > 0.35 : across > 0.7;
                    if (on) g.drawRect(xx, yy, 2, 2);
                }
            }
        }

        // Group the chunks under one container so the `_ditherGfx` reference and
        // its z-order / teardown stay single-handled. Each chunk caches its own
        // (now legally-sized) bitmap.
        const overlay = new PIXI.Container();
        // Whole overlay is faint — it's shading, not paint.
        overlay.alpha = 0.15;
        chunks.forEach((g) => {
            g.endFill();
            g.cacheAsBitmap = true;
            overlay.addChild(g);
        });
        const par = this.bldLayer.parent;
        par.addChildAt(overlay, par.getChildIndex(this.bldLayer) + 1);
        this._ditherGfx = overlay;
    },

    // ─── WEATHER SELECTION (Markov chain, climate + season aware) ───
    // Uses _MARKOV[climate][season][currentWeather]. Falls back gracefully
    // if the current weather doesn't have a row for the active season (e.g.
    // entering a climate where that state doesn't exist).
    _pickNextWeather() {
      const climateTable = this._MARKOV[this.climate] || this._MARKOV.temperate;
      const table = climateTable[this.season] || climateTable[Object.keys(climateTable)[0]];
      const row = table[this.weather] || table.clear || table.partly_cloudy
                  || [['clear', 1]];
      let total = 0;
      for (const [, w] of row) total += w;
      let roll = Math.random() * total;
      for (const [name, w] of row) {
          roll -= w;
          if (roll <= 0) return name;
      }
      return row[0][0];
    },

    updateWeather() {
      if (G.tick <= this.nextWeatherTick) return;

      // User can disable dynamic weather in Settings. Settle to clear via the
      // normal fade-out path (queue 'clear' as pending) and stop rolling.
      if (typeof G !== 'undefined' && G.prefs && G.prefs.weather === false) {
          if (this.weather !== 'clear' && !this.weatherPending) {
              this.weatherPending = 'clear';
              this.weatherTargetIntensity = 0;
          }
          this.nextWeatherTick = G.tick + 2000;
          return;
      }

      this.season = this.getSeason();

      // If a fade-out is still in progress, don't queue a new one yet —
      // let the current transition finish cleanly.
      if (this.weatherPending) {
          this.nextWeatherTick = G.tick + 400;
          return;
      }

      const nw = this._pickNextWeather();
      if (nw !== this.weather) {
          // Begin transition: fade out current, then swap to `nw`, then fade in.
          this.weatherPending = nw;
          this.weatherTargetIntensity = 0;
          this._announceWeather(nw);
      } else {
          // Same state picked — just nudge the target intensity (wiggle density).
          const peak = this._WEATHER_INFO[nw]?.peak || 0;
          this.weatherTargetIntensity = peak * (0.8 + Math.random() * 0.2);
      }

      // Next roll in 25-65 seconds of sim time (matches old cadence).
      this.nextWeatherTick = G.tick + 2000 + Math.floor(Math.random() * 3000);
    },

    _announceWeather(nw) {
      if (typeof UI === 'undefined') return;
      const toasts = {
          rain:         '🌧️ A rainstorm is rolling in.',
          drizzle:      '🌦️ A light drizzle has started.',
          thunderstorm: '⛈️ Thunderstorm! Heads down out there.',
          snow:         '❄️ Snow is starting to fall.',
          cherry:       '🌸 Cherry blossoms drifting through the air.',
          leaves:       '🍂 Autumn leaves are falling.',
          fog:          '🌫️ Fog is settling over the city.',
          overcast:     '☁️ The sky is clouding over.',
          partly_cloudy:'⛅ A few clouds moving in.',
      };
      const msg = toasts[nw];
      if (msg) UI.addToast(msg);
      else if (nw === 'clear' && G.tick > 1500) UI.addToast('☀️ The weather is clearing up.');

      // Existing achievements preserved; extend with new ones.
      if (G.unlockAchieve) {
          if (nw === 'rain')         G.unlockAchieve('rain_seen');
          else if (nw === 'snow')    G.unlockAchieve('snow_seen');
          else if (nw === 'thunderstorm') G.unlockAchieve('thunder_seen');
          else if (nw === 'fog')     G.unlockAchieve('fog_seen');
      }
    },

    // ─── SMOOTH TRANSITION TICK (runs every frame) ───
    // Lerps weatherIntensity toward its target. When fading out and a
    // `weatherPending` is queued, swap and begin fading in to the new peak.
    _tickWeatherTransition() {
      const lerpRate = 0.004;  // ~250-frame (4-second) fade at 60fps
      const target = this.weatherTargetIntensity;
      const cur = this.weatherIntensity;
      const delta = target - cur;
      if (Math.abs(delta) > 0.001) {
          this.weatherIntensity += delta * lerpRate * 16;  // scaled lerp
          if (Math.abs(this.weatherIntensity - target) < 0.005) this.weatherIntensity = target;
      }

      // Fade-out complete → swap to pending weather and start fading in.
      if (this.weatherPending && this.weatherIntensity < 0.02) {
          const nw = this.weatherPending;
          this.weather = nw;
          this.weatherPending = null;
          // Clear old particles so they don't flash in the new state.
          this.rainDrops.length = 0;
          this.snowFlakes.length = 0;
          this.petals.length = 0;
          // Begin fading in to the new weather's peak intensity.
          const peak = this._WEATHER_INFO[nw]?.peak || 0;
          this.weatherTargetIntensity = peak * (0.85 + Math.random() * 0.15);
      }

      // Slow wind drift — gentle breeze, stronger during storms.
      const t = G.tick * 0.0008 + this._windSeed;
      const base = Math.sin(t) * 0.4 + Math.sin(t * 0.37) * 0.2;
      let windMax = 0.4;
      if (this.weather === 'rain' || this.weather === 'drizzle') windMax = 1.1;
      else if (this.weather === 'thunderstorm') windMax = 1.8;
      else if (this.weather === 'snow') windMax = 0.7;
      else if (this.weather === 'fog') windMax = 0.25;
      this.wind.x = base * windMax;
    },

    updateDesertWeather() {
      if (G.tick <= this.nextDesertWeatherTick) return;
      // Desert: mostly clear with occasional sandstorms
      const desertOptions = ['clear', 'clear', 'clear', 'clear', 'clear', 'sandstorm'];
      const nw = desertOptions[Math.floor(Math.random() * desertOptions.length)];
      
      if (nw !== this.desertWeather) {
        this.desertWeather = nw;
        this.sandParticles = [];
        if (typeof UI !== 'undefined') {
            if (nw === 'sandstorm') UI.addToast('🏜️ A sandstorm is sweeping the launch zone!');
            else if (this.desertWeather === 'sandstorm') UI.addToast('☀️ The sandstorm has passed.');
        }
      }
      this.nextDesertWeatherTick = G.tick + 3000 + Math.floor(Math.random() * 4000);
    },

    // Get desert zone X range for particle culling
    _getDesertRange() {
      let sX = Infinity, eX = 0;
      if (typeof SPACE_BLDS !== 'undefined' && window.BLDS) {
          BLDS.forEach(b => {
              if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
                  if (b.x < sX) sX = b.x;
                  if (b.x + b.w > eX) eX = b.x + b.w;
              }
          });
          if (sX < Infinity) { sX = Math.max(0, sX - 60); eX += 60; }
      }
      return sX < Infinity ? { start: sX, end: eX } : null;
    },

    // Procedural displacement map for the harbor water — smooth crossed sine
    // ripples baked into R (x-shift) and G (y-shift) channels on an offscreen
    // canvas (0x80 = no shift). No external asset, so it's CSP-safe. 256x64 is
    // power-of-two both ways so REPEAT wrapping tiles cleanly.
    _makeWaterDisplaceTex() {
        const cw = 256, ch = 64;
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(cw, ch);
        for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
                const idx = (y * cw + x) * 4;
                const rx = Math.sin(x * 0.09) + Math.sin((x * 0.031) + (y * 0.12));
                const ry = Math.sin(y * 0.22) + Math.sin((x * 0.05) - (y * 0.09));
                img.data[idx]     = 128 + rx * 42;   // R → horizontal displacement
                img.data[idx + 1] = 128 + ry * 42;   // G → vertical displacement
                img.data[idx + 2] = 128;
                img.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        const tex = PIXI.Texture.from(cv);
        tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        return tex;
    },

    // Rippling harbor-water reflections. A dedicated container above the ground
    // and below the ships carries reflection highlights (sky/moon sheen, a moon
    // glimmer column, per-ship hull shadows + colored deck-light glints); a core
    // PIXI DisplacementFilter driven by the noise map above warps the whole lot
    // into moving water, animated by sliding the displacement sprite each frame.
    _drawPortWater() {
        if (typeof PortZone === 'undefined' || typeof PortZone.oceanStartX !== 'number') return;

        // Lazy build the container + filter once.
        if (!this._portWaterCont) {
            if (!this.groundGfx || !this.groundGfx.parent || typeof PIXI.DisplacementFilter !== 'function') return;
            const disp = new PIXI.Sprite(this._makeWaterDisplaceTex());
            disp.scale.set(2.2);
            disp.renderable = false; // supplies the map only — never drawn itself
            const filter = new PIXI.DisplacementFilter(disp);
            filter.scale.set(9, 6);  // ripple strength (x, y)
            filter.padding = 24;
            const cont = new PIXI.Container();
            const gfx = new PIXI.Graphics();
            cont.addChild(disp, gfx);
            cont.filters = [filter];
            const par = this.groundGfx.parent;
            par.addChildAt(cont, par.getChildIndex(this.groundGfx) + 1);
            this._portWaterCont = cont; this._portWaterGfx = gfx;
            this._waterDispSprite = disp; this._waterFilter = filter;
        }

        // Cull unless the harbor is near the viewport (filters aren't cheap).
        const wsx = PortZone.oceanStartX;
        const wex = (typeof PortZone.coastlineX === 'number') ? PortZone.coastlineX : PortZone.oceanEndX;
        const zoom = (G.world && G.world.scale && G.world.scale.x) ? G.world.scale.x : 1;
        const viewL = -(G.world.x || 0) / zoom;
        const viewR = viewL + G.vpW / zoom;
        const near = wex > viewL - 400 && wsx < viewR + 400;
        this._portWaterCont.visible = near;
        if (!near) return;

        const gy = G.groundY;
        const tick = G.tick;
        const dp = (typeof G.getDayPhase === 'function') ? G.getDayPhase() : 0.5;
        const night = dp > 0.83 || dp < 0.25;
        const surfTop = gy - 4;   // waterline
        const surfBot = gy + 34;  // reflections fade out by here
        const g = this._portWaterGfx;
        g.clear();

        const span = surfBot - surfTop;
        // Sky/moon sheen — horizontal streaks that thin out with depth.
        const sheenCol = night ? 0x27506f : 0x5a92c4;
        for (let sy = surfTop; sy < surfBot; sy += 4) {
            const depth = (sy - surfTop) / span;
            g.beginFill(sheenCol, 0.22 * (1 - depth));
            g.drawRect(wsx, sy, wex - wsx, 2.5);
            g.endFill();
        }

        // Moon/sun glimmer — the hero: a bright shimmering vertical light column
        // reflecting straight down onto the water (broken into wavy dashes).
        const glimX = wsx + (wex - wsx) * 0.42;
        const glimCol = night ? 0xeaf3ff : 0xfff2c8;
        for (let sy = surfTop; sy < surfBot; sy += 2.5) {
            const depth = (sy - surfTop) / span;
            const wob = Math.sin(tick * 0.05 + sy * 0.45) * 8;
            const wArc = 16 + Math.sin(sy * 0.5 + tick * 0.03) * 8;
            g.beginFill(glimCol, 0.32 * (1 - depth * 0.7));
            g.drawRect(glimX + wob - wArc / 2, sy, wArc, 1.7);
            g.endFill();
        }

        // Neon waterfront reflections — a few colored light columns wobbling down
        // from the quayside signage, brightest at night.
        const neonCols = night ? [0x22d3ee, 0xf59e0b, 0x4ade80, 0xf472b6] : [0x60a5fa, 0xfbbf24];
        for (let ni = 0; ni < neonCols.length; ni++) {
            const nx = wex - 40 - ni * 55;                 // near the dock edge
            if (nx < viewL - 60 || nx > viewR + 60) continue;
            const col = neonCols[ni];
            for (let sy = surfTop; sy < surfBot - 4; sy += 3) {
                const depth = (sy - surfTop) / span;
                const wob = Math.sin(tick * 0.06 + sy * 0.5 + ni * 2) * 6;
                g.beginFill(col, (night ? 0.24 : 0.12) * (1 - depth));
                g.drawRect(nx + wob - 3, sy, 6, 1.6);
                g.endFill();
            }
        }

        // Per-ship reflections — dark hull shadow + colored deck-light glints.
        if (typeof PortEnv !== 'undefined' && PortEnv.shipConts && PortZone.ships) {
            for (let i = 0; i < PortEnv.shipConts.length; i++) {
                const s = PortEnv.shipConts[i];
                const ship = PortZone.ships[i];
                if (!s || !ship || typeof ship.x !== 'number') continue;
                const sx = ship.x, sw = s.sw || 150;
                if (sx + sw < viewL - 200 || sx > viewR + 200) continue;
                // Hull shadow smear just under the waterline
                g.beginFill(0x081019, 0.5);
                g.drawRect(sx - 12, surfTop, sw + 24, 9);
                g.endFill();
                // Colored deck-light glints, wobbling
                g.beginFill(ship.color, night ? 0.45 : 0.22);
                for (let gx = sx; gx < sx + sw; gx += 15) {
                    g.drawEllipse(gx, surfTop + 4 + Math.sin(tick * 0.06 + gx) * 1.2, 5, 1.4);
                }
                g.endFill();
                // A red/green nav-light dot reflection at the bow/stern at night
                if (night) {
                    g.beginFill(0xef4444, 0.4); g.drawCircle(sx - 6, surfTop + 6, 1.6); g.endFill();
                    g.beginFill(0x4ade80, 0.4); g.drawCircle(sx + sw + 6, surfTop + 6, 1.6); g.endFill();
                }
            }
        }

        // Slide the displacement map to animate the ripples (REPEAT tiles it).
        this._waterDispSprite.x = (tick * 0.6) % 512;
        this._waterDispSprite.y = Math.sin(tick * 0.02) * 10;
    },

    // Settled snow that builds up during snowfall and slowly melts after — a
    // ground blanket plus white caps on building rooftops. Draws on its own
    // layer above the ground (in front of buildings, behind characters).
    _drawSnowAccum() {
        if (!this._snowGfx) {
            if (!this.groundGfx || !this.groundGfx.parent) return;
            this._snowGfx = new PIXI.Graphics();
            const par = this.groundGfx.parent;
            par.addChildAt(this._snowGfx, par.getChildIndex(this.groundGfx) + 1);
        }
        const g = this._snowGfx;
        // Build up while snowing, melt afterward (melt slower than buildup).
        const isSnow = this.weather === 'snow';
        const target = isSnow ? (0.3 + (this.weatherIntensity || 0) * 0.7) : 0;
        this._snowAccum += (target - this._snowAccum) * (isSnow ? 0.01 : 0.006);
        if (this._snowAccum < 0.02) { g.clear(); return; }
        g.clear();
        const acc = this._snowAccum;
        const solid = Math.min(1, acc * 1.7); // near-opaque so snow reads white, not translucent-blue
        const zoom = (G.world && G.world.scale && G.world.scale.x) ? G.world.scale.x : 1;
        const vw = G.vpW / zoom;
        const wx = -(G.world.x || 0) / zoom;
        const viewL = wx - 100, viewR = wx + vw + 100;
        const gy = G.groundY;
        const groundTop = gy - 24;
        const desert = this._getDesertRange();
        const ds = desert ? desert.start : Infinity, de = desert ? desert.end : -Infinity;

        // ── Ground blanket: white strip along the surface, split around the
        //    (snow-free) desert zone. Thickness grows with accumulation. ──
        const blanketH = 3 + acc * 7;
        const drawStrip = (x0, x1) => {
            if (x1 <= x0) return;
            g.beginFill(0xeaf2ff, 0.92 * solid);
            g.drawRect(x0, groundTop - blanketH + 2, x1 - x0, blanketH);
            g.endFill();
            g.beginFill(0xffffff, solid); // brighter crest line
            g.drawRect(x0, groundTop - blanketH + 2, x1 - x0, 1.5);
            g.endFill();
        };
        if (desert && de > viewL && ds < viewR) {
            drawStrip(viewL, Math.max(viewL, ds));
            drawStrip(Math.min(viewR, de), viewR);
        } else {
            drawStrip(viewL, viewR);
        }

        // ── Rooftop caps: a white sliver on each building's roofline. ──
        if (window.BLDS) {
            const capH = 2 + acc * 5;
            for (let i = 0; i < BLDS.length; i++) {
                const b = BLDS[i];
                if (!b._container || b._container.destroyed) continue;
                if (b.id.startsWith('forest_') || b.id === 'black_market') continue;
                const rx = b.x, rw = b.w;
                if (rx > viewR || rx + rw < viewL) continue;
                if (desert && rx + rw > ds && rx < de) continue; // desert = no snow
                const roofY = b._container.y; // world-Y of the building's top
                g.beginFill(0xfbfdff, solid);
                g.drawRect(rx + 1, roofY - capH * 0.5, rw - 2, capH);
                // Soft rounded shoulders so the cap doesn't read as a hard bar.
                g.drawCircle(rx + 1, roofY, capH * 0.5);
                g.drawCircle(rx + rw - 1, roofY, capH * 0.5);
                g.endFill();
            }
        }
    },

    drawWeather() {
      // Throttle weather particle drawing to every other frame
      if (G.tick % 2 !== 0) return;
      const g = this.fxGfx; g.clear();
      // fxGfx is a child of G.world which has scale applied — viewport bounds
      // must be in LOCAL world coords (pre-scale). Previously this used raw
      // G.vpW / G.world.x, which left rain seeded in a wrong-sized, offset box
      // and made particles only appear where the camera first was.
      const zoom = (G.world && G.world.scale && G.world.scale.x) ? G.world.scale.x : 1;
      const vw = G.vpW / zoom;
      const vh = G.vpH / zoom;
      const wx = -(G.world.x || 0) / zoom; // world-X of viewport left edge
      const wy = -(G.world.y || 0) / zoom; // world-Y of viewport top edge
      const margin = 80 / zoom;             // overscan so particles enter/exit gracefully
      const xMin = wx - margin, xMax = wx + vw + margin;
      const yMin = wy - margin, yMax = wy + vh + margin;
      // Weather particles must not bleed into the underground. All terrain
      // (city, port, power, backbone, agents, desert) draws its topmost
      // surface at groundY - 24, so that's the universal floor for rain/snow/etc.
      const groundTop = (typeof G.groundY === 'number') ? G.groundY - 24 : yMax;
      const desert = this._getDesertRange();
      const tick = G.tick;
      const ds = desert ? desert.start : 0;
      const de = desert ? desert.end : 0;

      // Helper: respawn a particle somewhere inside the current viewport
      // (used when camera pans and old particles end up offscreen).
      const respawnInside = (d) => {
        d.x = wx + Math.random() * vw;
        const maxY = Math.min(wy + vh, groundTop);
        d.y = wy + Math.random() * Math.max(0, maxY - wy);
      };

      // ─── CITY WEATHER (skip desert zone) ───
      const w = this.weather;
      const intensity = this.weatherIntensity;
      const wind = this.wind;
      // Reduced-motion thins particle fields (less on-screen movement).
      const rmMul = window._reduceMotion ? 0.45 : 1;

      // RAINY FAMILY (drizzle, rain, thunderstorm) — unified render path
      if (w === 'drizzle' || w === 'rain' || w === 'thunderstorm') {
        // Target particle count scales with intensity. Drizzle caps low.
        const baseTarget = w === 'thunderstorm' ? 340 : w === 'rain' ? 260 : 100;
        const target = Math.floor(baseTarget * intensity * rmMul);
        // Spawn up to target; remove surplus gradually (during fade-out).
        while (this.rainDrops.length < target) {
          this.rainDrops.push({
            x: wx + Math.random() * vw,
            y: wy + Math.random() * vh,
            s: (w === 'drizzle' ? 2.5 : 4) + Math.random() * 4
          });
        }
        if (this.rainDrops.length > target) this.rainDrops.length = target;

        const rainAlpha = (w === 'drizzle' ? 0.22 : w === 'thunderstorm' ? 0.5 : 0.38) * (0.3 + intensity * 0.7);
        const windX = wind.x * (w === 'drizzle' ? 0.6 : 1.0);
        const streakLen = w === 'drizzle' ? 9 : w === 'thunderstorm' ? 18 : 14;
        // Splash spawning: a fraction of ground-hitting drops kick up an impact ring.
        const splashCap = 60;
        const splashChance = (w === 'thunderstorm' ? 0.05 : w === 'rain' ? 0.035 : 0.014) * (0.4 + intensity * 0.6);
        const splashes = this.rainSplashes;
        g.lineStyle(1, 0x88bbdd, rainAlpha);
        const drops = this.rainDrops;
        for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            d.y += d.s;
            d.x += windX - 0.2;
            // Respawn when drop hits ground OR exits viewport bottom.
            if (d.y > groundTop || d.y > yMax) {
              // True ground impact (not just a viewport-bottom exit) → occasional splash,
              // but only where the ground is actually on-screen and outside the desert.
              if (d.y > groundTop && d.x >= xMin && d.x <= xMax && splashes.length < splashCap
                  && (!desert || d.x < ds || d.x > de) && Math.random() < splashChance) {
                  splashes.push({ x: d.x, y: groundTop, age: 0 });
              }
              d.y = yMin;
              d.x = wx + Math.random() * vw;
            } else if (d.x < xMin || d.x > xMax || d.y < yMin) {
              respawnInside(d);
            }
            if (desert && d.x >= ds && d.x <= de) continue;
            if (d.y > groundTop) continue;
            // Streak slants with wind, but never extends below ground.
            const endY = Math.min(d.y + streakLen, groundTop);
            g.moveTo(d.x, d.y);
            g.lineTo(d.x - 1.5 + windX * 2, endY);
        }

      // SNOW — drifts with wind
      } else if (w === 'snow') {
        const target = Math.floor(220 * intensity * rmMul);
        while (this.snowFlakes.length < target) {
          this.snowFlakes.push({
            x: wx + Math.random() * vw,
            y: wy + Math.random() * vh,
            s: 0.5 + Math.random() * 1.2,
            r: 1 + Math.random() * 2,
            dx: Math.random() * 0.5 - 0.25
          });
        }
        if (this.snowFlakes.length > target) this.snowFlakes.length = target;

        g.beginFill(0xffffff, 0.5 * (0.4 + intensity * 0.6));
        const flakes = this.snowFlakes;
        for (let i = 0; i < flakes.length; i++) {
            const d = flakes[i];
            d.y += d.s;
            d.x += d.dx + Math.sin(tick * 0.02 + d.r) * 0.3 + wind.x * 0.8;
            if (d.y > groundTop || d.y > yMax) {
              d.y = yMin;
              d.x = wx + Math.random() * vw;
            } else if (d.x < xMin || d.x > xMax || d.y < yMin) {
              respawnInside(d);
            }
            if (desert && d.x >= ds && d.x <= de) continue;
            if (d.y > groundTop) continue;
            g.drawCircle(d.x, d.y, d.r);
        }
        g.endFill();

      // CHERRY BLOSSOMS — unchanged look, now wind-aware
      } else if (w === 'cherry') {
        const target = Math.floor(130 * intensity * rmMul);
        while (this.petals.length < target) {
          this.petals.push({
            x: wx + Math.random() * vw,
            y: wy + Math.random() * vh,
            s: 0.3 + Math.random() * 0.8,
            r: Math.random() * Math.PI,
            rot: Math.random() * 0.02
          });
        }
        if (this.petals.length > target) this.petals.length = target;

        g.beginFill(0xffb7c5, 0.5 * (0.4 + intensity * 0.6));
        const petals = this.petals;
        for (let i = 0; i < petals.length; i++) {
            const d = petals[i];
            d.y += d.s;
            d.x += Math.sin(d.r += d.rot) * 0.5 + wind.x * 0.5;
            if (d.y > groundTop || d.y > yMax) {
              d.y = yMin;
              d.x = wx + Math.random() * vw;
            } else if (d.x < xMin || d.x > xMax || d.y < yMin) {
              respawnInside(d);
            }
            if (desert && d.x >= ds && d.x <= de) continue;
            if (d.y > groundTop) continue;
            g.drawEllipse(d.x, d.y, 3, 1.5);
        }
        g.endFill();

      // AUTUMN LEAVES — cherry variant with warm palette
      } else if (w === 'leaves') {
        const target = Math.floor(110 * intensity * rmMul);
        while (this.petals.length < target) {
          this.petals.push({
            x: wx + Math.random() * vw,
            y: wy + Math.random() * vh,
            s: 0.4 + Math.random() * 0.9,
            r: Math.random() * Math.PI,
            rot: (Math.random() - 0.5) * 0.04,
            // Pre-pick a tint so each leaf has a stable color across frames.
            leafCol: [0xd97706, 0xc2410c, 0x9a3412, 0x991b1b, 0xca8a04][Math.floor(Math.random() * 5)]
          });
        }
        if (this.petals.length > target) this.petals.length = target;

        const leaves = this.petals;
        const baseAlpha = 0.55 * (0.4 + intensity * 0.6);
        for (let i = 0; i < leaves.length; i++) {
            const d = leaves[i];
            d.y += d.s;
            d.x += Math.sin(d.r += d.rot) * 0.7 + wind.x * 0.7;
            if (d.y > groundTop || d.y > yMax) {
              d.y = yMin;
              d.x = wx + Math.random() * vw;
            } else if (d.x < xMin || d.x > xMax || d.y < yMin) {
              respawnInside(d);
            }
            if (desert && d.x >= ds && d.x <= de) continue;
            if (d.y > groundTop) continue;
            // Each leaf is a tiny ellipse with its tumble-rotation applied
            // via the graphics matrix — cheap and gives individual motion.
            g.beginFill(d.leafCol || 0xd97706, baseAlpha);
            const tumble = Math.sin(tick * 0.03 + d.r) * 0.5 + 1;
            g.drawEllipse(d.x, d.y, 3.2, 1.6 * tumble);
            g.endFill();
        }
      }

      // ─── FOG WASH ───
      // Separate overlay layer (additive-friendly). Created lazily. Drifts with wind.
      if (!this._fogGfx) {
          this._fogGfx = new PIXI.Graphics();
          // Parent to the same layer as fxGfx so it draws above the city.
          if (this.fxGfx && this.fxGfx.parent) this.fxGfx.parent.addChild(this._fogGfx);
      }
      const fogG = this._fogGfx;
      fogG.clear();
      const fogIntensity = (w === 'fog') ? intensity : 0;
      if (fogIntensity > 0.02) {
          // Three horizontal bands with decreasing alpha toward the bottom —
          // gives depth-fog feel without a texture or shader.
          const drift = (tick * 0.2 + wind.x * 40) % 200 - 100;
          const bandAlpha = fogIntensity * 0.35;
          // Clip fog to above ground so it doesn't wash underground tunnels.
          const clipBandH = (top, wantH) => Math.max(0, Math.min(top + wantH, groundTop) - top);
          const band1Top = wy;
          const band1H = clipBandH(band1Top, vh * 0.55);
          if (band1H > 0) {
              fogG.beginFill(0xa8b1bb, bandAlpha);
              fogG.drawRect(wx - 200, band1Top, vw + 400, band1H);
              fogG.endFill();
          }
          const band2Top = wy + vh * 0.3;
          const band2H = clipBandH(band2Top, vh * 0.55);
          if (band2H > 0) {
              fogG.beginFill(0xbec5cc, bandAlpha * 0.7);
              fogG.drawRect(wx - 200, band2Top, vw + 400, band2H);
              fogG.endFill();
          }
          // Drifting streaks: low-alpha elongated ellipses, skipped below ground.
          fogG.beginFill(0xd1d6dc, bandAlpha * 0.5);
          for (let fi = 0; fi < 6; fi++) {
              const sy = wy + (fi * vh) / 6 + ((tick * 0.1) % (vh / 6));
              if (sy > groundTop) continue;
              const sx = wx + ((drift + fi * 80) % (vw + 400)) - 200;
              fogG.drawEllipse(sx, sy, 140, 14);
          }
          fogG.endFill();
      }

      // ─── LIGHTNING FLASH OVERLAY ───
      if (!this._flashGfx) {
          this._flashGfx = new PIXI.Graphics();
          if (this.fxGfx && this.fxGfx.parent) this.fxGfx.parent.addChild(this._flashGfx);
      }
      const flashG = this._flashGfx;
      flashG.clear();
      // Reduced-motion: no strobing lightning at all (photosensitivity). Rain
      // still falls, the sky just never flashes and no bolt is forged.
      if (w === 'thunderstorm' && !window._reduceMotion) {
          // Schedule next strike 3-13s ahead (200-800 ticks) — only during storm.
          if (this._nextLightningTick <= 0) this._nextLightningTick = G.tick + 200 + Math.floor(Math.random() * 600);
          if (G.tick >= this._nextLightningTick) {
              this.lightningFlash = 0.9 + Math.random() * 0.1;
              this._nextLightningTick = G.tick + 200 + Math.floor(Math.random() * 600);
              // Forge a jagged bolt from above the viewport down to the rooftops.
              const boltX = wx + Math.random() * vw;
              const segs = 9;
              const endY = groundTop - 60 - Math.random() * 140;
              const startY = wy - 120;
              const pts = [];
              for (let s2 = 0; s2 <= segs; s2++) {
                  const t = s2 / segs;
                  pts.push({
                      x: boltX + (Math.random() - 0.5) * 46 + wind.x * t * 30,
                      y: startY + (endY - startY) * t
                  });
              }
              this._boltPath = pts;
              this._boltLife = 5;
              // Thunder SFX delayed by 10-35 ticks (~0.2-0.6s at 60fps) — distant rumble.
              if (typeof SND !== 'undefined' && SND.playTone) {
                  const delay = 150 + Math.random() * 450;
                  setTimeout(() => {
                      try {
                          SND.playTone(90, 'sawtooth', 0.8, 0.06, 45);
                          setTimeout(() => SND.playTone(60, 'triangle', 1.1, 0.04, 30), 200);
                      } catch (_) {}
                  }, delay);
              }
          }
      } else {
          this._nextLightningTick = 0;
      }
      if (this.lightningFlash > 0.02) {
          flashG.beginFill(0xf5f7ff, this.lightningFlash * 0.35);
          flashG.drawRect(wx - 200, wy - 200, vw + 400, vh + 400);
          flashG.endFill();
          this.lightningFlash *= 0.82;  // fast decay, 3-4 visible frames
      }
      // Bolt: fat soft glow underlay + bright core, both fading over ~5 frames.
      if (this._boltLife > 0 && this._boltPath && this._boltPath.length > 1) {
          const ba = this._boltLife / 5;
          const pts = this._boltPath;
          for (let pass = 0; pass < 2; pass++) {
              flashG.lineStyle(pass === 0 ? 6 : 2, pass === 0 ? 0x9ec5ff : 0xfdfdff, ba * (pass === 0 ? 0.28 : 0.95));
              flashG.moveTo(pts[0].x, pts[0].y);
              for (let pi = 1; pi < pts.length; pi++) flashG.lineTo(pts[pi].x, pts[pi].y);
          }
          flashG.lineStyle(0);
          this._boltLife--;
      }

      // ─── DESERT WEATHER (sandstorm — only in desert zone) ───
      if (this.desertWeather === 'sandstorm' && desert) {
        const target = 140;
        while (this.sandParticles.length < target) {
            this.sandParticles.push({
                x: desert.start + Math.random() * (desert.end - desert.start),
                y: wy + Math.random() * vh,
                s: 3 + Math.random() * 5,
                vy: (Math.random() - 0.3) * 2,
                size: 1 + Math.random() * 3,
                alpha: 0.1 + Math.random() * 0.4
            });
        }
        const sandP = this.sandParticles;
        for (let i = 0; i < sandP.length; i++) {
            const d = sandP[i];
            d.x += d.s;
            d.y += d.vy + Math.sin(tick * 0.03 + d.x * 0.01) * 0.5;
            // Wrap within desert zone
            if (d.x > desert.end) { d.x = desert.start; d.y = wy + Math.random() * vh; }
            // Vertical recycling: never let sand drift below desert surface.
            if (d.y > groundTop || d.y > yMax) d.y = yMin;
            if (d.y < yMin - 10) d.y = Math.min(yMax, groundTop);
            if (d.y > groundTop) continue;
            g.beginFill(0xd4a574, d.alpha);
            g.drawEllipse(d.x, d.y, d.size * 2, d.size * 0.6);
            g.endFill();
        }

        // Sandstorm haze overlay — clipped to above desert surface.
        const hazeTop = yMin - 200;
        const hazeH = Math.max(0, Math.min(hazeTop + vh + 400, groundTop) - hazeTop);
        if (hazeH > 0) {
            g.beginFill(0xc2956a, 0.06 + Math.sin(tick * 0.01) * 0.02);
            g.drawRect(desert.start, hazeTop, desert.end - desert.start, hazeH);
            g.endFill();
        }
      }

      // ─── GROUND FX (below characters): cloud shadows, puddles, rain splashes ───
      // Its own layer sits just above the ground and below shadows/characters, so
      // people walk over puddles and through splashes instead of behind them.
      if (!this._groundFxGfx) {
          this._groundFxGfx = new PIXI.Graphics();
          if (this.groundGfx && this.groundGfx.parent) {
              const par = this.groundGfx.parent;
              par.addChildAt(this._groundFxGfx, par.getChildIndex(this.groundGfx) + 1);
          }
      }
      const gfxG = this._groundFxGfx;
      gfxG.clear();

      const dpNow = (typeof G.getDayPhase === 'function') ? G.getDayPhase() : 0.5;
      const nightNow = dpNow > 0.83 || dpNow < 0.25;
      const isRainNow = (w === 'drizzle' || w === 'rain' || w === 'thunderstorm');

      // Wetness accumulates while raining, evaporates otherwise — drives puddle alpha.
      const wetTarget = isRainNow ? (0.35 + intensity * 0.65) : 0;
      this._wetness += (wetTarget - this._wetness) * (isRainNow ? 0.02 : 0.01);

      // ── Cloud ground-shadows: only when the sun is up and skies are clear/partly
      //    cloudy (overcast/rain give diffuse light that casts no crisp shadow). ──
      const isDay = dpNow >= 0.25 && dpNow <= 0.83;
      const sunHeight = isDay ? Math.sin(((dpNow - 0.25) / 0.58) * Math.PI) : 0;
      if (sunHeight > 0.05 && (w === 'clear' || w === 'partly_cloudy') && this.cloudLayer) {
          const shadowOffset = (dpNow - 0.54) * 90; // low sun skews shadows to the side
          const clouds = this.cloudLayer.children;
          for (let ci = 0; ci < clouds.length; ci++) {
              const c = clouds[ci];
              const sxc = c.x + shadowOffset;
              if (sxc < wx - 120 || sxc > wx + vw + 120) continue;
              if (desert && sxc >= ds && sxc <= de) continue;
              const a = sunHeight * (c.alpha || 0.1) * 0.85;
              if (a < 0.012) continue;
              const rw = (c._w || 60) * 0.6;
              gfxG.beginFill(0x0a0f1a, a);
              gfxG.drawEllipse(sxc, groundTop + 5, rw, 6);
              gfxG.endFill();
          }
      }

      // ── Puddles: deterministic spots, faded by wetness; neon shimmer at night. ──
      if (this._wetness > 0.04) {
          if (!this.puddles) {
              this.puddles = [];
              const span = (G.cityW || 8000);
              const neonPal = [0x22d3ee, 0xf472b6, 0xfbbf24, 0x4ade80, 0xa855f7];
              let idx = 0;
              for (let px = 120; px < span; px += 260) {
                  if (this._labNoise(px * 0.5 + 3) < 0.35) continue; // leave dry gaps
                  this.puddles.push({
                      x: px + this._labNoise(px + 7) * 120,
                      w: 18 + this._labNoise(px + 11) * 46,
                      neon: neonPal[idx % neonPal.length],
                      ph: this._labNoise(px + 13) * Math.PI * 2
                  });
                  idx++;
              }
          }
          const wet = this._wetness;
          const pud = this.puddles;
          for (let i = 0; i < pud.length; i++) {
              const p = pud[i];
              if (p.x < wx - 60 || p.x > wx + vw + 60) continue;
              if (desert && p.x >= ds && p.x <= de) continue;
              const py = groundTop + 3;
              const rw = p.w, rh = Math.max(2.5, p.w * 0.11);
              // Dark water body
              gfxG.beginFill(0x0a1420, wet * 0.5);
              gfxG.drawEllipse(p.x, py, rw, rh); gfxG.endFill();
              // Sky sheen on the near edge
              gfxG.beginFill(0x9fb8d4, wet * 0.16);
              gfxG.drawEllipse(p.x, py - rh * 0.3, rw * 0.85, rh * 0.5); gfxG.endFill();
              // Reflected-neon shimmer — night only, drifts and pulses
              if (nightNow) {
                  const shimmer = 0.10 + Math.sin(tick * 0.05 + p.ph) * 0.06;
                  if (shimmer > 0) {
                      gfxG.beginFill(p.neon, wet * shimmer);
                      gfxG.drawEllipse(p.x + Math.sin(tick * 0.03 + p.ph) * 3, py, rw * 0.5, rh * 0.6);
                      gfxG.endFill();
                  }
              }
          }
      }

      // ── Rain splashes: expanding rings that thin out over ~14 frames. ──
      const spl = this.rainSplashes;
      for (let i = spl.length - 1; i >= 0; i--) {
          const s = spl[i];
          s.age++;
          const life = s.age / 14;
          if (life >= 1) { spl.splice(i, 1); continue; }
          if (s.x < wx - 40 || s.x > wx + vw + 40) { spl.splice(i, 1); continue; }
          const r = 1 + life * 7;
          const a = (1 - life) * 0.4;
          gfxG.lineStyle(1, 0xbcd8ee, a);
          gfxG.drawEllipse(s.x, s.y + 2, r, r * 0.42);
          gfxG.lineStyle(0);
      }
    },

    update(dp, night, occ) {
        if (!this._vpEl) this._vpEl = document.getElementById('viewport');
        const vp = this._vpEl;
        let sky;
        if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        else if (dp < .30) { const t = (dp - .22) / .08;
        sky = `linear-gradient(180deg,rgb(${8 + t * 50 | 0},${10 + t * 20 | 0},${30 + t * 50 | 0}),rgb(${15 + t * 130 | 0},${15 + t * 50 | 0},${40 + t * 30 | 0}) 50%,rgb(${30 + t * 160 | 0},${25 + t * 80 | 0},${35 - t * 10 | 0}))`;
        }
        else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        else if (dp < .84) { const t = (dp - .72) / .12;
        sky = `linear-gradient(180deg,rgb(${35 + t * 45 | 0},${25 + t * 10 | 0},${90 - t * 50 | 0}),rgb(${120 + t * 110 | 0},${80 - t * 30 | 0},${60 - t * 30 | 0}) 50%,rgb(${180 + t * 60 | 0},${100 - t * 40 | 0},${30 | 0}))`;
        }
        else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        // ─── WEATHER SKY OVERRIDES ───
        // Extended for new states. Each is applied only in day/golden-hour
        // where it reads (night skies already dominate).
        const _w = this.weather;
        if (!night && dp > .3 && dp < .72) {
            if (_w === 'rain' || _w === 'drizzle')      sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
            else if (_w === 'thunderstorm')             sky = 'linear-gradient(180deg,#1a1f2a,#2d3340 50%,#444a55)';
            else if (_w === 'overcast')                 sky = 'linear-gradient(180deg,#4a5568,#64748b 50%,#94a3b8)';
            else if (_w === 'fog')                      sky = 'linear-gradient(180deg,#8a9099,#a8b1bb 50%,#c0c8d0)';
            else if (_w === 'partly_cloudy')            sky = 'linear-gradient(180deg,#355088,#6a9abf 50%,#93b9d8)';
        }
        if (_w === 'snow') sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        // X-Ray mode: override sky with pure black so the neon overlay reads as night-on-black
        if (typeof XRayMode !== 'undefined' && XRayMode.active) sky = '#02060a';
        if (sky !== this._lastSky) { this._lastSky = sky; vp.style.background = sky; }
    
        this.starsLayer.visible = night;
        if (night && G.tick % 8 === 0) this._drawStars(G.tick);
        const cel = this.celestialGfx;
        // Counter-scroll the celestial layer so the sun/moon follow the camera —
        // previously they were pinned in world space near the city's left edge and
        // invisible from most of the map.
        if (typeof Camera !== 'undefined') cel.x = -Camera.x;
        const isGoldenHour = (dp >= 0.72 && dp < 0.84) || (dp >= 0.22 && dp < 0.30);
        // Throttle celestial redraws to every 3rd frame (sun moves slowly)
        if (G.tick % 3 !== 0 && !this._celDirty) { /* skip redraw */ }
        else {
        this._celDirty = false;
        cel.clear();
        if (night) {
          let np = dp > 0.83 ?
          (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42;
          const mx = G.vpW * np, my = 40 + Math.sin(np * Math.PI) * 120, mr = 13;
          // ── REAL MOON PHASE (accuracy mandate: even the sky is factual) ──
          // Lit disc + offset shadow disc = correct crescent/gibbous for today's date.
          const p = (typeof CityAmbience !== 'undefined') ? CityAmbience.getMoonPhase() : 0.5;
          const illum = (1 - Math.cos(Math.PI * 2 * p)) / 2;   // 0 new → 1 full
          const dir = p < 0.5 ? -1 : 1;                         // waxing lights the right
          // Soft halo scales with illumination
          cel.beginFill(0xe8e8d0, 0.06 + illum * 0.06);
          cel.drawCircle(mx, my, mr * 2.1); cel.endFill();
          // Dark side base (barely visible earthshine disc)
          cel.beginFill(0x3a4356, 0.55); cel.drawCircle(mx, my, mr); cel.endFill();
          // Lit disc
          cel.beginFill(0xe8e8d0); cel.drawCircle(mx, my, mr); cel.endFill();
          // Craters on the lit face
          cel.beginFill(0xc9c9b4, 0.5);
          cel.drawCircle(mx - 4, my - 3, 2.2); cel.drawCircle(mx + 3, my + 4, 1.6); cel.drawCircle(mx + 5, my - 5, 1.2);
          cel.endFill();
          // Shadow disc slides off as the moon waxes; fully off at full moon
          if (illum < 0.985) {
              cel.beginFill(0x10182a, 0.96);
              cel.drawCircle(mx + dir * 2 * mr * illum, my, mr);
              cel.endFill();
          }
        } else {
          let dayP = (dp - 0.25) / (0.83 - 0.25);
          const sunX = G.vpW * dayP;
          const sunY = 40 + Math.sin(dayP * Math.PI) * 120;

          // Golden hour glow + god rays
          if (isGoldenHour) {
              let ghI = dp >= 0.72 ? 1 - Math.abs((dp - 0.78) / 0.06) : 1 - Math.abs((dp - 0.26) / 0.04);
              ghI = Math.max(0, Math.min(1, ghI));

              // Layered aura
              cel.beginFill(0xff6622, 0.02 * ghI); cel.drawCircle(sunX, sunY, 140); cel.endFill();
              cel.beginFill(0xff8833, 0.04 * ghI); cel.drawCircle(sunX, sunY, 80); cel.endFill();
              cel.beginFill(0xffaa44, 0.08 * ghI); cel.drawCircle(sunX, sunY, 40); cel.endFill();

              // God rays — fan downward from sun
              for (let r = 0; r < 7; r++) {
                  const angle = Math.PI * 0.2 + (r / 6) * Math.PI * 0.6 + Math.sin(G.tick * 0.003 + r * 1.7) * 0.04;
                  const rayLen = 120 + (r % 3) * 60;
                  const rayW = 6 + (r % 4) * 3;
                  const shimmer = 0.5 + 0.5 * Math.sin(G.tick * 0.01 + r * 2.1);
                  const ex = sunX + Math.cos(angle) * rayLen;
                  const ey = sunY + Math.sin(angle) * rayLen;
                  cel.beginFill(0xffbb55, 0.012 * ghI * shimmer);
                  cel.moveTo(sunX + Math.cos(angle + 0.03) * 18, sunY + Math.sin(angle + 0.03) * 18);
                  cel.lineTo(ex + Math.cos(angle + Math.PI / 2) * rayW, ey + Math.sin(angle + Math.PI / 2) * rayW);
                  cel.lineTo(ex - Math.cos(angle + Math.PI / 2) * rayW, ey - Math.sin(angle + Math.PI / 2) * rayW);
                  cel.closePath();
                  cel.endFill();
              }
          }

          // Main sun disc
          cel.beginFill(isGoldenHour ? 0xff9944 : 0xffe066);
          cel.drawCircle(sunX, sunY, isGoldenHour ? 18 : 15); cel.endFill();
        }
        } // end celestial throttle

        if (G.tick % 2 === 0) {
            const clouds = this.cloudLayer.children;
            const cLen = clouds.length;
            const _tk = G.tick;
            // Cloud cover scales with weather category — overcast/storm pack the sky, drizzle/fog add partial wash.
            const _w = this.weather, _wi = this.weatherIntensity || 0;
            let cloudAlphaBase = -1;
            if (_w === 'rain' || _w === 'snow')        cloudAlphaBase = 0.30 * (0.5 + _wi * 0.5);
            else if (_w === 'thunderstorm')            cloudAlphaBase = 0.48 * (0.5 + _wi * 0.5);
            else if (_w === 'overcast')                cloudAlphaBase = 0.38 * (0.5 + _wi * 0.5);
            else if (_w === 'drizzle')                 cloudAlphaBase = 0.25 * (0.5 + _wi * 0.5);
            else if (_w === 'fog')                     cloudAlphaBase = 0.22 * (0.5 + _wi * 0.5);
            else if (_w === 'partly_cloudy')           cloudAlphaBase = 0.18 * (0.5 + _wi * 0.5);
            const cloudTint = isGoldenHour ? 0xffcc88 : 0xffffff;
            for (let ci = 0; ci < cLen; ci++) {
                const c = clouds[ci];
                c.x = c._bx + Math.sin(_tk * (c._drift || .003) + c._i) * 40;
                const ca = cloudAlphaBase >= 0 ? cloudAlphaBase : .10 + Math.sin(_tk * 0.001 + c._i) * 0.03;
                c.alpha = isGoldenHour ? ca + 0.08 : ca;
                if (c.tint !== cloudTint) c.tint = cloudTint;
            }
        }
        // ─── DATA PULSE BLIPS — animate along cables ───
        for (let pi = 0; pi < this.dataPulses.length; pi++) {
            const p = this.dataPulses[pi];
            if (!p || p.destroyed) continue;
            p.x += p._speed;
            p.y = p._baseY + Math.sin(G.tick * 0.02 + p._baseY) * 2;
            if (p._speed > 0 && p.x > p._endX + 200) p.x = p._startX - 100;
            else if (p._speed < 0 && p.x < p._startX - 200) p.x = p._endX + 100;
        }

        if (G.viewMode === 'micro') { this.updateWeather(); this.updateDesertWeather(); }
        this._tickWeatherTransition();
        this.drawWeather();
        this._drawPortWater();
        this._drawSnowAccum();
        // Reflection alpha scales with rain intensity and stacks with night/golden-hour boosts.
        let targetRefAlpha = 0;
        const _rw = this.weather, _rwi = this.weatherIntensity || 0;
        const _isRainy = (_rw === 'rain' || _rw === 'drizzle' || _rw === 'thunderstorm');
        if (night) {
            if (_isRainy)          targetRefAlpha = 0.55 + 0.40 * _rwi;
            else if (_rw === 'snow') targetRefAlpha = 0.5;
            else if (_rw === 'fog')  targetRefAlpha = 0.45;
            else                     targetRefAlpha = 0.35;
        } else {
            if (_isRainy)          targetRefAlpha = 0.15 + 0.25 * _rwi;
            else if (_rw === 'snow') targetRefAlpha = 0.2;
            else if (_rw === 'fog')  targetRefAlpha = 0.18;
            else if (isGoldenHour)   targetRefAlpha = 0.25;
        }
        this.reflectionLayer.alpha += (targetRefAlpha - this.reflectionLayer.alpha) * 0.05;
        const targetLightAlpha = night ? 1 : 0; if(this.lightLayer) { this.lightLayer.alpha += (targetLightAlpha - this.lightLayer.alpha) * 0.05;
        } 
        
        // ─── SIGN ANIMATIONS ───
        // Track day/night transition to update styles only ONCE (style changes are expensive)
        const wasNight = this._wasNight || false;
        if (night !== wasNight) {
            this._wasNight = night;
            BLDS.forEach(b => {
                // Lab HQ boards — set glow once on transition
                if (b._boardTxt) {
                    b._boardTxt.style.dropShadowBlur = night ? 18 : 8;
                }
                // Metro above-ground signs
                if (b._metroSign) {
                    b._metroSign.style.dropShadowBlur = night ? 16 : 8;
                }
                // Underground station signs
                if (b._stationSign) {
                    b._stationSign.style.dropShadowBlur = night ? 10 : 0;
                }
                // Building name signs
                if (b._sign) {
                    if (night) {
                        const sc = b._boardCol || 0x6688ff;
                        b._sign.style.fill = sc;
                        b._sign.style.dropShadow = true;
                        b._sign.style.dropShadowColor = sc;
                        b._sign.style.dropShadowBlur = 8;
                        b._sign.style.dropShadowDistance = 0;
                    } else {
                        b._sign.style.fill = 0x9898c0;
                        b._sign.style.dropShadow = false;
                    }
                }
                // DC/Fab signs
                if (b._dcSign) {
                    b._dcSign.style.dropShadowBlur = night ? 10 : 0;
                }
            });
        }
        // ─── SINGLE UNIFIED BLDS PASS — merged from 4 separate forEach loops ───
        const camL = typeof Camera !== 'undefined' ? -Camera.x - 200 : 0;
        const camR = -Camera.x + G.vpW / (Camera.zoom || 1) + 200;
        const tick = G.tick;
        const doOcc = tick % 60 === 0;
        const bldLen = BLDS.length;

        for (let bi = 0; bi < bldLen; bi++) {
            const b = BLDS[bi];
            const bRight = b.x + b.w;
            const onScreen = !(bRight < camL || b.x > camR);

            // Container visibility culling
            if (b._container) {
                if (b._container.visible !== onScreen) b._container.visible = onScreen;
            }

            if (!onScreen) continue;

            // Neon signs: always visible, flicker at night only
            if (b._neonCont) {
                b._neonCont.visible = true;
                if (night) {
                    const t = tick * b._neonSpeed;
                    const base = 0.7 + Math.sin(t) * 0.2;
                    const buzz = Math.random() < b._neonFlicker ? (Math.random() * 0.4 - 0.2) : 0;
                    const flick = Math.max(0.3, Math.min(1.0, base + buzz));
                    const blink = (Math.random() < 0.003) ? 0.1 : 1.0;
                    b._neonTxt.alpha = flick * blink;
                    b._neonGlow.alpha = flick * blink * 0.15;
                } else {
                    b._neonTxt.alpha = 0.8;
                    b._neonGlow.alpha = 0;
                }
            }
            // Lab board alpha pulse (cheap)
            if (b._boardTxt && night) {
                b._boardTxt.alpha = 0.85 + Math.sin(tick * 0.04) * 0.15;
            }
            // Metro sign alpha pulse
            if (b._metroSign && night) {
                b._metroSign.alpha = 0.85 + Math.sin(tick * 0.05) * 0.15;
            }
            // Station sign alpha pulse
            if (b._stationSign && night) {
                b._stationSign.alpha = 0.8 + Math.sin(tick * 0.05) * 0.2;
            }
            // DC/Fab sign alpha pulse
            if (b._dcSign && night) {
                b._dcSign.alpha = 0.85 + Math.sin(tick * 0.04) * 0.15;
            }
            // Visitor monument capstone pulse
            if (b._capGlow) {
                b._capGlow.alpha = 0.06 + Math.sin(tick * 0.03) * 0.04;
            }
            // Graveyard eternal flame flicker
            if (b._flame) {
                b._flame.alpha = 0.6 + Math.sin(tick * 0.1) * 0.2 + Math.random() * 0.15;
                b._flame.scale.set(0.9 + Math.sin(tick * 0.15) * 0.15, 0.85 + Math.sin(tick * 0.12) * 0.2);
            }

            // Beacon/crown animation
            if (b._beacon && b._beacon.beam && !b._beacon.beam.destroyed) {
                b._beacon.beam.alpha = 0.7 + Math.sin(tick * 0.1) * 0.3;
                if (b._beacon.crown && !b._beacon.crown.destroyed) {
                    b._beacon.crown.scale.set(1 + Math.sin(tick * 0.05) * 0.1);
                    b._beacon.crown.y = -120 + Math.sin(tick * 0.08) * 5;
                }
            }
            // Stock ticker scroll
            if (b._stockTicker && b._tickerW && !b._stockTicker.destroyed) {
                b._stockTicker.x -= 0.6;
                if (b._stockTicker.x + b._stockTicker.width < 0) {
                    b._stockTicker.x = b._tickerW;
                }
                if (doOcc && typeof API !== 'undefined' && API.stockPrices && API.stockPrices[b._tickerSym]) {
                    const sd = API.stockPrices[b._tickerSym]; b._stockTicker.text = `${b._tickerSym} $${sd.price} [${sd.change}]`; b._stockTicker.style.fill = sd.color; b._stockTicker.style.stroke = sd.color; b._stockTicker.style.dropShadow = true; b._stockTicker.style.dropShadowColor = sd.color; b._stockTicker.style.dropShadowBlur = 10;
                }
            }
            // VC ticker scroll
            if (b._vcTicker && b._vcTickerW && !b._vcTicker.destroyed) {
                b._vcTicker.x -= 0.6;
                if (b._vcTicker.x + b._vcTicker.width < 0) {
                    b._vcTicker.text = (typeof VCRow !== 'undefined')
                        ? (b._vcTickerIsCrypto ? VCRow.getNextCryptoTickerItem() : VCRow.getNextTickerItem())
                        : '';
                    b._vcTicker.x = b._vcTickerW;
                }
            }
            // Backbone ticker scroll
            if (b._bkTicker && b._bkTickerW && !b._bkTicker.destroyed) {
                b._bkTicker.x -= 0.5;
                if (b._bkTicker.x + b._bkTicker.width < 0) {
                    b._bkTicker.text = (typeof BackboneZone !== 'undefined') ? BackboneZone.getNextTickerItem() : '';
                    b._bkTicker.x = b._bkTickerW;
                }
            }

            // Occupancy updates (every 60 frames)
            if (doOcc) {
                const list = occ[b.id] || []; const ct = list.length;
                if (b._sign && b._sign.text !== undefined) {
                    if (ct > 0) b._sign.text = `${b.name} [${ct}]`; else b._sign.text = b.name; b._sign.scale.set(1);
                    if (b._sign.width > b.w - 4) b._sign.scale.set((b.w - 4) / b._sign.width);
                }
            }
        }
        if (doOcc && G.bloomFilter) {
            const targetBloom = night ? 1.8 : 0.8; G.bloomFilter.bloomScale += (targetBloom - G.bloomFilter.bloomScale) * 0.05;
        }
        
        if (G.tick % 120 === 0) { 
            const park = G.bldById['park'];
            if (park && park._monIcon && !park._monIcon.destroyed) {
                const sorted = [...G.models].filter(m => !m.ret || new Date(m.ret) > new Date()).map(m => { const elo = BM[m.id]?.ELO || 0; const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0; return { m, score: elo ? ((elo - 1000) / 4.5) : avg }; }).sort((a, b) => b.score - a.score);
                const top = sorted[0]; 
                if (top) { 
                    const lab = LABS[top.m.lab] || LABS.other; const display = BM[top.m.id]?.ELO ?
                    BM[top.m.id].ELO + ' Elo' : ((typeof avgBM === 'function' ? avgBM(top.m.id) : '??') + '%'); park._monIcon.text = lab.icon || '★';
                    park._monIcon.style.fill = lab.color; park._monIcon.style.fontSize = 24; park.tip = `Current #1 Leader:\n${top.m.name} (${display})`; 
                } 
            } 
        } 
    } 
};
