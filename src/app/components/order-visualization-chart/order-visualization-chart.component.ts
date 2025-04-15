import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  signal,
  WritableSignal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { Order } from '../../models/orders.model';
import { Organization } from '../../models/organizations.model';

interface ChartData {
  id: string;
  displayName: string;
  value: number;
}

interface EntityOption {
  id: string;
  displayName: string;
}

@Component({
  selector: 'app-order-visualization-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule,
  ],
  templateUrl: './order-visualization-chart.component.html',
  styleUrl: './order-visualization-chart.component.scss',
})
export class OrderVisualizationChartComponent implements OnInit {
  @ViewChild('chart', { static: true }) private chartContainer!: ElementRef;

  private ordersService = inject(OrdersService);
  private organizationsService = inject(OrganizationsService);

  readonly viewMode: WritableSignal<'buyersByVendor' | 'vendorsByBuyer'> =
    signal('buyersByVendor');
  readonly selectedEntityId: WritableSignal<string | null> = signal(null);

  // Couleurs pour les barres
  private readonly BUYER_COLOR = '#4285F4'; // Bleu Google
  private readonly BUYER_HOVER_COLOR = '#3367D6'; // Bleu Google plus foncé
  private readonly VENDOR_COLOR = '#0F9D58'; // Vert Google
  private readonly VENDOR_HOVER_COLOR = '#0B8043'; // Vert Google plus foncé

  // Cache des noms générés pour les IDs
  private buyerNames = new Map<string, string>();
  private vendorNames = new Map<string, string>();

  // Maps des vendeurs et acheteurs ayant des commandes
  private vendorsWithOrders = new Map<string, number>();
  private buyersWithOrders = new Map<string, number>();

  // Compteurs pour la numérotation des entités
  private vendorCounter = 1;
  private buyerCounter = 1;

  // Charger tous les IDs des commandes et compter les occurrences
  private processOrdersData(): void {
    const orders = this.ordersService.orders;

    // Réinitialiser les maps
    this.vendorsWithOrders.clear();
    this.buyersWithOrders.clear();

    // Compter les commandes pour chaque vendeur et acheteur
    for (const order of orders) {
      const vendorId = order.vendorOrganizationId;
      const buyerId = order.buyerOrganizationId;

      if (vendorId) {
        this.vendorsWithOrders.set(
          vendorId,
          (this.vendorsWithOrders.get(vendorId) || 0) + 1
        );
      }

      if (buyerId) {
        this.buyersWithOrders.set(
          buyerId,
          (this.buyersWithOrders.get(buyerId) || 0) + 1
        );
      }
    }
  }

  readonly availableVendors = computed(() => {
    // Ne retourner que les vendeurs qui ont au moins une commande
    const vendorsWithOrdersIds = Array.from(this.vendorsWithOrders.keys());

    // Réinitialiser le compteur
    this.vendorCounter = 1;

    // Fusionner avec les vendeurs connus pour obtenir leurs infos
    const knownVendors = this.organizationsService.vendorOrganizations
      .filter(vendor => vendorsWithOrdersIds.includes(vendor.id))
      .map(vendor => ({
        id: vendor.id,
        displayName: this.getVendorName(vendor.id),
      }));

    // Ajouter les IDs trouvés uniquement dans les commandes
    const extraVendors = vendorsWithOrdersIds
      .filter(id => !knownVendors.some(v => v.id === id))
      .map(id => ({
        id,
        displayName: this.getVendorName(id),
      }));

    // Fusionner et trier par ordre alphabétique du displayName
    return [...knownVendors, ...extraVendors].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  });

  readonly availableBuyers = computed(() => {
    // Ne retourner que les acheteurs qui ont au moins une commande
    const buyersWithOrdersIds = Array.from(this.buyersWithOrders.keys());

    // Réinitialiser le compteur
    this.buyerCounter = 1;

    // Fusionner avec les acheteurs connus pour obtenir leurs infos
    const knownBuyers = this.organizationsService.buyerOrganizations
      .filter(buyer => buyersWithOrdersIds.includes(buyer.id))
      .map(buyer => ({
        id: buyer.id,
        displayName: this.getBuyerName(buyer.id),
      }));

    // Ajouter les IDs trouvés uniquement dans les commandes
    const extraBuyers = buyersWithOrdersIds
      .filter(id => !knownBuyers.some(b => b.id === id))
      .map(id => ({
        id,
        displayName: this.getBuyerName(id),
      }));

    // Fusionner et trier par ordre alphabétique du displayName
    return [...knownBuyers, ...extraBuyers].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  });

