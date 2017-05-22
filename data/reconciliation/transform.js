/* jshint node: true, esnext: true */
'use strict';

const parse = require('../../lib/parse');

const REPORTED_GOV = 'Government Reported';
const REPORTED_CO = 'Company Reported';
const VARIANCE_DOLLARS = 'Variance Dollars';
const VARIANCE_PERCENT = 'Variance Percent';
const N_A = 'N/A';

const parseNA = function(field) {
  return function(d) {
    var value = d[field];
    return value === N_A
      ? null
      : parse.number(value);
  };
};

const MATERIAL_VARIANCES = {
  'Royalties': {
    threshold: 1,
    floor: 100000,
    name: 'Royalties'
  },
  'Rents':  {
    threshold: 2,
    floor: 50000,
    name: 'Rents'
  },
  'Bonus': {
    threshold: 2,
    floor: 100000,
    name: 'Bonuses'
  },
  'Other Revenue': {
    threshold: 3,
    floor: 50000,
    name: 'Other revenue'
  },
  'Offshore Inspection Fee': {
    threshold: 2,
    floor: 20000,
    name: 'Offshore inspection fees'
  },
  'ONRR Civil Penalties': {
    threshold: 1,
    floor: 1000,
    name: 'Civil penalties'
  },
  'Bonus & 1st Year Rental': {
    threshold: 2,
    floor: 10000,
    name: 'BLM bonus and first year rentals'
  },
  'Permit Fees': {
    threshold: 3,
    floor: 10000,
    name: 'Permit fees'
  },
  'Renewables': {
    threshold: 'N/A',
    floor: 'N/A',
    name: 'BLM renewables'
  },
  'AML Fees': {
    threshold: 2,
    floor: 100000,
    name: 'OSMRE AML fees'
  },
  'OSMRE Civil Penalties': {
    threshold: 3,
    floor: 0,
    name: 'OSMRE civil penalties'
  },
  'Corporate Income Tax': {
    threshold: 1,
    floor: 100000,
    name: 'Taxes'
  }
};

module.exports = {
  year:             'Year',
  company:          'Company',
  revenue_type:     'Type',
  reported_gov:     parseNA(REPORTED_GOV),
  reported_company: parseNA(REPORTED_CO),
  reported_note: function(d) {
    var str = d[REPORTED_CO];
    return isNaN(str) ? str : null;
  },
  variance_dollars: parseNA(VARIANCE_DOLLARS),
  variance_percent: parseNA(VARIANCE_PERCENT),
  /*
   * determine if this is a "material variance," according to the threshold and
   * $ floor values specific to each type of revenue
   */
  variance_material: function isMaterialVariance(d) {
    var gov = Number(d[REPORTED_GOV]);
    var co = Number(d[REPORTED_CO]);
    var variance = Number(d[VARIANCE_PERCENT]);
    var delta = Math.abs(gov - co);
    var material = MATERIAL_VARIANCES[d.Type];
    return (variance > material.threshold && delta > material.floor) ? 1 : 0;
  }
};
