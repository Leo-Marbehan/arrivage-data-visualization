/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@angular/core';
import { DataPoint, DataType } from './visualization-3-page.model';
import { Order } from '../../models/orders.model';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';

@Injectable({
  providedIn: 'root',
})
export class Visualization3PreprocessingService {
  // the data
  // région à région: nbr_régions * nbr_régions = 13 * 13 = 169
  // sousrégion à région: nbr_sous_régions * nbr_régions * 2 = 120 * 13 * 2 = 3120
  // sousrégion à sous-région d'une même région: nbr_sous_régions_moyen_par_région^2 * nbr_régions
  // total = 169 + 3120 = 3289, ce qui rend la génération statique complète de cet objet réaliste
  private _datapoints: DataPoint[] = [];
  // Show what subregions a regions has
  private _region_to_subregions = new Map<string, string[]>([]);
  // Show existing regions
  private _regions: string[] = [];
  // Type of shown data
  private _data_type: DataType = DataType.AMOUNTS;

  // is true when all the necessary data is loaded
  private _can_start = false;

  // A list of the relevant regions and subregions in order of apparition
  private _names: string[] = [];
  // An mapping of names to indexes
  private _indexes = new Map<string, number>();
  // The matrix of values
  private _matrix: number[][] = [];
  // The name of the region if expanded and null if no region is expanded
  private _expanded_region: string | null = null;
  // the index at the start of the expanded region
  private _subregions_start: number | null = null;
  // colors
  private _colors: string[] = [];

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService
  ) {}

  get can_start() {
    return this._can_start;
  }

  get data_type() {
    return this._data_type;
  }

  get datapoints() {
    return this._datapoints;
  }

  get colors() {
    return this._colors;
  }

  get names() {
    return this._names;
  }

  get matrix() {
    return this._matrix;
  }

  get expanded_region() {
    return this._expanded_region;
  }

  get regions() {
    return this._regions;
  }

  async initialize() {
    let resolve: () => void;
    const promise = new Promise<void>(res => {
      resolve = res;
    });
    const interval = setInterval(() => {
      const can_start =
        this.ordersService.isInitializedSignal() &&
        this.organizationsService.isInitializedSignal();
      if (can_start) {
        clearInterval(interval);
        this.initialize_all_data();
        resolve();
      }
    }, 100);
    return promise;
  }

  update_data_type(data_type: DataType, on_update: () => void) {
    if (this._can_start)
      if (data_type != this._data_type) {
        this._data_type = data_type;
        this.generate_matrix();
        on_update();
      }
  }

  toggle_subregions(region: string, on_update: () => void) {
    if (this._can_start && region != this._expanded_region) {
      if (this._expanded_region) this.subregions_out();
      if (region) this.subregions_in(region);
      this.generate_matrix();
      on_update();
    }
  }

  dt_conv(datapoint: DataPoint): number {
    const key =
      Object.keys(DataType)[
        Object.values(DataType).indexOf(this._data_type)
      ].toLowerCase();
    return datapoint[key as keyof DataPoint] as number;
  }

  private initialize_all_data() {
    // sets this._datapoints
    this.generate_fixed_data();
    // sets this._names
    this._names = [...this._regions];
    // sets this._colors
    this._colors = d3.quantize(d3.interpolateRainbow, this._names.length);
    // sets this._indexes
    this.update_indexes();
    // sets this._matrix
    this.generate_matrix();
    this._can_start = true;
  }

  private update_indexes() {
    this._indexes = new Map(this._names.map((name, i) => [name, i]));
  }

  private generate_fixed_data() {
    const datapoints: DataPoint[] = [];
    const regions = new Set<string>();
    const regions_to_subregions = new Map<string, Set<string>>([]);
    let nbr_lost_organisations = 0;

    const create_or_update_relation = (
      source: string,
      target: string,
      order: Order
    ) => {
      const existing_relation = datapoints.find(
        dp => dp.source == source && dp.target == target
      );
      if (existing_relation) {
        existing_relation.amounts += order.totalAmountWithoutTaxes;
        existing_relation.distances += order.distanceToPickup;
        existing_relation.taxed_amounts += order.totalAmountWithTaxes;
        existing_relation.nbr_orders += 1;
        return true;
      } else {
        const new_relation: DataPoint = {
          source,
          target,
          distances: order.distanceToPickup,
          amounts: order.totalAmountWithoutTaxes,
          taxed_amounts: order.totalAmountWithTaxes,
          nbr_orders: 1,
        };
        datapoints.push(new_relation);
        return false;
      }
    };

    const update_region_to_subregions = (region: string, subregion: string) => {
      if (regions_to_subregions.has(region))
        regions_to_subregions.get(region)!.add(subregion);
      else regions_to_subregions.set(region, new Set<string>([subregion]));
    };

    for (const order of this.ordersService.orders) {
      const buyer_organisation =
        this.organizationsService.buyerOrganizations.find(
          org => org.id == order.buyerOrganizationId
        );
      const vendor_organisation =
        this.organizationsService.vendorOrganizations.find(
          org => org.id == order.vendorOrganizationId
        );

      if (!buyer_organisation || !vendor_organisation) {
        nbr_lost_organisations += 1;
        continue;
      }

      regions.add(buyer_organisation.region);
      regions.add(vendor_organisation.region);
      update_region_to_subregions(
        vendor_organisation.region,
        vendor_organisation.subRegion
      );
      update_region_to_subregions(
        buyer_organisation.region,
        buyer_organisation.subRegion
      );

      create_or_update_relation(
        vendor_organisation.region,
        buyer_organisation.region,
        order
      );
      create_or_update_relation(
        vendor_organisation.subRegion,
        buyer_organisation.region,
        order
      );
      create_or_update_relation(
        vendor_organisation.region,
        buyer_organisation.subRegion,
        order
      );

      if (vendor_organisation.region == buyer_organisation.region)
        create_or_update_relation(
          vendor_organisation.subRegion,
          buyer_organisation.subRegion,
          order
        );
    }
    if (nbr_lost_organisations > 0)
      console.log(`${nbr_lost_organisations} organisations were lost.`);

    this._datapoints = datapoints;
    this._regions = [...regions];
    this._region_to_subregions = new Map(
      [...regions_to_subregions.keys()].map(key => [
        key,
        [...regions_to_subregions.get(key)!],
      ])
    );
  }

  private generate_matrix() {
    // Generates zero matrix of the right shape based on existing names
    this._matrix = Array.from(this._indexes, () =>
      new Array(this._names.length).fill(0)
    );

    // Fills the matrix with data based on the present data_type
    for (const point of this._datapoints) {
      const source = point.source;
      const target = point.target;
      const value = this.dt_conv(point);
      // Not every data_point is used, so checks which ones are used in the names array
      if (this._names.includes(source) && this._names.includes(target)) {
        const source_index = Number(this._indexes.get(source));
        const target_index = Number(this._indexes.get(target));
        this._matrix[source_index][target_index] += value;
      }
    }
  }

  private subregions_in(region: string) {
    if (this._can_start)
      if (this._expanded_region === null) {
        const relevant_subregions = this._region_to_subregions.get(region)!;
        const region_index = this._indexes.get(region)!;
        const remove_one_and_insert_many = (
          array: string[],
          elements: string[]
        ) => {
          array.splice(region_index, 1);
          array.splice(region_index, 0, ...elements);
        };
        const color = this._colors[region_index];
        const colors = new Array<string>(relevant_subregions.length).fill(
          color
        );
        remove_one_and_insert_many(this._names, relevant_subregions);
        remove_one_and_insert_many(this._colors, colors);

        this._subregions_start = region_index!;
        this.update_indexes();
        this._expanded_region = region;
      }
  }

  private subregions_out() {
    if (this._can_start)
      if (this._expanded_region !== null) {
        const relevant_subregions = this._region_to_subregions.get(
          this._expanded_region
        )!;
        const remove_many_and_insert_one = (
          array: string[],
          element: string
        ) => {
          array.splice(this._subregions_start!, relevant_subregions.length);
          array.splice(this._subregions_start!, 0, element);
        };
        const color = this._colors[this._subregions_start!];
        remove_many_and_insert_one(this._names, this._expanded_region);
        remove_many_and_insert_one(this._colors, color);

        this.update_indexes();
        this._expanded_region = null;
      }
  }
}
