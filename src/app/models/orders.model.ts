export interface Order {
  id: string;
  number: string;
  dateAddedToSpreadsheet: Date;
  dueDate: Date;
  uniqueItemsOrdered: number;
  totalAmountWithoutTaxes: number; // CAD
  totalAmountWithTaxes: number; // CAD
  allStatuses: OrderStatus[];
  distributionMode: OrderDistributionMode;
  distributionDate: Date;
  deliveryFees: number; // CAD
  distanceToPickup: number; // km
  vendorOrganizationId: string;
  buyerOrganizationId: string;
  creatorOrganizationId: string;
  isCreatorLoggedIn: boolean;
}

export type OrderStatus =
  | 'cancelled'
  | 'completed'
  | 'confirmed'
  | 'delivered'
  | 'paid'
  | 'submitted';

export type OrderDistributionMode = 'delivery' | 'pickup';

export const ORDER_DISTRIBUTION_MODES: OrderDistributionMode[] = [
  'delivery',
  'pickup',
];

export function translateOrderStatus(status: OrderStatus): string {
  switch (status) {
    case 'cancelled':
      return 'Annulée';
    case 'completed':
      return 'Complétée';
    case 'confirmed':
      return 'Confirmée';
    case 'delivered':
      return 'Livrée';
    case 'paid':
      return 'Payée';
    case 'submitted':
      return 'Soumise';
  }
}

export function translateOrderDistributionMode(
  mode: OrderDistributionMode
): string {
  switch (mode) {
    case 'delivery':
      return 'Livraison';
    case 'pickup':
      return 'Ramassage';
  }
}
