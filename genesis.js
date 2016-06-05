const utils = require('ethereumjs-util')
const BN = utils.BN
const genesisState = require('ethereum-common').genesisState

var accounts = []

for (address in genesisState){
  var balance = new BN(genesisState[address])
  accounts.push({
    address,
    balance,
  })
}

accounts.sort( (a,b) => b.balance.cmp(a.balance) )

accounts.slice(0,10).forEach( (acc) => console.log(acc.address+':', acc.balance.toString()) )