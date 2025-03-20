import { Injectable, signal, WritableSignal } from '@angular/core';
import {
  BuyerOrganization,
  Language,
  mapBuyerOrganizationCategory,
  mapVendorProductCategory,
  Organization,
  RAW_VENDOR_PRODUCT_CATEGORIES,
  VendorOrganization,
  VendorProductCategory,
} from '../models/organizations.model';
import { CsvService } from './csv.service';

@Injectable({
  providedIn: 'root',
})
export class OrganizationsService {
  private readonly VENDORS_FILE_PATH =
    'data/dataset-arrivage-organizations - DB_VENDORS.csv';
  private readonly BUYERS_PRO_FILE_PATH =
    'data/dataset-arrivage-organizations - DB_BUYERS_PRO.csv';
  private readonly BUYERS_NOT_PRO_FILE_PATH =
    'data/dataset-arrivage-organizations - DB_BUYERS_NOPRO.csv';

  private readonly _isInitializedSignal: WritableSignal<boolean> =
    signal(false);

  private _vendorOrganizations: VendorOrganization[] = [];
  private _buyerOrganizations: BuyerOrganization[] = [];

  constructor(private readonly csvService: CsvService) {
    void this.loadOrganizations();
  }

  get isInitializedSignal(): WritableSignal<boolean> {
    return this._isInitializedSignal;
  }

  get vendorOrganizations(): VendorOrganization[] {
    return this._vendorOrganizations;
  }

  get buyerOrganizations(): BuyerOrganization[] {
    return this._buyerOrganizations;
  }

  get proBuyerOrganizations(): BuyerOrganization[] {
    return this._buyerOrganizations.filter(buyer => buyer.isPro);
  }

  get notProBuyerOrganizations(): BuyerOrganization[] {
    return this._buyerOrganizations.filter(buyer => !buyer.isPro);
  }

  get organizations(): Organization[] {
    return [...this._vendorOrganizations, ...this._buyerOrganizations];
  }

  private async loadOrganizations() {
    const vendorOrganizations = await this.loadVendors();
    const proBuyerOrganizations = await this.loadBuyersPro();
    const notProBuyerOrganizations = await this.loadBuyersNotPro();

    this._vendorOrganizations = vendorOrganizations;

    this._buyerOrganizations = [
      ...proBuyerOrganizations,
      ...notProBuyerOrganizations,
    ];

    this._isInitializedSignal.set(true);
  }

  private async loadVendors(): Promise<VendorOrganization[]> {
    const rawVendors = await this.csvService.loadCsvData(
      this.VENDORS_FILE_PATH
    );

    return rawVendors
      .map((rawVendor, index) => {
        return this.extractVendorOrganization(rawVendor, index);
      })
      .filter((vendor): vendor is VendorOrganization => vendor !== null);
  }

  private async loadBuyersPro(): Promise<BuyerOrganization[]> {
    const rawBuyersPro = await this.csvService.loadCsvData(
      this.BUYERS_PRO_FILE_PATH
    );

    return rawBuyersPro
      .map((rawBuyerPro, index) => {
        return this.extractBuyerOrganization(rawBuyerPro, 'Buyer pro', index);
      })
      .filter((buyerPro): buyerPro is BuyerOrganization => buyerPro !== null);
  }

  private async loadBuyersNotPro(): Promise<BuyerOrganization[]> {
    const rawBuyersNotPro = await this.csvService.loadCsvData(
      this.BUYERS_NOT_PRO_FILE_PATH
    );

    return rawBuyersNotPro
      .map((rawBuyerNotPro, index) => {
        return this.extractBuyerOrganization(
          rawBuyerNotPro,
          'Buyer not pro',
          index
        );
      })
      .filter(
        (buyerNotPro): buyerNotPro is BuyerOrganization => buyerNotPro !== null
      );
  }

  private extractVendorOrganization(
    rawVendorOrganization: Record<string, string>,
    index: number
  ): VendorOrganization | null {
    const organization = this.extractOrganization(
      rawVendorOrganization,
      'Vendor',
      index
    );
    if (organization === null) {
      return null;
    }

    const productCategories: VendorProductCategory[] = [];
    for (const rawCategory of RAW_VENDOR_PRODUCT_CATEGORIES) {
      if (
        rawVendorOrganization[rawCategory] !== undefined &&
        rawVendorOrganization[rawCategory] !== ''
      ) {
        try {
          productCategories.push(mapVendorProductCategory(rawCategory));
        } catch (_error) {
          console.error(
            `Vendor product category ${rawCategory} is invalid for index`,
            index
          );
          return null;
        }
      }
    }

    const vendorOrganization: VendorOrganization = {
      ...organization,
      productCategories,
    };

    return vendorOrganization;
  }

  private extractBuyerOrganization(
    rawBuyerOrganization: Record<string, string>,
    type: 'Buyer pro' | 'Buyer not pro',
    index: number
  ): BuyerOrganization | null {
    const organization = this.extractOrganization(
      rawBuyerOrganization,
      type,
      index
    );
    if (organization === null) {
      return null;
    }

    const rawCategory = rawBuyerOrganization['org_cat'];
    if (rawCategory === undefined || rawCategory === '') {
      console.error(type, 'category is missing for index', index);
      return null;
    }
    let category;
    try {
      category = mapBuyerOrganizationCategory(rawCategory);
    } catch (_error) {
      console.error(type, 'category is invalid for index', index);
      return null;
    }

    const buyerOrganization: BuyerOrganization = {
      ...organization,
      category,
      isPro: type === 'Buyer pro',
    };

    return buyerOrganization;
  }

  private extractOrganization(
    rawOrganization: Record<string, string>,
    type: 'Vendor' | 'Buyer pro' | 'Buyer not pro',
    index: number
  ): Organization | null {
    const id = rawOrganization['unique_id'];
    if (id === undefined) {
      console.error(type, 'id is missing for index', index);
      return null;
    }

    const language: Language = rawOrganization['lang'] as Language;
    if (language === undefined || (language as string) === '') {
      console.error(type, 'language is missing for index', index);
      return null;
    }
    if (language !== 'fr' && language !== 'en') {
      console.error(type, 'language is invalid for index', index);
      return null;
    }

    const country = rawOrganization['country'];
    if (country === undefined || country === '') {
      console.error(type, 'country is missing for index', index);
      return null;
    }

    const province = rawOrganization['province'];
    if (province === undefined || province === '') {
      console.error(type, 'province is missing for index', index);
      return null;
    }

    const region = rawOrganization['region'];
    if (region === undefined || region === '') {
      console.error(type, 'region is missing for index', index);
      return null;
    }

    const subRegion = rawOrganization['sous-region'];
    if (subRegion === undefined || subRegion === '') {
      console.error(type, 'sub region is missing for index', index);
      return null;
    }

    const city = rawOrganization['city'];
    if (city === undefined || city === '') {
      console.error(type, 'city is missing for index', index);
      return null;
    }

    const rawCreationTimestamp = rawOrganization['timestamp_creation'];
    if (rawCreationTimestamp === undefined || rawCreationTimestamp === '') {
      console.error(type, 'creation timestamp is missing for index', index);
      return null;
    }
    const creationTimestamp = new Date(rawCreationTimestamp);
    if (isNaN(creationTimestamp.getTime())) {
      console.error(type, 'creation timestamp is invalid for index', index);
      return null;
    }

    const organization: Organization = {
      id,
      language,
      country,
      province,
      region,
      subRegion,
      city,
      creationTimestamp,
    };

    return organization;
  }
}
