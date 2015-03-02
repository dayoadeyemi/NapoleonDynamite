//'use strict;'
var _ = require('highland');
var R = require('ramda');
var M = require('./matrix');

var collect = R.curry(function(n, xs) {
  var i, _xs = [];
  for (i = 0; i * n < xs.length; i++) {
    _xs.push(xs.slice(i * n, i * n + n));
  }
  return _xs;
});

var initState = {
  settings: {},
  map: {
    super_regions: {},
    regions: {},
    neighbors: [],
    wastelands: [],
    armies: {}
  },
  input: '',
  output: ''
};

function update_region(region_id, player, no_armies){
  return R.I;
}

var update_map = R.curry(function (region_id, player, no_armies, _map) {
  var map = R.clone(_map);
  map.armies[region_id] = parseInt(no_armies, 10);
  map.regions[region_id].player = player;
  return map;
});

var get_armies = R.curry(function (state, region_id){
  return state.map.armies[region_id];
});

function get_opponent(state){
  return state.settings.opponent_bot;
}

var get_owner = R.curry(function (state, region_id){
  return state.map.regions[region_id].player;
});

function get_bot_name(state){
  return state.settings.your_bot;
};

var get_super_region = R.curry(function (state, region_id){
  return state.map.regions[region_id].super_region;
});

function setup_map(setup_option, setup_args, state){
  switch(setup_option) {
    case 'super_regions':
      return R.assocPath('map.super_regions', R.compose(R.fromPairs, collect(2))(setup_args), state);
    case 'regions':
      return R.assocPath('map.regions', R.compose(R.mapObj(function(x){
        return {
          player: 'neutral',
          super_region: x
        };
      }), R.fromPairs, collect(2))(setup_args), state);
    case 'neighbors':
      return R.assocPath('map.neighbors', R.compose(R.unnest, R.values, R.mapObjIndexed(function(xs, y){
        return R.map(function(x){ return [y, x];}, xs);
      }), R.mapObj(R.split(',')), R.fromPairs, collect(2))(setup_args), state);
    case 'wastelands':
      return R.assocPath('map.wastelands', setup_args, state);
    case 'opponent_starting_regions':
      return R.compose(
              R.assoc('map.regions.' + R.head(setup_args) + '.player', get_opponent(state)),
              R.assoc('map.armies.' + R.head(setup_args), 2)
        )(state);
    default:
      console.error('unknown setup fn');
      return state;
  }
}

function pick_starting_region (options, state){
  return R.pipe(
    R.map(R.map(get_super_region(state))),
    R.reject(function(srAdj){
      return srAdj[0] === srAdj[1];
    }),
    R.map(function(srAdj){
      return [srAdj, [srAdj[1], srAdj[0]]];
    }),
    R.unnest,
    R.countBy(R.head),
    R.toPairs,
    R.filter(function(pair){
      return R.contains(R.head(pair), R.map(get_super_region(state), options));
    }),
    R.sort(function(x, y){
      return x[1] - y[1];
    }),
    R.head,
    R.head,
    function (super_region){
      return R.find(R.compose(R.eq(super_region), get_super_region(state)), options);
    }
  )(state.map.neighbors);
}

function sr_unownedness(state){
  return R.pipe(
          R.toPairs,
          R.reject(R.pipe(
                  R.prop(1),
                  R.prop('player'),
                  R.eq(get_bot_name(state))
          )),//regions not owned by player
          R.map(R.head),
          R.map(get_super_region(state)),
          R.countBy(R.I)
  )(state.map.regions);
}
function attack_transfer(state){
  return R.pipe(
    R.filter(R.compose(
      R.contains(get_bot_name(state)),
      R.map(get_owner(state))
    )),
    R.groupBy(function(xy){
      if (get_owner(state, xy[0])=== get_owner(state, xy[1])) {
        return 'tranfer';
      }
      return 'attack';
    }),
    R.mapObjIndexed(function(adj_list, type){
      if (type==='tranfer'){
        return [];
      }
      if (type==='attack'){
        return R.pipe(
                R.map(function(srAdj){
                  return [srAdj, [srAdj[1], srAdj[0]]];
                }),
                R.unnest,
                R.filter(R.compose(R.eq(get_bot_name(state)), get_owner(state), R.head)),
                R.groupBy(R.head),
                R.mapObj(function(adj_list){
                  var unk = sr_unownedness(state);
                  var unknownness = R.compose(R.flip(R.prop)(unk), get_super_region(state));
                  return R.pipe(
                    R.map(R.prop(1)),
                    R.sort(function(x, y){
                      return unknownness(x)- unknownness(y);
                    }),
                    R.head
                  )(adj_list);
                }),
                R.toPairs,
                R.map(function(xy){
                  return R.concat(xy, [get_armies(state, xy[0])-1]);//[source_id, target_id, no_armies]
                }),
                R.reject(R.compose(R.eq(0), R.prop(2)))
        )(adj_list);
      }
    }),
    R.values,
    R.unnest
  )(state.map.neighbors); //[[source_id, target_id, no_armies], ...]
}

function go(go_command, state){
  switch(go_command) {
    case 'place_armies':
      return 'give me randomly';
    case 'attack/transfer':
      var moves = attack_transfer(state);
      if (R.isEmpty(moves)) return 'No moves'
      return R.join(', ', R.map(R.compose(R.join(' '), R.concat([state.settings.your_bot, 'attack/transfer'])), moves));
    default:
      return [];
  }
}

/**
 * Initialize bot
 * __main__
 */
process.stdin.setEncoding('utf8')
_(process.stdin)
.map(R.split('\n'))
.flatten()
.map(R.trim)
//.doto(console.log)
.map(R.split(' '))
.map(function(xs) {
  var command = R.head(xs);
  var args = R.tail(xs);
  return function(_state) {
    var state = R.clone(_state);
    state.input = xs.join(' ');
    state.output = [];
    if ("settings" === command) {
      state.settings[args[0]] = args[1];
    } else if ("setup_map" === command) {
      state = setup_map(R.head(args), R.tail(args), state);
    } else if ("update_map" === command) {
      state.map = R.apply(R.compose, (R.map(R.apply(update_map), collect(3, args))))(state.map);
    } else if ("pick_starting_region" === command) {
      state.output = pick_starting_region(R.tail(args), state);
    } else if ("go" === command) {
      state.output = go(R.head(args), state);
    }else if ("opponent_moves" === command) {
//      state.output = go(R.head(args), state);
    } else {
//      state.output.push('unknown command');
    }
    return state;
  };
})
.scan(initState, R.flip(R.call))
//.map(R.path('map'))
.map(R.path('output'))
.reject(R.isEmpty)
.each(console.log);
