/**
 * New node file
 */
var R = require('ramda');

function Matrix(M){
  R.mapObjIndexed(function(fn, fnName){
    M[fnName] = fn.bind(M);
  }, Matrix);
} 

Matrix.set = R.curry(function set(M, x, y, v){
  var _M = R.clone(M);
  var _Mx = R.clone(M[x]);
  _Mx[y] = v;
  _M[x] = Mx;
  return _M;
});

Matrix.transpose = function(M){
  var _M = [];
  M.forEach(function(row, i){
    row.forEach(function(val, j){
      if ('Array' !== R.type(M[j])) M[j] = [];
      _M[j][i] = val;
    })
  })
}
Matrix.T = Matrix.transpose;

Matrix.RowFromObj = function(o){
  return new Matrix(R.compose(R.reduce(function(acc, pair){
    acc[pair[0]] = pair[1]
    return acc;
  }, [0]),R.map(R.map(parseInt)), R.toPairs)(o));
}
module.exports = Matrix;