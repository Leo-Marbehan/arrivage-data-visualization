import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import {
  translateVendorProductCategory,
  VENDOR_PRODUCT_CATEGORIES,
  VendorOrganization,
  VendorProductCategory,
} from '../../models/organizations.model';
import { Order } from '../../models/orders.model';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatButtonToggle,
  MatButtonToggleGroup,
} from '@angular/material/button-toggle';

const HIGHLIGHT_COLOR = '#ba005d';
const TOTAL_COLOR = 'black';
const CATEGORY_COLOR = 'grey';

interface Scales {
  x: d3.ScaleTime<number, number, never>;
  y: d3.ScaleLinear<number, number, never>;
}

interface Filter {
  categoryId: VendorProductCategory;
  name: string;
  displayed: boolean;
}

interface ChartData {
  date: Date;
  categories: VendorProductCategory[];
}

interface DatesByCategory {
  categoryId: VendorProductCategory;
  dates: Date[];
}

interface CategoryData {
  categoryId: VendorProductCategory;
  ordersPerMonth: MonthData[];
}

interface MonthData {
  date: Date;
  nbOrders: number;
}

@Component({
  selector: 'app-visualization-5-page',
  standalone: true,
  imports: [
    ToolbarComponent,
    MatCheckbox,
    MatButtonToggleGroup,
    MatButtonToggle,
  ],
  templateUrl: './visualization-5-page.component.html',
  styleUrl: './visualization-5-page.component.scss',
})
export class VisualizationFivePageComponent implements OnInit {
  categoryFilters: Filter[];
  SEASONS = [
    { name: 'Hiver', start: '12-21', end: '03-20', color: '#C6DEF1' },
    { name: 'Printemps', start: '03-21', end: '06-20', color: '#C9E4D5' },
    { name: 'Été', start: '06-21', end: '09-20', color: '#FAEDCB' },
    { name: 'Automne', start: '09-21', end: '12-20', color: '#F7D9C4' },
  ];
  highlightedCategory?: VendorProductCategory;
  @ViewChild('chart', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;
  private readonly data: ChartData[];
  private readonly groupedData: CategoryData[];
  private filteredCategories: CategoryData[] = [];
  private filteredTotal: MonthData[] = [];
  private categoriesView = false;
  private dimensions = { width: 0, height: 0 };

  get displayedCategories(): VendorProductCategory[] {
    return this.categoryFilters.reduce((displayedCategories, filter) => {
      if (filter.displayed) {
        displayedCategories.push(filter.categoryId);
      }
      return displayedCategories;
    }, [] as VendorProductCategory[]);
  }

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService
  ) {
    this.categoryFilters = this.createFilters();
    this.data = this.attachCategoriesToOrderDates(
      this.cropDateRange(this.ordersService.orders),
      this.organizationsService.vendorOrganizations
    );
    this.groupedData = this.groupByMonth(this.groupByCategory(this.data));
    this.filterData();
  }
  ngOnInit(): void {
    d3.select(window).on('resize', this.createChart.bind(this));
    this.createChart();
  }

  toggleFilter(filter: Filter, displayed: boolean) {
    if (!displayed) {
      this.onCheckboxMouseLeave(filter.categoryId);
    }
    filter.displayed = displayed;
    this.filterData();
    this.createChart();
    // TODO: updateChart
    if (displayed) {
      this.onCheckboxMouseEnter(filter.categoryId);
    }
  }

  changeView(categoriesView: boolean) {
    this.categoriesView = categoriesView;
    this.createChart();
    // TODO: updateChart
  }

  onCheckboxMouseEnter(categoryId: VendorProductCategory) {
    if (this.categoriesView && this.displayedCategories.includes(categoryId)) {
      this.highlightCategory(categoryId);
    }
  }

  onCheckboxMouseLeave(categoryId: VendorProductCategory) {
    if (this.categoriesView && this.displayedCategories.includes(categoryId)) {
      this.undoHighlightCategory(
        categoryId,
        this.categoriesView ? CATEGORY_COLOR : TOTAL_COLOR
      );
    }
  }

  private createFilters(): Filter[] {
    return VENDOR_PRODUCT_CATEGORIES.map(categoryId => {
      return {
        categoryId,
        name: translateVendorProductCategory(categoryId),
        displayed: true,
      };
    });
  }

  private cropDateRange(orders: Order[]): Order[] {
    return orders.filter(
      order =>
        order.distributionDate.getTime() >= new Date(2021, 3).getTime() && // Min: April 2021
        order.distributionDate.getTime() <= new Date(2025, 1).getTime() // Max: February 2025
    );
  }

