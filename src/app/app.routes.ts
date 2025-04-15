import { Routes } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { RawDataPageComponent } from './components/raw-data-page/raw-data-page.component';
import { Visualisation1PageComponent } from './components/visualisation-1-page/visualisation-1-page.component';
import { Visualization3PageComponent } from './components/visualization-3-page/visualization-3-page.component';
import { VisualizationFourPageComponent } from './components/visualization-4-page/visualization-4-page.component';
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePageComponent },
  { path: 'raw-data', component: RawDataPageComponent },
  { path: 'viz1', component: Visualisation1PageComponent },
  { path: 'visualization-3', component: Visualization3PageComponent },
  { path: 'visualization-4', component: VisualizationFourPageComponent },
  { path: '**', redirectTo: 'home' },
];
