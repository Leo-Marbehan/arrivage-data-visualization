import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizationFourPageComponent } from './visualization-4-page.component';

describe('VisualizationFourPageComponent', () => {
  let component: VisualizationFourPageComponent;
  let fixture: ComponentFixture<VisualizationFourPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizationFourPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VisualizationFourPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
