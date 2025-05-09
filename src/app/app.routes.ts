import { Routes } from '@angular/router';
import { HomePageComponent } from './components/home-page/home-page.component';
import { RawDataPageComponent } from './components/raw-data-page/raw-data-page.component';
import { Visualisation1PageComponent } from './components/visualisation-1-page/visualisation-1-page.component';
import { Visualization2PageComponent } from './components/visualization-2-page/visualization-2-page/visualization-2-page.component';
import { Visualization3PageComponent } from './components/visualization-3-page/visualization-3-page.component';
import { VisualizationFourPageComponent } from './components/visualization-4-page/visualization-4-page.component';
import { VisualizationFivePageComponent } from './components/visualization-5-page/visualization-5-page.component';
import { Visualization6PageComponent } from './components/visualization-6-page/visualization-6-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePageComponent },
  { path: 'raw-data', component: RawDataPageComponent },
  { path: 'visualization-1', component: Visualisation1PageComponent },
  { path: 'visualization-3', component: Visualization3PageComponent },
  { path: 'visualization-2', component: Visualization2PageComponent },
  { path: 'visualization-4', component: VisualizationFourPageComponent },
  { path: 'visualization-5', component: VisualizationFivePageComponent },
  { path: 'visualization-6', component: Visualization6PageComponent },
  { path: '**', redirectTo: 'home' },
];
