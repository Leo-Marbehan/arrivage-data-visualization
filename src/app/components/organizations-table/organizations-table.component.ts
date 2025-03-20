import { Component, Input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
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

@Component({
  selector: 'app-organizations-table',
  imports: [MatDividerModule, MatTooltipModule],
  templateUrl: './organizations-table.component.html',
  styleUrl: './organizations-table.component.scss',
})
export class OrganizationsTableComponent {
  @Input({ required: true }) organizations: Organization[] = [];

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
}
