/* jshint node: true, mocha: true */
/* jshint -W089 */
/* jshint -W110 */
var tito = require('tito');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var assert = require('assert');

var parse = require('../../lib/parse');
var loadPivot = require('../../lib/load-pivot');

describe('revenues by type', function() {

  describe('state rollups', function() {

    var dataSource = path.join(
      __dirname,
      '../../_data/state_revenues_by_type.yml'
    );

    var pivotSource = path.join(
      __dirname,
      '../../data/revenue/pivot-onshore.tsv'
    );

    var stateRevenueByType = yaml.safeLoad(
      fs.readFileSync(dataSource, 'utf8')
    );

    it('match values in the pivot table', function(done) {
      var testRow = function(d, i) {
        if (d.CY.match(/ Total$/)) {
          return;
        }
        var expected = parse.dollars(d.Total);
        if (isNaN(expected)) {
          assert.ok(false, 'got NaN revenue for: ' + JSON.stringify(d));
        }
        var actual;
        try {
          actual = stateRevenueByType[
            d.St
          ][
            d.Commodity.trim()
          ][
            d['Revenue Type']
          ][
            d.CY
          ];
        } catch (error) {
          assert.ok(false, 'no data for: ' + JSON.stringify(d));
        }
        var difference = expected - actual;

        var values = [d.St, d.Commodity.trim(), d['Revenue Type'], d.CY]. join(' | ');
        assert.ok(
          Math.abs(difference) <= 1,
          (actual + ' != ' + expected + ' @ ' + (i + 1) + " for " + values)
        );
      };

      loadPivot(pivotSource, function(error, rows) {
        rows.forEach(testRow);
        done();
      });
    });

    it("doesn't contain values that aren't in the pivot table", function(done) {
      loadPivot(pivotSource, function(error, rows) {
        var state;
        var commodity;
        var type;
        var year;
        var actual;
        var expected;
        var difference;
        var found;

        var filter = function(d) {
          return d.St === state &&
                 d.Commodity.trim() === commodity &&
                 d['Revenue Type'] === type &&
                 d.CY === year;
        };

        for (state in stateRevenueByType) {
          for (commodity in stateRevenueByType[state]) {
            if (commodity === 'All') {
              continue;
            }
            for (type in stateRevenueByType[state][commodity]) {
              // Do not count rows with type Civil Penalties or Other Revenues
              // as they originate from data/revenue/civil-penalties.js
              // Test Civil Penalties in the national rollups
              if (
                type === 'All' ||
                type == 'Civil Penalties' ||
                type == 'Other Revenues'
              ) {
                continue;
              }
              for (year in stateRevenueByType[state][commodity][type]) {
                actual = stateRevenueByType[state][commodity][type][year];
                found = rows.filter(filter);

                assert.equal(
                  found.length, 1,
                  'wrong row count: ' + found.length +
                  ' for: ' + [state, commodity, type, year].join('/')
                );

                expected = parse.dollars(found[0].Total);
                difference = expected - actual;

                assert.ok(
                  Math.abs(difference) <= 1,
                  (actual + ' != ' + expected)
                );
              }
            }
          }
        }

        done();
      });
    });

    it('properly sums up "All" revenues (by commodity)', function() {
      var dataSource = path.join(
        __dirname,
        '../../_data/state_revenues.yml'
      );

      var stateRevenuesByCommodity = yaml.safeLoad(
        fs.readFileSync(dataSource, 'utf8')
      );

      for (var state in stateRevenuesByCommodity) {
        // Don't run None, it contains civil penalties and other conflicting values
        if (state !== 'None') {
          var commodities = stateRevenuesByCommodity[state].commodities;
          var allByYear = {};
          var totalsByYear = {};
          var count = 0;

          var commodity;
          var year;
          var difference;

          for (commodity in commodities) {
            for (year in commodities[commodity]) {
              var revenue = commodities[commodity][year].revenue;
              if (commodity === 'All') {
                allByYear[year] = revenue;
              } else {
                totalsByYear[year] = (totalsByYear[year] || 0) + revenue;
                count++;
              }
            }
          }
          // compare yearly totals, using the number of commodities as a standin
          // for the acceptable rounding error (+/- 1 for each)
          for (year in totalsByYear) {
            difference = Math.abs(allByYear[year] - totalsByYear[year]);
            assert.ok(
              difference <= count,
              'abs(' + allByYear[year] + ' - ' +
                totalsByYear[year] + ' = ' + difference + ')'
            );
          }

          // now check the keys for allByYear just to be sure that we don't have
          // extra years in there
          for (year in allByYear) {
            difference = Math.abs(allByYear[year] - totalsByYear[year]);
            assert.ok(
              difference <= count,
              'abs(' + allByYear[year] + ' - ' +
                totalsByYear[year] + ' = ' + difference + ')'
            );
          }
        }
      }
    });
  });

  describe('national rollups', function() {
    it('has the values that are in the civil penalties pivot table',
      function(done) {
      var dataSource = path.join(
        __dirname,
        '../../_data/national_revenues_by_type.yml'
      );

      var pivotSource = path.join(
        __dirname,
        '../../data/revenue/civil-penalties.tsv'
      );

      var nationalRevenueByType = yaml.safeLoad(
        fs.readFileSync(dataSource, 'utf8')
      );

      var testRow = function(d, i) {
        // Only test Civil Penalties as Other Revenues is combined with
        // figures from the pivot table.
        if (d['Revenue Type'].match(/Civil Penalties$/)) {
          var expected = parse.dollars(d.Total);
          if (isNaN(expected)) {
            assert.ok(false, 'got NaN revenue for: ' + JSON.stringify(d));
          }
          var actual;
          try {
            actual = nationalRevenueByType.US.All[
              d['Revenue Type']
            ][
              d.CY
            ];
          } catch (error) {
            assert.ok(false, 'no data for: ' + JSON.stringify(d));
          }
          var difference = expected - actual;
          assert.ok(
            Math.abs(difference) <= 1,
            (actual + ' != ' + expected + ' @ ' + (i + 1))
          );
        }
      };

      loadPivot(pivotSource, function(error, rows) {
        rows.forEach(testRow);
        done();
      });


    });
  });
});
