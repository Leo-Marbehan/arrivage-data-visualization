/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
// import { OrderVisualizationChartComponent } from '../order-visualization-chart/order-visualization-chart.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { LoadingService } from '../../services/loading.service';
import * as d3 from 'd3';
import { Order } from '../../models/orders.model';
import { MatRadioModule } from '@angular/material/radio';

enum ShownData {
  DISTANCES = 'distance',
  AMOUNTS = 'amount',
  TAXED_AMOUNTS = 'tax_amount',
  NBR_ORDERS = 'nbr_orders',
}

interface DataPoint {
  source: string;
  target: string;
  distance: number;
  amount: number;
  tax_amount: number;
  nbr_orders: number;
}

// POUR LA REMISE FINALE
// TODO: Mettre les rubans "loopback" (donc qui reviennet à l'arc de départ) au centre
// TODO: Avoir les informations affichées en fonction de la position de la souris
// TODO: Appliquer d'avantage le code
// TODO: Mettre un option de valeur minimale pour les échanges

// POUR LA BÊTA (8h)
// DONE: 1. Aller chercher les vraies données (40 min)
// DONE: 2. Mettre des boutons pour alterner entre ces données (1h20m in)
// DONE: 3. Quand on clique sur un arc, on l'explose en sous-régions (4h)
// DONE: 4. Quand on hover par dessus un arc, changer la couleure à rouge (40 min)
// TODO: 5. Mettre une échelle (1h20 min)
// DONE: 6. Régler le bug quand ça load
@Component({
  selector: 'app-visualization-3-page',
  standalone: true,
  imports: [CommonModule, ToolbarComponent, MatRadioModule],
  templateUrl: './visualization-3-page.component.html',
  styleUrl: './visualization-3-page.component.scss',
})
export class Visualization3PageComponent implements OnInit {
  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService,
    private loadingService: LoadingService
  ) {}

  is_data_loaded = false;

  // the data
  // région à région: nbr_régions * nbr_régions = 13 * 13 = 169
  // sousrégion à région: nbr_sous_régions * nbr_régions * 2 = 120 * 13 * 2 = 3120
  // sousrégion à sous-région d'une même région: nbr_sous_régions_moyen_par_région^2 * nbr_régions
  // total = 169 + 3120 = 3289, ce qui rend la génération statique complète de cet objet réaliste
  data: DataPoint[] | null = null;
  // A list of the relevant regions and subregions in order of apparition
  names: string[] | null = null;
  // An mapping of names to indexes
  indexes: Map<string, number> | null = null;
  // The matrix of values
  matrix: number[][] | null = null;
  // The name of the region if expanded and null if no region is expanded
  expanded_region: string | null = null;
  // the index at the start of the expanded region
  subregions_start: number | null = null;
  // Type of shown data
  shown_data: ShownData = ShownData.AMOUNTS;
  // Show what subregions a regions has
  region_to_subregions: Map<string, string[]> | null = null;
  // Show existing regions
  regions: string[] | null = null;
  // colors
  colors: string[] | null = null;

  ngOnInit() {
    this.initialize()
      .then(() => {
        this.initialize_data();
        this.createVisualization();
      })
      .catch(error => {
        console.log(error);
      });
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
        resolve();
      }
    }, 100);
    return promise;
  }

  createVisualization() {
    d3.select('#data-type-toggle').style('display', 'flex');
    d3.select('#subregion-toggle').style('display', 'flex');
    const angle_padding = (Math.PI * 2 * (60 / 360)) / this.names!.length;
    const height = window.innerHeight - 70;
    const width = height;
    const innerRadius = width / 3;
    const outerRadius = innerRadius + 10;
    const chord = d3
      .chordDirected()
      .padAngle(angle_padding)
      .sortSubgroups(d3.descending);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);

    const ribbon = d3
      .ribbonArrow()
      .headRadius(10)
      .radius(innerRadius - 0.2)
      .padAngle(Math.PI * 2 * (0.1 / 360));

    const svg = d3
      .select('#diagramme')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('style', 'font: 10px sans-serif;');

    const chords = chord(this.matrix!);

    const group = svg.append('g').selectAll().data(chords.groups).join('g');

    group
      .append('path')
      .classed('arc', true)
      .attr('fill', d => this.colors![d.index])
      .attr('d', d =>
        String(
          arc({
            ...d,
            innerRadius: innerRadius - 1,
            outerRadius: outerRadius,
          } as d3.DefaultArcObject)
        )
      )
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        d3.select(event.currentTarget).attr('fill', 'red');
        d3.selectAll('.ribbon').attr('fill', d2 =>
          d1.index === (d2 as any).source.index
            ? 'red'
            : this.colors![(d2 as any).source.index]
        );
      })
      .on('mouseout', (event, d1) => {
        d3.select(event.currentTarget).attr('fill', this.colors![d1.index]);
        d3.selectAll('.ribbon').attr(
          'fill',
          d2 => this.colors![(d2 as any).source.index]
        );
      });

    group
      .append('text')
      .each(d => ((d as any).angle = (d.startAngle + d.endAngle) / 2))
      .attr(
        'transform',
        d => `
          rotate(${((d as any).angle * 180) / Math.PI - 90})
          translate(${outerRadius + 35})
          ${(d as any).angle > Math.PI ? 'rotate(180)' : ''}
        `
      )
      .attr('text-anchor', d => ((d as any).angle > Math.PI ? 'end' : 'start'))
      .text(d => this.names![d.index])
      .attr('fill', d2 => this.colors![(d2 as any).index])
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        d3.select(event.currentTarget).attr('fill', 'red');
        d3.selectAll('.ribbon').attr('fill', d2 =>
          d1.index === (d2 as any).source.index
            ? 'red'
            : this.colors![(d2 as any).source.index]
        );
        d3.selectAll('.arc').attr('fill', d2 =>
          d1.index === (d2 as any).index
            ? 'red'
            : this.colors![(d2 as any).index]
        );
      })
      .on('mouseout', (event, d1) => {
        d3.select(event.currentTarget).attr('fill', this.colors![d1.index]);
        d3.selectAll('.ribbon').attr(
          'fill',
          d2 => this.colors![(d2 as any).source.index]
        );
        d3.selectAll('.arc').attr(
          'fill',
          d2 => this.colors![(d2 as any).index]
        );
      });

    svg
      .append('g')
      .attr('fill-opacity', 0.75)
      .selectAll()
      .data(chords)
      .join('path')
      .classed('ribbon', true)
      .attr('fill', d => this.colors![d.source.index])
      .attr('d', d =>
        String(
          ribbon({
            source: {
              ...d.source,
              radius: 600,
            },
            target: {
              ...d.target,
              radius: 600,
            },
          } as d3.Ribbon)
        )
      )
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        d3.selectAll('.ribbon').attr('fill', d2 =>
          d1.source.index === (d2 as any).source.index
            ? 'red'
            : this.colors![(d2 as any).source.index]
        );
        d3.selectAll('.arc').attr('fill', d2 =>
          d1.source.index === (d2 as any).index
            ? 'red'
            : this.colors![(d2 as any).index]
        );
      })
      .on('mouseout', (event, d1) => {
        d3.selectAll('.ribbon').attr(
          'fill',
          d2 => this.colors![(d2 as any).source.index]
        );
        d3.selectAll('.arc').attr(
          'fill',
          d2 => this.colors![(d2 as any).index]
        );
      });

    function groupTicks(d: d3.ChordGroup, step: number | undefined) {
      const k = (d.endAngle - d.startAngle) / d.value;
      return d3.range(0, d.value, step).map(value => {
        return { value: value, angle: value * k + d.startAngle };
      });
    }
    // const sum = d3.sum(data.flat());
    const sum = this.data?.map(d => d[this.shown_data]).reduce((a, b) => a + b);
    const tickStep = d3.tickStep(0, sum!, 200);
    const tickStepMajor = d3.tickStep(0, sum!, 20);
    const formatValue = d3.formatPrefix(',.0', tickStep);

    const groupTick = group
      .append('g')
      .selectAll()
      .data(d => groupTicks(d, tickStep))
      .join('g')
      .attr(
        'transform',
        d =>
          `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${outerRadius},0)`
      );

    groupTick.append('line').attr('stroke', 'currentColor').attr('x2', 6);

    groupTick
      .filter(d => d.value % tickStepMajor === 0)
      .append('text')
      .attr('x', 8)
      .attr('dy', '.35em')
      .attr('transform', d =>
        d.angle > Math.PI ? 'rotate(180) translate(-16)' : null
      )
      .attr('text-anchor', d => (d.angle > Math.PI ? 'end' : null))
      .text(d => formatValue(d.value));
  }

  initialize_data() {
    // sets this.data
    this.generate_names_and_data();
    // sets this.names
    this.names = [...this.regions!];
    // sets this.colors
    this.colors = d3.quantize(d3.interpolateRainbow, this.names.length);
    // sets this.indexes
    this.update_indexes();
    // sets this.matrix
    this.generate_matrix();
    // we are now ready to show the diagram
    this.is_data_loaded = true;
  }

  update_indexes() {
    this.indexes = new Map(this.names!.map((name, i) => [name, i]));
  }

  generate_names_and_data() {
    const data: DataPoint[] = [];
    const regions = new Set<string>();
    const regions_to_subregions = new Map<string, Set<string>>([]);
    let nbr_lost_organisations = 0;

    const create_or_update_relation = (
      source: string,
      target: string,
      order: Order
    ) => {
      const existing_relation = data.find(
        dp => dp.source == source && dp.target == target
      );
      if (existing_relation) {
        existing_relation.amount += order.totalAmountWithoutTaxes;
        existing_relation.distance += order.distanceToPickup;
        existing_relation.tax_amount += order.totalAmountWithTaxes;
        existing_relation.nbr_orders += 1;
        return true;
      } else {
        const new_relation: DataPoint = {
          source,
          target,
          distance: order.distanceToPickup,
          amount: order.totalAmountWithoutTaxes,
          tax_amount: order.totalAmountWithTaxes,
          nbr_orders: 1,
        };
        data.push(new_relation);
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

    this.data = data;
    this.regions = [...regions];
    this.region_to_subregions = new Map(
      [...regions_to_subregions.keys()].map(key => [
        key,
        [...regions_to_subregions.get(key)!],
      ])
    );
  }

  toggle_data_subregions() {
    // TODO: Insert or remove region of names
    this.generate_matrix();
  }

  generate_matrix() {
    this.matrix = Array.from(this.indexes!, () =>
      new Array(this.names!.length).fill(0)
    );

    for (const point of this.data!) {
      const source = point.source;
      const target = point.target;
      const value = point[this.shown_data];
      if (this.names!.includes(source) && this.names!.includes(target)) {
        this.matrix[Number(this.indexes!.get(source))][
          Number(this.indexes!.get(target))
        ] += value;
      }
    }
  }

  change_shown_data(new_data_type: ShownData) {
    if (new_data_type != this.shown_data) {
      this.shown_data = new_data_type;
      this.generate_matrix();
      d3.select('#diagramme').select('svg').remove();
      this.createVisualization();
    }
  }

  subregions_in(region: string) {
    const relevant_subregions = this.region_to_subregions!.get(region)!;
    const region_index = this.indexes!.get(region)!;
    const remove_one_and_insert_many = (
      array: string[],
      elements: string[]
    ) => {
      array.splice(region_index, 1);
      array.splice(region_index, 0, ...elements);
    };
    const color = this.colors![region_index];
    const colors = new Array<string>(relevant_subregions.length).fill(color);
    remove_one_and_insert_many(this.names!, relevant_subregions);
    remove_one_and_insert_many(this.colors!, colors);

    this.subregions_start = region_index!;
    this.update_indexes();
    this.expanded_region = region;
  }

  subregions_out() {
    const relevant_subregions = this.region_to_subregions!.get(
      this.expanded_region!
    )!;
    const remove_many_and_insert_one = (array: string[], element: string) => {
      array.splice(this.subregions_start!, relevant_subregions.length);
      array.splice(this.subregions_start!, 0, element);
    };
    const color = this.colors![this.subregions_start!];
    remove_many_and_insert_one(this.names!, this.expanded_region!);
    remove_many_and_insert_one(this.colors!, color);

    this.update_indexes();
    this.expanded_region = null;
  }

  toggle_expanded_region(region: string) {
    if (region != this.expanded_region) {
      if (this.expanded_region) this.subregions_out();
      this.subregions_in(region);
    } else {
      this.subregions_out();
    }
    this.generate_matrix();
    d3.select('#diagramme').select('svg').remove();
    this.createVisualization();
  }
}
