import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import * as d3 from 'd3';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { Order } from '../../models/orders.model';

interface ChartData {
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
  private data: ChartData[];

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

  private extractData(): ChartData[] {
    return Array.from(
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
      } as ChartData;
    });
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

    const svg = d3
      .select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .style('background-color', 'red');

    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(this.data, data => {
          return data.date.getTime();
        }) as [number, number]
      )
      .range([0, width]);
    svg
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale));

    const yScale = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(this.data, data => {
          return data.orders.length;
        }) as number,
      ])
      .range([height, 0]);
    svg.append('g').call(d3.axisLeft(yScale));

    svg
      .append('path')
      .datum(this.data.sort((a, b) => a.date.getTime() - b.date.getTime()))
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .line<ChartData>()
          .x(d => xScale(d.date))
          .y(d => yScale(d.orders.length))
      );

    svg
      .selectAll('circle')
      .data(this.data)
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

    svg
      .append('text')
      .attr('x', xScale(this.data[this.data.length - 1].date) + 10)
      .attr('y', yScale(this.data[this.data.length - 1].orders.length) + 4)
      .style('font-size', 14)
      .text('Total');
  }
}
