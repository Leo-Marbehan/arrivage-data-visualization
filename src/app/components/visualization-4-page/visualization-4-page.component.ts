import { Component } from '@angular/core';
import { OrderVisualizationChartComponent } from '../order-visualization-chart/order-visualization-chart.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-visualization-4-page',
  standalone: true,
  imports: [CommonModule, ToolbarComponent, OrderVisualizationChartComponent],
  templateUrl: './visualization-4-page.component.html',
  styleUrl: './visualization-4-page.component.scss',
})
export class VisualizationFourPageComponent {}
