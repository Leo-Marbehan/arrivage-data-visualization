import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import {
  translateVendorProductCategory,
  VendorProductCategory,
} from '../../models/organizations.model';

interface ChartData {
  date: Date;
  categories: VendorProductCategory[];
}

interface CategoryData {
  name: string;
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
  private data: ChartData[];
  private filteredData: CategoryData[];

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService
  ) {
    this.data = this.ordersService.orders.reduce((data, order) => {
      const categories = this.organizationsService.vendorOrganizations.find(
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
    this.filteredData = this.filterData();
  }

  ngOnInit(): void {
    d3.select(window).on('resize', this.drawChart.bind(this));
    this.drawChart();
  }

  private filterData(): CategoryData[] {
    const total = {
      name: 'Total',
      ordersPerMonth: Array.from(
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
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    };
    return [total].concat(
      this.data
        .reduce(
          (categoriesWithDates, order) => {
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
          },
          [] as { name: VendorProductCategory; dates: Date[] }[]
        )
        .map(category => {
          return {
            name: translateVendorProductCategory(category.name),
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
        })
    );
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
        d3.extent(
          this.filteredData
            .reduce(
              (arr, productTypeData) => [
                ...arr,
                ...productTypeData.ordersPerMonth,
              ],
              [] as MonthData[]
            )
            .flat(),
          monthData => {
            return monthData.date.getTime();
          }
        ) as [number, number]
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
        d3.max(
          this.filteredData,
          productTypeData =>
            d3.max(productTypeData.ordersPerMonth, monthData => {
              return monthData.nbOrders;
            }) as number
        ) as number,
      ])
      .range([height, 0]);
    g.append('g').call(d3.axisLeft(yScale));

    this.filteredData.forEach(productTypeData =>
      this.drawLine(productTypeData, xScale, yScale)
    );
  }

  private drawLine(
    category: CategoryData,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>
  ) {
    const g = d3.select('#graph-g').append('g').attr('id', category.name);

    g.append('path')
      .datum(category.ordersPerMonth)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line<MonthData>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.nbOrders))
      );

    g.selectAll('circle')
      .data(category.ordersPerMonth)
      .enter()
      .append('circle')
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .attr('cx', function (d) {
        return xScale(d.date);
      })
      .attr('cy', function (d) {
        return yScale(d.nbOrders);
      })
      .attr('r', 3);

    const lastMonth =
      category.ordersPerMonth[category.ordersPerMonth.length - 1];

    g.append('text')
      .attr('x', xScale(lastMonth.date) + 10)
      .attr('y', yScale(lastMonth.nbOrders) + 4)
      .style('font-size', 14)
      .text(category.name);
  }
}
