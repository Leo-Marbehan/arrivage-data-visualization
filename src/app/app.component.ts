import { Component, computed, effect, Signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingService } from './services/loading.service';
import { OrganizationsService } from './services/organizations.service';
import { PurchaseOrdersService } from './services/purchase-orders.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly isInitializedSignal: Signal<boolean> = computed(() => {
    return (
      this.organizationsService.isInitializedSignal() &&
      this.purchaseOrdersService.isInitializedSignal()
    );
  });

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly loadingService: LoadingService
  ) {
    effect(() => {
      if (this.isInitializedSignal()) {
        this.loadingService.stop();
      } else {
        this.loadingService.start('Loading data from CSV files...');
      }
    });
  }
}
