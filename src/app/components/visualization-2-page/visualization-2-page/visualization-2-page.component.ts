import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import {
  BuyerOrganizationCategory,
  isBuyerOrganization,
  translateBuyerOrganizationCategory,
} from '../../../models/organizations.model';
import { OrganizationsService } from '../../../services/organizations.service';
import { OrdersService } from '../../../services/orders.service';
import { LoadingService } from '../../../services/loading.service';
import { ToolbarComponent } from '../../toolbar/toolbar.component';

interface BuyerCategoryStats {
  category: BuyerOrganizationCategory;
  translatedCategory: string;
  orderCount: number;
  orderPercentage: number;
  totalSpending: number;
  spendingPercentage: number;
  isOther?: boolean;
}

@Component({
  selector: 'app-visualization-2-page',
  standalone: true,
  templateUrl: './visualization-2-page.component.html',
  styleUrls: ['./visualization-2-page.component.scss'],
  imports: [ToolbarComponent],
})
export class Visualization2PageComponent implements OnInit {
  private readonly ORDER_COLOR = '#1f77b4';
  private readonly SPENDING_COLOR = '#2ca02c';
  private readonly OTHER_COLOR = '#888';
  private svg: any;
  private margin = { top: 80, right: 150, bottom: 80, left: 100 };
  private width = 0;
  private height = 0;
  private totalOrders = 0;
  private totalSpending = 0;

  constructor(
    private organizationsService: OrganizationsService,
    private ordersService: OrdersService,
    private loadingService: LoadingService
  ) {}

  async ngOnInit() {
    try {
      this.loadingService.start('Chargement des données...');

      await Promise.all([
        this.organizationsService.isInitializedSignal(),
        this.ordersService.isInitializedSignal(),
      ]);

      const buyers = this.organizationsService.buyerOrganizations;
      const orders = this.ordersService.orders.filter(
        order =>
          order.allStatuses.includes('confirmed') &&
          order.buyerOrganizationId &&
          order.totalAmountWithTaxes
      );

      if (!orders?.length || !buyers?.length) {
        throw new Error('No data loaded');
      }

      this.totalOrders = orders.length;
      this.totalSpending = orders.reduce(
        (sum, order) => sum + order.totalAmountWithTaxes,
        0
      );

      const stats = this.processData(orders, buyers);
      this.createVisualization(stats);
    } catch (error: any) {
      this.showError(error);
    } finally {
      this.loadingService.stop();
    }
  }

  private processData(orders: any[], buyers: any[]): BuyerCategoryStats[] {
    const statsMap = new Map<
      BuyerOrganizationCategory,
      { orderCount: number; totalSpending: number }
    >();

    orders.forEach(order => {
      const buyer = buyers.find(b => b.id === order.buyerOrganizationId);
      if (!buyer || !isBuyerOrganization(buyer)) return;

      if (!statsMap.has(buyer.category)) {
        statsMap.set(buyer.category, { orderCount: 0, totalSpending: 0 });
      }

      const stats = statsMap.get(buyer.category)!;
      stats.orderCount += 1;
      stats.totalSpending += order.totalAmountWithTaxes;
    });

    const allCategories = Array.from(statsMap.entries())
      .map(([category, stats]) => ({
        category,
        translatedCategory: translateBuyerOrganizationCategory(category),
        orderCount: stats.orderCount,
        totalSpending: stats.totalSpending,
        isOther: false,
      }))
      .sort((a, b) => b.totalSpending - a.totalSpending);

    const topCategories = allCategories.slice(0, 5);
    const otherCategories = allCategories.slice(5);

    const otherStats = {
      orderCount: otherCategories.reduce((sum, cat) => sum + cat.orderCount, 0),
      totalSpending: otherCategories.reduce(
        (sum, cat) => sum + cat.totalSpending,
        0
      ),
    };

    const result = topCategories.map(cat => ({
      ...cat,
      orderPercentage: (cat.orderCount / this.totalOrders) * 100,
      spendingPercentage: (cat.totalSpending / this.totalSpending) * 100,
    }));

    if (otherStats.orderCount > 0) {
      result.push({
        category: 'consumer' as BuyerOrganizationCategory,
        translatedCategory: 'Autre',
        orderCount: otherStats.orderCount,
        orderPercentage: (otherStats.orderCount / this.totalOrders) * 100,
        totalSpending: otherStats.totalSpending,
        spendingPercentage:
          (otherStats.totalSpending / this.totalSpending) * 100,
        isOther: true,
      });
    }

    return result;
  }

  private createVisualization(stats: BuyerCategoryStats[]) {
    const container = d3.select('.chart-container').node() as HTMLElement;
    if (!container) return;

    // Utilisation de la largeur et hauteur du conteneur parent
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Réduction de la taille du graphique
    this.width = Math.max(0, containerWidth * 0.9); // 90% du conteneur
    this.height = Math.max(0, containerHeight * 0.8); // 80% du conteneur

    // Ajustement des marges pour le centrage
    const centerX = (containerWidth - this.width) / 2;

    d3.select('svg#chart').remove();

    this.svg = d3
      .select('.chart-container')
      .append('svg')
      .attr('id', 'chart')
      .attr('width', containerWidth) // Prend toute la largeur du conteneur
      .attr('height', containerHeight) // Prend toute la hauteur du conteneur
      .append('g')
      .attr('transform', `translate(${centerX},${this.margin.top})`); // Centrage horizontal

    this.svg
      .append('text')
      .attr('x', this.width / 2)
      .attr('y', this.height + this.margin.bottom - 10) // Position ajustée
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Catégorie');

    this.svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -this.height / 2)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .text('Pourcentage');

