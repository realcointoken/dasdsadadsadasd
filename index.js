const express = require('express')
const Web3 = require('web3')
const homeWeb3 = new Web3()
const foreignWeb3 = new Web3()
const erc20PortalJson = require('./abi/ERC20Portal.json')
const nativePortalJson = require('./abi/NativePortal.json')
const erc20Json = require('./abi/ERC20Interface.json')

require('dotenv').config()

var app = express()
app.use(express.json())
app.set('json spaces', 2)
app.use(function(err, req, res, next) {
    console.error(err.stack)
    res.status(500).send(err.stack)
})

var erc20Portal, nativePortal, erc20

app.listen(process.env.PORT, async () => {
    console.log('Welcome to TokenPortal')
    homeWeb3.setProvider(process.env.HOME_ETHEREUM_PROVIDER_URL)
    foreignWeb3.setProvider(process.env.FOREIGN_ETHEREUM_PROVIDER_URL)
    erc20Portal = new foreignWeb3.eth.Contract(erc20PortalJson.abi, process.env.FOREIGN_PORTAL_CONTRACT)
    nativePortal = new homeWeb3.eth.Contract(nativePortalJson.abi, process.env.HOME_PORTAL_CONTRACT)
    erc20 = new foreignWeb3.eth.Contract(erc20Json.abi, process.env.TOKEN_CONTRACT)
})

// wrap catches for asyn calls
const asyncMiddleware = fn =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch(next);
    }

// displays title and information about the service
app.get('/', function(request, response) {
    response.json('TokenPortal')
})

app.get('/transactions/:address', asyncMiddleware(async (request, response, next) => {

    let foreignEnterlogs = await erc20Portal.getPastEvents('EnterBridgeEvent', {
        filter: { from: request.params.address },
        fromBlock: 0,
        toBlock: 'latest'
    })
    let foreignExitlogs = await erc20Portal.getPastEvents('ExitBridgeEvent', {
        filter: { from: request.params.address },
        fromBlock: 0,
        toBlock: 'latest'
    })
    let homeEnterLogs = await nativePortal.getPastEvents('EnterBridgeEvent', {
        fromBlock: 0,
        toBlock: 'latest'
    })
    let homeExitLogs = await nativePortal.getPastEvents('ExitBridgeEvent', {
        fromBlock: 0,
        toBlock: 'latest'
    })

    let allTxns = {}
    allTxns.foreign = {}
    allTxns.home = {}
    allTxns.foreign.Enterlogs = foreignEnterlogs
    allTxns.foreign.Exitlogs = foreignExitlogs
    allTxns.home.EnterLogs = homeEnterLogs
    allTxns.home.ExitLogs = homeExitLogs
    response.json(allTxns)
}))

// curl -d '{ "txnHash": "0x83445ad0c995c35eb379218519508363ca60b28c883278b6202a57af723b1752" }' -H "Content-Type: application/json" http://127.0.0.1:4000/foreign/verify
app.post('/foreign/verify', asyncMiddleware(async (request, response, next) => {

    let logs = await erc20Portal.getPastEvents('EnterBridgeEvent', {
        fromBlock: 0,
        toBlock: 'latest'
    })

    let log = logs.find(log => log.transactionHash === request.body.txnHash)
    if (!log) {
        console.log(`transactionHash: ${request.body.txnHash} was not found on home blockchain`)
        throw `transactionHash ${request.body.txnHash} was not found on home blockchain`
    }
    let txnHash = log.transactionHash
    let tokens = log.returnValues.amount
    let fromAccount = log.returnValues.from
    let decimals = await erc20.methods.decimals().call()
    let baseTokenAmount = tokens / Math.pow(10, decimals)
    let nativeTokenAmount = baseTokenAmount * Math.pow(10, 18)

    console.log(decimals, baseTokenAmount, nativeTokenAmount)
    console.log(fromAccount, txnHash, process.env.FOREIGN_PORTAL_CONTRACT, tokens)

    let contentHash = hashFunction(fromAccount, txnHash, process.env.FOREIGN_PORTAL_CONTRACT, nativeTokenAmount)
    let signatures = getValidatorSignature(contentHash)

    let exitPacket = {}
    exitPacket.transactionHash = txnHash
    exitPacket.foreignContract = process.env.FOREIGN_PORTAL_CONTRACT
    exitPacket.tokens = nativeTokenAmount
    exitPacket.signatures = signatures

    response.json(exitPacket)
}))

// curl -d '{ "txnHash": "0x83445ad0c995c35eb379218519508363ca60b28c883278b6202a57af723b1752" }' -H "Content-Type: application/json" http://127.0.0.1:4000/home/verify
app.post('/home/verify', asyncMiddleware(async (request, response, next) => {

    console.log(nativePortal)

    let logs = await nativePortal.getPastEvents('EnterBridgeEvent', {
        fromBlock: 0,
        toBlock: 'latest'
    })

    console.log(logs)

    let log = logs.find(log => log.transactionHash === request.body.txnHash)
    if (!log) {
        console.log(`transactionHash: ${request.body.txnHash} was not found on home blockchain`)
        throw `transactionHash ${request.body.txnHash} was not found on home blockchain`
    }
    let txnHash = log.transactionHash
    let tokens = log.returnValues.amount
    let fromAccount = log.returnValues.from
    let decimals = await erc20.methods.decimals().call()
    let baseTokenAmount = tokens / Math.pow(10, 18)
    let erc20TokenAmount = baseTokenAmount * Math.pow(10, decimals)

    console.log(decimals, baseTokenAmount, erc20TokenAmount)
    console.log(fromAccount, txnHash, process.env.HOME_PORTAL_CONTRACT, tokens)

    let contentHash = hashFunction(fromAccount, txnHash, process.env.HOME_PORTAL_CONTRACT, erc20TokenAmount)
    let signatures = getValidatorSignature(contentHash)

    let exitPacket = {}
    exitPacket.transactionHash = txnHash
    exitPacket.foreignContract = process.env.HOME_PORTAL_CONTRACT
    exitPacket.tokens = erc20TokenAmount
    exitPacket.signatures = signatures

    response.json(exitPacket)
}))

function hashFunction(from, txnHash, foreignAddress, amount) {
    let web3 = homeWeb3
    var functionSig = web3.eth.abi.encodeFunctionSignature('entranceHash(bytes32,address,uint256)')

    let hash = web3.utils.keccak256(web3.eth.abi.encodeParameters(
        ['bytes4', 'address', 'bytes32', 'address', 'uint256'],
        [functionSig, from, txnHash, foreignAddress, web3.utils.toHex(amount)]
    ))
    return hash
}

function getValidatorSignature(payload) {
    let web3 = homeWeb3
    // signed by the verifier
    var sig = web3.eth.accounts.sign(payload, process.env.PRIVATE_KEY, true)
    return sig.signature
}