const async = require('async')
const clone = require('clone')
const EthQuery = require('eth-store/query')
const createRpcVm = require('ethereumjs-vm/lib/hooked').fromWeb3Provider
const ethUtil = require('ethereumjs-util')
const materializeBlocks = require('./materialize-blocks')
const Readable = require('stream').Readable
const ConcatStream = require('concat-stream')

module.exports = {
  createVmTraceStream,
  generateTxSummary,
}


function generateTxSummary(provider, txHash, cb) {
  var traceStream = createVmTraceStream(provider, txHash)
  traceStream.on('error', (err) => cb(err) )
  var concatStream = ConcatStream({ encoding: 'object' }, function(results){
    cb(null, results)
  })
  traceStream.pipe(concatStream)
}

function createVmTraceStream(provider, txHash){
  var traceStream = new Readable({ objectMode: true, read: noop })
  var query = new EthQuery(provider)

  // raw data
  var txData = null
  var blockData = null
  // eth objs
  var prepatoryTxs = null
  var targetTx = null
  var targetBlock = null
  var vm = null

  async.series({
    prepareVM,
    runPrepatoryTxs,
    runTargetTx,
  }, parseResults)

  return traceStream

  // load block data and create vm
  function prepareVM(cb){
    // load tx
    query.getTransaction(txHash, function(err, _txData){
      if (err) return cb(err)
      txData = _txData
      // load block
      // console.log('targetTx:',txData)
      traceStream.push({
        type: 'tx',
        data: txData,
      })
      query.getBlockByHash(txData.blockHash, function(err, _blockData){
        if (err) return cb(err)
        blockData = _blockData
        // materialize block and tx's
        targetBlock = materializeBlocks(blockData)
        var txIndex = parseInt(txData.transactionIndex, 16)
        targetTx = targetBlock.transactions[txIndex]
        // determine prepatory tx's
        prepatoryTxs = targetBlock.transactions.slice(0, txIndex)
        // create vm
        var backingStateBlockNumber = parseInt(blockData.number, 16)-1
        vm = createRpcVm(provider, backingStateBlockNumber, {
          enableHomestead: true,
        })
        // complete
        cb()
      })
    })
  }
  
  // we need to run all the txs to setup the state
  function runPrepatoryTxs(cb){
    async.eachSeries(prepatoryTxs, function(prepTx, cb){
      // console.log('prepTx!')
      vm.runTx({
        tx: prepTx,
        block: targetBlock,
        skipNonce: true,
        skipBalance: true,
      }, cb)
    }, cb)
  }

  // run the actual tx to analyze
  function runTargetTx(cb){
    var codePath = []
    // console.log('targetTx!')
    vm.on('step', function(step){
      var cleanStep = clone({
        opcode: step.opcode,
        stack: step.stack,
        memory: step.memory,
        address: step.address,
        pc: step.pc,
        depth: step.depth,
      })
      // console.log('op!')
      traceStream.push({
        type: 'step',
        data: cleanStep
      })
    })

    vm.runTx({
      tx: targetTx,
      block: targetBlock,
      skipNonce: true,
      skipBalance: true,
    }, function(err, results){
      if (err) return cb(err)
      cb(null, results)
    })
  }

  // return the summary
  function parseResults(err, data){
    // if (err) return cb(err)
    if (err) throw err
    var results = data.runTargetTx
    // cb(null, results)
    // console.log('results!')
    traceStream.push({
      type: 'results',
      data: results,
    })
    traceStream.push(null)
  }

}

function noop(){}
