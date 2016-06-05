const EthQuery = require('eth-store/query')
const async = require('async')
const createRpcVm = require('ethereumjs-vm/lib/hooked').fromWeb3Provider
const Transaction = require('ethereumjs-tx')
const materializeBlocks = require('./materialize-blocks')

// summary event schema

// {
//   type: 'call',
//   params: {
//     to: null,
//     data: null,
//     value: null,
//   },
//   summary: [],
//   result: null,
//   error: null,
// }

// {
//   type: 'storageGet',
//   key: null,
//   value: null,
// }

// {
//   type: 'storagePut',
//   key: null,
//   value: null,
// }

// {
//   type: 'log',
//   topics: [],
// }

// need the blockHash unless we have an index of txHash->blockHash
// actually this is avail in both the txData + txReceipt

// txData
//   ├─ blockHash: 0x3f4e66950a67167986602025945673efe3ec6fe2dc4c0e8e465e75cbfb459fa5
//   ├─ blockNumber: 0x18fdfb
//   ├─ from: 0x84db6181fc7863544228a8bfd8989bc5fe194b33
//   ├─ gas: 0x5208
//   ├─ gasPrice: 0x6fc23ac00
//   ├─ hash: 0xfe329ad7e0eaffd154ad6e49197e5e2f2bc45a42f398f4151dfdac2c59b9a1b7
//   ├─ input: 0x
//   ├─ nonce: 0x10c
//   ├─ to: 0x32be343b94f860124dc4fee278fdcbd38c102d88
//   ├─ transactionIndex: 0x0
//   └─ value: 0xeb15b5574e09400

// txReceipt
//    ├─ blockHash: 0x3f4e66950a67167986602025945673efe3ec6fe2dc4c0e8e465e75cbfb459fa5
//    ├─ blockNumber: 0x18fdfb
//    ├─ contractAddress
//    ├─ cumulativeGasUsed: 0x5208
//    ├─ from: 0x84db6181fc7863544228a8bfd8989bc5fe194b33
//    ├─ gasUsed: 0x5208
//    ├─ logs
//    ├─ root: 5102d1f54c50d34e0571c008cf6614a2c6b702be579b8f22dbb2e528f67be978
//    ├─ to: 0x32be343b94f860124dc4fee278fdcbd38c102d88
//    ├─ transactionHash: 0xfe329ad7e0eaffd154ad6e49197e5e2f2bc45a42f398f4151dfdac2c59b9a1b7
//    └─ transactionIndex: 0x0

//  blockByHash
//    ├─ difficulty: 0x2848beeecc0d
//    ├─ extraData: 0xd783010404844765746887676f312e362e32856c696e7578
//    ├─ gasLimit: 0x47e7c4
//    ├─ gasUsed: 0x3d860
//    ├─ hash: 0x3f4e66950a67167986602025945673efe3ec6fe2dc4c0e8e465e75cbfb459fa5
//    ├─ logsBloom: 0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
//    ├─ miner: 0x2a65aca4d5fc5b5c859090a6c34d164135398226
//    ├─ nonce: 0xb564cc9807e996bc
//    ├─ number: 0x18fdfb
//    ├─ parentHash: 0x145c62e8ee5befddc457712ee42d88fc14a1f9f46fc60934d96b9ca8b31baccf
//    ├─ receiptRoot: 0x080f31a67fbad59e8c3eddcf6078171d477eb40ff784ab4d6e73d26d4389bbc8
//    ├─ sha3Uncles: 0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347
//    ├─ size: 0x759
//    ├─ stateRoot: 0x477469282bc3a182043036aac3b233ac9a2fc7ece9a62e3be42ad39da402f025
//    ├─ timestamp: 0x5751d90e
//    ├─ totalDifficulty: 0x153060f272313f531
//    ├─ transactions
//    │  ├─ 0: 0xfe329ad7e0eaffd154ad6e49197e5e2f2bc45a42f398f4151dfdac2c59b9a1b7
//    │  ├─ 1: 0xd4f95caee9a38fa3c35ebfae4e9dd19f527741c329c422f3f91be0ff6c9dc2d2
//    │  ├─ 2: 0xb3eeedd18e4f16905d64b15638ae62dc88b03e54e1f41a55a0879502f89ef63f
//    │  ├─ 3: 0xdd69d41902d724833f599d4b7ba66941a2e4955b152d15737dbb64bb0d010a28
//    │  ├─ 4: 0x21e227155d0c6ee5d8a8d2c35ff49058d9d6dd03beb8470f62c1d86f75a30da4
//    │  ├─ 5: 0x9ab34279f23887fc4586755ae2dfa2237ced0ba11fd1444fa737bb5504489ba9
//    │  ├─ 6: 0x9fec5bb9192f2e902e49c9e59ebd2ae4546d568a45d65553b88572d08ea636f5
//    │  ├─ 7: 0xf4caf6feffa2bf9d5d3649afae2903bc7d1f0b845e980f2f34627fa9d002cbcb
//    │  ├─ 8: 0x80389e7f50124e71ceac375374c97d1bcde490250123328418858edd12fbf868
//    │  ├─ 9: 0x7c5e3ec1dd9533a315ad26b74c2dae78ada7f5ec9c4c9952c2044e917622362d
//    │  ├─ 10: 0xfb8285ba359ecd5df65558f2eeec2e85b692c977e9ac4b27526f356f3b80b9de
//    │  └─ 11: 0x5129320c5bb81af38672a59656593b2b67e2501651b94e208fec1b2376a76cd3
//    ├─ transactionsRoot: 0xedd4cf82578a0205726c722aa6405140d27a085b63c5bb2b7d384f6713dfb9a6
//    └─ uncles

module.exports = generateTxSummary


function generateTxSummary(provider, txHash, cb) {
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


  // load block data and create vm
  function prepareVM(cb){
    // load tx
    query.getTransaction(txHash, function(err, _txData){
      if (err) return cb(err)
      txData = _txData
      // load block
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
        vm = createRpcVm(provider, blockData.number, {
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
    vm.on('step', function(step){
      codePath.push(step)
    })

    // console.log('runTargetTx', targetTx)
    console.log('tx.from', targetTx.from.toString('hex'))
    console.log('tx.to', targetTx.to.toString('hex'))
    console.log('tx.gasLimit', targetTx.gasLimit.toString('hex'))

    console.log('txParams.gas',txData.gas)
    console.log('txParams.gasLimit',txData.gasLimit)

    console.log('block.header.coinbase',   targetBlock.header.coinbase.toString('hex'))

    vm.runTx({
      tx: targetTx,
      block: targetBlock,
      skipNonce: true,
      skipBalance: true,
    }, function(err, results){
      if (err) return cb(err)
      var summary = {
        codePath: codePath,
        results, results,
      }
      cb(null, summary)
    })
  }

  // return the summary
  function parseResults(err, data){
    if (err) return cb(err)
    var summary = data.runTargetTx
    cb(null, summary)
  }

}