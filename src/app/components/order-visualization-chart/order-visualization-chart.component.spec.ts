import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderVisualizationChartComponent } from './order-visualization-chart.component';

describe('OrderVisualizationChartComponent', () => {
  let component: OrderVisualizationChartComponent;
  let fixture: ComponentFixture<OrderVisualizationChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderVisualizationChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderVisualizationChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
