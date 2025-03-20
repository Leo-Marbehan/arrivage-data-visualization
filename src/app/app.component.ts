import { Component, effect, Signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './services/loading.service';
import { OrganizationsService } from './services/organizations.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly loadingService: LoadingService
  ) {
    effect(() => {
      if (this.isInitializedSignal()) {
        this.loadingService.stop();
      } else {
        this.loadingService.start('Loading organizations...');
      }
    });
  }

  get isInitializedSignal(): Signal<boolean> {
    return this.organizationsService.isInitializedSignal;
  }
}
