import {
  AfterViewInit,
  Component,
  effect,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  MatButtonToggleChange,
  MatButtonToggleModule,
} from '@angular/material/button-toggle';
import * as d3 from 'd3';
import {
  isBuyerOrganization,
  isVendorOrganization,
  Organization,
} from '../../models/organizations.model';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { ToolbarComponent } from '../toolbar/toolbar.component';

type DataMode = 'all' | 'vendors' | 'buyers';
type ViewMode = 'stacked' | 'continuous';
type CountMode = 'absolute' | 'cumulative';

@Component({
  selector: 'app-visualization-6-page',
  imports: [ToolbarComponent, MatButtonToggleModule],
  templateUrl: './visualization-6-page.component.html',
  styleUrl: './visualization-6-page.component.scss',
})
export class Visualization6PageComponent implements AfterViewInit {
  // MARK: Properties
  readonly CHART_WIDTH = 1280;
  readonly CHART_HEIGHT = 600;

  private readonly MARGIN = {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40,
  };

  private readonly ALL_FIRST_COLOR = '#ffaaaa';
  private readonly ALL_LAST_COLOR = '#880000';
  private readonly VENDORS_FIRST_COLOR = '#aaaaff';
  private readonly VENDORS_LAST_COLOR = '#000088';
  private readonly BUYERS_FIRST_COLOR = '#aaffaa';
  private readonly BUYERS_LAST_COLOR = '#008800';

  // MARK: Filters
  readonly dataModesSignal: WritableSignal<DataMode[]> = signal([
    'all',
    'vendors',
    'buyers',
  ]);

  readonly viewModeSignal: WritableSignal<ViewMode> = signal('continuous');

  readonly countModeSignal: WritableSignal<CountMode> = signal('absolute');

  private readonly isInitializedSignal: WritableSignal<boolean> = signal(false);

  // Legend
  readonly legendSignal: WritableSignal<{
    years: string[];
    modes: {
      dataMode: DataMode;
      colors: string[];
    }[];
  } | null> = signal(null);

