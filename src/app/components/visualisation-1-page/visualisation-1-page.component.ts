import { Component, OnInit } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { LoadingService } from '../../services/loading.service';
import * as d3 from 'd3';
import {
  isBuyerOrganization,
  isVendorOrganization,
  translateBuyerOrganizationCategory,
  translateVendorProductCategory,
  BuyerOrganizationCategory
} from '../../models/organizations.model';

@Component({
  selector: 'app-visualisation-1-page',
  standalone: true,
  imports: [ToolbarComponent],
  templateUrl: './visualisation-1-page.component.html',
  styleUrls: ['./visualisation-1-page.component.scss']
})
export class Visualisation1PageComponent implements OnInit {
  private readonly BUYER_TYPES = [
    'specialized_grocery_store',
    'restaurant',
    'grocery_store',
    'artisan',
    'institution',
    'community_organization',
    "distributor",
    'producer',
    'event_fest',
    'purchasing_group'
    ];

  private readonly COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEEAD',
    '#D4A5A5',
    '#9B59B6',
    '#3498DB',
    '#E67E22',
    '#2ECC71'
  ];

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService,
    private loadingService: LoadingService
  ) {}

  async ngOnInit() {
    try {
      console.log('Starting data loading...');
      this.loadingService.start('Chargement des données...');
      
      await Promise.all([
        this.ordersService.isInitializedSignal(),
        this.organizationsService.isInitializedSignal()
      ]);

      const orders = this.ordersService.orders;
      const organizations = this.organizationsService.organizations;

      if (!orders?.length || !organizations?.length) {
        throw new Error('No data loaded');
      }

      this.createVisualization(orders, organizations);
    } catch (error: any) {
      console.error('Error in visualization:', error);
      const svg = d3.select('svg#chart');
      svg.selectAll('*').remove();
      svg
        .append('text')
        .attr('x', 100)
        .attr('y', 100)
        .style('fill', 'red')
        .text(`Error loading data: ${error.message || 'Unknown error'}`);
    } finally {
      this.loadingService.stop();
    }
  }

  createVisualization(orders: any[], organizations: any[]) {
    console.log('Creating visualization...');
    
    // Filter orders to only include confirmed orders
    const validOrders = orders.filter(order => 
      order.allStatuses && 
      order.allStatuses.includes('confirmed')
    );

    console.log(`Using ${validOrders.length} out of ${orders.length} orders`);
    
    // Create a map of organization IDs to their categories
    const orgMap = new Map<string, string>();
    organizations.forEach(o => {
      if (isBuyerOrganization(o)) {
        orgMap.set(o.id, translateBuyerOrganizationCategory(o.category));
      }
    });

    // Count buyers per product type and buyer type
    const buyerCounts = new Map<string, Map<string, number>>();
    validOrders.forEach(order => {
      const buyerOrg = organizations.find(o => o.id === order.buyerOrganizationId);
      const vendorOrg = organizations.find(o => o.id === order.vendorOrganizationId);
      
      if (buyerOrg && isBuyerOrganization(buyerOrg) && vendorOrg && isVendorOrganization(vendorOrg)) {
        const buyerType = translateBuyerOrganizationCategory(buyerOrg.category);
        const productCategories = vendorOrg.productCategories.map(cat => translateVendorProductCategory(cat));
        
        productCategories.forEach(product => {
          if (!buyerCounts.has(product)) {
            buyerCounts.set(product, new Map());
          }
          const productBuyerCounts = buyerCounts.get(product)!;
          productBuyerCounts.set(
            buyerType,
            (productBuyerCounts.get(buyerType) || 0) + 1
          );
        });
      }
    });

    // Group data by product type and organization category, summing the amounts
    const groupedData = d3.rollup(
      validOrders,
      v => d3.rollup(
        v,
        vv => d3.sum(vv, d => d.totalAmountWithTaxes),
        d => {
          const buyerOrg = organizations.find(o => o.id === d.buyerOrganizationId);
          return buyerOrg && isBuyerOrganization(buyerOrg) 
            ? translateBuyerOrganizationCategory(buyerOrg.category)
            : 'Unknown';
        }
      ),
      d => {
        const vendorOrg = organizations.find(o => o.id === d.vendorOrganizationId);
        if (vendorOrg && isVendorOrganization(vendorOrg)) {
          return vendorOrg.productCategories.map(cat => translateVendorProductCategory(cat));
        }
        return ['Unknown'];
      }
    );

    // Flatten the grouped data to include all product categories
    const flattenedData = new Map<string, Map<string, number>>();
    groupedData.forEach((buyerMap, productCategories) => {
      productCategories.forEach(category => {
        if (!flattenedData.has(category)) {
          flattenedData.set(category, new Map());
        }
        const currentMap = flattenedData.get(category)!;
        buyerMap.forEach((value, buyerType) => {
          currentMap.set(buyerType, (currentMap.get(buyerType) || 0) + value);
        });
      });
    });

    const productLabels = Array.from(flattenedData.keys()).filter(label => label !== 'Unknown');
    
    const buyerTypes = Array.from(new Set(Array.from(flattenedData.values())
      .flatMap(m => Array.from(m.keys()))
      .filter(type => type !== 'Unknown')));

    // Calculate total cost for each product
    const productTotals = new Map<string, number>();
    productLabels.forEach(product => {
      const values = flattenedData.get(product);
      let total = 0;
      buyerTypes.forEach(type => {
        total += values?.get(type) ?? 0;
      });
      productTotals.set(product, total);
    });

    // Sort product labels by total cost in descending order
    const sortedProductLabels = [...productLabels].sort((a, b) => {
      const totalA = productTotals.get(a) ?? 0;
      const totalB = productTotals.get(b) ?? 0;
      return totalB - totalA;
    });

    const color = d3
      .scaleOrdinal<string, string>()
      .domain(buyerTypes)
      .range(this.COLORS);

    // Prepare data for stacking using sorted product labels
    const dataStacked = sortedProductLabels.map(product => {
      const values = flattenedData.get(product);
      const result: any = { product };
      buyerTypes.forEach(type => {
        const value = values?.get(type) ?? 0;
        if (value > 0) {
          result[type] = value;
        }
      });
      return result;
    });

    const nonZeroSeries = buyerTypes.filter(type => 
      dataStacked.some(d => d[type] > 0)
    );

    const stack = d3.stack<any>()
      .keys(nonZeroSeries)(dataStacked);

    this.renderChart(stack, sortedProductLabels, color, dataStacked, buyerCounts);
  }

  renderChart(
    series: d3.Series<any, string>[],
    labels: string[],
    color: d3.ScaleOrdinal<string, string>,
    dataStacked: any[],
    buyerCounts: Map<string, Map<string, number>>
  ) {
    const svg = d3.select('svg#chart');
    const container = d3.select('.visualization-container').node() as HTMLElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const width = containerWidth - 40;
    const height = containerHeight - 100;
    const margin = { top: 100, right: 150, bottom: 80, left: 250 };

    const buyerTypes = Array.from(new Set(series.map(s => s.key)));

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background-color', '#ffffff');

    svg.selectAll('*').remove();

    svg.append('text')
      .attr('x', width / 12)
      .attr('y', 100)
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text('Type de produits');

    const x = d3
      .scaleLinear()
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleBand()
      .domain(labels)
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    // Calculate the maximum value from the data
    const maxValue = d3.max(dataStacked, d => {
      let total = 0;
      buyerTypes.forEach(type => {
        total += d[type] || 0;
      });
      return total;
    }) || 0;

    x.domain([0, maxValue * 1.1]);

    const tickCount = 8;
    const tickStep = Math.ceil(maxValue / tickCount / 100) * 100;
    const tickValues = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep);

    const xAxis = d3.axisBottom(x)
      .tickValues(tickValues)
      .tickFormat(d => `${d}`)
      .tickSize(10);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - margin.bottom + 50)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Coût du produit (CAN)');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '12px');

    const legendGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 40)`);

    legendGroup
      .append('text')
      .attr('x', 700)
      .attr('y', -10)
      .text('Type d\'acheteur')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#333');

    const legendItemWidth = 180;
    const legendItemsPerRow = Math.floor((width - margin.left - margin.right) / legendItemWidth);
    const legendRowHeight = 30;

    buyerTypes.forEach((type: string, i: number) => {
      const row = Math.floor(i / legendItemsPerRow);
      const col = i % legendItemsPerRow;
      
      const legendItem = legendGroup
        .append('g')
        .attr('transform', `translate(${col * legendItemWidth}, ${row * legendRowHeight})`);

      legendItem
        .append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color(type));

      legendItem
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .text(type)
        .style('font-size', '12px')
        .style('fill', '#333')
        .style('text-anchor', 'start');
    });

    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '8px')
      .style('background', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('transition', 'opacity 0.2s');

    // Calculate total values for percentages
    const productTotals = new Map<string, number>();
    dataStacked.forEach(d => {
      const product = d.product;
      let total = 0;
      buyerTypes.forEach(type => {
        total += d[type] || 0;
      });
      productTotals.set(product, total);
    });

    let tooltipTimeout: number | null = null;
    let isTooltipVisible = false;

    const bars = svg
      .append('g')
      .selectAll('g')
      .data(series)
      .join('g')
      .attr('fill', d => color(d.key));

    let currentSegmentLabel: d3.Selection<SVGTextElement, unknown, HTMLElement, any> | null = null;

    bars
      .selectAll('rect')
      .data(d => d.map(e => ({ ...e, key: d.key })))
      .join('rect')
      .attr('x', d => x(d[0]))
      .attr('y', d => y(d.data.product)!)
      .attr('width', d => {
        const width = x(d[1]) - x(d[0]);
        return width > 0 ? width : 0;
      })
      .attr('height', y.bandwidth())
      .style('display', d => {
        const value = d[1] - d[0];
        return value > 0 ? 'block' : 'none';
      })
      .on('mouseover', function (event, d) {
        const value = d[1] - d[0];
        if (value <= 0) return;

        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }

        tooltipTimeout = window.setTimeout(() => {
          if (!isTooltipVisible) {
            const product = d.data.product;
            const total = productTotals.get(product) || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
            const buyerCount = buyerCounts.get(product)?.get(d.key) || 0;

            d3.select(this).attr('opacity', 0.8);

            if (currentSegmentLabel) {
              currentSegmentLabel.remove();
            }

            currentSegmentLabel = svg
              .append('text')
              .attr('class', 'segment-label')
              .attr('x', x(d[0]) + (x(d[1]) - x(d[0])) / 2)
              .attr('y', y(product)! + y.bandwidth() / 2 + 5)
              .attr('text-anchor', 'middle')
              .style('fill', 'black')
              .style('font-weight', 'bold')
              .style('font-size', '16px')
              .text(`${percentage}%`);

            tooltip
              .style('display', 'block')
              .style('opacity', '1')
              .html(`${d.key}<br>${Math.round(value)} CAD<br>${buyerCount} acheteurs`);

            isTooltipVisible = true;
          }
        }, 50);
      })
      .on('mousemove', function (event) {
        if (isTooltipVisible) {
          tooltip
            .style('top', event.pageY - 40 + 'px')
            .style('left', event.pageX + 10 + 'px');
        }
      })
      .on('mouseout', function () {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }
        d3.select(this).attr('opacity', 1);
        if (currentSegmentLabel) {
          currentSegmentLabel.remove();
          currentSegmentLabel = null;
        }
        tooltip
          .style('opacity', '0')
          .style('display', 'none');
        isTooltipVisible = false;
      });
  }
}
