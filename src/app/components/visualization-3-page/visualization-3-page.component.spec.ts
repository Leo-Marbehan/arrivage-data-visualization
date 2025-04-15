import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Visualization3PageComponent } from './visualization-3-page.component';

describe('VisualizationFourPageComponent', () => {
  let component: Visualization3PageComponent;
  let fixture: ComponentFixture<Visualization3PageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Visualization3PageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(Visualization3PageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
