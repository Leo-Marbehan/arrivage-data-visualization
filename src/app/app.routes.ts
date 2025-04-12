import { Routes } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { RawDataPageComponent } from './components/raw-data-page/raw-data-page.component';
import { VisualizationFourPageComponent } from './components/visualization-4-page/visualization-4-page.component';
import { VisualizationFivePageComponent } from './components/visualization-5-page/visualization-5-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePageComponent },
  { path: 'raw-data', component: RawDataPageComponent },
  { path: 'visualization-4', component: VisualizationFourPageComponent },
  { path: 'visualization-5', component: VisualizationFivePageComponent },
  { path: '**', redirectTo: 'home' },
];
