export interface PurchaseOrder {
  id: string;
  number: string;
  dateAddedToSpreadsheet: Date;
  dueDate: Date;
  uniqueItemsOrdered: number;
  totalAmountWithoutTaxes: number; // CAD
  totalAmountWithTaxes: number; // CAD
  allStatuses: PurchaseOrderStatus[];
  distributionMode: PurchaseOrderDistributionMode;
  distributionDate: Date;
  deliveryFees: number; // CAD
  distanceToPickup: number; // km
  vendorOrganizationId: string;
  buyerOrganizationId: string;
  creatorOrganizationId: string;
  isCreatorLoggedIn: boolean;
}

export type PurchaseOrderStatus =
  | 'cancelled'
  | 'completed'
  | 'confirmed'
  | 'delivered'
  | 'paid'
  | 'submitted';

export type PurchaseOrderDistributionMode = 'delivery' | 'pickup';

export const PURCHASE_ORDER_DISTRIBUTION_MODES: PurchaseOrderDistributionMode[] =
  ['delivery', 'pickup'];
