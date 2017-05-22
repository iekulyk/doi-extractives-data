#!/usr/bin/env node
/* jshint node: true */
'use strict';
var options = require('yargs')
  .option('user', {
    desc: 'your BEA API user ID'
  })
  .option('year', {
    desc: 'year or year range',
    // XXX BEA has not yet released 2015 data!
    default: '2005-2014'
  })
  .option('of', {
    desc: 'output format (tito-compatible)',
    default: 'tsv'
  })
  .option('o', {
    desc: 'output filename'
  })
  .argv;

var tito = require('tito').formats;
var request = require('request');
var qs = require('querystring');
var util = require('../../lib/util');
var fs = require('fs');
var async = require('async');
var extend = require('extend');
var streamify = require('stream-array');

var years = util.range(options.year);

var lineCodes = {
  total: 10,    // "[SA25N] Total employment"
  mining: 200,  // "[SA25N] Mining"
};

var tables = {
  // "Total Full-Time and Part-Time Employment by NAICS Industry"
  total:    'SA25N',
  // "Full-Time and Part-Time Wage and Salary Employment by NAICS Industry"
  wageSalary: 'SA27N',
};

var params = {
  UserID:       options.user || process.env.BEA_API_KEY,
  DataSetName:  'RegionalIncome',
  Method:       'GetData',
  Year:         years.join(','),
  GeoFips:      'STATE',
  LineCode:     lineCodes.mining
};

var fetch = function(params) {
  var url = [
    'https://www.bea.gov/api/data/',
    qs.stringify(params)
  ].join('?');
  console.warn('fetching:', params, '->', url);
  return request(url);
};

var parser = function() {
  return tito.createReadStream('json', {
    path: '.BEAAPI.Results.Data.*'
  });
};

var configs = {
  allTotal: {
    TableName: tables.total,
    LineCode: lineCodes.total
  },
  allMining: {
    TableName: tables.total,
    LineCode: lineCodes.mining
  },
  subMining: {
    TableName: tables.wageSalary,
    LineCode: lineCodes.mining
  }
};

async.mapSeries([
  configs.allTotal,
  configs.allMining,
  configs.subMining
], function(config, next) {
  var p = extend({}, params, config);

  var rows = [];
  var done = function(error) {
    if (error) {
      console.warn('error?', error, 'for', p);
    }
    next(null, rows);
  };

  fetch(p)
    .on('error', done)
    .pipe(parser())
    .on('data', function(row) {
      row = mapRow(row);
      if (row) {
        console.warn('+ row:', row);
        rows.push(row);
      }
    })
    .on('end', done);
}, function(error, sets) {
  if (error) {
    return console.error('error:', error);
  }

  console.warn('got %d sets', sets.length);

  sets[0].forEach(function(d) {
    d.Overall = d.Value;
    d.Industry = 0;
    d.Value = 0;
  });

  sets[1].forEach(function(d) {
    d.Overall = 0;
    d.Industry = d.Value;
    d.Value = 0;
  });

  sets[2].forEach(function(d) {
    d.Overall = 0;
    d.Industry = 0;
  });

  var rows = sets.reduce(function(list, set) {
    return list.concat(set);
  }, []);

  var keys = ['Region', 'Year'];
  var result = util.group(rows, keys, function(group) {
    var overall = 0;
    var industry = 0;
    var wageSalary = 0;

    group.values.forEach(function(d) {
      overall += coerceNumber(d.Overall);
      industry += coerceNumber(d.Industry);
      wageSalary += coerceNumber(d.Value);
    });

    var selfEmployed = industry - wageSalary;
    return {
      // Overall: overall,
      // Industry: industry,
      // WageSalary: wageSalary,
      Jobs: selfEmployed,
      Share: (selfEmployed / overall).toFixed(4)
    };
  })
  .map(function(entry) {
    return extend(entry.key, entry.value);
  });

  console.warn('got %d rows', result.length);
  console.warn(result[0]);

  streamify(result)
    .pipe(tito.createWriteStream(options.of))
    .pipe(fs.createWriteStream(options.o || '/dev/stdout'))
    .on('end', function() {
      console.warn('wrote %d rows', result.length);
    });
});

function mapRow(row) {
  var fips = row.GeoFips.substr(0, 2);
  if (fips > 90) {
    return;
  }
  return {
    Region: row.GeoName,
    Year:   row.TimePeriod,
    Value:  row.DataValue
  };
}

function coerceNumber(str) {
  return Number(str) || 0;
}
