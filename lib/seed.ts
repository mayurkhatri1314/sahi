import type { RawDeal, Coupon } from "./types";

/**
 * Illustrative products shown only when no live feed or database is configured.
 * They carry no price history on purpose: Sahi never shows history it didn't observe.
 */
const raw: Omit<RawDeal, "source" | "sample">[] = [
  { external_id: "B0CHX1W1XY", name: "iPhone 15 (128 GB)", brand: "Apple", category: "Mobiles", store_id: "amazon", product_url: "https://www.amazon.in/dp/B0CHX1W1XY", mrp: 79900, price: 66999, bank_name: "HDFC Credit", bank_pct: 10, bank_max: 5000 },
  { external_id: "FK-S24", name: "Galaxy S24 5G (256 GB)", brand: "Samsung", category: "Mobiles", store_id: "flipkart", product_url: "https://www.flipkart.com/p/galaxy-s24", mrp: 89999, price: 61999, coupon_code: "FLIP3000", coupon_value: 3000, bank_name: "ICICI Credit", bank_pct: 10, bank_max: 4000 },
  { external_id: "B09XS7JWHH", name: "WH-1000XM5 Headphones", brand: "Sony", category: "Audio", store_id: "amazon", product_url: "https://www.amazon.in/dp/B09XS7JWHH", mrp: 34990, price: 24990, coupon_code: "SONY1500", coupon_value: 1500, bank_name: "Axis Credit", bank_pct: 10, bank_max: 2000 },
  { external_id: "B09N3ZNHTY", name: "Airdopes 161 TWS", brand: "boAt", category: "Audio", store_id: "amazon", product_url: "https://www.amazon.in/dp/B09N3ZNHTY", mrp: 2990, price: 1299, coupon_code: "BOAT100", coupon_value: 100 },
  { external_id: "MY-NIKE7", name: "Revolution 7 Running Shoes", brand: "Nike", category: "Fashion", store_id: "myntra", product_url: "https://www.myntra.com/p/nike-revolution-7", mrp: 4995, price: 2747, coupon_code: "MYNTRA200", coupon_value: 200, bank_name: "Kotak Credit", bank_pct: 10, bank_max: 500 },
  { external_id: "AJ-LEVI511", name: "511 Slim Fit Jeans", brand: "Levi's", category: "Fashion", store_id: "ajio", product_url: "https://www.ajio.com/p/levis-511", mrp: 3999, price: 1799, coupon_code: "AJIO300", coupon_value: 300 },
  { external_id: "NY-MAMA-VC", name: "Vitamin C Face Wash 100ml", brand: "Mamaearth", category: "Beauty", store_id: "nykaa", product_url: "https://www.nykaa.com/p/mamaearth-vc", mrp: 399, price: 299, coupon_code: "GLOW50", coupon_value: 50 },
  { external_id: "FK-ATOM", name: "Renesa 1200mm Ceiling Fan", brand: "Atomberg", category: "Appliances", store_id: "flipkart", product_url: "https://www.flipkart.com/p/atomberg-renesa", mrp: 4490, price: 3299, bank_name: "ICICI Credit", bank_pct: 10, bank_max: 400 },
  { external_id: "B08QB93S6R", name: "Air Fryer HD9252 4.1L", brand: "Philips", category: "Home", store_id: "amazon", product_url: "https://www.amazon.in/dp/B08QB93S6R", mrp: 12995, price: 7999, coupon_code: "KITCHEN500", coupon_value: 500, bank_name: "SBI Credit", bank_pct: 10, bank_max: 1000 },
  { external_id: "FK-NOISE5", name: "ColorFit Pro 5 Smartwatch", brand: "Noise", category: "Electronics", store_id: "flipkart", product_url: "https://www.flipkart.com/p/noise-colorfit-pro-5", mrp: 5999, price: 2999, coupon_code: "NOISE200", coupon_value: 200 },
  { external_id: "FK-LGAC15", name: "1.5 Ton 5 Star Inverter AC", brand: "LG", category: "Appliances", store_id: "flipkart", product_url: "https://www.flipkart.com/p/lg-ac", mrp: 64990, price: 41990, coupon_code: "COOL2000", coupon_value: 2000, bank_name: "HDFC Credit", bank_pct: 10, bank_max: 3500 },
  { external_id: "B09F5DK3JC", name: "Flip 6 Portable Speaker", brand: "JBL", category: "Audio", store_id: "amazon", product_url: "https://www.amazon.in/dp/B09F5DK3JC", mrp: 11999, price: 7499, bank_name: "Axis Credit", bank_pct: 10, bank_max: 1000 },
  { external_id: "B0CT4M4WLL", name: "Note 13 Pro 5G (128 GB)", brand: "Redmi", category: "Mobiles", store_id: "amazon", product_url: "https://www.amazon.in/dp/B0CT4M4WLL", mrp: 27999, price: 22999, coupon_code: "REDMI1000", coupon_value: 1000, bank_name: "ICICI Credit", bank_pct: 10, bank_max: 2000 },
  { external_id: "FK-DELL15", name: "Inspiron 15 (i5, 16GB)", brand: "Dell", category: "Electronics", store_id: "flipkart", product_url: "https://www.flipkart.com/p/dell-inspiron-15", mrp: 78990, price: 54990, coupon_code: "DELL2000", coupon_value: 2000, bank_name: "HDFC Credit", bank_pct: 10, bank_max: 4000 },
  { external_id: "NY-LAKME95", name: "9to5 Primer + Matte Lipstick", brand: "Lakme", category: "Beauty", store_id: "nykaa", product_url: "https://www.nykaa.com/p/lakme-9to5", mrp: 650, price: 449, coupon_code: "BEAUTY50", coupon_value: 50 },
  { external_id: "B07KMBF2WB", name: "Premium Care Pants (M, 74)", brand: "Pampers", category: "Kids", store_id: "amazon", product_url: "https://www.amazon.in/dp/B07KMBF2WB", mrp: 1799, price: 1199, coupon_code: "BABY100", coupon_value: 100 },
];

export const SEED_DEALS: RawDeal[] = raw.map((d) => ({ ...d, source: "sample", sample: true }));

const c = (external_id: string, store_id: string, store: string, category: string, code: string, title: string, min_order: number): Coupon =>
  ({ external_id, store_id, store, category, code, title, min_order, success_rate: null, verified_at: null, expires_at: null, sample: true });

export const SEED_COUPONS: Coupon[] = [
  c("c1", "amazon", "Amazon", "Electronics", "AMZ10BANK", "10% off with ICICI cards", 5000),
  c("c2", "flipkart", "Flipkart", "Electronics", "FLIPEXTRA5", "Extra 5% on electronics", 9999),
  c("c3", "myntra", "Myntra", "Fashion", "MYNTRA600", "Rs 600 off on Rs 2,999+ fashion", 2999),
  c("c4", "nykaa", "Nykaa", "Beauty", "NYKAANEW", "20% off for new users", 599),
  c("c6", "swiggy", "Swiggy Instamart", "Grocery", "INSTA40", "40% off groceries (max Rs 80)", 199),
  c("c10", "bigbasket", "BigBasket", "Grocery", "BBNEW150", "Rs 150 off first grocery order", 1000),
  c("c12", "amazon", "Amazon", "Kids", "BABYCARE", "Rs 100 off baby care Rs 999+", 999),
  c("c13", "zomato", "Zomato", "Food", "EAT60", "60% off (max Rs 120) on food", 199),
];
