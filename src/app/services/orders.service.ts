import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../environment';
import {
  Order,
  ORDER_DISTRIBUTION_MODES,
  OrderDistributionMode,
  OrderStatus,
} from '../models/orders.model';
import { CsvService } from './csv.service';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private readonly CANCELLED_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Cancelled.csv';
  private readonly COMPLETED_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Completed.csv';
  private readonly CONFIRMED_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Confirmed.csv';
  private readonly DELIVERED_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Delivered.csv';
  private readonly PAID_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Paid.csv';
  private readonly SUBMITTED_ORDERS_FILE_PATH =
    'data/dataset-arrivage-orders - Submitted.csv';

  private readonly ORDERS_LOCAL_STORAGE_KEY =
    'arrivage-data-visualization/orders';

  private readonly _isInitializedSignal: WritableSignal<boolean> =
    signal(false);

  private _orders: Order[] = [];

  constructor(private readonly csvService: CsvService) {
    void this.loadOrders();
  }

  get isInitializedSignal(): WritableSignal<boolean> {
    return this._isInitializedSignal;
  }

  get orders(): Order[] {
    return this._orders;
  }

  async resetOrders(): Promise<void> {
    localStorage.removeItem(this.ORDERS_LOCAL_STORAGE_KEY);

    this._orders = [];

    await this.loadOrders();
  }

  private async loadOrders() {
    this.isInitializedSignal.set(false);

    if (!this.getFromLocalStorage()) {
      const cancelledOrders = await this.loadOrdersFromFile(
        this.CANCELLED_ORDERS_FILE_PATH,
        'cancelled'
      );
      const completedOrders = await this.loadOrdersFromFile(
        this.COMPLETED_ORDERS_FILE_PATH,
        'completed'
      );
      const confirmedOrders = await this.loadOrdersFromFile(
        this.CONFIRMED_ORDERS_FILE_PATH,
        'confirmed'
      );
      const deliveredOrders = await this.loadOrdersFromFile(
        this.DELIVERED_ORDERS_FILE_PATH,
        'delivered'
      );
      const paidOrders = await this.loadOrdersFromFile(
        this.PAID_ORDERS_FILE_PATH,
        'paid'
      );
      const submittedOrders = await this.loadOrdersFromFile(
        this.SUBMITTED_ORDERS_FILE_PATH,
        'submitted'
      );

      this._orders = this.mergeOrders(cancelledOrders, completedOrders);
      this._orders = this.mergeOrders(this._orders, confirmedOrders);
      this._orders = this.mergeOrders(this._orders, deliveredOrders);
      this._orders = this.mergeOrders(this._orders, paidOrders);
      this._orders = this.mergeOrders(this._orders, submittedOrders);

      this.setToLocalStorage();
    }

    this._isInitializedSignal.set(true);
  }

  private getFromLocalStorage(): boolean {
    const orders = localStorage.getItem(this.ORDERS_LOCAL_STORAGE_KEY);

    if (orders === null || orders === '') {
      return false;
    }

    const parsedOrders = JSON.parse(orders) as Order[];

    const mappedOrders = parsedOrders.map((order: Order) => {
      const dateAddedToSpreadsheet = new Date(order.dateAddedToSpreadsheet);
      const dueDate = new Date(order.dueDate);
      const distributionDate = new Date(order.distributionDate);

      return {
        ...order,
        dateAddedToSpreadsheet,
        dueDate,
        distributionDate,
      };
    });

    this._orders = mappedOrders;

    return true;
  }

  private setToLocalStorage(): void {
    localStorage.setItem(
      this.ORDERS_LOCAL_STORAGE_KEY,
      JSON.stringify(this._orders)
    );
  }

  private mergeOrders(first: Order[], second: Order[]): Order[] {
    const mergedOrders = [...first];

    second.forEach(order => {
      // Find if the order already exists in the first array
      const existingOrder = first.find(o => o.id === order.id);

      if (existingOrder) {
        const allStatuses = Array.from(
          new Set([...existingOrder.allStatuses, ...order.allStatuses])
        );

        // Keep the most recent order
        if (
          order.dateAddedToSpreadsheet > existingOrder.dateAddedToSpreadsheet
        ) {
          order.allStatuses = allStatuses;
          mergedOrders.splice(mergedOrders.indexOf(existingOrder), 1, order);
        } else {
          existingOrder.allStatuses = allStatuses;
        }

        return;
      }

      mergedOrders.push(order);
    });
    return mergedOrders;
  }

  private async loadOrdersFromFile(
    filePath: string,
    status: OrderStatus
  ): Promise<Order[]> {
    const rawOrders = await this.csvService.loadCsvData(filePath);

    const orders: Order[] = rawOrders
      .map(order => this.extractOrder(order))
      .filter((order): order is Order => order !== null)
      // Remove duplicates id
      .filter((order, index, orders) => {
        const allOrdersWithSameId = orders.filter(o => o.id === order.id);
        const isDuplicate = allOrdersWithSameId.length > 1;
        if (isDuplicate) {
          this.logError('Duplicate order id found:', order.id);
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

    orders.forEach(order => order.allStatuses.push(status));

    return orders;
  }

  private extractOrder(rawOrder: Record<string, string>): Order | null {
    const id = rawOrder['Id'];
    if (id === undefined || id === '') {
      this.logError('Id is missing in order', rawOrder);
      return null;
    }

    const number = rawOrder['Number'];
    if (number === undefined) {
      this.logError('Number is missing in order', rawOrder);
      return null;
    }

    const rawDateAddedToSpreadsheet = rawOrder['Timestamp'];
    if (
      rawDateAddedToSpreadsheet === undefined ||
      rawDateAddedToSpreadsheet === ''
    ) {
      this.logError('Timestamp is missing in order', rawOrder);
      return null;
    }
    const dateAddedToSpreadsheet = new Date(rawDateAddedToSpreadsheet);
    if (isNaN(dateAddedToSpreadsheet.getTime())) {
      this.logError('Timestamp is not a valid date', rawOrder);
      return null;
    }

    const rawDueDate = rawOrder['Due date'];
    if (rawDueDate === undefined || rawDueDate === '') {
      this.logError('Due date is missing in order', rawOrder);
      return null;
    }
    const dueDate = new Date(rawDueDate);
    if (isNaN(dueDate.getTime())) {
      this.logError('Due date is not a valid date', rawOrder);
      return null;
    }

    const rawUniqueItemsOrdered = rawOrder['Uniq items ordered'];
    if (rawUniqueItemsOrdered === undefined || rawUniqueItemsOrdered === '') {
      this.logError('Unique items ordered is missing in order', rawOrder);
      return null;
    }
    const uniqueItemsOrdered = Number(rawUniqueItemsOrdered);
    if (isNaN(uniqueItemsOrdered)) {
      this.logError('Unique items ordered is not a valid number', rawOrder);
      return null;
    }

    const rawTotalAmountWithoutTaxes = rawOrder['Amount excluding taxes (CAD)'];
    if (
      rawTotalAmountWithoutTaxes === undefined ||
      rawTotalAmountWithoutTaxes === ''
    ) {
      this.logError('Total amount without taxes is missing in order', rawOrder);
      return null;
    }
    const totalAmountWithoutTaxes = this.parseNumber(
      rawTotalAmountWithoutTaxes
    );
    if (isNaN(totalAmountWithoutTaxes)) {
      this.logError(
        'Total amount without taxes is not a valid number',
        rawOrder
      );
      return null;
    }

    const rawTotalAmountWithTaxes = rawOrder['Amount including taxes (CAD)'];
    if (
      rawTotalAmountWithTaxes === undefined ||
      rawTotalAmountWithTaxes === ''
    ) {
      this.logError('Total amount with taxes is missing in order', rawOrder);
      return null;
    }
    const totalAmountWithTaxes = this.parseNumber(rawTotalAmountWithTaxes);
    if (isNaN(totalAmountWithTaxes)) {
      this.logError('Total amount with taxes is not a valid number', rawOrder);
      return null;
    }

    const allStatuses: OrderStatus[] = [];

    const rawDistributionMode: string = rawOrder['Distribution mode'];
    if (rawDistributionMode === undefined || rawDistributionMode === '') {
      this.logError('Distribution mode is missing in order', rawOrder);
      return null;
    }
    const distributionMode = rawDistributionMode as OrderDistributionMode;
    if (!ORDER_DISTRIBUTION_MODES.includes(distributionMode)) {
      this.logError('Distribution mode is not valid', rawOrder);
      return null;
    }

    const rawDistributionDate = rawOrder['Delivery date'];
    if (rawDistributionDate === undefined || rawDistributionDate === '') {
      this.logError('Delivery date is missing in order', rawOrder);
      return null;
    }
    const distributionDate = new Date(rawDistributionDate);
    if (isNaN(distributionDate.getTime())) {
      this.logError('Delivery date is not a valid date', rawOrder);
      return null;
    }

    const rawDeliveryFees = rawOrder['Delivery fees (CAD)'];
    if (rawDeliveryFees === undefined) {
      this.logError('Delivery fees are missing in order', rawOrder);
      return null;
    }
    let deliveryFees = Number(rawDeliveryFees);
    if (isNaN(deliveryFees)) {
      deliveryFees = 0;
    }

    const rawDistanceToPickup = rawOrder['Distance to pickup (km)'];
    if (rawDistanceToPickup === undefined) {
      this.logError('Distance to pickup is missing in order', rawOrder);
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
      //   rawOrder
      // );
      // return null;
      distanceToPickup = 0;
    } else {
      distanceToPickup = 0;
    }

    const vendorOrganizationId = rawOrder['Vendor organization id'];
    if (vendorOrganizationId === undefined || vendorOrganizationId === '') {
      this.logError('Vendor organization id is missing in order', rawOrder);
      return null;
    }

    const rawIsCreatorLoggedIn = rawOrder['Creator logged in'];
    if (rawIsCreatorLoggedIn === undefined || rawIsCreatorLoggedIn === '') {
      this.logError('Creator logged in is missing in order', rawOrder);
      return null;
    }
    const isCreatorLoggedIn = rawIsCreatorLoggedIn === 'TRUE';

    const creatorOrganizationId = rawOrder['Creator organization id'];
    if (
      creatorOrganizationId === undefined ||
      (isCreatorLoggedIn && creatorOrganizationId === '')
    ) {
      this.logError('Creator organization id is missing in order', rawOrder);
      return null;
    }

    let buyerOrganizationId = rawOrder['Buyer organization id'];
    if (
      buyerOrganizationId === undefined ||
      (isCreatorLoggedIn &&
        buyerOrganizationId === '' &&
        (creatorOrganizationId === '' ||
          creatorOrganizationId === buyerOrganizationId))
    ) {
      this.logError('Buyer organization id is missing in order', rawOrder);
      return null;
    }
    if (isCreatorLoggedIn && buyerOrganizationId === '') {
      buyerOrganizationId = creatorOrganizationId;
    }

    const order: Order = {
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

    return order;
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
