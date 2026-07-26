// Returns the visitor's coarse geolocation (country/subdivision) from Netlify's
// edge geo context. Same-origin so it satisfies the site CSP (connect-src 'self').
// Used by js/jail.js to decide which jurisdiction-scoped AI bans apply to THIS viewer
// (e.g. a Turkey visitor sees Grok detained; a Germany visitor sees DeepSeek detained).
// No IP is stored or returned — only the country/region code.

export default async (req, context) => {
    const geo = (context && context.geo) ? context.geo : {};
    const country = (geo.country && geo.country.code) ? String(geo.country.code).toUpperCase() : null;
    return new Response(JSON.stringify({
        country,
        countryName: (geo.country && geo.country.name) || null,
        subdivision: (geo.subdivision && geo.subdivision.code) ? String(geo.subdivision.code).toUpperCase() : null,
        city: geo.city || null,
        timezone: geo.timezone || null
    }), {
        headers: {
            'content-type': 'application/json',
            // private: this is per-visitor; let the browser cache briefly, not shared CDN.
            'cache-control': 'private, max-age=900',
            'access-control-allow-origin': '*'
        }
    });
};
