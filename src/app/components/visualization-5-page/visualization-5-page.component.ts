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

interface ChartData {
  date: Date;
  categories: VendorProductCategory[];
}

interface DatesByCategory {
  name: VendorProductCategory;
  dates: Date[];
}

interface CategoryData {
  name: VendorProductCategory;
  ordersPerMonth: MonthData[];
}

interface MonthData {
  date: Date;
  nbOrders: number;
}

@Component({
  selector: 'app-visualization-5-page',
  standalone: true,
  imports: [ToolbarComponent],
  templateUrl: './visualization-5-page.component.html',
  styleUrl: './visualization-5-page.component.scss',
})
export class VisualizationFivePageComponent implements OnInit {
  @ViewChild('chart', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;
  private readonly data: ChartData[];
  private readonly groupedData: CategoryData[];
  private filteredCategories: CategoryData[] = [];
  private filteredTotal: MonthData[] = [];

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService
  ) {
    this.data = this.attachCategoriesToOrderDates(
      this.ordersService.orders,
      this.organizationsService.vendorOrganizations
    );
    this.groupedData = this.groupByMonth(this.groupByCategory(this.data));
    this.filterData();
  }

  ngOnInit(): void {
    d3.select(window).on('resize', this.drawChart.bind(this));
    this.drawChart();
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
      order.categories.forEach(categoryName => {
        const existing = categoriesWithDates.find(
          category => category.name === categoryName
        );
        if (!existing) {
          categoriesWithDates.push({
            name: categoryName,
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
        name: category.name,
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
    const displayedCategories = VENDOR_PRODUCT_CATEGORIES;
    this.filteredCategories = this.groupedData.filter(category =>
      displayedCategories.includes(category.name)
    );
    this.filteredTotal = Array.from(
      d3
        .group(
          this.data,
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

  private drawChart() {
    const containerWidth =
      this.chartContainer.nativeElement.getBoundingClientRect().width;
    const containerHeight = 500;
    const margin = { top: 20, right: 80, bottom: 30, left: 50 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    const g = d3
      .select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('id', 'graph-g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(this.filteredTotal, monthData => {
          return monthData.date.getTime();
        }) as [number, number]
      )
      .range([0, width]);
    g.append('g').attr('transform', `translate(0, ${height})`).call(
      d3.axisBottom(xScale)
      // .ticks(d3.timeMonth.every(3))
      // .tickFormat(domain => {
      //   return (domain as Date).getMonth() === 0
      //     ? (domain as Date).getFullYear().toString()
      //     : '';
      // })
    );

    const yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(this.filteredTotal, monthData => {
          return monthData.nbOrders;
        }) as number,
      ])
      .range([height, 0]);
    g.append('g').call(d3.axisLeft(yScale));

    this.filteredCategories.forEach(category =>
      this.drawLine(
        translateVendorProductCategory(category.name),
        'gray',
        category.ordersPerMonth,
        xScale,
        yScale
      )
    );
    this.drawLine('Total', 'black', this.filteredTotal, xScale, yScale);
  }

  private drawLine(
    name: string,
    color: string,
    data: MonthData[],
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>
  ) {
    const g = d3.select('#graph-g').append('g').attr('id', name);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line<MonthData>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.nbOrders))
      );

    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('fill', color)
      .attr('stroke', 'none')
      .attr('cx', function (d) {
        return xScale(d.date);
      })
      .attr('cy', function (d) {
        return yScale(d.nbOrders);
      })
      .attr('r', 3);

    const lastMonth = data[data.length - 1];

    g.append('text')
      .attr('x', xScale(lastMonth.date) + 10)
      .attr('y', yScale(lastMonth.nbOrders) + 4)
      .style('font-size', 14)
      .text(name);
  }
}
