import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [MatButtonModule],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  constructor(private readonly router: Router) {}

  async navigateToRawData() {
    await this.router.navigate(['raw-data']);
  }

  async navigateToViz1() {
    await this.router.navigate(['viz1']);
  }
  
  async navigateToVisualization3() {
    await this.router.navigate(['visualization-3']);
  }
  
  async navigateToVisualization4() {
    await this.router.navigate(['visualization-4']);
  }
}
