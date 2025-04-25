import { Component } from '@angular/core';
import { OrderVisualizationChartComponent } from '../order-visualization-chart/order-visualization-chart.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { Visualization6ChartComponent } from '../visualization-6-chart/visualization-6-chart.component';

@Component({
  selector: 'app-users-page',
  imports: [
    ToolbarComponent,
    Visualization6ChartComponent,
    OrderVisualizationChartComponent,
  ],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent {}
