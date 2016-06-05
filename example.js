const async = require('async')
const xhr = process.browser ? require('xhr') : require('request')
const generateTxSummary = require('./index.js')

const RPC_ENDPOINT = 'https://mainnet.infura.io/'
// long tx run
// const targetTx = '0x44ddb2dc10f0354ba87814a17e58765b7bf1a7d47baa2fac9cf5b72f462c66cd'
// lots of setup + long tx run
// const targetTx = '0x9f004c8acac4457d985154a1004e0b43c9c8010697abfc3796de84ca81b93d05'
// invalid jump
const targetTx = '0x026084424ed68542b611f8deffb2563bb527600abf63cee61d1cd8850f1b94fe'

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

generateTxSummary(provider, targetTx, function(err, summary){
  if (err) throw err
  // console.log(treeify(summary, true))
  summary.codePath.forEach(function(step, index){
    var stepNumber = index+1
    console.log(`[${stepNumber}] ${step.pc}: ${step.opcode.name}`)
  })
  console.log(summary.results)
})
