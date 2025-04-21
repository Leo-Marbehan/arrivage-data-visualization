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
  HIGHLIGHT_COLOR,
  LABEL_COLOR,
  TRANSITION_DURATION,
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
import { Season } from './visualization-5-page.model';

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
  private previousScales?: Scales;

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
    this.updateChart();
    if (displayed) {
      this.onCheckboxMouseEnter(filter.categoryId);
    }
  }

  changeView(isCategoriesView: boolean): void {
    this.isCategoriesView = isCategoriesView;
    this.updateChart();
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
    const dimensions = utils.computeDimensions(
      this.chartContainer.nativeElement
    );
    const scales = this.createScales(dimensions);
    this.previousScales = scales;

    this.drawContainer(dimensions);
    this.drawAxes(scales, dimensions);
    this.drawSeasons(scales, dimensions);
    this.drawAllLines(scales);
    this.drawToolTip();
  }

  private createScales(dimensions: Dimensions): Scales {
    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(this.filteredTotal, monthData => monthData.date) as [
          Date,
          Date,
        ]
      )
      .range([0, dimensions.width]);
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

    return { x: xScale, y: yScale };
  }

  private drawToolTip(): void {
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

  private drawContainer(dimensions: Dimensions): void {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();
    d3.select(element)
      .append('svg')
      .attr('width', dimensions.width + MARGIN.left + MARGIN.right)
      .attr('height', dimensions.height + MARGIN.top + MARGIN.bottom)
      .append('g')
      .attr('id', 'graph-g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
  }

  private drawAxes(
    scales: Scales,
    dimensions: Dimensions,
    transitionDuration = 0
  ): void {
    const g = d3.select('#graph-g');
    const xAxis = g.selectAll<SVGGElement, unknown>('.x-axis').data([null]);
    xAxis
      .enter()
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${dimensions.height})`)
      .merge(xAxis)
      .transition()
      .duration(transitionDuration)
      .call(
        d3
          .axisBottom(scales.x)
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

    const yAxis = g.selectAll<SVGGElement, unknown>('.y-axis').data([null]);
    yAxis
      .enter()
      .append('g')
      .attr('class', 'y-axis')
      .merge(yAxis)
      .transition()
      .duration(transitionDuration)
      .call(d3.axisLeft(scales.y));

    const yLabel = g
      .selectAll<SVGTextElement, unknown>('.axis-text')
      .data([null]);
    yLabel
      .enter()
      .append('text')
      .attr('class', 'axis-text')
      .attr('font-size', 12)
      .attr('y', -5)
      .style('text-anchor', 'middle')
      .merge(yLabel)
      .text('Nombre de commandes');
  }

  private drawSeasons(
    scales: Scales,
    dimensions: Dimensions,
    transitionDuration = 0
  ): void {
    const g = d3.select('#graph-g');

    const startDate = scales.x.domain()[0];
    const endDate = scales.x.domain()[1];
    let currentYear = startDate.getFullYear();
    const seasonData: Season[] = [];
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
          seasonData.push({
            start: d3.max([seasonStart, startDate]) as Date,
            end: d3.min([seasonEnd, endDate]) as Date,
            color: season.color,
            id: `${season.start}-${currentYear}`,
          });
        }
      });
      currentYear++;
    }

    const seasons = g
      .selectAll<SVGRectElement, unknown>('.season')
      .data(seasonData, d => (d as Season).id);
    seasons
      .enter()
      .append('rect')
      .attr('class', 'season')
      .attr('y', 0)
      .attr('height', dimensions.height)
      .attr('fill', d => d.color)
      .attr('opacity', 0.5)
      .merge(seasons)
      .transition()
      .duration(transitionDuration)
      .attr('x', d => scales.x(d.start))
      .attr('width', d => scales.x(d.end) - scales.x(d.start));
    seasons.exit().remove();
  }

  private drawAllLines(scales: Scales, transitionDuration = 0): void {
    if (this.isCategoriesView) {
      this.filteredCategories.forEach(category => {
        this.drawLine(
          translateVendorProductCategory(category.categoryId),
          CATEGORY_COLOR,
          category.ordersPerMonth,
          scales,
          category.categoryId,
          transitionDuration
        );
      });
    } else if (this.filteredTotal.length > 0) {
      this.drawLine(
        'Total',
        TOTAL_COLOR,
        this.filteredTotal,
        scales,
        undefined,
        transitionDuration
      );
    }
  }

  private drawLine(
    name: string,
    color: string,
    data: MonthData[],
    scales: Scales,
    categoryId?: VendorProductCategory,
    transitionDuration = 0
  ): void {
    const lineId = categoryId ? categoryId : name;
    const g = d3.select(`#graph-g`).select<SVGGElement>(`#${lineId}`);

    const group = g.empty()
      ? d3
          .select('#graph-g')
          .append('g')
          .attr('class', 'line-group')
          .attr('id', lineId)
          .attr('stroke', color)
          .attr('fill', color)
      : g;

    if (categoryId && g.empty()) {
      group
        .on('mouseenter', () => this.highlightCategory(categoryId))
        .on('mouseleave', () => this.undoHighlightCategory(categoryId, color));
    }

    const lineGenerator = d3
      .line<MonthData>()
      .x(d => scales.x(d.date))
      .y(d => scales.y(d.nbOrders));

    const path = group.selectAll('path').data([data]);
    path.transition().duration(transitionDuration).attr('d', lineGenerator);
    path
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('d', lineGenerator);

    const circles = group
      .selectAll<SVGCircleElement, MonthData>('circle')
      .data(data, d => d.date.toString());
    circles
      .on('mouseenter', (_, d) => this.showToolTip(d, scales))
      .on('mouseleave', () => this.hideToolTip())
      .transition()
      .duration(transitionDuration)
      .attr('cx', d => scales.x(d.date))
      .attr('cy', d => scales.y(d.nbOrders));
    circles
      .enter()
      .append('circle')
      .attr('stroke', 'none')
      .attr('r', 3)
      .attr('cx', d => scales.x(d.date))
      .attr('cy', d => scales.y(d.nbOrders))
      .on('mouseenter', (_, d) => this.showToolTip(d, scales))
      .on('mouseleave', () => this.hideToolTip());
    circles.exit().remove();

    const lastMonth = data[data.length - 1];
    const label = group.selectAll('.label').data([lastMonth]);
    label
      .transition()
      .duration(transitionDuration)
      .style(
        'transform',
        d =>
          `translate(${scales.x(d.date) + 10}px, ${scales.y(d.nbOrders) + 4}px)`
      );
    const labelEnter = label.enter().append('g').attr('class', 'label');
    labelEnter
      .style(
        'transform',
        d =>
          `translate(${scales.x(d.date) + 10}px, ${scales.y(d.nbOrders) + 4}px)`
      )
      .append('text')
      .attr('stroke', 'none')
      .style('font-size', 12)
      .text(name);
    labelEnter.each(function () {
      const textDims = d3
        .select(this)
        .select<SVGTextElement>('text')
        .node()!
        .getBBox();
      d3.select(this)
        .insert('rect', ':first-child')
        .attr('x', textDims.x)
        .attr('y', textDims.y)
        .attr('fill', LABEL_COLOR)
        .attr('width', textDims.width)
        .attr('height', textDims.height)
        .attr('stroke', 'none');
    });
    label.exit().remove();
  }

  // -----------------------------------------------------------
  // MARK: Updating the chart

  private updateChart(): void {
    const dimensions = utils.computeDimensions(
      this.chartContainer.nativeElement
    );

    this.removeAllLines();
    this.drawAllLines(this.previousScales!, 0);

    const newScales = this.createScales(dimensions);
    this.drawAxes(newScales, dimensions, TRANSITION_DURATION);
    this.drawSeasons(newScales, dimensions, TRANSITION_DURATION);
    this.drawAllLines(newScales, TRANSITION_DURATION);
    this.previousScales = newScales;
  }

  private removeAllLines(): void {
    const g = d3.select('#graph-g');
    g.selectAll('g.line-group').remove();
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
    const g = d3.selectAll<SVGGElement, unknown>(`#${categoryId}`);
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
