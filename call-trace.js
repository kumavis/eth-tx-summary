const async = require('async')
// const ZeroClient = require('web3-provider-engine/zero')
const ethUtil = require('ethereumjs-util')
const createVmTraceStream = require('./index.js').createVmTraceStream
const endOfStream = require('end-of-stream')

// const RPC_ENDPOINT = 'https://mainnet.infura.io/'
// const RPC_ENDPOINT = 'http://localhost:8545/'

// simple tx
// const targetTx = '0x27a1aacb510a092fe5accace80ff2c0612ba24b415c9d6c398da6bf81db9e576'
// DAO getting ripped
// const targetTx = '0xc0b6d5916bff007ef3a349b9191300e210a5fbb1db7f1cece50184c479947bc3'
// deploying a split proposal?
// 0xe9ebfecc2fa10100db51a4408d18193b3ac504584b51a4e55bdef1318f0a30f9
// local tx
// const targetTx = '0x6406ef867412a9dd8f79b5c350cf5ec981ba83d6de3e5fc42b0f57f4c8473fa9'
// const targetTx = '0x58be5f96253365a73f8b74aee5e58b98dedbd9a0b57953eac1968c7bd98e0768'

// var provider = ZeroClient({ rpcUrl: RPC_ENDPOINT })

// generateCallTrace(targetTx, provider, function(err, callTrace){
//   if (err) throw err
//   console.log(JSON.stringify(callTrace))
// })

module.exports = generateCallTrace

function generateCallTrace(txHash, provider, cb){
  
  var callTrace = { accounts: {}, calls: [], stackFrames: [], logs: [] }
  
  var traceStream = createVmTraceStream(provider, txHash)
  endOfStream(traceStream, function(err){
    if (err) return cb(err)
    cb(null, callTrace)
  })
  traceStream.on('data', handleDatum)

  function handleDatum(traceDatum){
    switch (traceDatum.type) {
      case 'tx':
        return initalMessage(traceDatum.data)
      case 'step':
        return analyzeStep(traceDatum.data)
    }
  }

  function initalMessage(txParams) {
    var message = messageFromTx(txParams)
    recordMessage(message)
    recordStack([0])
  }

  function analyzeStep(step){
    switch(step.opcode.name) {
      case 'CALL':
        var message = messageFromStep(step)
        recordMessage(message)
        var prevStack = callTrace.stackFrames.slice(-1)[0]
        var stack = stackFromMessage(prevStack, message)
        recordStack(stack)
        return
      // TODO: CALLCODE, DELEGATECALL

      case 'LOG0':
      case 'LOG1':
      case 'LOG2':
      case 'LOG3':
      case 'LOG4':
        var numTopics = step.opcode.in - 2
        var memOffset = ethUtil.bufferToInt(step.stack.pop())
        var memLength = ethUtil.bufferToInt(step.stack.pop())
        var topics = step.stack.slice(0, numTopics).map(function(topic){
          return ethUtil.bufferToHex(ethUtil.setLengthLeft(topic, 32))
        })

        var log = {
          stepIndex: callTrace.calls.length-1,
          address: ethUtil.bufferToHex(step.address),
          topics: topics,
          // TODO: load data from memory
          // data: null,
        }
        callTrace.logs.push(log)
    }
  }

  function messageFromTx(txParams){
    var message = {
      sequence:    callTrace.calls.length,
      depth:       0,
      fromAddress: ethUtil.bufferToHex(txParams.from),
      gasLimit:    ethUtil.bufferToHex(txParams.gasLimit),
      toAddress:   ethUtil.bufferToHex(txParams.to),
      value:       ethUtil.bufferToHex(txParams.value),
      data:        ethUtil.bufferToHex(txParams.data),
    }
    return message
  }

  function messageFromStep(step){
    var depth = step.depth + 1
    // from the stack (order is important)
    var gasLimit  = ethUtil.bufferToHex(step.stack.pop())
    var toAddress = ethUtil.bufferToHex(step.stack.pop())
    var value     = ethUtil.bufferToHex(step.stack.pop())
    var inOffset  = ethUtil.bufferToInt(step.stack.pop())
    var inLength  = ethUtil.bufferToInt(step.stack.pop())
    // var outOffset = ethUtil.bufferToInt(step.stack.pop())
    // var outLength = ethUtil.bufferToInt(step.stack.pop())

    var data = ethUtil.bufferToHex(memLoad(step.memory, inOffset, inLength))
    
    var callParams = {
      sequence:    callTrace.calls.length,
      depth:       depth,
      fromAddress: ethUtil.bufferToHex(step.address),
      gasLimit:    gasLimit,
      toAddress:   toAddress,
      value:       value,
      data:        data,
    }
    return callParams
  }

  function stackFromMessage(prevStack, msgParams){
    var topOfStackCallIndex = prevStack.slice(-1)[0]
    var topOfStack = callTrace.calls[topOfStackCallIndex]
    var newStack = prevStack.slice()
    var prevDepth = topOfStack.depth
    var itemsToRemove = 1 + prevDepth - msgParams.depth
    // remove old calls
    newStack.splice(newStack.length-itemsToRemove)
    // add new call
    var messageIndex = callTrace.calls.indexOf(msgParams)
    newStack.push(messageIndex)
    return newStack
  }

  function recordStack(stack){
    callTrace.stackFrames.push(stack)
  }

  function recordMessage(msgParams){
    recordAccount(msgParams.fromAddress)
    recordAccount(msgParams.toAddress)
    recordCall(msgParams)
  }

  function recordAccount(address){
    if (!address) return
    callTrace.accounts[address] = {address}
  }

  function recordCall(callParams){
    callTrace.calls.push(callParams)
  }

}


// from ethereumjs-vm
function memLoad(memory, offset, length) {
  var loaded = memory.slice(offset, offset + length)
  // fill the remaining lenth with zeros
  for (var i = loaded.length; i < length; i++) {
    loaded.push(0)
  }
  return new Buffer(loaded)
}
