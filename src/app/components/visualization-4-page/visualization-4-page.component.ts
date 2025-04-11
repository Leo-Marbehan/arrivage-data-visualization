import { Component } from '@angular/core';
import { OrderVisualizationChartComponent } from '../order-visualization-chart/order-visualization-chart.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-visualization-page',
  standalone: true,
  imports: [CommonModule, ToolbarComponent, OrderVisualizationChartComponent],
  templateUrl: './visualization-page.component.html',
  styleUrl: './visualization-page.component.scss',
})
export class VisualizationFourPageComponent {}
