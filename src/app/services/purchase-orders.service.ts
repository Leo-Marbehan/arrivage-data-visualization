import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../environment';
import {
  PURCHASE_ORDER_DISTRIBUTION_MODES,
  PurchaseOrder,
  PurchaseOrderDistributionMode,
  PurchaseOrderStatus,
} from '../models/purchase-orders.model';
import { CsvService } from './csv.service';

@Injectable({
  providedIn: 'root',
})
export class PurchaseOrdersService {
  private readonly CANCELLED_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Cancelled.csv';
  private readonly COMPLETED_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Completed.csv';
  private readonly CONFIRMED_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Confirmed.csv';
  private readonly DELIVERED_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Delivered.csv';
  private readonly PAID_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Paid.csv';
  private readonly SUBMITTED_PURCHASE_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Submitted.csv';

  private readonly _isInitializedSignal: WritableSignal<boolean> =
    signal(false);

  private _purchaseOrders: PurchaseOrder[] = [];

  constructor(private readonly csvService: CsvService) {
    void this.loadPurchaseOrders();
  }

  get isInitializedSignal(): WritableSignal<boolean> {
    return this._isInitializedSignal;
  }

  private async loadPurchaseOrders() {
    const cancelledPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.CANCELLED_PURCHASE_ORDERS_FILE_PATH,
      'cancelled'
    );
    const completedPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.COMPLETED_PURCHASE_ORDERS_FILE_PATH,
      'completed'
    );
    const confirmedPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.CONFIRMED_PURCHASE_ORDERS_FILE_PATH,
      'confirmed'
    );
    const deliveredPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.DELIVERED_PURCHASE_ORDERS_FILE_PATH,
      'delivered'
    );
    const paidPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.PAID_PURCHASE_ORDERS_FILE_PATH,
      'paid'
    );
    const submittedPurchaseOrders = await this.loadPurchaseOrdersFromFile(
      this.SUBMITTED_PURCHASE_ORDERS_FILE_PATH,
      'submitted'
    );

    this._purchaseOrders = this.mergePurchaseOrders(
      cancelledPurchaseOrders,
      completedPurchaseOrders
    );
    this._purchaseOrders = this.mergePurchaseOrders(
      this._purchaseOrders,
      confirmedPurchaseOrders
    );
    this._purchaseOrders = this.mergePurchaseOrders(
      this._purchaseOrders,
      deliveredPurchaseOrders
    );
    this._purchaseOrders = this.mergePurchaseOrders(
      this._purchaseOrders,
      paidPurchaseOrders
    );
    this._purchaseOrders = this.mergePurchaseOrders(
      this._purchaseOrders,
      submittedPurchaseOrders
    );

    this._isInitializedSignal.set(true);
  }

  private mergePurchaseOrders(
    first: PurchaseOrder[],
    second: PurchaseOrder[]
  ): PurchaseOrder[] {
    const mergedPurchaseOrders = [...first];

    second.forEach(order => {
      let orderToAdd = order;

      const existingOrder = first.find(o => o.id === order.id);
      if (existingOrder) {
        // Keep the most recent order
        if (
          order.dateAddedToSpreadsheet > existingOrder.dateAddedToSpreadsheet
        ) {
          orderToAdd = order;
        } else {
          orderToAdd = existingOrder;
        }

        // Merge statuses
        orderToAdd.allStatuses = Array.from(
          new Set([...orderToAdd.allStatuses, ...existingOrder.allStatuses])
        );
      }

      mergedPurchaseOrders.push(orderToAdd);
    });
    return mergedPurchaseOrders;
  }

  private async loadPurchaseOrdersFromFile(
    filePath: string,
    status: PurchaseOrderStatus
  ): Promise<PurchaseOrder[]> {
    const rawPurchaseOrders = await this.csvService.loadCsvData(filePath);

    const purchaseOrders: PurchaseOrder[] = rawPurchaseOrders
      .map(order => this.extractPurchaseOrder(order))
      .filter((order): order is PurchaseOrder => order !== null)
      // Remove duplicates id
      .filter((order, index, orders) => {
        const allOrdersWithSameId = orders.filter(o => o.id === order.id);
        const isDuplicate = allOrdersWithSameId.length > 1;
        if (isDuplicate) {
          this.logError('Duplicate purchase order id found:', order.id);
        } else {
          return true;
        }

        const isNewestOrder = allOrdersWithSameId.some(
          o => o.dateAddedToSpreadsheet > order.dateAddedToSpreadsheet
        );
        const isFirstOrder =
          allOrdersWithSameId.filter(
            o => o.dateAddedToSpreadsheet === order.dateAddedToSpreadsheet
          )[0] === order;
        return isNewestOrder && isFirstOrder;
      });

    purchaseOrders.forEach(order => order.allStatuses.push(status));

    return purchaseOrders;
  }

  private extractPurchaseOrder(
    rawPurchaseOrder: Record<string, string>
  ): PurchaseOrder | null {
    const id = rawPurchaseOrder['Id'];
    if (id === undefined || id === '') {
      this.logError('Id is missing in purchase order', rawPurchaseOrder);
      return null;
    }

    const number = rawPurchaseOrder['Number'];
    if (number === undefined) {
      this.logError('Number is missing in purchase order', rawPurchaseOrder);
      return null;
    }

    const rawDateAddedToSpreadsheet = rawPurchaseOrder['Timestamp'];
    if (
      rawDateAddedToSpreadsheet === undefined ||
      rawDateAddedToSpreadsheet === ''
    ) {
      this.logError('Timestamp is missing in purchase order', rawPurchaseOrder);
      return null;
    }
    const dateAddedToSpreadsheet = new Date(rawDateAddedToSpreadsheet);
    if (isNaN(dateAddedToSpreadsheet.getTime())) {
      this.logError('Timestamp is not a valid date', rawPurchaseOrder);
      return null;
    }

    const rawDueDate = rawPurchaseOrder['Due date'];
    if (rawDueDate === undefined || rawDueDate === '') {
      this.logError('Due date is missing in purchase order', rawPurchaseOrder);
      return null;
    }
    const dueDate = new Date(rawDueDate);
    if (isNaN(dueDate.getTime())) {
      this.logError('Due date is not a valid date', rawPurchaseOrder);
      return null;
    }

    const rawUniqueItemsOrdered = rawPurchaseOrder['Uniq items ordered'];
    if (rawUniqueItemsOrdered === undefined || rawUniqueItemsOrdered === '') {
      this.logError(
        'Unique items ordered is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const uniqueItemsOrdered = Number(rawUniqueItemsOrdered);
    if (isNaN(uniqueItemsOrdered)) {
      this.logError(
        'Unique items ordered is not a valid number',
        rawPurchaseOrder
      );
      return null;
    }

    const rawTotalAmountWithoutTaxes =
      rawPurchaseOrder['Amount excluding taxes (CAD)'];
    if (
      rawTotalAmountWithoutTaxes === undefined ||
      rawTotalAmountWithoutTaxes === ''
    ) {
      this.logError(
        'Total amount without taxes is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const totalAmountWithoutTaxes = this.parseNumber(
      rawTotalAmountWithoutTaxes
    );
    if (isNaN(totalAmountWithoutTaxes)) {
      this.logError(
        'Total amount without taxes is not a valid number',
        rawPurchaseOrder
      );
      return null;
    }

    const rawTotalAmountWithTaxes =
      rawPurchaseOrder['Amount including taxes (CAD)'];
    if (
      rawTotalAmountWithTaxes === undefined ||
      rawTotalAmountWithTaxes === ''
    ) {
      this.logError(
        'Total amount with taxes is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const totalAmountWithTaxes = this.parseNumber(rawTotalAmountWithTaxes);
    if (isNaN(totalAmountWithTaxes)) {
      this.logError(
        'Total amount with taxes is not a valid number',
        rawPurchaseOrder
      );
      return null;
    }

    const allStatuses: PurchaseOrderStatus[] = [];

    const rawDistributionMode: string = rawPurchaseOrder['Distribution mode'];
    if (rawDistributionMode === undefined || rawDistributionMode === '') {
      this.logError(
        'Distribution mode is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const distributionMode =
      rawDistributionMode as PurchaseOrderDistributionMode;
    if (!PURCHASE_ORDER_DISTRIBUTION_MODES.includes(distributionMode)) {
      this.logError('Distribution mode is not valid', rawPurchaseOrder);
      return null;
    }

    const rawDistributionDate = rawPurchaseOrder['Delivery date'];
    if (rawDistributionDate === undefined || rawDistributionDate === '') {
      this.logError(
        'Delivery date is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const distributionDate = new Date(rawDistributionDate);
    if (isNaN(distributionDate.getTime())) {
      this.logError('Delivery date is not a valid date', rawPurchaseOrder);
      return null;
    }

    const rawDeliveryFees = rawPurchaseOrder['Delivery fees (CAD)'];
    if (rawDeliveryFees === undefined) {
      this.logError(
        'Delivery fees are missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    let deliveryFees = Number(rawDeliveryFees);
    if (isNaN(deliveryFees)) {
      deliveryFees = 0;
    }

    const rawDistanceToPickup = rawPurchaseOrder['Distance to pickup (km)'];
    if (rawDistanceToPickup === undefined) {
      this.logError(
        'Distance to pickup is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    let distanceToPickup = Number(rawDistanceToPickup);
    if (
      distributionMode === 'pickup' &&
      (rawDistanceToPickup === '' || isNaN(distanceToPickup))
    ) {
      // TODO Compute using the cities
      // this.logError(
      //   'Distance to pickup is not a valid number',
      //   rawPurchaseOrder
      // );
      // return null;
      distanceToPickup = 0;
    } else {
      distanceToPickup = 0;
    }

    const vendorOrganizationId = rawPurchaseOrder['Vendor organization id'];
    if (vendorOrganizationId === undefined || vendorOrganizationId === '') {
      this.logError(
        'Vendor organization id is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }

    const rawIsCreatorLoggedIn = rawPurchaseOrder['Creator logged in'];
    if (rawIsCreatorLoggedIn === undefined || rawIsCreatorLoggedIn === '') {
      this.logError(
        'Creator logged in is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    const isCreatorLoggedIn = rawIsCreatorLoggedIn === 'TRUE';

    const creatorOrganizationId = rawPurchaseOrder['Creator organization id'];
    if (
      creatorOrganizationId === undefined ||
      (isCreatorLoggedIn && creatorOrganizationId === '')
    ) {
      this.logError(
        'Creator organization id is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }

    let buyerOrganizationId = rawPurchaseOrder['Buyer organization id'];
    if (
      buyerOrganizationId === undefined ||
      (isCreatorLoggedIn &&
        buyerOrganizationId === '' &&
        (creatorOrganizationId === '' ||
          creatorOrganizationId === buyerOrganizationId))
    ) {
      this.logError(
        'Buyer organization id is missing in purchase order',
        rawPurchaseOrder
      );
      return null;
    }
    if (isCreatorLoggedIn && buyerOrganizationId === '') {
      buyerOrganizationId = creatorOrganizationId;
    }

    const purchaseOrder: PurchaseOrder = {
      id,
      number,
      dateAddedToSpreadsheet,
      dueDate,
      uniqueItemsOrdered,
      totalAmountWithoutTaxes,
      totalAmountWithTaxes,
      allStatuses,
      distributionMode,
      distributionDate,
      deliveryFees,
      distanceToPickup,
      vendorOrganizationId,
      buyerOrganizationId,
      creatorOrganizationId,
      isCreatorLoggedIn,
    };

    return purchaseOrder;
  }

  private parseNumber(rawNumber: string): number {
    const rawNumberWithDecimalSeparator = rawNumber.replace(',', '.');
    const rawNumberWithDecimalSeparatorAndSpaces =
      rawNumberWithDecimalSeparator.replace(/\s/g, '');
    const number = Number(rawNumberWithDecimalSeparatorAndSpaces);
    return number;
  }

  private logError(...args: unknown[]): void {
    if (!environment.production) {
      console.error(...args);
    }
  }
}

/**
 * new Set([
    "Id",
    "Number",
    "Timestamp",
    "Due date",
    "",
    "_1",
    "Uniq items ordered",
    "Amount excluding taxes (CAD)",
    "Amount including taxes (CAD)",
    "Status",
    "Distribution mode",
    "Delivery date",
    "Delivery fees (CAD)",
    "Distance to pickup (km)",
    "Vendor organization id",
    "_2",
    "Buyer organization id",
    "_3",
    "Creator organization id",
    "_4",
    "Creator logged in"
])
 */
