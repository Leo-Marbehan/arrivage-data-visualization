export interface Organization {
  id: string;
  language: Language;
  country: string;
  province: string;
  region: string;
  subRegion: string;
  city: string;
  creationTimestamp: Date;
}

export interface VendorOrganization extends Organization {
  productCategories: VendorProductCategory[];
}

export interface BuyerOrganization extends Organization {
  category: BuyerOrganizationCategory;
  isPro: boolean;
}

export function isVendorOrganization(
  organization: Organization
): organization is VendorOrganization {
  return 'productCategories' in organization;
}

export function isBuyerOrganization(
  organization: Organization
): organization is BuyerOrganization {
  return 'category' in organization && 'isPro' in organization;
}

export type Language = 'fr' | 'en';

export type VendorProductCategory =
  | 'vegetable-fruit'
  | 'meat'
  | 'processed-product'
  | 'maple-honey'
  | 'bread'
  | 'dairy'
  | 'wild-product'
  | 'seafood'
  | 'oils-and-vinegars'
  | 'drink';

export const VENDOR_PRODUCT_CATEGORIES: VendorProductCategory[] = [
  'vegetable-fruit',
  'meat',
  'processed-product',
  'maple-honey',
  'bread',
  'dairy',
  'wild-product',
  'seafood',
  'oils-and-vinegars',
  'drink',
];

export const RAW_VENDOR_PRODUCT_CATEGORIES: string[] = [
  'vegetable_fruit',
  'meat',
  'processed_product',
  'maple_honey',
  'bread',
  'dairy',
  'wild_product',
  'seafood',
  'oils_and_vinegars',
  'alcohol_free_drink',
  'alcohol_below_18_drink',
  'alcohol_above_18_drink',
  'non_food_products',
];

export const EXCLUDED_CATEGORIES = [
  'non_food_products', // Contains only 1 order
];

export function mapVendorProductCategory(
  rawProductCategory: string
): VendorProductCategory {
  switch (rawProductCategory) {
    case 'vegetable_fruit':
      return 'vegetable-fruit';
    case 'meat':
      return 'meat';
    case 'processed_product':
      return 'processed-product';
    case 'maple_honey':
      return 'maple-honey';
    case 'bread':
      return 'bread';
    case 'dairy':
      return 'dairy';
    case 'wild_product':
      return 'wild-product';
    case 'seafood':
      return 'seafood';
    case 'oils_and_vinegars':
      return 'oils-and-vinegars';
    case 'alcohol_free_drink':
    case 'alcohol_below_18_drink':
    case 'alcohol_above_18_drink':
      // Group all drinks because each category is very small
      return 'drink';
    default:
      throw new Error(`Invalid raw product category: ${rawProductCategory}`);
  }
}

export function translateVendorProductCategory(
  productCategory: VendorProductCategory
): string {
  switch (productCategory) {
    case 'vegetable-fruit':
      return 'Fruits et légumes';
    case 'meat':
      return 'Viandes';
    case 'processed-product':
      return 'Produits transformés';
    case 'maple-honey':
      return 'Sirop d’érable et miel';
    case 'bread':
      return 'Pains et pâtisseries';
    case 'dairy':
      return 'Produits laitiers';
    case 'wild-product':
      return 'Produits sauvages';
    case 'seafood':
      return 'Produits de la mer';
    case 'oils-and-vinegars':
      return 'Huiles et vinaigres';
    case 'drink':
      return 'Boissons';
  }
}

export type BuyerOrganizationCategory =
  | 'specialized-grocery-store'
  | 'restaurant'
  | 'grocery-store'
  | 'artisan'
  | 'institution'
  | 'community-organization'
  | 'distributor'
  | 'producer'
  | 'event-fest'
  | 'purchasing-group'
  | 'consumer';

export const BUYER_ORGANIZATION_CATEGORIES: BuyerOrganizationCategory[] = [
  'specialized-grocery-store',
  'restaurant',
  'grocery-store',
  'artisan',
  'institution',
  'community-organization',
  'distributor',
  'producer',
  'event-fest',
  'purchasing-group',
  'consumer',
];

export const RAW_BUYER_ORGANIZATION_CATEGORIES: string[] = [
  'specialized_grocery_store',
  'restaurant',
  'grocery_store',
  'artisan',
  'institution',
  'community_organization',
  'distributor',
  'producer',
  'event_fest',
  'purchasing_group',
  'consumer',
];

export function mapBuyerOrganizationCategory(
  rawCategory: string
): BuyerOrganizationCategory {
  switch (rawCategory) {
    case 'specialized_grocery_store':
      return 'specialized-grocery-store';
    case 'restaurant':
      return 'restaurant';
    case 'grocery_store':
      return 'grocery-store';
    case 'artisan':
      return 'artisan';
    case 'institution':
      return 'institution';
    case 'community_organization':
      return 'community-organization';
    case 'distributor':
      return 'distributor';
    case 'producer':
      return 'producer';
    case 'event_fest':
      return 'event-fest';
    case 'purchasing_group':
      return 'purchasing-group';
    case 'consumer':
      return 'consumer';
    default:
      throw new Error(
        `Invalid raw buyer organization category: ${rawCategory}`
      );
  }
}

export function translateBuyerOrganizationCategory(
  category: BuyerOrganizationCategory
): string {
  switch (category) {
    case 'specialized-grocery-store':
      // Petites épiceries et comptoirs
      return 'Épicerie spécialisée';
    case 'restaurant':
      // Restaurants, traiteurs, hôtels
      return 'Restaurant';
    case 'grocery-store':
      // Grandes épiceries et bannières
      return 'Épicerie';
    case 'artisan':
      // Artisans, transformateurs, boulangers, pâtissiers, etc.
      return 'Artisan';
    case 'institution':
      // CPE, écoles, RPA, hôpitaux, etc.
      return 'Institution';
    case 'community-organization':
      // Banques alimentaires, popotes roulantes, organismes en sécurité alimentaire
      return 'Organisme communautaire';
    case 'distributor':
      // Distributeurs, grossistes et vente en gros
      return 'Distributeur';
    case 'producer':
      // Agriculteurs et boutiques à la ferme
      return 'Agriculteur';
    case 'event-fest':
      // Événements et festivals
      return 'Événement/festival';
    case 'purchasing-group':
      // Groupes d'achats citoyens
      return "Groupe d'achat citoyen";
    case 'consumer':
      // Particuliers
      return 'Particulier';
  }
}
