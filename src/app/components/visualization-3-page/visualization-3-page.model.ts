export enum DataType {
  // DISTANCES = 'Distances',
  AMOUNTS = 'Montants',
  TAXED_AMOUNTS = 'Montants (avec taxes)',
  NBR_ORDERS = 'Nombre de commandes',
}

export interface DataPoint {
  source: string;
  target: string;
  distances: number;
  amounts: number;
  taxed_amounts: number;
  nbr_orders: number;
}
