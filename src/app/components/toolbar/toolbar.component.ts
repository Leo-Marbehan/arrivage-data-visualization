import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatToolbarModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {
  constructor(private readonly router: Router) {}

  async navigateToHome() {
    await this.router.navigate(['home']);
  }

  async navigateToRawData() {
    await this.router.navigate(['raw-data']);
  }
  
  async navigateToVisualization4() {
    await this.router.navigate(['visualization-4']);
  }
}
