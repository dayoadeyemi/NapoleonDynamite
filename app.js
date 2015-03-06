//'use strict;'
var _ = require('highland');
var R = require('ramda');
var M = require('./matrix');

function tap(msg){
  return function(x){
    console.log('---'+msg+'---');
    console.log(require('util').inspect(x, false, null, true));
    console.log('---------');
    return x;
  }
}

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
  return R.has(region_id, state.map.armies) ? state.map.armies[region_id] : 2;
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
      return R.assocPath('map.neighbors', R.compose(R.unnest, R.unnest, R.values, R.mapObjIndexed(function(xs, y){
        return R.map(function(x){ return [[y, x], [x, y]];}, xs);
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
          R.filter(R.pipe(
                  R.prop(1),
                  R.prop('player'),
                  R.eq('neutral')
          )),
          R.map(R.head),
          R.map(get_super_region(state)),
          R.countBy(R.I)
  )(state.map.regions);
}

var is_my_region = R.curry(function (state, region){
  return get_owner(state, region) === get_bot_name(state);
});

function borders(state){
  return R.pipe(
    R.filter(R.pipe(
      R.prop(0),
      is_my_region(state)
    )),
    R.reject(R.pipe(
      R.prop(1),
      is_my_region(state)
    ))
  )(state.map.neighbors);
}

function border_distances(state){
  return R.pipe(
    R.always(state.map.regions),
    R.keys,
    R.partition(is_my_region(state)),
    function (S){
      return dijkstra(S[1], S[0], state.map.neighbors);
    }
  )();
}

function dijkstra(start, rest, adj){
  var INFINITY = 1/0;
  var isFinite = R.flip(R.lt)(INFINITY);
  var initial_distances = R.fromPairs(R.concat(
    R.map(function(x){return [x, 0]}, start),
    R.map(function(x){return [x, INFINITY]}, rest)
  ));
  var adjMap = R.compose(R.mapObj(R.map(R.prop(1))), R.groupBy(R.prop(0)))(adj);

  function _it(distances){
    if (R.all(isFinite, R.values(distances))) { return distances; }
    return _it(R.mapObjIndexed(function(distance, node){
      if (isFinite(distance)) return distance;
      return R.pipe(
        R.always(adjMap),
        R.prop(node),
        R.map(R.flip(R.prop)(distances)),
        R.map(R.add(1)),
        R.min
      )();
    }, distances));
  }
  return _it(initial_distances);
}

function region_bad_neighbors(state){
  return R.pipe(
    borders,
    R.groupBy(R.head),
    R.mapObj(R.map(R.prop(1)))
  )(state);
}

var get_armies_for_attack = R.curry(function (state, y){
    return Math.floor(get_armies(state, y)/0.6/0.84) + get_owner(state, y) === 'neutral' ? 1 : 6;
});

function region_dangers(state){
  return R.pipe(
    region_bad_neighbors,
    R.mapObj(R.map(get_armies_for_attack(state))),
    R.mapObj(R.sum),
    R.add(1)
  )(state);
}

function coordinate_attack(state, armies, target){
  var necc_armies = get_armies_for_attack(state, target);
  var army_total = R.pipe(
    R.always(armies),
    R.values,
    R.filter(R.eq(1)),
    R.sum
  )();
  if (army_total < necc_armies) return R.map(R.always(0), {});
  else return R.pipe(
    R.always(armies),
    R.toPairs,
    R.reject(R.pipe(R.prop(1), R.eq(1))),
    R.fromPairs,
    R.mapObj(R.multiply(necc_armies)),
    R.mapObj(R.flip(R.divide)(army_total)),
    R.mapObj(R.add(1)),
    R.mapObj(Math.floor)
  )();
  var _adj_list = R.pipe(
  )()
}

function attack_transfer(state){
  return R.pipe(
    R.filter(R.pipe(
      R.prop(0),
      get_owner(state),
      R.eq(get_bot_name(state))
    )),
    R.groupBy(function(xy){
      if (get_owner(state, xy[0])=== get_owner(state, xy[1])) {
        return 'transfer';
      }
      return 'attack';
    }),
    R.mapObjIndexed(function(adj_list, type){
      if (type==='transfer'){
        var b_distances = border_distances(state);
        var dangers = region_dangers(state);
        var danger_diff = R.pipe(
          R.map(R.flip(R.prop)(dangers)),
          R.apply(R.subtract)
        );
        var diffuse = R.pipe(
          R.always(adj_list),
          R.filter(R.pipe(
            R.map(R.flip(R.prop)(b_distances)),
            R.apply(R.subtract),
            R.lt(0)
          )),
          R.map(function(xy){
            return R.concat(xy, [Math.floor(get_armies(state, xy[0])-1), 1000]);//[source_id, target_id, no_armies]
          })
        )();
        return R.pipe(
          R.filter(R.pipe(
            danger_diff,
            R.gte(0)
          )),
          R.map(function(xy){
            return R.concat(xy, [Math.floor(get_armies(state, xy[0])*3/2), 1000 + danger_diff(xy)]); //[source_id, target_id, no_armies, score]
          }),
          R.concat(diffuse)
        )(adj_list);
      }
      if (type==='attack'){
        var coordinated_attacks = R.pipe(
          R.always(adj_list),
          R.groupBy(R.prop(1)),
          R.mapObj(R.prop(0)),
          R.toPairs,
          R.reduce(function(memo, elt){
            var target = elt[0];
            var armies = R.zipObj(elt[1], R.map(R.flip(R.prop)(memo.armies), elt[1]));
            var used_armies = coordinate_attack(state, armies, target);
            var attacks = R.map(function(source){ return [source, target, used_armies, 0]; }, used_armies);
            return {
              moves: R.concat(memo.moves, attacks),
              armies: R.mapObjIndexed(function(memo_army, region_id){
                return memo_army - (used_armies[region_id] || 0);
              }, memo.armies)
            }
          }, {
            moves: [],
            armies: state.map.armies,
          }),
          R.prop('moves')
        )();
        var rudimentary_attacks = R.pipe(
          R.always(adj_list),
          // R.groupBy(R.head),
          // R.mapObj(function(adj_list){
          //   var unk = sr_unownedness(state);
          //   var unknownness = R.compose(R.flip(R.prop)(unk), get_super_region(state));
          //   return R.pipe(
          //     R.map(R.prop(1)),
          //     R.sort(function(x, y){
          //       return unknownness(x)- unknownness(y);
          //     }),
          //     R.head
          //   )(adj_list);
          // }),
          // R.toPairs,
          R.map(function(adj){
            var necc_armies = get_armies_for_attack(state, adj[1]);
            return R.concat(adj,  [Math.floor(necc_armies/2 + get_armies(state, adj[0])/2), necc_armies]); //[source_id, target_id, no_armies, score]
          }),
          R.filter(function(move){
            return move[2] < get_armies(state, move[0]);
          })
        )();

        return R.concat(coordinated_attacks, rudimentary_attacks);
      }
    }),
    R.values,
    R.unnest,
    R.filter(R.compose(R.lt(0), R.prop(2))),
    R.sort(function(x,y){
      return x[3]-y[3];
    }),
    R.groupBy(R.prop(0)),
    R.mapObj(R.head),
    R.values,
    R.map(R.slice(0, 3))
  )(state.map.neighbors); //[[source_id, target_id, no_armies], ...]
}

function place_armies(state){
  var unk = sr_unownedness(state);
  var unknownness = R.compose(R.flip(R.prop)(unk), get_super_region(state));
  var b_distances = border_distances(state);
  return R.pipe(
    R.always(state.map.regions),
    R.mapObj(R.prop('super_region')),
    R.mapObj(R.flip(R.prop)(unk)),
    R.mapObj(R.ifElse(R.isNil,R.always(0),R.I)),
    R.toPairs,
    R.filter(R.pipe(
      R.prop(0),
      R.flip(R.prop)(b_distances),
      R.eq(1)
    )),
    R.filter(R.compose(R.eq(get_bot_name(state)), get_owner(state), R.head)),
    R.sort(function(x, y){
      return x[1]- y[1];
    }),
    R.slice(0, 1),
    R.map(function(x){
      return [x[0], state.settings.starting_armies];
    })
  )()
}

function go(go_command, state){
  var moves;
  switch(go_command) {
    case 'place_armies':
      moves = place_armies(state);
      return R.join(', ', R.map(R.compose(R.join(' '), R.concat([state.settings.your_bot, 'place_armies'])), moves));
    case 'attack/transfer':
      moves = attack_transfer(state);
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
// .doto(console.log)
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
// .tap(R.compose(tap('map'), R.path('map')))
.map(R.path('output'))
.reject(R.isEmpty)
.each(console.log);
