import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  input,
  InputSignal,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BuyerOrganization,
  isBuyerOrganization,
  isVendorOrganization,
  Organization,
  translateBuyerOrganizationCategory,
  translateVendorProductCategory,
  VendorOrganization,
} from '../../models/organizations.model';

type SortColumn = keyof Omit<
  VendorOrganization & BuyerOrganization,
  'productCategories'
>;

@Component({
  selector: 'app-organizations-table',
  imports: [
    MatDividerModule,
    MatTooltipModule,
    MatIconModule,
    NgTemplateOutlet,
  ],
  templateUrl: './organizations-table.component.html',
  styleUrl: './organizations-table.component.scss',
})
export class OrganizationsTableComponent {
  readonly organizationsInputSignal: InputSignal<Organization[]> =
    input.required({
      alias: 'organizations',
    });

  readonly sortedOrganizationsSignal: Signal<Organization[]> = computed(() => {
    const organizations = this.organizationsInputSignal();
    const sort = this.sortSignal();
    if (sort === null) {
      return organizations;
    }

    const multiplier = sort.direction === 'asc' ? 1 : -1;

    switch (sort.column) {
      case 'id':
      case 'language':
      case 'country':
      case 'province':
      case 'region':
      case 'subRegion':
      case 'city':
        return organizations.sort((a, b) => {
          const aValue: string = a[sort.column as keyof Organization] as string;
          const bValue: string = b[sort.column as keyof Organization] as string;
          return aValue.localeCompare(bValue) * multiplier;
        });
      case 'creationTimestamp':
        return organizations.sort(
          (a, b) =>
            (a.creationTimestamp.getTime() - b.creationTimestamp.getTime()) *
            multiplier
        );
      case 'category':
        return organizations.sort((a, b) => {
          const aCategory = isBuyerOrganization(a) ? a.category : '';
          const bCategory = isBuyerOrganization(b) ? b.category : '';
          return aCategory.localeCompare(bCategory) * multiplier;
        });
      case 'isPro':
        return organizations.sort((a, b) => {
          const aIsPro = isBuyerOrganization(a) ? a.isPro : false;
          const bIsPro = isBuyerOrganization(b) ? b.isPro : false;
          return (aIsPro === bIsPro ? 0 : aIsPro ? 1 : -1) * multiplier;
        });
    }
  });

  readonly sortSignal: WritableSignal<{
    column: SortColumn;
    direction: 'asc' | 'desc';
  } | null> = signal(null);

  getVendorOrganization(organization: Organization): VendorOrganization | null {
    return isVendorOrganization(organization) ? organization : null;
  }

  getBuyerOrganization(organization: Organization): BuyerOrganization | null {
    return isBuyerOrganization(organization) ? organization : null;
  }

  getVendorProductCategories(vendorOrganization: VendorOrganization): string {
    return vendorOrganization.productCategories
      .map(translateVendorProductCategory)
      .join(', ');
  }

  getBuyerOrganizationCategory(buyerOrganization: BuyerOrganization): string {
    return translateBuyerOrganizationCategory(buyerOrganization.category);
  }

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

  cssClassToSortColumn(column: string): SortColumn {
    switch (column) {
      case 'id':
      case 'language':
      case 'country':
      case 'province':
      case 'region':
      case 'city':
        return column as SortColumn;
      case 'sub-region':
        return 'subRegion';
      case 'creation-timestamp':
        return 'creationTimestamp';
      case 'buyer-organization-category':
        return 'category';
      case 'is-pro':
        return 'isPro';
      default:
        throw new Error(`Unknown column: ${column}`);
    }
  }
}
