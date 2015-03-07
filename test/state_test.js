var S = require('../src/state.js')
var assert = require('assert')

var example_state = {
  settings: {
    your_bot: "Imro",
    opponent_bot: "Dayan"
  },
  map: {
    super_regions: {
      "1": 2,
      "2": 5,
      "3": 7
    },
    regions: {
      "1": { player: "Imro", super_region: 1 },
      "2": { player: "Dayan", super_region: 2 },
      "3": { player: "neutral", super_region: 2 },
      "4": { player: "neutral", super_region: 3 },
      "5": { player: "neutral", super_region: 3 },
      "6": { player: "Imro", super_region: 3 }
    },
    neighbors: [
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [4, 5]
    ],
    wasteland: [3, 4, 5],
    armies: {
      "1": 2,
      "2": 5
    }
  }
}

describe('State', function() {
  describe('Get Armies', function() {
    it('should give us the correct number of armies', function() {
      assert.equal(2, S.get_armies(example_state, 1));
    })

    it('should return the default (2) for such a region does not exist', function() {
      assert.equal(2, S.get_armies(example_state, 1))
    })
  })

  describe('Get Opponent', function() {
    it('should give us the opponents name', function() {
      assert.equal("Dayan", S.get_opponent_name(example_state))
    })
  })

  describe('Get Our Name', function() {
    it('should give us our name', function() {
      assert.equal('Imro', S.get_our_name(example_state))
    })
  })

  describe('Get Super Region', function() {
    it('should give us the super region', function() {
      assert.equal(1, S.get_super_region(example_state, 1))
    })
  })

  describe('Super Region Unownedness', function() {
    var unownedness = S.sr_unownedness(example_state)
    
    // Disagree
    it('should return undefined if we own all regions in a super region', function() {
      assert.equal(undefined, unownedness["1"])
    })

    it('should return 1 if only one region is unowned', function() {
      assert.equal(1, unownedness["2"])
    })

    it('should return 2 if two regions are unowned', function() {
      assert.equal(2, unownedness["3"])
    })
  })
});