# TokenPortal
A service that links two Ethereum chains for ERC20 and native exchange

# Prerequisites
This simple token portal requires a set of bridge portal contracts for each chain to be deployed. 
Currently, only ERC20 and native tokens are supported. The portal contracts can be found at 

https://github.com/0xMithril/BridgeableToken

Specifically, the contract ERC20Portal must be installed on mainnet, for example, and the contract NativePortal 
must be installed on the sidechain.

Both of these contracts support multi-sig verification, however this service only integrates a single verifier. In
the future, centralized and decentralized multi-verifier architectures are planned.

# Setup
Download program from repo and build with:

npm i

# Create a .env file that contains all of your configuration:

```
# Token Portal Properties
PORT=4000

# Ethereum Properties
PRIVATE_KEY=0xPrivateKey

# Native Portal contract
HOME_ETHEREUM_PROVIDER_URL=<home-provider-url>
HOME_PORTAL_CONTRACT=<0xBridgePortalNativeContract>

# ERC20 Portal contract
FOREIGN_ETHEREUM_PROVIDER_URL=<foreign-provider-url>
FOREIGN_PORTAL_CONTRACT=<0xBridgePortalERC20Contract>

# ERC20
TOKEN_CONTRACT=<mainnet-ERC20-address>
```
and then fire it up:

```node index.js```
