import { Component, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Organization } from '../../models/organizations.model';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationsTableComponent } from '../organizations-table/organizations-table.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

@Component({
  selector: 'app-raw-data-page',
  imports: [
    ToolbarComponent,
    MatButtonModule,
    MatIconModule,
    OrganizationsTableComponent,
  ],
  templateUrl: './raw-data-page.component.html',
  styleUrl: './raw-data-page.component.scss',
})
export class RawDataPageComponent {
  readonly viewSignal: WritableSignal<'organizations' | 'purchaseOrders'> =
    signal('organizations');

  constructor(private readonly organizationsService: OrganizationsService) {}

  get organizations(): Organization[] {
    return this.organizationsService.organizations;
  }

  onToggleViewButtonClick(): void {
    this.viewSignal.update(view =>
      view === 'organizations' ? 'purchaseOrders' : 'organizations'
    );
  }
}
