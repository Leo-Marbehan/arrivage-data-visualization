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

export type SortColumn =
  | 'id'
  | 'language'
  | 'country'
  | 'province'
  | 'region'
  | 'subRegion'
  | 'city'
  | 'creationTimestamp'
  | 'buyerOrganizationCategory'
  | 'isPro';

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
    if (!sort) {
      return organizations;
    }

    const multiplier = sort.direction === 'asc' ? 1 : -1;

    switch (sort.column) {
      case 'id':
        return organizations.sort(
          (a, b) => a.id.localeCompare(b.id) * multiplier
        );
      case 'language':
        return organizations.sort(
          (a, b) => a.language.localeCompare(b.language) * multiplier
        );
      case 'country':
        return organizations.sort(
          (a, b) => a.country.localeCompare(b.country) * multiplier
        );
      case 'province':
        return organizations.sort(
          (a, b) => a.province.localeCompare(b.province) * multiplier
        );
      case 'region':
        return organizations.sort(
          (a, b) => a.region.localeCompare(b.region) * multiplier
        );
      case 'subRegion':
        return organizations.sort(
          (a, b) => a.subRegion.localeCompare(b.subRegion) * multiplier
        );
      case 'city':
        return organizations.sort(
          (a, b) => a.city.localeCompare(b.city) * multiplier
        );
      case 'creationTimestamp':
        return organizations.sort(
          (a, b) =>
            (a.creationTimestamp.getTime() - b.creationTimestamp.getTime()) *
            multiplier
        );
      case 'buyerOrganizationCategory':
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
        return 'id';
      case 'language':
        return 'language';
      case 'country':
        return 'country';
      case 'province':
        return 'province';
      case 'region':
        return 'region';
      case 'sub-region':
        return 'subRegion';
      case 'city':
        return 'city';
      case 'creation-timestamp':
        return 'creationTimestamp';
      case 'buyer-organization-category':
        return 'buyerOrganizationCategory';
      case 'is-pro':
        return 'isPro';
      default:
        throw new Error(`Unknown column: ${column}`);
    }
  }
}
