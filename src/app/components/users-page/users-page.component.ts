import { Component } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { Visualization6ChartComponent } from '../visualization-6-chart/visualization-6-chart.component';

@Component({
  selector: 'app-users-page',
  imports: [ToolbarComponent, Visualization6ChartComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent {}
