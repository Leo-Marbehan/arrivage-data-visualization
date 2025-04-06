import { Component, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Order } from '../../models/orders.model';
import { Organization } from '../../models/organizations.model';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';
import { OrdersTableComponent } from '../orders-table/orders-table.component';
import { OrganizationsTableComponent } from '../organizations-table/organizations-table.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

@Component({
  selector: 'app-raw-data-page',
  imports: [
    ToolbarComponent,
    MatButtonModule,
    MatIconModule,
    OrganizationsTableComponent,
    OrdersTableComponent,
  ],
  templateUrl: './raw-data-page.component.html',
  styleUrl: './raw-data-page.component.scss',
})
export class RawDataPageComponent {
  readonly viewSignal: WritableSignal<'organizations' | 'orders'> =
    signal('organizations');

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly ordersService: OrdersService
  ) {}

  get organizations(): Organization[] {
    return this.organizationsService.organizations;
  }

  get orders(): Order[] {
    return this.ordersService.orders;
  }

  onToggleViewButtonClick(): void {
    this.viewSignal.update(view =>
      view === 'organizations' ? 'orders' : 'organizations'
    );
  }
}
