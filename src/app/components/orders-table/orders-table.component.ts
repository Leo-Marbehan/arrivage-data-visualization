import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  input,
  InputSignal,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Order,
  translateOrderDistributionMode,
  translateOrderStatus,
} from '../../models/orders.model';

type SortColumn = keyof Omit<Order, 'allStatuses'>;

@Component({
  selector: 'app-orders-table',
  imports: [
    MatDividerModule,
    MatTooltipModule,
    MatIconModule,
    NgTemplateOutlet,
    MatPaginatorModule,
  ],
  templateUrl: './orders-table.component.html',
  styleUrl: './orders-table.component.scss',
})
export class OrdersTableComponent {
  readonly PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500];
  readonly INITIAL_PAGE_SIZE = 10;

  readonly ordersInputSignal: InputSignal<Order[]> = input.required({
    alias: 'orders',
  });

  readonly sortedOrdersSignal: Signal<Order[]> = computed(() => {
    const orders = [...this.ordersInputSignal()];
    const sort = this.sortSignal();
    if (sort === null) {
      return orders;
    }

    const multiplier = sort.direction === 'asc' ? 1 : -1;

    switch (sort.column) {
      case 'id':
      case 'number':
      case 'vendorOrganizationId':
      case 'buyerOrganizationId':
      case 'creatorOrganizationId':
      case 'distributionMode':
        return orders.sort((a, b) => {
          const aValue: string = a[sort.column] as string;
          const bValue: string = b[sort.column] as string;
          return aValue.localeCompare(bValue) * multiplier;
        });
      case 'dateAddedToSpreadsheet':
      case 'dueDate':
      case 'distributionDate':
        return orders.sort((a, b) => {
          const aValue: Date = a[sort.column] as Date;
          const bValue: Date = b[sort.column] as Date;
          return (aValue.getTime() - bValue.getTime()) * multiplier;
        });
      case 'uniqueItemsOrdered':
      case 'totalAmountWithoutTaxes':
      case 'deliveryFees':
      case 'distanceToPickup':
      case 'totalAmountWithTaxes':
        return orders.sort((a, b) => {
          const aValue: number = a[sort.column] as number;
          const bValue: number = b[sort.column] as number;
          return (aValue - bValue) * multiplier;
        });
      case 'isCreatorLoggedIn':
        return orders.sort((a, b) => {
          const aValue: boolean = a[sort.column] as boolean;
          const bValue: boolean = b[sort.column] as boolean;
          return (aValue === bValue ? 0 : aValue ? -1 : 1) * multiplier;
        });
    }
  });

  private readonly pageIndexSignal: WritableSignal<number> = signal(0);
  private readonly pageSizeSignal: WritableSignal<number> = signal(
    this.INITIAL_PAGE_SIZE
  );

  readonly slicedOrdersSignal: Signal<Order[]> = computed(() => {
    const orders = this.sortedOrdersSignal();
    const pageIndex = this.pageIndexSignal();
    const pageSize = this.pageSizeSignal();
    const startIndex = pageIndex * pageSize;
    const endIndex = startIndex + pageSize;
    return orders.slice(startIndex, endIndex);
  });

  readonly sortSignal: WritableSignal<{
    column: SortColumn;
    direction: 'asc' | 'desc';
  } | null> = signal(null);

  sort(column: SortColumn): void {
    this.sortSignal.update(currentSort => {
      if (currentSort && currentSort.column === column) {
        if (currentSort.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        return null;
      }
      return { column, direction: 'asc' };
    });
  }

  getStatuses(order: Order): string {
    return order.allStatuses
      .map(status => translateOrderStatus(status))
      .join(', ');
  }

  getDistributionMode(order: Order): string {
    return translateOrderDistributionMode(order.distributionMode);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndexSignal.set(event.pageIndex);
    this.pageSizeSignal.set(event.pageSize);
  }

  cssClassToSortColumn(column: string): SortColumn {
    switch (column) {
      case 'id':
      case 'number':
        return column as SortColumn;
      case 'date-added-to-spreadsheet':
        return 'dateAddedToSpreadsheet';
      case 'due-date':
        return 'dueDate';
      case 'unique-items-ordered':
        return 'uniqueItemsOrdered';
      case 'total-amount-without-taxes':
        return 'totalAmountWithoutTaxes';
      case 'total-amount-with-taxes':
        return 'totalAmountWithTaxes';
      case 'distribution-mode':
        return 'distributionMode';
      case 'distribution-date':
        return 'distributionDate';
      case 'delivery-fees':
        return 'deliveryFees';
      case 'distance-to-pickup':
        return 'distanceToPickup';
      case 'vendor-organization-id':
        return 'vendorOrganizationId';
      case 'buyer-organization-id':
        return 'buyerOrganizationId';
      case 'creator-organization-id':
        return 'creatorOrganizationId';
      case 'is-creator-logged-in':
        return 'isCreatorLoggedIn';
      default:
        throw new Error(`Invalid column name: ${column}`);
    }
  }
}
