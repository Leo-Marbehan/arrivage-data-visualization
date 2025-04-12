import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { Order } from '../../models/orders.model';

interface ProductTypeData {
  name: string;
  ordersPerMonth: MonthData[];
}

interface MonthData {
  date: Date;
  orders: Order[];
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
  private data: ProductTypeData[];

  constructor(
    private ordersService: OrdersService,
    private organizationsService: OrganizationsService
  ) {
    this.data = this.extractData();
  }

  ngOnInit(): void {
    d3.select(window).on('resize', this.drawChart.bind(this));
    this.drawChart();
  }

  private extractData(): ProductTypeData[] {
    return [
      {
        name: 'Total',
        ordersPerMonth: Array.from(
          d3
            .group(
              this.ordersService.orders,
              order =>
                new Date(
                  order.distributionDate.getFullYear(),
                  order.distributionDate.getMonth()
                )
            )
            .entries()
        ).map(([date, orders]) => {
          return {
            date,
            orders,
          } as MonthData;
        }),
      },
    ];
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
          this.data
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
    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale));

    const yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(
          this.data,
          productTypeData =>
            d3.max(productTypeData.ordersPerMonth, monthData => {
              return monthData.orders.length;
            }) as number
        ) as number,
      ])
      .range([height, 0]);
    g.append('g').call(d3.axisLeft(yScale));

    this.data.forEach(productTypeData =>
      this.drawLine(productTypeData, xScale, yScale)
    );
  }

  private drawLine(
    data: ProductTypeData,
    xScale: d3.ScaleTime<number, number, never>,
    yScale: d3.ScaleLinear<number, number, never>
  ) {
    const g = d3.select('#graph-g');
    g.append('path')
      .datum(
        data.ordersPerMonth.sort((a, b) => a.date.getTime() - b.date.getTime())
      )
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line<MonthData>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.orders.length))
      );

    g.selectAll('circle')
      .data(data.ordersPerMonth)
      .enter()
      .append('circle')
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .attr('cx', function (d) {
        return xScale(d.date);
      })
      .attr('cy', function (d) {
        return yScale(d.orders.length);
      })
      .attr('r', 3);

    const lastMonth = data.ordersPerMonth[data.ordersPerMonth.length - 1];

    g.append('text')
      .attr('x', xScale(lastMonth.date) + 10)
      .attr('y', yScale(lastMonth.orders.length) + 4)
      .style('font-size', 14)
      .text(data.name);
  }
}