  readonly activeVendors = computed(() => {
    // Pour le mode vendorsByBuyer, on ne veut que les vendeurs qui ont vendu à l'acheteur sélectionné
    if (this.viewMode() !== 'vendorsByBuyer' || !this.selectedEntityId()) {
      return this.availableVendors();
    }

    const buyerId = this.selectedEntityId();
    const vendorIds = this.ordersService.orders
      .filter(order => order.buyerOrganizationId === buyerId)
      .map(order => order.vendorOrganizationId);

    // Créer un Set pour éliminer les doublons
    const uniqueVendorIds = new Set(vendorIds);

    // Filtrer et trier par ordre alphabétique du displayName
    return this.availableVendors().filter(vendor =>
      uniqueVendorIds.has(vendor.id)
    );
  });

  readonly activeBuyers = computed(() => {
    // Pour le mode buyersByVendor, on ne veut que les acheteurs qui ont acheté au vendeur sélectionné
    if (this.viewMode() !== 'buyersByVendor' || !this.selectedEntityId()) {
      return this.availableBuyers();
    }

    const vendorId = this.selectedEntityId();
    const buyerIds = this.ordersService.orders
      .filter(order => order.vendorOrganizationId === vendorId)
      .map(order => order.buyerOrganizationId);

    // Créer un Set pour éliminer les doublons
    const uniqueBuyerIds = new Set(buyerIds);

    // Filtrer et trier par ordre alphabétique du displayName
    return this.availableBuyers().filter(buyer => uniqueBuyerIds.has(buyer.id));
  });

