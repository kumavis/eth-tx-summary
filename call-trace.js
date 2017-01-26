const async = require('async')
const ethUtil = require('ethereumjs-util')
const createVmTraceStream = require('./index.js').createVmTraceStream
const endOfStream = require('end-of-stream')

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
      gasLimit:    ethUtil.bufferToHex(txParams.gas || txParams.gasLimit),
      toAddress:   ethUtil.bufferToHex(txParams.to),
      value:       ethUtil.bufferToHex(txParams.value),
      data:        ethUtil.bufferToHex(txParams.data || txParams.input),
    }
    return message
  }

  function messageFromStep(step){
    var depth = step.depth + 1
    // from the stack (order is important)
    var gasLimit  = ethUtil.bufferToHex(step.stack.pop())
    var toAddress = ethUtil.bufferToHex(ethUtil.setLengthLeft(step.stack.pop(), 20))
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
