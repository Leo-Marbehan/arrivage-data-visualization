import * as d3 from 'd3';
import { Order } from '../../models/orders.model';
import {
  translateVendorProductCategory,
  VENDOR_PRODUCT_CATEGORIES,
  VendorOrganization,
  VendorProductCategory,
} from '../../models/organizations.model';
import {
  ChartData,
  DatesByCategory,
  CategoryData,
  MonthData,
  Filter,
} from './visualization-5-page.model';
import { MAX_DATE, MIN_DATE } from './visualization-5-page.constants';

export class VisualizationFiveUtils {
  // -----------------------------------------------------------
  // MARK: Data processing

  static cropDateRange(orders: Order[]): Order[] {
    return orders.filter(
      order =>
        order.distributionDate.getTime() >= new Date(MIN_DATE).getTime() &&
        order.distributionDate.getTime() <= new Date(MAX_DATE).getTime()
    );
  }

  static attachCategoriesToOrderDates(
    orders: Order[],
    vendors: VendorOrganization[]
  ): ChartData[] {
    return orders.reduce((data, order) => {
      const categories = vendors.find(
        vendor => vendor.id === order.vendorOrganizationId
      )?.productCategories;
      if (categories) {
        data.push({
          date: order.distributionDate,
          categories,
        });
        return data;
      } else {
        return data;
      }
    }, [] as ChartData[]);
  }

  static groupByCategory(data: ChartData[]): DatesByCategory[] {
    return data.reduce((categoriesWithDates, order) => {
      order.categories.forEach(categoryId => {
        const existing = categoriesWithDates.find(
          category => category.categoryId === categoryId
        );
        if (!existing) {
          categoriesWithDates.push({
            categoryId,
            dates: [order.date],
          });
        } else {
          existing.dates.push(order.date);
        }
      });
      return categoriesWithDates;
    }, [] as DatesByCategory[]);
  }

  static groupByMonth(data: DatesByCategory[]): CategoryData[] {
    return data.map(category => {
      return {
        categoryId: category.categoryId,
        ordersPerMonth: category.dates
          .reduce((ordersPerMonth, date) => {
            const month = new Date(date.getFullYear(), date.getMonth());
            const existing = ordersPerMonth.find(
              monthData => monthData.date.getTime() === month.getTime()
            );
            if (!existing) {
              ordersPerMonth.push({ date: month, nbOrders: 1 });
            } else {
              existing.nbOrders++;
            }
            return ordersPerMonth;
          }, [] as MonthData[])
          .sort((a, b) => a.date.getTime() - b.date.getTime()),
      };
    });
  }

  // -----------------------------------------------------------
  // MARK: Filters

  static filterTotal(
    data: ChartData[],
    displayedCategories: VendorProductCategory[]
  ): MonthData[] {
    return Array.from(
      d3
        .group(
          data.filter(d =>
            this.hasIntersection(d.categories, displayedCategories)
          ),
          order => new Date(order.date.getFullYear(), order.date.getMonth())
        )
        .entries()
    )
      .map(([date, orders]) => {
        return {
          date,
          nbOrders: orders.length,
        } as MonthData;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  static filterCategories(
    groupedData: CategoryData[],
    displayedCategories: VendorProductCategory[]
  ): CategoryData[] {
    return groupedData.filter(category =>
      displayedCategories.includes(category.categoryId)
    );
  }

  static createFilters(): Filter[] {
    return VENDOR_PRODUCT_CATEGORIES.map(categoryId => {
      return {
        categoryId,
        name: translateVendorProductCategory(categoryId),
        displayed: true,
      };
    });
  }

  // -----------------------------------------------------------
  // MARK: Miscellaneous

  static hasIntersection(a: string[], b: string[]): boolean {
    return a.filter(value => b.includes(value)).length > 0;
  }

  static getMaxY(
    isCategoriesView: boolean,
    filteredCategories: CategoryData[],
    filteredTotal: MonthData[]
  ): number {
    if (isCategoriesView) {
      return d3.max(
        filteredCategories,
        category =>
          d3.max(
            category.ordersPerMonth,
            monthData => monthData.nbOrders
          ) as number
      ) as number;
    } else {
      return d3.max(filteredTotal, monthData => {
        return monthData.nbOrders;
      })!;
    }
  }
}
