import { Component } from '@angular/core';
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
export class HomePageComponent extends Navigation {
  constructor(router: Router) {
    super(router);
  }
}
