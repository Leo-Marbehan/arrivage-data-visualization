import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Navigation } from '../../classes/navigation.class';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent extends Navigation {
  constructor(router: Router) {
    super(router);
  }
}
