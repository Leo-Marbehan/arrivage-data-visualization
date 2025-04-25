/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Component } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { MatRadioModule } from '@angular/material/radio';
import { DataType } from './visualization-3-page.model';
import { Visualization3PreprocessingService } from './visualization-3-page.preprocessing.service';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-visualization-3-page',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
    CommonModule,
    ToolbarComponent,
    MatRadioModule,
  ],
  templateUrl: './visualization-3-page.component.html',
  styleUrl: './visualization-3-page.component.scss',
})
export class Visualization3PageComponent {
  private _data_type_dict: [DataType, string][] = [];

  constructor(public v3ps: Visualization3PreprocessingService) {
    this.v3ps
      .initialize()
      .then(() => {
        this.createVisualization();
        this._data_type_dict = Object.keys(DataType).map((data_type, i) => {
          const enum_value = Object.values(DataType)[i];
          return [enum_value, Object.values(DataType)[i]];
        });
      })
      .catch(error => {
        console.log(error);
      });
  }

  get data_type_dict(): [DataType, string][] {
    return this._data_type_dict;
  }

  redraw() {
    d3.select('#visualization').select('svg').remove();
    this.createVisualization();
  }

  createVisualization() {
    if (this.v3ps.can_start) {
      const height = document.getElementById('visualization')!.clientHeight;
      const width = height;
      const inner_radious = width / 3 - 65;
      const outer_radious = inner_radious + 10;

      const angle_padding = (Math.PI * 2 * (60 / 360)) / this.v3ps.names.length;
      const chords = d3
        .chordDirected()
        .padAngle(angle_padding)
        .sortSubgroups(d3.ascending)(this.v3ps.matrix);

      d3.select('#visualization')
        .append('svg')
        .attr('display', 'block')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', [-width / 2, -height / 2, width, height])
        .attr('style', 'font: 12px sans-serif;');

      this.set_archs(chords, inner_radious, outer_radious);
      this.set_labels(chords, outer_radious, height);
      this.set_ribbons(chords, inner_radious);
      this.set_ticks(chords, outer_radious);
    }
  }

  change_shown_data(event: MatSelectChange) {
    this.v3ps.update_data_type(event.value as DataType, () => {
      this.redraw();
    });
  }

  toggle_expanded_region(event: MatSelectChange) {
    this.v3ps.toggle_subregions(event.value as string, () => {
      this.redraw();
    });
  }

