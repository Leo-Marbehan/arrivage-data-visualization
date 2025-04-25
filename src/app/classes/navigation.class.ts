import { Router } from '@angular/router';

export class Navigation {
  constructor(private readonly router: Router) {}

  async navigateToRawData() {
    await this.router.navigate(['raw-data']);
  }

  async navigateToVisualization(number: number) {
    await this.router.navigate([`visualization-${number}`]);
  }

  async navigateToHome() {
    await this.router.navigate(['home']);
  }

  async navigateToUsers() {
    await this.router.navigate(['users']);
  }
}
