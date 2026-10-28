/*
 * PlotPulse — colony configuration.
 * For every new builder/colony, edit this file, colony/plots.json,
 * the images in colony/panos and the PDFs in colony/docs. The code stays the same.
 */
window.PLOTPULSE_CONFIG = {
  colony: {
    name: "Chohak Land",
    tagline: "Residential plots and shops, with a park, community centre and wide internal roads.",
    builder: "Builder name here",          // e.g. "XYZ Developers Pvt. Ltd."
    builderShort: "CL",                     // 2 letters for the logo badge, until there's a logo
    city: "Punjab",
    // Short lines shown in the hero, like a brochure. Keep them true to the approved plan.
    highlights: [
      { icon: "road", text: "30 ft and 40 ft roads" },
      { icon: "park", text: "Park, 900 gaj" },
      { icon: "community", text: "Community centre" },
      { icon: "shop", text: "22 shops on the main road" },
      { icon: "parking", text: "Shop parking" },
      { icon: "stp", text: "STP and garbage collection" },
    ],
  },

  // Buyer enquiries go to this WhatsApp number (country code, no + or spaces)
  whatsapp: "919999999999",
  // {unit} becomes "Plot No. 47" or "Shop No. 5"
  whatsappMessage: "Hi, I'm interested in {unit} in {colony}. Please share the price and details.",

  // Google Maps pin. Used for the embedded map and the "Open in Google Maps" link.
  location: {
    lat: 30.8536,
    lng: 75.8216,
    address: "Site address here, Punjab",   // replace with the real address and map pin
    nearby: [
      // Sample distances. Replace with real ones for the site.
      { name: "Main highway", distance: "1 km" },
      { name: "Schools", distance: "2 km" },
      { name: "Hospital", distance: "4 km" },
      { name: "Railway station", distance: "9 km" },
      { name: "Airport", distance: "30 km" },
    ],
  },

  // Approvals shown in the "Approvals" section. Put the PDFs in colony/docs/.
  trust: {
    rera: "PBRERA-XXX00-PR0000 (sample, replace)",
    documents: [
      { title: "RERA registration certificate", file: "colony/docs/rera-certificate.pdf" },
      { title: "Change of Land Use (CLU)", file: "colony/docs/clu-approval.pdf" },
      { title: "Approved layout plan", file: "colony/docs/layout-approval.pdf" },
    ],
  },

  // 360 tour scenes. Images are 2:1 equirectangular JPGs.
  // Hotspots: yaw/pitch in degrees, "to" = scene id to jump to.
  tour: {
    first: "entrance",
    scenes: {
      entrance: {
        title: "Entry gate",
        image: "colony/panos/entrance.jpg",
        hotspots: [
          { yaw: 0, pitch: -6, to: "road", text: "Walk inside" },
          { yaw: 150, pitch: -4, to: "park", text: "Park" },
        ],
      },
      road: {
        title: "40 ft road",
        image: "colony/panos/road.jpg",
        hotspots: [
          { yaw: 0, pitch: -6, to: "park", text: "Park" },
          { yaw: 180, pitch: -6, to: "entrance", text: "Back to entrance" },
        ],
      },
      park: {
        title: "Park",
        image: "colony/panos/park.jpg",
        hotspots: [
          { yaw: 90, pitch: -6, to: "road", text: "Internal road" },
          { yaw: -90, pitch: -6, to: "entrance", text: "Entrance gate" },
        ],
      },
    },
  },

  // Optional: a render of the colony (aerial view) for the top of the page, e.g. "colony/hero.jpg".
  // Without one, the page shows a 3D model of the master plan instead.
  heroImage: null,

  // Demand rules (the builder can change these from the dashboard when Supabase is on)
  demand: {
    windowDays: 7,      // count viewers over the last N days
    topPercent: 20,     // top N% most-viewed available plots turn yellow
    minToShow: 10,      // only show "N people viewed" when at least this many
  },

  // Leave empty to run in demo mode (data stays in this browser only).
  // Fill both to go live — see README.
  supabase: {
    url: "",
    anonKey: "",
  },

  // Demo mode only: password for the builder dashboard
  demoPassword: "demo123",

  credit: { name: "VF Animation", url: "https://github.com/VFAnimation" },
};