  private set_archs(
    chords: d3.Chords,
    inner_radious: number,
    outer_radious: number
  ) {
    const arc = d3.arc().innerRadius(inner_radious).outerRadius(outer_radious);

    d3.select('#visualization svg')
      .append('g')
      .selectAll()
      .data(chords.groups)
      .join('g')
      .append('path')
      .classed('arc', true)
      .attr('fill', d => this.v3ps.colors[d.index])
      .attr('d', d =>
        String(
          arc({
            ...d,
            innerRadius: inner_radious - 1,
            outerRadius: outer_radious,
          } as d3.DefaultArcObject)
        )
      )
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        d3.select(event.currentTarget).attr('fill', 'red');
        this.set_label_color(d1.index, 'red');
        this.set_ribbon_color(d1.index, 'red');
      })
      .on('mouseout', (event, d1) => {
        d3.select(event.currentTarget).attr('fill', this.v3ps.colors[d1.index]);
        this.reset_ribbon_colors();
        this.reset_label_colors();
      });
  }

  private set_labels(chords: d3.Chords, outer_radious: number, height: number) {
    d3.select('#visualization svg')
      .append('g')
      .selectAll()
      .data(chords.groups)
      .join('g')
      .append('text')
      .each(d => ((d as any).angle = (d.startAngle + d.endAngle) / 2))
      .attr(
        'transform',
        d => `
          rotate(${((d as any).angle * 180) / Math.PI - 90})
          translate(${height / 25 + outer_radious})
          ${(d as any).angle > Math.PI ? 'rotate(180)' : ''}
        `
      )
      .attr('text-anchor', d => ((d as any).angle > Math.PI ? 'end' : 'start'))
      .text(d => this.v3ps.names[d.index])
      .classed('label', true)
      .attr('fill', d2 => this.v3ps.colors[(d2 as any).index])
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        d3.select(event.currentTarget).attr('fill', 'red');
        this.set_arc_color(d1.index, 'red');
        this.set_ribbon_color(d1.index, 'red');
      })
      .on('mouseout', (event, d1) => {
        d3.select(event.currentTarget).attr('fill', this.v3ps.colors[d1.index]);
        this.reset_ribbon_colors();
        this.reset_arc_color();
      });
  }

  private set_ribbons(chords: d3.Chords, inner_radious: number) {
    const tooltip = d3
      .select('#dynamic-legend')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden');

    const sum = this.v3ps.datapoints
      ?.map(d => this.v3ps.dt_conv(d))
      .reduce((a, b) => a + b);
    const small_step = d3.tickStep(0, sum, 200);
    const formatValue = d3.formatPrefix(',.0', small_step);

    const ribbon = d3
      .ribbonArrow()
      .headRadius(10)
      .radius(inner_radious - 0.2)
      .padAngle(Math.PI * 2 * (0.1 / 360));

    d3.select('#visualization svg')
      .append('g')
      .attr('fill-opacity', 0.75)
      .selectAll()
      .data(chords)
      .join('path')
      .classed('ribbon', true)
      .attr('fill', d => this.v3ps.colors[d.source.index])
      .attr('d', d =>
        String(
          ribbon({
            source: {
              ...d.source,
              radius: 600,
            },
            target: {
              ...d.target,
              radius: 600,
            },
          } as d3.Ribbon)
        )
      )
      .on('mouseover', (event, d1) => {
        // change all bars to red when any is hovered
        this.set_arc_color(d1.source.index, 'red');
        this.set_label_color(d1.source.index, 'red');
        this.set_label_color(d1.target.index, 'red');
        this.set_ribbon_color(d1.source.index, 'red');

        if (d1.source.index === d1.target.index) {
          const from_and_to_before =
            (d1.source.endAngle + d1.source.startAngle) / 2 > Math.PI;
          const from_and_to_name = `${from_and_to_before ? '(depuis & vers) ' : ''}${this.v3ps.names[d1.source.index]}${from_and_to_before ? '' : ' (depuis & vers)'}`;
          this.set_label_name(d1.source.index, from_and_to_name);
        } else {
          const from_before =
            (d1.source.endAngle + d1.source.startAngle) / 2 > Math.PI;
          const to_before =
            (d1.target.endAngle + d1.target.startAngle) / 2 > Math.PI;

          const from_name = `${from_before ? '(depuis) ' : ''}${this.v3ps.names[d1.source.index]}${from_before ? '' : ' (depuis)'}`;
          const to_name = `${to_before ? '(vers) ' : ''}${this.v3ps.names[d1.target.index]}${to_before ? '' : ' (vers)'}`;
          this.set_label_name(d1.source.index, from_name);
          this.set_label_name(d1.target.index, to_name);
        }

        d3.select(event.currentTarget).attr('fill', 'DarkRed');
        return tooltip
          .text(formatValue(d1.target.value))
          .style('font-weight', 'bold')
          .style('visibility', 'visible');
      })
      .on('mouseout', (event, d1) => {
        this.reset_ribbon_colors();
        this.reset_arc_color();
        this.reset_label_colors();
        this.reset_label_name();
        return tooltip.style('visibility', 'hidden');
      })
      .on('mousemove', function (event) {
        return tooltip
          .style('top', event!.pageY - 30 + 'px')
          .style('left', event!.pageX - 30 + 'px');
      });
  }

  private set_ticks(chords: d3.Chords, outer_radious: number) {
    const sum = this.v3ps.datapoints
      ?.map(d => this.v3ps.dt_conv(d))
      .reduce((a, b) => a + b);
    const small_step = d3.tickStep(0, sum, 200);

    const groupTick = d3
      .select('#visualization svg')
      .append('g')
      .selectAll()
      .data(chords.groups.filter(d => d.endAngle - d.startAngle > 0.1))
      .join('g')
      .selectAll()
      .data(d => {
        console.log(d);
        return d3.range(0, d.value, small_step).map(value => {
          return {
            value: value,
            angle:
              (value * (d.endAngle - d.startAngle)) / d.value + d.startAngle,
          };
        });
      })
      .join('g')
      .attr(
        'transform',
        d =>
          `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${outer_radious},0)`
      );

    groupTick.append('line').attr('stroke', 'currentColor').attr('x2', 6);

    const formatValue = d3.formatPrefix(',.0', small_step);
    const big_step = d3.tickStep(0, sum, 40);
    groupTick
      .filter(d => d.value % big_step === 0)
      .append('text')
      .attr('transform', d =>
        d.angle > Math.PI ? 'rotate(180) translate(-15)' : null
      )
      .attr('x', 7)
      .attr('dy', '.3em')
      .attr('text-anchor', d => (d.angle > Math.PI ? 'end' : null))
      .text(d => formatValue(d.value));
  }

  private reset_ribbon_colors() {
    d3.selectAll('.ribbon').attr(
      'fill',
      d2 => this.v3ps.colors[(d2 as any).source.index]
    );
  }

  private reset_arc_color() {
    d3.selectAll('.arc').attr(
      'fill',
      d2 => this.v3ps.colors[(d2 as any).index]
    );
  }

  private reset_label_colors() {
    d3.selectAll('.label').attr(
      'fill',
      d2 => this.v3ps.colors[(d2 as any).index]
    );
  }

  private reset_label_name() {
    d3.selectAll('.label').text(d => this.v3ps.names[(d as any).index]);
  }

  private set_arc_color(source_index: number, color: string) {
    d3.selectAll('.arc')
      .filter(d => source_index === (d as any).index)
      .attr('fill', color);
  }

  private set_ribbon_color(source_index: number, color: string) {
    d3.selectAll('.ribbon')
      .filter(d => source_index === (d as any).source.index)
      .attr('fill', color);
  }

  private set_label_color(source_index: number, color: string) {
    d3.selectAll('.label')
      .filter(d => source_index === (d as any).index)
      .attr('fill', color);
  }

  private set_label_name(source_index: number, name: string) {
    d3.selectAll('.label')
      .filter(d => source_index === (d as any).index)
      .text(name);
  }
}
