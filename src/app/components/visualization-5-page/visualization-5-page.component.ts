import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import {
  translateVendorProductCategory,
  VendorProductCategory,
} from '../../models/organizations.model';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatButtonToggle,
  MatButtonToggleGroup,
} from '@angular/material/button-toggle';
import {
  SEASONS,
  CATEGORY_COLOR,
  TOTAL_COLOR,
  MARGIN,
  CONTAINER_HEIGHT,
  HIGHLIGHT_COLOR,
  LABEL_COLOR,
} from './visualization-5-page.constants';
import {
  Filter,
  ChartData,
  CategoryData,
  MonthData,
  Dimensions,
  Scales,
} from './visualization-5-page.model';
import { VisualizationFiveUtils as utils } from './visualization-5-page.utils';

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
  @ViewChild('chart', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;

  categoryFilters: Filter[];
  seasons = SEASONS;
  highlightedCategory?: VendorProductCategory;

  private readonly data: ChartData[];
  private readonly groupedData: CategoryData[];
  private filteredCategories: CategoryData[] = [];
  private filteredTotal: MonthData[] = [];
  private isCategoriesView = false;

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
    this.categoryFilters = utils.createFilters();
    this.data = utils.attachCategoriesToOrderDates(
      utils.cropDateRange(this.ordersService.orders),
      this.organizationsService.vendorOrganizations
    );
    this.groupedData = utils.groupByMonth(utils.groupByCategory(this.data));
    this.filterData();
  }

  ngOnInit(): void {
    d3.select(window).on('resize', this.createChart.bind(this));
    this.createChart();
  }

  // -----------------------------------------------------------
  // MARK: Interactions

  toggleFilter(filter: Filter, displayed: boolean): void {
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

  changeView(isCategoriesView: boolean): void {
    this.isCategoriesView = isCategoriesView;
    this.createChart();
    // TODO: updateChart
  }

  onCheckboxMouseEnter(categoryId: VendorProductCategory): void {
    if (
      this.isCategoriesView &&
      this.displayedCategories.includes(categoryId)
    ) {
      this.highlightCategory(categoryId);
    }
  }

  onCheckboxMouseLeave(categoryId: VendorProductCategory): void {
    if (
      this.isCategoriesView &&
      this.displayedCategories.includes(categoryId)
    ) {
      this.undoHighlightCategory(
        categoryId,
        this.isCategoriesView ? CATEGORY_COLOR : TOTAL_COLOR
      );
    }
  }

  private filterData(): void {
    this.filteredCategories = utils.filterCategories(
      this.groupedData,
      this.displayedCategories
    );
    this.filteredTotal = utils.filterTotal(this.data, this.displayedCategories);
  }

  // -----------------------------------------------------------
  // MARK: Creating the chart

  private createChart(): void {
    const dimensions = this.drawContainer();
    const scales = this.drawAxies(dimensions);
    this.drawSeasons(scales, dimensions);
    this.drawAllLines(scales);

    d3.select(this.chartContainer.nativeElement)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('background-color', LABEL_COLOR)
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('transform', 'translate(-50%, -100%)')
      .style('padding', '5px')
      .style('text-align', 'center')
      .style('font-size', '14px')
      .style('line-height', '20px')
      .style('border-radius', '5px');
  }

  private drawContainer(): Dimensions {
    const containerWidth =
      this.chartContainer.nativeElement.getBoundingClientRect().width;
    const dimensions = {
      width: containerWidth - MARGIN.left - MARGIN.right,
      height: CONTAINER_HEIGHT - MARGIN.top - MARGIN.bottom,
    };

    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();
    d3.select(element)
      .append('svg')
      .attr('width', dimensions.width + MARGIN.left + MARGIN.right)
      .attr('height', dimensions.height + MARGIN.top + MARGIN.bottom)
      .append('g')
      .attr('id', 'graph-g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    return dimensions;
  }

  private drawAxies(dimensions: Dimensions): Scales {
    const g = d3.select('#graph-g');
    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(this.filteredTotal, monthData => monthData.date) as [
          Date,
          Date,
        ]
      )
      .range([0, dimensions.width]);
    g.append('g')
      .attr('transform', `translate(0, ${dimensions.height})`)
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
      .domain([
        0,
        utils.getMaxY(
          this.isCategoriesView,
          this.filteredCategories,
          this.filteredTotal
        ),
      ])
      .range([dimensions.height, 0]);
    g.append('g').call(d3.axisLeft(yScale));

    g.append('text')
      .text('Nombre de commandes')
      .attr('class', 'axis-text')
      .attr('font-size', 12)
      .attr('y', -5)
      .style('text-anchor', 'middle');

    return { x: xScale, y: yScale };
  }

  private drawSeasons(scales: Scales, dimensions: Dimensions): void {
    const g = d3.select('#graph-g');

    const startDate = scales.x.domain()[0];
    const endDate = scales.x.domain()[1];
    let currentYear = startDate.getFullYear();
    while (new Date(`${currentYear}-01-01`) < endDate) {
      this.seasons.forEach(season => {
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
            .attr('height', dimensions.height)
            .attr('fill', season.color)
            .attr('opacity', 0.5);
        }
      });
      currentYear++;
    }
  }

  private drawAllLines(scales: Scales): void {
    if (this.isCategoriesView) {
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

  private drawLine(
    name: string,
    color: string,
    data: MonthData[],
    scales: Scales,
    categoryId?: VendorProductCategory
  ): void {
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

    g.selectAll('dot')
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
      .attr('r', 3)
      .on('mouseenter', (_, d) => this.showToolTip(d, scales))
      .on('mouseleave', () => this.hideToolTip());

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
      .attr('fill', LABEL_COLOR)
      .attr('width', textDims.width)
      .attr('height', textDims.height)
      .attr('stroke', 'none');
  }

  // -----------------------------------------------------------
  // MARK: Updating the chart

  private updateChart(): void {
    // TODO
  }

  // -----------------------------------------------------------
  // MARK: Hover

  private highlightCategory(categoryId: VendorProductCategory): void {
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
  ): void {
    const g = d3.select<SVGGElement, unknown>(`#${categoryId}`);
    g.select('path').attr('stroke-width', 2).attr('stroke', originalColor);
    g.selectAll('circle').attr('fill', originalColor);
    g.select('g.label')
      .select('text')
      .attr('fill', originalColor)
      .attr('font-weight', 'normal');
    this.highlightedCategory = undefined;
  }

  private showToolTip(d: MonthData, scales: Scales): void {
    const dateText =
      d.date.toLocaleString('default', {
        month: 'long',
      }) +
      ' ' +
      d.date.getFullYear();
    const capitalizedDateText =
      dateText.charAt(0).toUpperCase() + dateText.slice(1);
    const ordersText = d.nbOrders + ' commande' + (d.nbOrders > 1 ? 's' : '');
    d3.select('.tooltip')
      .style('opacity', 1)
      .html(capitalizedDateText + '<br/>' + ordersText)
      .style('left', scales.x(d.date) + MARGIN.left + 'px')
      .style('top', scales.y(d.nbOrders) + MARGIN.top - 10 + 'px');
  }

  private hideToolTip(): void {
    d3.select('.tooltip').style('opacity', 0);
  }
}