  // MARK: Constructor
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly ordersService: OrdersService
  ) {
    effect(() => {
      const organizations = this.organizationsService.organizations;

      const dataModes = this.dataModesSignal();
      const viewMode = this.viewModeSignal();
      const countMode = this.countModeSignal();

      this.isInitializedSignal();

      this.renderChart(organizations, dataModes, viewMode, countMode);
    });
  }

  // MARK: Lifecycle
  ngAfterViewInit(): void {
    this.isInitializedSignal.set(true);
  }

  // MARK: Handlers
  onDataModesChange(change: MatButtonToggleChange) {
    this.dataModesSignal.set(change.value as DataMode[]);
  }

  onViewModeChange(change: MatButtonToggleChange) {
    this.viewModeSignal.set(change.value as ViewMode);
  }

  onCountModeChange(change: MatButtonToggleChange) {
    this.countModeSignal.set(change.value as CountMode);
  }

  // MARK: Helpers
  getOrganizationsCountByMonth(
    organizations: Organization[],
    countMode: 'absolute' | 'cumulative'
  ): Map<
    string,
    {
      year: number;
      month: number;
      count: number;
    }
  > {
    const organizationsCountByMonth = new Map<
      string,
      {
        year: number;
        month: number;
        count: number;
      }
    >();

    organizations
      .sort((a, b) => {
        const dateA = new Date(a.creationTimestamp);
        const dateB = new Date(b.creationTimestamp);
        return dateA.getTime() - dateB.getTime();
      })
      .reduce((acc, organization) => {
        const creationDate = new Date(organization.creationTimestamp);
        const key = d3.timeFormat('%Y-%b')(creationDate);
        const year = creationDate.getFullYear();
        const month = creationDate.getMonth();
        if (!organizationsCountByMonth.has(key)) {
          organizationsCountByMonth.set(key, {
            year,
            month,
            count: 0,
          });
        }
        if (countMode === 'absolute') {
          organizationsCountByMonth.set(key, {
            year,
            month,
            count: organizationsCountByMonth.get(key)!.count + 1,
          });
        } else {
          organizationsCountByMonth.set(key, {
            year,
            month,
            count: acc + 1,
          });
        }
        return organizationsCountByMonth.get(key)!.count;
      }, 0);

    return organizationsCountByMonth;
  }

  translateDataModeToString(dataMode: DataMode): string {
    switch (dataMode) {
      case 'all':
        return 'Tous';
      case 'vendors':
        return 'Vendeurs';
      case 'buyers':
        return 'Acheteurs';
      default:
        return '';
    }
  }

  // MARK: Rendering
  private renderChart(
    organizations: Organization[],
    dataModes: DataMode[],
    viewMode: ViewMode,
    countMode: CountMode
  ) {
    const svg = d3.select('#chart');

    const width = this.CHART_WIDTH;
    const height = this.CHART_HEIGHT;

    const margin = this.MARGIN;

    // Get all years
    const years = Array.from(
      new Set(
        organizations.map(organization =>
          organization.creationTimestamp.getFullYear().toString()
        )
      )
    ).sort((a, b) => parseInt(a) - parseInt(b));

    // Create a color scale for the years
    const allFirstColor = this.ALL_FIRST_COLOR;
    const allLastColor = this.ALL_LAST_COLOR;
    const vendorsFirstColor = this.VENDORS_FIRST_COLOR;
    const vendorsLastColor = this.VENDORS_LAST_COLOR;
    const buyersFirstColor = this.BUYERS_FIRST_COLOR;
    const buyersLastColor = this.BUYERS_LAST_COLOR;

    const [allColorScale, vendorsColorScale, buyersColorScale] = [
      [allFirstColor, allLastColor],
      [vendorsFirstColor, vendorsLastColor],
      [buyersFirstColor, buyersLastColor],
    ].map(([firstColor, lastColor]) =>
      d3
        .scaleOrdinal<string>()
        .domain(Array.from(years))
        .range(
          Array.from(years).map((_, i) =>
            d3.interpolateRgb(firstColor, lastColor)(i / (years.length - 1))
          )
        )
    );

    // Build the data for the chart
    const allOrganizationsCountByMonth = this.getOrganizationsCountByMonth(
      organizations,
      countMode
    );

    const vendorOrganizationsCountByMonth = this.getOrganizationsCountByMonth(
      organizations.filter(isVendorOrganization),
      countMode
    );

    const buyerOrganizationsCountByMonth = this.getOrganizationsCountByMonth(
      organizations.filter(isBuyerOrganization),
      countMode
    );

    // Get the displayed counts to adapt the scales
    const displayedCounts: {
      year: number;
      month: number;
      count: number;
    }[] = [];

    if (dataModes.includes('all')) {
      displayedCounts.push(...allOrganizationsCountByMonth.values());
    }
    if (dataModes.includes('vendors')) {
      displayedCounts.push(...vendorOrganizationsCountByMonth.values());
    }
    if (dataModes.includes('buyers')) {
      displayedCounts.push(...buyerOrganizationsCountByMonth.values());
    }

    // Create the axes scales
    const x = d3
      .scaleBand()
      .domain(
        organizations.map(organization =>
          viewMode === 'stacked'
            ? d3.timeFormat('%b')(new Date(organization.creationTimestamp))
            : d3.timeFormat('%Y-%b')(new Date(organization.creationTimestamp))
        )
      )
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(displayedCounts, d => d.count) || 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Clear the previous chart
    svg.selectAll('.x-axis').remove();
    svg.selectAll('.y-axis').remove();

    // Render the axes
    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat(d => (viewMode === 'stacked' ? d : d.split('-')[1]))
      );
    svg
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Render the data
    this.renderData(
      allOrganizationsCountByMonth,
      x,
      y,
      allColorScale,
      'all',
      viewMode,
      dataModes.includes('all')
    );

    this.renderData(
      vendorOrganizationsCountByMonth,
      x,
      y,
      vendorsColorScale,
      'vendors',
      viewMode,
      dataModes.includes('vendors')
    );

    this.renderData(
      buyerOrganizationsCountByMonth,
      x,
      y,
      buyersColorScale,
      'buyers',
      viewMode,
      dataModes.includes('buyers')
    );

    // Display a dotted line for each year if continuous mode
    if (viewMode === 'continuous') {
      const elementsOfEachYear = years.map(year =>
        Array.from(allOrganizationsCountByMonth.entries()).find(
          d => d[1].year === parseInt(year)
        )
      );

      // Add the lines
      svg
        .selectAll('line.dotted-line')
        .data(elementsOfEachYear)
        .enter()
        .append('line')
        .attr('class', 'dotted-line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5')
        .attr(
          'transform',
          (d, i) => `translate(${x(d![0])! + x.bandwidth() / 2},0)`
        );

      // Add the years
      svg
        .selectAll('text.year')
        .data(elementsOfEachYear)
        .enter()
        .append('text')
        .attr('class', 'year')
        .attr('x', (d, i) => x(d![0])! + x.bandwidth() / 2)
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .text((d, i) => d![1].year);

      // Fade in the lines
      svg
        .selectAll('line.dotted-line')
        .transition()
        .duration(1000)
        .attr('opacity', 1);

      // Fade in the years
      svg.selectAll('text.year').transition().duration(1000).attr('opacity', 1);
    } else {
      // Fade out the lines
      svg
        .selectAll('line.dotted-line')
        .transition()
        .duration(1000)
        .attr('opacity', 0);

      // Fade out the years
      svg.selectAll('text.year').transition().duration(1000).attr('opacity', 0);
    }

    this.legendSignal.set({
      years: years,
      modes: [
        {
          dataMode: 'all',
          colors: Array.from(years).map((_, i) =>
            d3.interpolateRgb(
              allFirstColor,
              allLastColor
            )(i / (years.length - 1))
          ),
        },
        {
          dataMode: 'vendors',
          colors: Array.from(years).map((_, i) =>
            d3.interpolateRgb(
              vendorsFirstColor,
              vendorsLastColor
            )(i / (years.length - 1))
          ),
        },
        {
          dataMode: 'buyers',
          colors: Array.from(years).map((_, i) =>
            d3.interpolateRgb(
              buyersFirstColor,
              buyersLastColor
            )(i / (years.length - 1))
          ),
        },
      ],
    });

    // TODO Hover on line make it highlighted and other lines dimmed
    // TODO Hover on point make it highlighted and info tooltip
    // TODO Hover on legend cell make line highlighted and other lines dimmed
    // TODO Hover on legend line or column make lines highlighted and other lines dimmed
  }

  private renderData(
    organizationsCountByMonth: Map<
      string,
      {
        year: number;
        month: number;
        count: number;
      }
    >,
    x: d3.ScaleBand<string>,
    y: d3.ScaleLinear<number, number>,
    colorScale: d3.ScaleOrdinal<string, string>,
    className: string,
    viewMode: ViewMode,
    shouldRender: boolean
  ) {
    const svg = d3.select('#chart');

    const entries = Array.from(organizationsCountByMonth.entries());

    // Display the dots
    svg
      .selectAll(`circle.${className}`)
      .data(entries)
      .enter()
      .append('circle')
      .attr('class', className)
      .attr('r', 5)
      .attr('fill', (d, i) => colorScale(d[1].year.toString()))
      .attr(
        'cx',
        (d, i) =>
          (x(viewMode === 'stacked' ? d[0].split('-')[1] : d[0]) || 0) +
          x.bandwidth() / 2
      )
      .attr('cy', d => y(d[1].count));

    // Animate the dots
    svg
      .selectAll(`circle.${className}`)
      .data(entries)
      .transition()
      .duration(1000)
      .attr(
        'cx',
        (d, i) =>
          (x(viewMode === 'stacked' ? d[0].split('-')[1] : d[0]) || 0) +
          x.bandwidth() / 2
      )
      .attr('cy', d => y(d[1].count));

    // Display the lines
    const line = d3
      .line<[string, { year: number; month: number; count: number }]>()
      .defined((d, i, data) => {
        // Ensure the year does not change between consecutive points in stacked mode
        return (
          viewMode !== 'stacked' || i === 0 || data[i - 1][1].year === d[1].year
        );
      })
      .x((d, i) => {
        const xValue = viewMode === 'stacked' ? d[0].split('-')[1] : d[0];
        return (x(xValue) || 0) + x.bandwidth() / 2;
      })
      .y((d, i) => y(d[1].count));

    svg
      .selectAll(`path.${className}`)
      .data(entries)
      .enter()
      .append('path')
      .attr('class', className)
      .attr('fill', 'none')
      .attr('stroke', (d, i) => colorScale(d[1].year.toString()))
      .attr('stroke-width', 3)
      .attr('d', (d, i) => (i === 0 ? line([d]) : line([entries[i - 1], d])));

    // Animate the lines
    svg
      .selectAll(`path.${className}`)
      .data(entries)
      .transition()
      .duration(1000)
      .attr('d', (d, i) => (i === 0 ? line([d]) : line([entries[i - 1], d])));

    if (!shouldRender) {
      svg.selectAll(`circle.${className}`).attr('opacity', 0);
      svg.selectAll(`path.${className}`).attr('opacity', 0);
    } else {
      svg.selectAll(`circle.${className}`).attr('opacity', 1);
      svg.selectAll(`path.${className}`).attr('opacity', 1);
    }
  }
}
