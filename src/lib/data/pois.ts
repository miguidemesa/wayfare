import type { Interest, PlaceCategory } from "../types";

export type Poi = {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  rating: number;
  /** Price level as yen-symbol count; 0 = free */
  priceLevel: number;
  /** Typical per-person cost in local currency (0 if free) */
  avgCost: number;
  currency: string;
  hours: string;
  cuisine?: string;
  tags: string[];
  durationMin: number;
  blurb: string;
};

export const POIS: Poi[] = [
  // ---------------- TOKYO — Attractions & Culture ----------------
  {
    id: "tok-shibuya-crossing", name: "Shibuya Crossing", category: "ATTRACTION", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.6595, lng: 139.7005, rating: 4.6, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Photography", "Nightlife"],
    durationMin: 30,
    blurb: "The world's busiest scramble crossing — best watched from Starbucks or Shibuya Sky.",
  },
  {
    id: "tok-meiji", name: "Meiji Shrine", category: "TEMPLE", city: "Tokyo",
    neighborhood: "Harajuku", lat: 35.6764, lng: 139.6993, rating: 4.7, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Sunset–4:30 PM", tags: ["Culture", "History", "Nature"],
    durationMin: 75,
    blurb: "Forest shrine minutes from Harajuku — serene grounds and torii gates.",
  },
  {
    id: "tok-sensoji", name: "Sensō-ji Temple", category: "TEMPLE", city: "Tokyo",
    neighborhood: "Asakusa", lat: 35.7148, lng: 139.7967, rating: 4.7, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "6 AM–5 PM", tags: ["Culture", "History", "Photography"],
    durationMin: 90,
    blurb: "Tokyo's oldest temple, approached through the lantern-lined Nakamise street.",
  },
  {
    id: "tok-skytree", name: "Tokyo Skytree", category: "ATTRACTION", city: "Tokyo",
    neighborhood: "Sumida", lat: 35.7101, lng: 139.8107, rating: 4.5, priceLevel: 3,
    avgCost: 2400, currency: "JPY", hours: "10 AM–9 PM", tags: ["Photography", "Architecture"],
    durationMin: 90,
    blurb: "634 m broadcast tower with panoramic decks over the whole Kanto plain.",
  },
  {
    id: "tok-teamlab-planets", name: "teamLab Planets", category: "MUSEUM", city: "Tokyo",
    neighborhood: "Toyosu", lat: 35.6497, lng: 139.7899, rating: 4.7, priceLevel: 3,
    avgCost: 3800, currency: "JPY", hours: "9 AM–10 PM", tags: ["Art" as string, "Adventure", "Relaxation"],
    durationMin: 120,
    blurb: "Barefoot, water-immersive digital art museum — book timed tickets well ahead.",
  },
  {
    id: "tok-tsukiji", name: "Tsukiji Outer Market", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Tsukiji", lat: 35.6654, lng: 139.7707, rating: 4.5, priceLevel: 2,
    avgCost: 2500, currency: "JPY", hours: "5 AM–2 PM, closed Sun", cuisine: "Seafood market",
    tags: ["Food"], durationMin: 90,
    blurb: "Street-food alley of tamagoyaki, uni, and the freshest tuna bowls in town.",
  },
  {
    id: "tok-ginza-east-gardens", name: "Imperial Palace East Gardens", category: "PARK", city: "Tokyo",
    neighborhood: "Chiyoda", lat: 35.6852, lng: 139.7528, rating: 4.4, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "9 AM–4:30 PM, closed Mon/Fri", tags: ["History", "Nature", "Relaxation"],
    durationMin: 75,
    blurb: "Stone foundations of Edo Castle amid manicured gardens — free entry.",
  },
  {
    id: "tok-shinjuku-gyoen", name: "Shinjuku Gyoen", category: "PARK", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6852, lng: 139.71, rating: 4.6, priceLevel: 1,
    avgCost: 500, currency: "JPY", hours: "9 AM–5:30 PM, closed Mon", tags: ["Nature", "Relaxation", "Photography"],
    durationMin: 105,
    blurb: "Expansive French/Japanese gardens — early sakura by mid-March.",
  },
  {
    id: "tok-tmg-building", name: "TMG Observation Deck", category: "ATTRACTION", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6894, lng: 139.6917, rating: 4.4, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "9:30 AM–10 PM", tags: ["Photography", "Architecture"],
    durationMin: 60,
    blurb: "Free 202 m observation deck — Mt. Fuji on clear winter afternoons.",
  },
  {
    id: "tok-takeshita", name: "Takeshita Street", category: "SHOPPING", city: "Tokyo",
    neighborhood: "Harajuku", lat: 35.6712, lng: 139.7031, rating: 4.2, priceLevel: 2,
    avgCost: 2000, currency: "JPY", hours: "11 AM–7 PM", tags: ["Shopping", "Anime & Pop Culture"],
    durationMin: 75,
    blurb: "Neon teen-fashion lane — crepes, vintage stores, and kawaii everything.",
  },
  {
    id: "tok-akihabara", name: "Akihabara Electric Town", category: "SHOPPING", city: "Tokyo",
    neighborhood: "Akihabara", lat: 35.7022, lng: 139.7745, rating: 4.4, priceLevel: 2,
    avgCost: 5000, currency: "JPY", hours: "10 AM–8 PM", tags: ["Anime & Pop Culture", "Shopping"],
    durationMin: 150,
    blurb: "Anime, arcade, and electronics mecca — retro games at Super Potato.",
  },
  {
    id: "tok-pokemon-center", name: "Pokémon Center Mega Tokyo", category: "SHOPPING", city: "Tokyo",
    neighborhood: "Ikebukuro", lat: 35.7295, lng: 139.7169, rating: 4.5, priceLevel: 2,
    avgCost: 3000, currency: "JPY", hours: "10 AM–9 PM", tags: ["Anime & Pop Culture", "Shopping"],
    durationMin: 60,
    blurb: "Flagship Pokémon store in Sunshine City — exclusive plush and merch.",
  },
  {
    id: "tok-golden-gai", name: "Golden Gai", category: "BAR", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6938, lng: 139.7036, rating: 4.3, priceLevel: 3,
    avgCost: 3500, currency: "JPY", hours: "7 PM–late", tags: ["Nightlife"],
    durationMin: 120,
    blurb: "Six alleys of six-seat bars, each with its own personality. Cover charges apply.",
  },
  {
    id: "tok-omoide-yokocho", name: "Omoide Yokocho", category: "BAR", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6934, lng: 139.6997, rating: 4.4, priceLevel: 2,
    avgCost: 2500, currency: "JPY", hours: "5 PM–late", cuisine: "Yakitori",
    tags: ["Food", "Nightlife"], durationMin: 90,
    blurb: "'Memory Lane' — smoky yakitori counters under the train tracks.",
  },
  {
    id: "tok-ueno-park", name: "Ueno Park & Museums", category: "PARK", city: "Tokyo",
    neighborhood: "Ueno", lat: 35.7156, lng: 139.7745, rating: 4.4, priceLevel: 1,
    avgCost: 1000, currency: "JPY", hours: "5 AM–11 PM", tags: ["Nature", "History", "Culture"],
    durationMin: 120,
    blurb: "Museum cluster and park walks — National Museum is Japan's oldest and largest.",
  },
  {
    id: "tok-mori-museum", name: "Mori Art Museum & Shibuya Sky alternative", category: "MUSEUM", city: "Tokyo",
    neighborhood: "Roppongi", lat: 35.6604, lng: 139.7292, rating: 4.5, priceLevel: 3,
    avgCost: 2200, currency: "JPY", hours: "10 AM–10 PM", tags: ["Art" as string, "Architecture"],
    durationMin: 110,
    blurb: "Cutting-edge contemporary art atop Roppongi Hills with city-view deck.",
  },
  {
    id: "tok-tokyo-tower", name: "Tokyo Tower", category: "ATTRACTION", city: "Tokyo",
    neighborhood: "Minato", lat: 35.6586, lng: 139.7454, rating: 4.5, priceLevel: 2,
    avgCost: 1500, currency: "JPY", hours: "9 AM–10:30 PM", tags: ["Photography", "Architecture"],
    durationMin: 75,
    blurb: "The orange-and-white icon — main deck views beat Skytree's atmosphere for some.",
  },
  {
    id: "tok-yoyogi", name: "Yoyogi Park", category: "PARK", city: "Tokyo",
    neighborhood: "Harajuku", lat: 35.6685, lng: 139.7005, rating: 4.3, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Nature", "Relaxation"],
    durationMin: 60,
    blurb: "People-watching park beside Meiji Shrine — picnics and buskers on Sundays.",
  },

  // ---------------- TOKYO — Restaurants ----------------
  {
    id: "tok-sushi-dai", name: "Sushi Dai", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Toyosu", lat: 35.6512, lng: 139.7868, rating: 4.7, priceLevel: 4,
    avgCost: 4200, currency: "JPY", hours: "5 AM–8 PM, queue from 3:30 AM", cuisine: "Edomae sushi",
    tags: ["Food"], durationMin: 75,
    blurb: "Legendary omakase counter relocated from Tsukiji — worth the wake-up call.",
  },
  {
    id: "tok-ichiran", name: "Ichiran Ramen Shibuya", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.6614, lng: 139.701, rating: 4.5, priceLevel: 1,
    avgCost: 1200, currency: "JPY", hours: "24 hours", cuisine: "Tonkotsu ramen",
    tags: ["Food"], durationMin: 45,
    blurb: "Solo-booth tonkotsu ramen — customize every parameter via order sheet.",
  },
  {
    id: "tok-afuri", name: "Afuri Ramen Ebisu", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Ebisu", lat: 35.6459, lng: 139.7102, rating: 4.4, priceLevel: 1,
    avgCost: 1300, currency: "JPY", hours: "11 AM–5 AM", cuisine: "Yuzu shio ramen",
    tags: ["Food"], durationMin: 45,
    blurb: "Light citrus-kissed broth — the ramen for people who don't love heavy ramen.",
  },
  {
    id: "tok-uobei", name: "Uobei Genki Sushi Shibuya", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.67, lng: 139.698, rating: 4.3, priceLevel: 1,
    avgCost: 1500, currency: "JPY", hours: "10:30 AM–11 PM", cuisine: "Conveyor sushi",
    tags: ["Food"], durationMin: 50,
    blurb: "Order on a tablet, plates rocket to your seat on high-speed lanes.",
  },
  {
    id: "tok-gonpachi", name: "Gonpachi Nishi-Azabu", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Nishi-Azabu", lat: 35.6605, lng: 139.727, rating: 4.3, priceLevel: 3,
    avgCost: 4000, currency: "JPY", hours: "11:30 AM–3:30 PM, 5–11:30 PM", cuisine: "Izakaya",
    tags: ["Food", "Nightlife"], durationMin: 90,
    blurb: "The 'Kill Bill' izakaya — soaring timber hall, skewers, and atmosphere.",
  },
  {
    id: "tok-maisen", name: "Maisen Tonkatsu", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Omotesando", lat: 35.6666, lng: 139.7055, rating: 4.5, priceLevel: 2,
    avgCost: 2000, currency: "JPY", hours: "11 AM–10 PM", cuisine: "Tonkatsu",
    tags: ["Food"], durationMin: 60,
    blurb: "Silky black-pork cutlets in a converted bathhouse near Omotesando.",
  },
  {
    id: "tok-gyoza-lou", name: "Harajuku Gyoza Lou", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Harajuku", lat: 35.6699, lng: 139.704, rating: 4.3, priceLevel: 1,
    avgCost: 1000, currency: "JPY", hours: "11:30 AM–9:30 PM", cuisine: "Gyoza",
    tags: ["Food"], durationMin: 45,
    blurb: "Garlic-forward pan-fried gyoza and nothing else, basically. Cash-friendly.",
  },
  {
    id: "tok-fuunji", name: "Fuunji Tsukemen", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6939, lng: 139.6985, rating: 4.5, priceLevel: 1,
    avgCost: 1100, currency: "JPY", hours: "10:30 AM–3 PM, 6–9 PM", cuisine: "Tsukemen",
    tags: ["Food"], durationMin: 45,
    blurb: "Dipping ramen with rich fish-broth — queue moves fast, line outside.",
  },
  {
    id: "tok-tsunahachi", name: "Tsunahachi Tempura", category: "RESTAURANT", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6925, lng: 139.699, rating: 4.4, priceLevel: 2,
    avgCost: 2800, currency: "JPY", hours: "11 AM–10 PM", cuisine: "Tempura",
    tags: ["Food"], durationMin: 75,
    blurb: "Counter tempura fried course-by-course since 1923.",
  },
  {
    id: "tok-streamer", name: "Streamer Coffee Company", category: "CAFE", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.6595, lng: 139.697, rating: 4.3, priceLevel: 2,
    avgCost: 800, currency: "JPY", hours: "8 AM–8 PM", cuisine: "Specialty coffee",
    tags: ["Relaxation"], durationMin: 40,
    blurb: "Latte-art institution a block off the scramble.",
  },
  {
    id: "tok-mameya", name: "Koffee Mameya", category: "CAFE", city: "Tokyo",
    neighborhood: "Omotesando", lat: 35.666, lng: 139.708, rating: 4.5, priceLevel: 2,
    avgCost: 900, currency: "JPY", hours: "10 AM–6 PM", cuisine: "Specialty coffee",
    tags: ["Relaxation", "Food"], durationMin: 35,
    blurb: "Bean sommeliers guide you through single-origin picks in a wooden cube.",
  },
  {
    id: "tok-depachika-isetan", name: "Isetan Depachika", category: "SHOPPING", city: "Tokyo",
    neighborhood: "Shinjuku", lat: 35.6887, lng: 139.706, rating: 4.5, priceLevel: 2,
    avgCost: 1800, currency: "JPY", hours: "10 AM–8 PM", tags: ["Food", "Shopping"],
    durationMin: 60,
    blurb: "Basement food hall theater — wagashi, bentos, and desserts as art.",
  },

  // ---------------- TOKYO — Essentials ----------------
  {
    id: "tok-donki-shibuya", name: "Don Quijote Shibuya", category: "ESSENTIAL", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.6616, lng: 139.6998, rating: 4.3, priceLevel: 1,
    avgCost: 2000, currency: "JPY", hours: "24 hours", tags: ["Shopping"],
    durationMin: 45,
    blurb: "Chaotic discount megastore — snacks, cosmetics, souvenirs, electronics.",
  },
  {
    id: "tok-seven-shibuya", name: "7-Eleven Shibuya Chuo-dori", category: "ESSENTIAL", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.658, lng: 139.7012, rating: 4.6, priceLevel: 0,
    avgCost: 600, currency: "JPY", hours: "24 hours", tags: [],
    durationMin: 15,
    blurb: "Onigiri, ATM with foreign cards, and egg sando emergencies.",
  },
  {
    id: "tok-matsumoto-pharma", name: "Matsumoto Kiyoshi Shibuya", category: "ESSENTIAL", city: "Tokyo",
    neighborhood: "Shibuya", lat: 35.6625, lng: 139.6975, rating: 4.2, priceLevel: 1,
    avgCost: 1500, currency: "JPY", hours: "10 AM–9 PM", tags: [],
    durationMin: 25,
    blurb: "Drugstore for sunscreen, masks, and travel meds — tax-free over ¥5,000.",
  },

  // ---------------- KYOTO ----------------
  {
    id: "kyo-fushimi-inari", name: "Fushimi Inari Taisha", category: "TEMPLE", city: "Kyoto",
    neighborhood: "Fushimi", lat: 34.9671, lng: 135.7727, rating: 4.8, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Culture", "History", "Photography"],
    durationMin: 150,
    blurb: "Ten thousand vermilion torii winding up the mountain — go early or late.",
  },
  {
    id: "kyo-kinkakuji", name: "Kinkaku-ji (Golden Pavilion)", category: "TEMPLE", city: "Kyoto",
    neighborhood: "Kita", lat: 35.0394, lng: 135.7292, rating: 4.7, priceLevel: 1,
    avgCost: 500, currency: "JPY", hours: "9 AM–5 PM", tags: ["Culture", "History", "Photography"],
    durationMin: 60,
    blurb: "Gold-leafed pavilion mirrored in its reflecting pond. Iconic.",
  },
  {
    id: "kyo-arashiyama", name: "Arashiyama Bamboo Grove", category: "PARK", city: "Kyoto",
    neighborhood: "Arashiyama", lat: 35.017, lng: 135.671, rating: 4.5, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Nature", "Photography", "Relaxation"],
    durationMin: 90,
    blurb: "Whispering green corridor — pair with Tenryū-ji and the Katsura riverbank.",
  },
  {
    id: "kyo-tenryuji", name: "Tenryū-ji Temple", category: "TEMPLE", city: "Kyoto",
    neighborhood: "Arashiyama", lat: 35.0159, lng: 135.6725, rating: 4.6, priceLevel: 1,
    avgCost: 500, currency: "JPY", hours: "8:30 AM–5 PM", tags: ["Culture", "History"],
    durationMin: 75,
    blurb: "UNESCO Zen temple with one of Japan's finest landscape gardens.",
  },
  {
    id: "kyo-kiyomizu", name: "Kiyomizu-dera", category: "TEMPLE", city: "Kyoto",
    neighborhood: "Higashiyama", lat: 34.9949, lng: 135.785, rating: 4.7, priceLevel: 1,
    avgCost: 400, currency: "JPY", hours: "6 AM–6 PM", tags: ["Culture", "History", "Photography"],
    durationMin: 90,
    blurb: "Wooden stage jutting over the hillside, city-wide views, love charms.",
  },
  {
    id: "kyo-gion", name: "Gion District", category: "ATTRACTION", city: "Kyoto",
    neighborhood: "Gion", lat: 35.0037, lng: 135.7788, rating: 4.5, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Evenings are magic", tags: ["Culture", "Photography", "History"],
    durationMin: 90,
    blurb: "Wooden machiya lanes where geiko and maiko still hurry to appointments.",
  },
  {
    id: "kyo-nishiki", name: "Nishiki Market", category: "RESTAURANT", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.005, lng: 135.7649, rating: 4.4, priceLevel: 2,
    avgCost: 2000, currency: "JPY", hours: "~10 AM–5 PM", cuisine: "Market food",
    tags: ["Food"], durationMin: 90,
    blurb: "\"Kyoto's kitchen\" — five blocks of pickles, tofu, skewers, and knives.",
  },
  {
    id: "kyo-philosophers-path", name: "Philosopher's Path", category: "PARK", city: "Kyoto",
    neighborhood: "Higashiyama", lat: 35.0269, lng: 135.7947, rating: 4.5, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Nature", "Relaxation", "Photography"],
    durationMin: 75,
    blurb: "Canal-side stone walk named for a philosopher's daily strolls.",
  },
  {
    id: "kyo-nijo-castle", name: "Nijō Castle", category: "ATTRACTION", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.0142, lng: 135.7481, rating: 4.6, priceLevel: 1,
    avgCost: 1300, currency: "JPY", hours: "8:45 AM–4 PM", tags: ["History", "Culture", "Architecture"],
    durationMin: 100,
    blurb: "Shogunal palace with nightingale floors and lavish screen paintings.",
  },
  {
    id: "kyo-pontocho", name: "Pontochō Alley", category: "BAR", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.0073, lng: 135.7696, rating: 4.5, priceLevel: 3,
    avgCost: 4500, currency: "JPY", hours: "5 PM–late", tags: ["Nightlife", "Food"],
    durationMin: 110,
    blurb: "One narrow lane of teahouses and bars along the Kamogawa river.",
  },
  {
    id: "kyo-yasaka", name: "Yasaka Shrine", category: "TEMPLE", city: "Kyoto",
    neighborhood: "Gion", lat: 35.0037, lng: 135.7815, rating: 4.6, priceLevel: 0,
    avgCost: 0, currency: "JPY", hours: "Always open", tags: ["Culture", "History"],
    durationMin: 45,
    blurb: "Vermilion gateway shrine anchoring Gion — lantern-lit at dusk.",
  },
  {
    id: "kyo-ippudo-nishikikoji", name: "Ippudo Nishikikoji", category: "RESTAURANT", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.0046, lng: 135.766, rating: 4.4, priceLevel: 1,
    avgCost: 1100, currency: "JPY", hours: "11 AM–10 PM", cuisine: "Ramen",
    tags: ["Food"], durationMin: 45,
    blurb: "Silky tonkotsu steps from Nishiki — English menus available.",
  },
  {
    id: "kyo-menami", name: "Menami Obanzai", category: "RESTAURANT", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.002, lng: 135.765, rating: 4.5, priceLevel: 2,
    avgCost: 3000, currency: "JPY", hours: "5 PM–10 PM", cuisine: "Kyoto home cooking",
    tags: ["Food"], durationMin: 85,
    blurb: "Obanzai — Kyoto grandmother comfort dishes, point-at-the-tray style.",
  },
  {
    id: "kyo-katsukura", name: "Katsukura Sanjo", category: "RESTAURANT", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.0005, lng: 135.759, rating: 4.5, priceLevel: 2,
    avgCost: 1900, currency: "JPY", hours: "11 AM–9:30 PM", cuisine: "Tonkatsu",
    tags: ["Food"], durationMin: 60,
    blurb: "Crackling pork cutlets with house sesame grind-your-own sauce.",
  },
  {
    id: "kyo-honke-owariya", name: "Honke Owariya", category: "RESTAURANT", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.01, lng: 135.7645, rating: 4.5, priceLevel: 2,
    avgCost: 1600, currency: "JPY", hours: "11 AM–7 PM", cuisine: "Soba",
    tags: ["Food", "History"], durationMin: 55,
    blurb: "Soba house serving since 1465 — the horai soba stack is the move.",
  },
  {
    id: "kyo-arabica", name: "% Arabica Higashiyama", category: "CAFE", city: "Kyoto",
    neighborhood: "Higashiyama", lat: 34.9965, lng: 135.78, rating: 4.4, priceLevel: 2,
    avgCost: 700, currency: "JPY", hours: "8 AM–6 PM", cuisine: "Coffee",
    tags: ["Relaxation", "Photography"], durationMin: 30,
    blurb: "Riverside latte perfection in the Yasaka Pagoda district.",
  },
  {
    id: "kyo-seven-kawaramachi", name: "7-Eleven Kawaramachi Shijo", category: "ESSENTIAL", city: "Kyoto",
    neighborhood: "Nakagyo", lat: 35.0042, lng: 135.7665, rating: 4.5, priceLevel: 0,
    avgCost: 600, currency: "JPY", hours: "24 hours", tags: [],
    durationMin: 15,
    blurb: "Central konbini for late-night onigiri runs.",
  },

  // ---------------- SEOUL (smaller set for second demo trip) ----------------
  {
    id: "sel-gyeongbokgung", name: "Gyeongbokgung Palace", category: "ATTRACTION", city: "Seoul",
    neighborhood: "Jongno", lat: 37.5796, lng: 126.977, rating: 4.7, priceLevel: 1,
    avgCost: 3000, currency: "KRW", hours: "9 AM–6 PM, closed Tue", tags: ["History", "Culture", "Photography"],
    durationMin: 120, blurb: "The grand Joseon palace with changing-of-the-guard ceremonies.",
  },
  {
    id: "sel-bukchon", name: "Bukchon Hanok Village", category: "ATTRACTION", city: "Seoul",
    neighborhood: "Jongno", lat: 37.5828, lng: 126.9853, rating: 4.4, priceLevel: 0,
    avgCost: 0, currency: "KRW", hours: "Always open", tags: ["Culture", "Photography"],
    durationMin: 90, blurb: "Lanes of traditional hanok houses on the hill between palaces.",
  },
  {
    id: "sel-myeongdong", name: "Myeongdong Shopping Street", category: "SHOPPING", city: "Seoul",
    neighborhood: "Jung", lat: 37.5638, lng: 126.9827, rating: 4.3, priceLevel: 2,
    avgCost: 30000, currency: "KRW", hours: "11 AM–9 PM", tags: ["Shopping", "Food"],
    durationMin: 120, blurb: "Skincare ground zero plus street-food stalls after dark.",
  },
  {
    id: "sel-namsan", name: "N Seoul Tower", category: "ATTRACTION", city: "Seoul",
    neighborhood: "Yongsan", lat: 37.5512, lng: 126.9882, rating: 4.5, priceLevel: 2,
    avgCost: 21000, currency: "KRW", hours: "10 AM–11 PM", tags: ["Photography", "Nightlife"],
    durationMin: 100, blurb: "Cable-car up Namsan for sunset over the Han river bend.",
  },
  {
    id: "sel-gwangjang", name: "Gwangjang Market", category: "RESTAURANT", city: "Seoul",
    neighborhood: "Jongno", lat: 37.5703, lng: 126.9867, rating: 4.5, priceLevel: 1,
    avgCost: 12000, currency: "KRW", hours: "8 AM–11 PM", cuisine: "Market food",
    tags: ["Food"], durationMin: 90, blurb: "Bindaetteok, mayak gimbap, and yukhoe at counter stalls.",
  },
  {
    id: "sel-hongdae", name: "Hongdae District", category: "BAR", city: "Seoul",
    neighborhood: "Mapo", lat: 37.5563, lng: 126.9235, rating: 4.4, priceLevel: 2,
    avgCost: 25000, currency: "KRW", hours: "Evening–late", tags: ["Nightlife", "Shopping"],
    durationMin: 150, blurb: "University energy — busking, bars, and BBQ till sunrise.",
  },

  // ---------------- ITALY (third demo trip) ----------------
  {
    id: "rom-colosseum", name: "Colosseum", category: "ATTRACTION", city: "Rome",
    neighborhood: "Monti", lat: 41.8902, lng: 12.4922, rating: 4.8, priceLevel: 2,
    avgCost: 18, currency: "EUR", hours: "9 AM–7 PM", tags: ["History", "Photography"],
    durationMin: 120, blurb: "Book the first-slot entry to beat both queues and heat.",
  },
  {
    id: "rom-trevi", name: "Trevi Fountain", category: "ATTRACTION", city: "Rome",
    neighborhood: "Centro Storico", lat: 41.9009, lng: 12.4833, rating: 4.7, priceLevel: 0,
    avgCost: 0, currency: "EUR", hours: "Always open", tags: ["Photography", "Romance" as string],
    durationMin: 30, blurb: "Toss your coin at dawn — the only quiet hour.",
  },
  {
    id: "rom-roscioli", name: "Roscioli Salumeria", category: "RESTAURANT", city: "Rome",
    neighborhood: "Centro Storico", lat: 41.8955, lng: 12.4722, rating: 4.6, priceLevel: 3,
    avgCost: 50, currency: "EUR", hours: "12:30–12 AM", cuisine: "Roman",
    tags: ["Food"], durationMin: 100, blurb: "Carbonara benchmark behind a deli front. Reserve weeks out.",
  },
  {
    id: "flo-duomo", name: "Florence Duomo & Dome Climb", category: "ATTRACTION", city: "Florence",
    neighborhood: "Duomo", lat: 43.7731, lng: 11.256, rating: 4.8, priceLevel: 2,
    avgCost: 30, currency: "EUR", hours: "8:15 AM–7:30 PM", tags: ["History", "Architecture", "Photography"],
    durationMin: 120, blurb: "Brunelleschi's dome — 463 steps, zero elevators, all reward.",
  },
  {
    id: "flo-vinaio", name: "All'Antico Vinaio", category: "RESTAURANT", city: "Florence",
    neighborhood: "Santa Croce", lat: 43.7691, lng: 11.2615, rating: 4.6, priceLevel: 1,
    avgCost: 12, currency: "EUR", hours: "10 AM–8 PM", cuisine: "Sandwiches",
    tags: ["Food"], durationMin: 40, blurb: "The schiacciata sandwich that broke the internet.",
  },
  {
    id: "ven-san-marco", name: "St Mark's Basilica", category: "ATTRACTION", city: "Venice",
    neighborhood: "San Marco", lat: 45.4342, lng: 12.3388, rating: 4.7, priceLevel: 1,
    avgCost: 7, currency: "EUR", hours: "9:30 AM–5:15 PM", tags: ["History", "Architecture"],
    durationMin: 90, blurb: "Gold mosaics under five domes — book the loggia terrace.",
  },
];

/** All cities we know about, with coordinates used for weather + maps. */
export const CITY_META: Record<string, { country: string; lat: number; lng: number }> = {
  Tokyo: { country: "Japan", lat: 35.6762, lng: 139.6503 },
  Kyoto: { country: "Japan", lat: 35.0116, lng: 135.7681 },
  Seoul: { country: "South Korea", lat: 37.5665, lng: 126.978 },
  Rome: { country: "Italy", lat: 41.9028, lng: 12.4964 },
  Florence: { country: "Italy", lat: 43.7696, lng: 11.2558 },
  Venice: { country: "Italy", lat: 45.4408, lng: 12.3155 },
};

export function poisByCity(city: string): Poi[] {
  return POIS.filter((p) => p.city === city);
}

export function poiById(id: string): Poi | undefined {
  return POIS.find((p) => p.id === id);
}
