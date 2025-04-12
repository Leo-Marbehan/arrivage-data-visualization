import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizationFivePageComponent } from './visualization-5-page.component';

describe('VisualizationFivePageComponent', () => {
  let component: VisualizationFivePageComponent;
  let fixture: ComponentFixture<VisualizationFivePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizationFivePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VisualizationFivePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