  private attachCategoriesToOrderDates(
    orders: Order[],
    vendors: VendorOrganization[]
  ): ChartData[] {
    return orders.reduce((data, order) => {
      const categories = vendors.find(
        vendor => vendor.id === order.vendorOrganizationId
      )?.productCategories;
      if (categories) {
        data.push({
          date: order.distributionDate,
          categories,
        });
        return data;
      } else {
        return data;
      }
    }, [] as ChartData[]);
  }

  private groupByCategory(data: ChartData[]): DatesByCategory[] {
    return data.reduce((categoriesWithDates, order) => {
      order.categories.forEach(categoryId => {
        const existing = categoriesWithDates.find(
          category => category.categoryId === categoryId
        );
        if (!existing) {
          categoriesWithDates.push({
            categoryId,
            dates: [order.date],
          });
        } else {
          existing.dates.push(order.date);
        }
      });
      return categoriesWithDates;
    }, [] as DatesByCategory[]);
  }

  private groupByMonth(data: DatesByCategory[]): CategoryData[] {
    return data.map(category => {
      return {
        categoryId: category.categoryId,
        ordersPerMonth: category.dates
          .reduce((ordersPerMonth, date) => {
            const month = new Date(date.getFullYear(), date.getMonth());
            const existing = ordersPerMonth.find(
              monthData => monthData.date.getTime() === month.getTime()
            );
            if (!existing) {
              ordersPerMonth.push({ date: month, nbOrders: 1 });
            } else {
              existing.nbOrders++;
            }
            return ordersPerMonth;
          }, [] as MonthData[])
          .sort((a, b) => a.date.getTime() - b.date.getTime()),
      };
    });
  }

