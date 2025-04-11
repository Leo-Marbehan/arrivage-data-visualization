import { Routes } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { RawDataPageComponent } from './components/raw-data-page/raw-data-page.component';
import { VisualizationPageComponent } from './components/visualization-page/visualization-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePageComponent },
  { path: 'raw-data', component: RawDataPageComponent },
  { path: 'visualization-4', component: VisualizationPageComponent },
  { path: '**', redirectTo: 'home' },
];