    this.svg
      .append('text')
      .attr('x', this.width / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .text('Comparaison des commandes et dépenses par catégorie (en %)');

    const x0 = d3
      .scaleBand()
      .domain(stats.map(d => d.translatedCategory))
      .rangeRound([0, this.width])
      .paddingInner(0.1);

    const x1 = d3
      .scaleBand()
      .domain(['commandes', 'dépenses'])
      .rangeRound([0, x0.bandwidth()])
      .padding(0.05);

    const y = d3.scaleLinear().domain([0, 100]).nice().range([this.height, 0]);

    this.svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x0));

    this.svg
      .append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).tickFormat(d => `${d}%`));

    this.svg
      .append('text')
      .attr('x', this.width / 2)
      .attr('y', this.height + this.margin.bottom - 10) // Position ajustée
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .text('Catégorie');

    this.svg
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -this.height / 2)
      .attr('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .text('Pourcentage');

    const categoryGroups = this.svg
      .selectAll('.category-group')
      .data(stats)
      .enter()
      .append('g')
      .attr('class', 'category-group')
      .attr(
        'transform',
        (d: BuyerCategoryStats) => `translate(${x0(d.translatedCategory)},0)`
      );

    // Barres pour les commandes
    categoryGroups
      .selectAll('.order-bar')
      .data((d: BuyerCategoryStats) => [d])
      .enter()
      .append('rect')
      .attr('class', 'order-bar')
      .attr('x', x1('commandes'))
      .attr('y', (d: BuyerCategoryStats) => y(d.orderPercentage))
      .attr('width', x1.bandwidth())
      .attr(
        'height',
        (d: BuyerCategoryStats) => this.height - y(d.orderPercentage)
      )
      .attr('fill', (d: BuyerCategoryStats) =>
        d.isOther ? this.OTHER_COLOR : this.ORDER_COLOR
      )
      .on('mouseover', (event: MouseEvent, d: BuyerCategoryStats) =>
        this.showTooltip(event, d, 'commandes')
      )
      .on('mouseout', () => this.hideTooltip());

    // Barres pour les dépenses
    categoryGroups
      .selectAll('.spending-bar')
      .data((d: BuyerCategoryStats) => [d])
      .enter()
      .append('rect')
      .attr('class', 'spending-bar')
      .attr('x', x1('dépenses'))
      .attr('y', (d: BuyerCategoryStats) => y(d.spendingPercentage))
      .attr('width', x1.bandwidth())
      .attr(
        'height',
        (d: BuyerCategoryStats) => this.height - y(d.spendingPercentage)
      )
      .attr('fill', (d: BuyerCategoryStats) =>
        d.isOther ? this.OTHER_COLOR : this.SPENDING_COLOR
      )
      .on('mouseover', (event: MouseEvent, d: BuyerCategoryStats) =>
        this.showTooltip(event, d, 'dépenses')
      )
      .on('mouseout', () => this.hideTooltip());

    const legend = this.svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.width - 100}, -40)`);

    legend
      .append('rect')
      .attr('x', 0)
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', this.ORDER_COLOR);

    legend
      .append('text')
      .attr('x', 25)
      .attr('y', 9)
      .attr('dy', '.35em')
      .text('Commandes (%)')
      .style('text-anchor', 'start')
      .style('font-size', '12px');

    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 20)
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', this.SPENDING_COLOR);

    legend
      .append('text')
      .attr('x', 25)
      .attr('y', 29)
      .attr('dy', '.35em')
      .text('Dépenses (%)')
      .style('text-anchor', 'start')
      .style('font-size', '12px');

    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 40)
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', this.OTHER_COLOR);

    legend
      .append('text')
      .attr('x', 25)
      .attr('y', 49)
      .attr('dy', '.35em')
      .text('Autre')
      .style('text-anchor', 'start')
      .style('font-size', '12px');
  }

  private showTooltip(
    event: MouseEvent,
    data: BuyerCategoryStats,
    type: 'commandes' | 'dépenses'
  ) {
    const tooltip = d3.select('.tooltip');
    let tooltipContent = `<strong>${data.translatedCategory}</strong><br>`;

    if (type === 'dépenses') {
      tooltipContent += `
        Dépenses: ${data.totalSpending.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} / 
        ${this.totalSpending.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}<br>
        (${data.spendingPercentage.toFixed(1)}%)
      `;
    } else {
      tooltipContent += `
        Commandes: ${data.orderCount.toLocaleString()} / ${this.totalOrders.toLocaleString()}<br>
        (${data.orderPercentage.toFixed(1)}%)
      `;
    }
    tooltip
      .style('display', 'block')
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 40}px`)
      .html(tooltipContent);

    d3.select(event.target as any).attr('opacity', 0.7);
  }

  private hideTooltip() {
    d3.select('.tooltip').style('display', 'none');
    d3.selectAll('.order-bar, .spending-bar').attr('opacity', 1);
  }

  private showError(error: Error) {
    d3.select('svg#chart').remove();

    const container = d3.select('.chart-container');
    container
      .append('svg')
      .attr('id', 'chart')
      .attr('width', '100%')
      .attr('height', '200px')
      .append('text')
      .attr('x', '50%')
      .attr('y', '50%')
      .attr('text-anchor', 'middle')
      .style('fill', 'red')
      .text(`Erreur: ${error.message || 'Impossible de charger les données'}`);
  }
}
