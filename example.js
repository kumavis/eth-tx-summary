const async = require('async')
const xhr = process.browser ? require('xhr') : require('request')
const EthQuery = require('eth-store/query')
const treeify = require('treeify').asTree
const generateTxSummary = require('./index.js')

const RPC_ENDPOINT = 'https://mainnet.infura.io/'
const targetTx = '0x44ddb2dc10f0354ba87814a17e58765b7bf1a7d47baa2fac9cf5b72f462c66cd'

var provider = {
  sendAsync: function(payload, cb){
    var requestParams = {
      uri: RPC_ENDPOINT,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      rejectUnauthorized: false,
    }
    
    var req = xhr(requestParams, function(err, res, body) {
      if (err) return cb(err)
      // parse response
      var data
      try {
        data = JSON.parse(body)
        if (data.error) {
          console.log('RPC ERROR:', payload, data.error)
          return cb(data.error)
        }
      } catch (err) {
        // console.error(RPC_ENDPOINT)
        // console.error(data.error)
        // console.error(err.stack)
        return cb(err)
      }
      
      console.log('network:', payload.method, payload.params, '->', data.result)
      cb(null, data)
    })
  }
}

var startBlock = 0
var endBlock = 1622266

var query = new EthQuery(provider)

generateTxSummary(provider, targetTx, function(err, summary){
  if (err) throw err
  // console.log(treeify(summary, true))
  summary.codePath.forEach(function(step){
    console.log(`${step.pc}: ${step.opcode.name}`)
  })
})
// async.parallel({
//   earliest: query.getNonce.bind(query, targetAccount, startBlock),
//   latest:   query.getNonce.bind(query, targetAccount, endBlock),
// }, function(err, results){
//   if (err) throw err
  
//   var totalTxCount = hexToNumber(results.latest) - hexToNumber(results.earliest)
//   var foundTxCount = 0
  
//   console.log(`searching for all txs for ${targetAccount}`)
//   findAllTxsInRange(provider, targetAccount, startBlock, endBlock, onTx, onComplete)

//   function onTx(txData){
//     foundTxCount++
//     console.log(`found: ${foundTxCount}/${totalTxCount} = ${100*foundTxCount/totalTxCount}%`)
//   }

//   function onComplete(err, results){
//     if (err) throw err
//     console.log('results:', results.map(tx=>tx.hash))
//   }

// })


// // util

// function hexToNumber(hexString){
//   return parseInt(hexString, 16)
// }