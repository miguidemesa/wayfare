// Where travellers usually stay in each city the guide covers, for the
// planning interview's "not booked yet? pick an area" question. The point is
// the area's centre: close enough to plan days around, not a hotel address.
// Google Places replaces this for any city once it's connected.

export type StayArea = { name: string; lat: number; lng: number; note: string };

export const STAY_AREAS: Record<string, StayArea[]> = {
  Tokyo: [
    { name: "Shinjuku", lat: 35.6909, lng: 139.7003, note: "Big hub, lots of hotels, lively at night" },
    { name: "Shibuya", lat: 35.658, lng: 139.7016, note: "Shopping and nightlife, well connected" },
    { name: "Ginza & Tokyo Station", lat: 35.6717, lng: 139.765, note: "Central, polished, easy for day trips" },
    { name: "Asakusa", lat: 35.7148, lng: 139.7967, note: "Old Tokyo, temples, quieter evenings" },
    { name: "Ueno", lat: 35.7138, lng: 139.7773, note: "Museums and park, good value" },
    { name: "Roppongi", lat: 35.6628, lng: 139.7314, note: "Art museums and late nights" },
  ],
  Kyoto: [
    { name: "Kyoto Station", lat: 34.9858, lng: 135.7588, note: "Easiest for trains and day trips" },
    { name: "Downtown (Kawaramachi)", lat: 35.0037, lng: 135.769, note: "Restaurants and shopping, walkable" },
    { name: "Gion & Higashiyama", lat: 35.0037, lng: 135.7788, note: "Temples and old streets on the doorstep" },
    { name: "Arashiyama", lat: 35.0094, lng: 135.6668, note: "Scenic and calm, far from the centre" },
  ],
  Seoul: [
    { name: "Myeongdong", lat: 37.5636, lng: 126.985, note: "Central, shopping and street food" },
    { name: "Jongno & Insadong", lat: 37.5744, lng: 126.9856, note: "Palaces and tea houses nearby" },
    { name: "Hongdae", lat: 37.5563, lng: 126.922, note: "Young, cafes and live music" },
    { name: "Gangnam", lat: 37.4979, lng: 127.0276, note: "Modern, south of the river" },
    { name: "Itaewon", lat: 37.5345, lng: 126.9946, note: "International food and bars" },
  ],
  Rome: [
    { name: "Centro Storico", lat: 41.8986, lng: 12.4769, note: "Walk to the Pantheon and Navona" },
    { name: "Monti", lat: 41.8955, lng: 12.493, note: "Near the Colosseum, neighbourhood feel" },
    { name: "Trastevere", lat: 41.8894, lng: 12.47, note: "Charming streets, great dinners" },
    { name: "Prati & Vatican", lat: 41.907, lng: 12.463, note: "Calmer, close to the Vatican" },
    { name: "Termini", lat: 41.901, lng: 12.5011, note: "By the main station, good value" },
  ],
  Florence: [
    { name: "Duomo", lat: 43.7731, lng: 11.256, note: "The centre of everything" },
    { name: "Santa Croce", lat: 43.7687, lng: 11.262, note: "Central with good trattorias" },
    { name: "Oltrarno", lat: 43.765, lng: 11.25, note: "Across the river, artisan and local" },
    { name: "Santa Maria Novella", lat: 43.7745, lng: 11.249, note: "By the station" },
  ],
  Venice: [
    { name: "San Marco", lat: 45.434, lng: 12.3388, note: "The heart of Venice, busiest by day" },
    { name: "Cannaregio", lat: 45.4445, lng: 12.329, note: "Quieter, local bars, near the station" },
    { name: "Dorsoduro", lat: 45.4308, lng: 12.326, note: "Galleries and canal-side walks" },
    { name: "Castello", lat: 45.435, lng: 12.35, note: "Residential and peaceful" },
    { name: "Mestre (mainland)", lat: 45.4903, lng: 12.238, note: "Cheaper, a short train ride in" },
  ],
};

export function stayAreasFor(city: string): StayArea[] {
  const key = Object.keys(STAY_AREAS).find((c) => c.toLowerCase() === city.trim().toLowerCase());
  return key ? STAY_AREAS[key] : [];
}
