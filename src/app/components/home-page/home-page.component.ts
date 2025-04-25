import { Component, AfterViewInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Navigation } from '../../classes/navigation.class';
import { ToolbarComponent } from '../toolbar/toolbar.component';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule, MatIconModule, ToolbarComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent extends Navigation implements AfterViewInit {
  constructor(router: Router) {
    super(router);
  }

  ngAfterViewInit() {
    const sections = document.querySelectorAll('.section');

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      {
        threshold: 0.5,
      }
    );

    sections.forEach(section => observer.observe(section));
  }
}
