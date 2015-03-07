var R = require('ramda');

var get_opponent_name = function(state) {
  return state.settings.opponent_bot;
};

var get_our_name = function(state) {
  return state.settings.your_bot;
};

var get_armies = R.curry(function (state, region_id) {
  return R.has(region_id, state.map.armies) ? state.map.armies[region_id] : 2;
});

var get_super_region = R.curry(function (state, region_id) {
  return state.map.regions[region_id].super_region;
});

function sr_unownedness(state) {
  return R.pipe(
    R.always(state.map.regions),
    R.toPairs,
    R.filter(R.pipe(
      R.prop(1),
      R.prop('player'),
      R.eq('neutral')
    )),
    R.map(R.head),
    R.map(get_super_region(state)),
    R.countBy(R.I)
  )();
}

var exports = module.exports = {};
exports.get_armies = get_armies;
exports.get_opponent_name = get_opponent_name;
exports.get_our_name = get_our_name;
exports.get_super_region = get_super_region;
exports.sr_unownedness = sr_unownedness;