  private filterData(): void {
    this.filteredCategories = this.groupedData.filter(category =>
      this.displayedCategories.includes(category.categoryId)
    );
    this.filteredTotal = Array.from(
      d3
        .group(
          this.data.filter(d =>
            this.hasIntersection(d.categories, this.displayedCategories)
          ),
          order => new Date(order.date.getFullYear(), order.date.getMonth())
        )
        .entries()
    )
      .map(([date, orders]) => {
        return {
          date,
          nbOrders: orders.length,
        } as MonthData;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private createChart() {
    const containerWidth =
      this.chartContainer.nativeElement.getBoundingClientRect().width;
    const containerHeight = 550;
    const margin = { top: 30, right: 130, bottom: 25, left: 250 };
    this.dimensions = {
      width: containerWidth - margin.left - margin.right,
      height: containerHeight - margin.top - margin.bottom,
    };

    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();
    d3.select(element)
      .append('svg')
      .attr('width', this.dimensions.width + margin.left + margin.right)
      .attr('height', this.dimensions.height + margin.top + margin.bottom)
      .append('g')
      .attr('id', 'graph-g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    this.updateChart();
  }

  private updateChart() {
    const scales = this.drawAxies(
      this.dimensions.width,
      this.dimensions.height
    );

    this.drawSeasons(scales);

    if (this.categoriesView) {
      this.filteredCategories.forEach(category =>
        this.drawLine(
          translateVendorProductCategory(category.categoryId),
          CATEGORY_COLOR,
          category.ordersPerMonth,
          scales,
          category.categoryId
        )
      );
    } else if (this.filteredTotal.length > 0) {
      this.drawLine('Total', TOTAL_COLOR, this.filteredTotal, scales);
    }
  }

  private drawAxies(width: number, height: number): Scales {
    const g = d3.select('#graph-g');
    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(this.filteredTotal, monthData => monthData.date) as [
          Date,
          Date,
        ]
      )
      .range([0, width]);
    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(d3.timeMonth.every(2))
          .tickFormat(domain => {
            if ((domain as Date).getMonth() === 0) {
              return (domain as Date).getFullYear().toString();
            } else {
              return (domain as Date).toLocaleString('default', {
                month: 'short',
              });
            }
          })
      );

    const yScale = d3
      .scaleLinear()
      .domain([0, this.getMaxY()])
      .range([height, 0]);
    g.append('g').call(d3.axisLeft(yScale));

    g.append('text')
      .text('Nombre de commandes')
      .attr('class', 'axis-text')
      .attr('font-size', 12)
      .attr('y', -5)
      .style('text-anchor', 'middle');

    return { x: xScale, y: yScale };
  }

  private getMaxY(): number {
    if (this.categoriesView) {
      return d3.max(
        this.filteredCategories,
        category =>
          d3.max(
            category.ordersPerMonth,
            monthData => monthData.nbOrders
          ) as number
      ) as number;
    } else {
      return d3.max(this.filteredTotal, monthData => {
        return monthData.nbOrders;
      })!;
    }
  }

  private drawSeasons(scales: Scales): void {
    const g = d3.select('#graph-g');

    const startDate = scales.x.domain()[0];
    const endDate = scales.x.domain()[1];
    let currentYear = startDate.getFullYear();
    while (new Date(`${currentYear}-01-01`) < endDate) {
      this.SEASONS.forEach(season => {
        const startDateStr = season.start.startsWith('12')
          ? `${currentYear - 1}-${season.start}`
          : `${currentYear}-${season.start}`;
        const endDateStr = season.end.startsWith('12')
          ? `${currentYear}-${season.end}`
          : `${currentYear + (season.end.startsWith('01') || season.end.startsWith('02') || season.end.startsWith('03') ? 1 : 0)}-${season.end}`;

        const seasonStart = new Date(startDateStr);
        const seasonEnd = new Date(endDateStr);

        if (seasonEnd > startDate && seasonStart < endDate) {
          g.append('rect')
            .attr('x', scales.x(d3.max([seasonStart, startDate]) as Date))
            .attr('y', 0)
            .attr(
              'width',
              scales.x(d3.min([seasonEnd, endDate]) as Date) -
                scales.x(d3.max([seasonStart, startDate]) as Date)
            )
            .attr('height', this.dimensions.height)
            .attr('fill', season.color)
            .attr('opacity', 0.5);
        }
      });
      currentYear++;
    }
  }

  private drawLine(
    name: string,
    color: string,
    data: MonthData[],
    scales: Scales,
    categoryId?: VendorProductCategory
  ) {
    const g = d3
      .select('#graph-g')
      .append('g')
      .attr('id', categoryId ? categoryId : name)
      .attr('stroke', color)
      .attr('fill', color);

    if (categoryId) {
      g.on('mouseenter', () => this.highlightCategory(categoryId)).on(
        'mouseleave',
        () => this.undoHighlightCategory(categoryId, color)
      );
    }

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr(
        'd',
        d3
          .line<MonthData>()
          .x(d => scales.x(d.date))
          .y(d => scales.y(d.nbOrders))
      );

    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('stroke', 'none')
      .attr('cx', d => {
        return scales.x(d.date);
      })
      .attr('cy', d => {
        return scales.y(d.nbOrders);
      })
      .attr('r', 3);

    const lastMonth = data[data.length - 1];

    const label = g.append('g').attr('class', 'label');
    label
      .append('text')
      .attr('x', scales.x(lastMonth.date) + 10)
      .attr('y', scales.y(lastMonth.nbOrders) + 4)
      .attr('stroke', 'none')
      .style('font-size', 12)
      .text(name);
    const textDims = label.select<SVGTextElement>('text').node()!.getBBox();
    label
      .insert('rect', ':first-child')
      .attr('x', textDims.x)
      .attr('y', textDims.y)
      .attr('fill', '#F9F9F9')
      .attr('width', textDims.width)
      .attr('height', textDims.height)
      .attr('stroke', 'none');
  }

  private highlightCategory(categoryId: VendorProductCategory) {
    const g = d3.select<SVGGElement, unknown>(`#${categoryId}`);
    g.select('path').attr('stroke-width', 3).attr('stroke', HIGHLIGHT_COLOR);
    g.selectAll('circle').attr('fill', HIGHLIGHT_COLOR);
    g.select('g.label')
      .select('text')
      .attr('fill', HIGHLIGHT_COLOR)
      .attr('font-weight', 'bold');
    d3.select<SVGGElement, unknown>('#graph-g').node()!.appendChild(g.node()!);
    this.highlightedCategory = categoryId;
  }

  private undoHighlightCategory(
    categoryId: VendorProductCategory,
    originalColor: string
  ) {
    const g = d3.select<SVGGElement, unknown>(`#${categoryId}`);
    g.select('path').attr('stroke-width', 2).attr('stroke', originalColor);
    g.selectAll('circle').attr('fill', originalColor);
    g.select('g.label')
      .select('text')
      .attr('fill', originalColor)
      .attr('font-weight', 'normal');
    this.highlightedCategory = undefined;
  }

  private hasIntersection(a: string[], b: string[]): boolean {
    return a.filter(value => b.includes(value)).length > 0;
  }
}
