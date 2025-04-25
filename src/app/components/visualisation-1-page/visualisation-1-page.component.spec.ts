import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Visualisation1PageComponent } from './visualisation-1-page.component';

describe('Visualisation1PageComponent', () => {
  let component: Visualisation1PageComponent;
  let fixture: ComponentFixture<Visualisation1PageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Visualisation1PageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(Visualisation1PageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