  readonly chartData = computed(() => {
    if (!this.selectedEntityId()) return [];

    const orders = this.ordersService.orders;
    const data: ChartData[] = [];

    if (this.viewMode() === 'buyersByVendor') {
      // Pour un vendeur sélectionné, afficher les acheteurs qui commandent le plus
      const vendorId = this.selectedEntityId();
      if (!vendorId) return [];

      // Regrouper les commandes par acheteur
      const buyerCounts = orders
        .filter(order => order.vendorOrganizationId === vendorId)
        .reduce(
          (acc, order) => {
            const buyerId = order.buyerOrganizationId;
            acc[buyerId] = (acc[buyerId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      // Convertir en format pour le graphique
      for (const [buyerId, count] of Object.entries(buyerCounts)) {
        data.push({
          id: buyerId,
          displayName: this.getBuyerName(buyerId),
          value: count,
        });
      }
    } else {
      // Pour un acheteur sélectionné, afficher les vendeurs qui lui vendent le plus
      const buyerId = this.selectedEntityId();
      if (!buyerId) return [];

      // Regrouper les commandes par vendeur
      const vendorCounts = orders
        .filter(order => order.buyerOrganizationId === buyerId)
        .reduce(
          (acc, order) => {
            const vendorId = order.vendorOrganizationId;
            acc[vendorId] = (acc[vendorId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      // Convertir en format pour le graphique
      for (const [vendorId, count] of Object.entries(vendorCounts)) {
        data.push({
          id: vendorId,
          displayName: this.getVendorName(vendorId),
          value: count,
        });
      }
    }

    // Trier par nombre de commandes (décroissant) et limiter à 15 entrées maximum
    return data.sort((a, b) => b.value - a.value).slice(0, 15);
  });

  constructor() {
    // Traiter les données des commandes
    this.processOrdersData();

    // Observer le changement de mode de vue ou d'entité sélectionnée
    effect(() => {
      const data = this.chartData();

      // Effacer toujours le graphique précédent
      const element = this.chartContainer.nativeElement;
      d3.select(element).selectAll('*').remove();

      if (data.length > 0) {
        this.renderChart(data);
      }
    });
  }

  ngOnInit(): void {
    // Initialiser les données et le premier rendu
    if (
      this.availableVendors().length > 0 &&
      this.viewMode() === 'buyersByVendor'
    ) {
      this.selectedEntityId.set(this.availableVendors()[0].id);
    } else if (
      this.availableBuyers().length > 0 &&
      this.viewMode() === 'vendorsByBuyer'
    ) {
      this.selectedEntityId.set(this.availableBuyers()[0].id);
    }
  }

  onViewModeChange(mode: 'buyersByVendor' | 'vendorsByBuyer'): void {
    this.viewMode.set(mode);
    // Réinitialiser l'entité sélectionnée
    if (mode === 'buyersByVendor' && this.availableVendors().length > 0) {
      this.selectedEntityId.set(this.availableVendors()[0].id);
    } else if (mode === 'vendorsByBuyer' && this.availableBuyers().length > 0) {
      this.selectedEntityId.set(this.availableBuyers()[0].id);
    } else {
      this.selectedEntityId.set(null);
    }
  }

  onEntitySelectionChange(entityId: string): void {
    this.selectedEntityId.set(entityId);
  }

  private getBuyerName(buyerId: string): string {
    if (!this.buyerNames.has(buyerId)) {
      // Extraire les 4 derniers caractères de l'ID pour un identifiant lisible
      const shortId = buyerId.length > 4 ? buyerId.slice(-4) : buyerId;
      const name = `Acheteur (${shortId})`;
      this.buyerNames.set(buyerId, name);
    }
    return this.buyerNames.get(buyerId) || buyerId;
  }

  private getVendorName(vendorId: string): string {
    if (!this.vendorNames.has(vendorId)) {
      // Extraire les 4 derniers caractères de l'ID pour un identifiant lisible
      const shortId = vendorId.length > 4 ? vendorId.slice(-4) : vendorId;
      const name = `Vendeur (${shortId})`;
      this.vendorNames.set(vendorId, name);
    }
    return this.vendorNames.get(vendorId) || vendorId;
  }

  private renderChart(data: ChartData[]): void {
    const element = this.chartContainer.nativeElement;

    // Déterminer la couleur en fonction du mode de visualisation
    const barColor =
      this.viewMode() === 'buyersByVendor'
        ? this.BUYER_COLOR
        : this.VENDOR_COLOR;
    const barHoverColor =
      this.viewMode() === 'buyersByVendor'
        ? this.BUYER_HOVER_COLOR
        : this.VENDOR_HOVER_COLOR;

    // Définir les dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 200 };
    const width = 800 - margin.left - margin.right;
    const height = Math.max(400, data.length * 30) - margin.top - margin.bottom;

    // Créer le SVG
    const svg = d3
      .select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Échelles
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(data.map(d => d.displayName))
      .range([0, height])
      .padding(0.1);

    // Ajouter les axes
    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', width / 2)
      .attr('y', 35)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .text('Nombre de commandes');

    svg
      .append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('text-anchor', 'end');

    // Créer les barres
    const bars = svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.displayName) || 0)
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', d => x(d.value))
      .attr('fill', barColor)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', barHoverColor);

        // Tooltip
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background-color', 'white')
          .style('border', '1px solid #ddd')
          .style('border-radius', '4px')
          .style('padding', '10px')
          .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)')
          .style('opacity', 0);

        tooltip.transition().duration(200).style('opacity', 0.9);

        tooltip
          .html(
            `<strong>${d.displayName}</strong>: ${d.value} commande(s)<br><small>ID complet: ${d.id}</small>`
          )
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', barColor);
        d3.select('.tooltip').remove();
      });

    // Animation
    bars
      .transition()
      .duration(800)
      .attr('width', d => x(d.value));

    // Ajouter une légende pour indiquer le type de données affichées
    const legendTitle =
      this.viewMode() === 'buyersByVendor'
        ? 'Acheteurs qui commandent le plus à ce vendeur'
        : 'Vendeurs qui vendent le plus à cet acheteur';

    svg
      .append('text')
      .attr('class', 'legend-title')
      .attr('x', width / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(legendTitle);
  }
}
