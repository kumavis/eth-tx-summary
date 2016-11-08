const async = require('async')
const xhr = process.browser ? require('xhr') : require('request')
const onStreamEnd = require('end-of-stream')
const generateTxSummary = require('./index.js').generateTxSummary
const createVmTraceStream = require('./index.js').createVmTraceStream
const ZeroClient = require('web3-provider-engine/zero')

const RPC_ENDPOINT = 'https://mainnet.infura.io/'
// const RPC_ENDPOINT = 'http://localhost:8545'
// long tx run
// const targetTx = '0x44ddb2dc10f0354ba87814a17e58765b7bf1a7d47baa2fac9cf5b72f462c66cd'
// lots of setup + long tx run
// const targetTx = '0x9f004c8acac4457d985154a1004e0b43c9c8010697abfc3796de84ca81b93d05'
// invalid jump
// const targetTx = '0x026084424ed68542b611f8deffb2563bb527600abf63cee61d1cd8850f1b94fe'
// DAO getting ripped
const targetTx = '0xc0b6d5916bff007ef3a349b9191300e210a5fbb1db7f1cece50184c479947bc3'


var provider = ZeroClient({ rpcUrl: RPC_ENDPOINT })
_sendAsync = provider.sendAsync.bind(provider)
// log network requests
// provider.sendAsync = function(payload, cb){ _sendAsync(payload, function(err, res){ console.log(payload, '->', res); cb.apply(null, arguments) }) }

var vmStream = createVmTraceStream(provider, targetTx)
vmStream.on('error', err => {throw err})
onStreamEnd(vmStream, ()=> provider.stop())

//vmStream.on('data', data => console.log(data))
logTraceGethStyle(vmStream)


function logTraceGethStyle(vmStream){
  var stepNumber = 0
  vmStream.on('data', data => {
    switch (data.type) {
      case 'step':
        stepNumber++
        var step = data.data
        console.log(`[${stepNumber}], ${step.pc}, ${step.opcode.name}, gasCost, ${step.depth}`)
        return
      case 'results':
        var result = data.data
        console.log(result)
        return
    }
  })
}
