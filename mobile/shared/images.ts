// High-Resolution Curated Travel Imagery Registry
// Editorial-grade Unsplash photography for destinations, categories, and moments.

export const DESTINATION_IMAGES: Record<string, { hero: string; thumb: string; gallery: string[] }> = {
  tokyo: {
    hero: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=85", // Tokyo Tower at dusk
    thumb: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80", // Shibuya Crossing
    gallery: [
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=800&q=80", // Shinjuku neon
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=800&q=80", // Senso-ji temple
    ],
  },
  kyoto: {
    hero: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85", // Fushimi Inari torii
    thumb: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=800&q=80", // Arashiyama bamboo
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
    ],
  },
  paris: {
    hero: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=85", // Eiffel Tower & Seine
    thumb: "https://images.unsplash.com/photo-1509299349698-dd22323b5963?auto=format&fit=crop&w=600&q=80", // Arc de Triomphe
    gallery: [
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1509299349698-dd22323b5963?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80", // Louvre
    ],
  },
  rome: {
    hero: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=85", // Colosseum at golden hour
    thumb: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=600&q=80", // Roman streets
    gallery: [
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=800&q=80", // Trevi Fountain
    ],
  },
  manila: {
    hero: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=85", // Tropical Philippine island
    thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
    ],
  },
  seoul: {
    hero: "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=85", // Gyeongbokgung Palace at dusk
    thumb: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=600&q=80", // Seoul cityscape
    gallery: [
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=800&q=80",
    ],
  },
  generic: {
    hero: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=85", // Mountain adventure
    thumb: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80", // Travel road
    gallery: [
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
    ],
  },
};

export const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  FOOD: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80", // Ramen / Dining
  RESTAURANT: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80", // Fine dining
  CAFE: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80", // Aesthetic cafe
  HOTEL: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80", // Luxury hotel
  ATTRACTION: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=600&q=80", // Temple / Sights
  SHOPPING: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80", // Boutique
  PARK: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80", // Coastal / Nature
  FLIGHT: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80", // Plane wing
  TRANSPORT: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80", // Train
};

export function getDestinationImages(cityOrCountry: string): { hero: string; thumb: string; gallery: string[] } {
  const norm = (cityOrCountry || "").toLowerCase().trim();
  if (norm.includes("tokyo") || norm.includes("japan")) return DESTINATION_IMAGES.tokyo;
  if (norm.includes("kyoto")) return DESTINATION_IMAGES.kyoto;
  if (norm.includes("paris") || norm.includes("france")) return DESTINATION_IMAGES.paris;
  if (norm.includes("rome") || norm.includes("italy")) return DESTINATION_IMAGES.rome;
  if (norm.includes("manila") || norm.includes("philippin") || norm.includes("palawan") || norm.includes("cebu") || norm.includes("boracay")) return DESTINATION_IMAGES.manila;
  if (norm.includes("seoul") || norm.includes("korea")) return DESTINATION_IMAGES.seoul;
  return DESTINATION_IMAGES.generic;
}

/**
 * A real photo of the destination, or null when we don't have one — better
 * no picture than a stock image of somewhere else.
 */
export function destinationPhoto(cityOrCountry: string): { hero: string; thumb: string } | null {
  const img = getDestinationImages(cityOrCountry);
  return img === DESTINATION_IMAGES.generic ? null : img;
}
