import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { parse, ParseResult } from 'papaparse';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CsvService {
  constructor(private readonly httpClient: HttpClient) {}

  async loadCsvData(filePath: string): Promise<Record<string, string>[]> {
    const response = await firstValueFrom(
      this.httpClient.get(filePath, { responseType: 'text' })
    );

    const result: ParseResult<Record<string, string>> = await new Promise(
      (resolve, reject) => {
        parse(response, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      }
    );

    return result.data;
  }
}
