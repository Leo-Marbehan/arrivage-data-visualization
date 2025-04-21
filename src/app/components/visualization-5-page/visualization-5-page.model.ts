import { VendorProductCategory } from '../../models/organizations.model';

export interface Scales {
  x: d3.ScaleTime<number, number, never>;
  y: d3.ScaleLinear<number, number, never>;
}

export interface Season {
  start: Date;
  end: Date;
  color: string;
  id: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Filter {
  categoryId: VendorProductCategory;
  name: string;
  displayed: boolean;
}

export interface ChartData {
  date: Date;
  categories: VendorProductCategory[];
}

export interface DatesByCategory {
  categoryId: VendorProductCategory;
  dates: Date[];
}

export interface CategoryData {
  categoryId: VendorProductCategory;
  ordersPerMonth: MonthData[];
}

export interface MonthData {
  date: Date;
  nbOrders: number;
}
