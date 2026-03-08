// Package abis holds minimal ABI JSON strings for the contracts we index.
// Only the events and functions actually used by the indexer are included.
package abis

// FactoryABI — ArtFactory: ArtworkCreated event
const FactoryABI = `[
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "internalType": "address", "name": "contractAddress", "type": "address"},
      {"indexed": true,  "internalType": "address", "name": "artist",           "type": "address"},
      {"indexed": false, "internalType": "string",  "name": "name",             "type": "string"},
      {"indexed": false, "internalType": "string",  "name": "ipfsCID",          "type": "string"},
      {"indexed": false, "internalType": "uint256", "name": "k",                "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "p0",               "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp",        "type": "uint256"}
    ],
    "name": "ArtworkCreated",
    "type": "event"
  }
]`

// BondingCurveABI — ArtBondingCurve: trade + graduation events
const BondingCurveABI = `[
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "internalType": "address", "name": "buyer",         "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount",        "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "ethCost",       "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "royalty",       "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "platformFee",   "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "newTotalSupply","type": "uint256"}
    ],
    "name": "SharesBought",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true,  "internalType": "address", "name": "seller",        "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount",        "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "ethReturned",   "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "royalty",       "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "platformFee",   "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "newTotalSupply","type": "uint256"}
    ],
    "name": "SharesSold",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "Graduated",
    "type": "event"
  }
]`
