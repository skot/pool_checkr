# Stratum Mining.Notify Parser

A tool to parse Bitcoin mining pool Stratum `mining.notify` messages and extract block information.

## Live Demo

💾 [Try it online](https://skot.github.io/pool_checkr/)

## Features

- Parse `mining.notify` JSON messages
- Extract block height (BIP 34)
- Display previous block hash in standard format
- Parse coinbase transaction outputs
- Decode Bitcoin addresses (P2PKH, P2SH, P2WPKH, P2WSH)
- Convert timestamps to human-readable format
- Support for OP_RETURN outputs
- Super fly System 6 UI

## Usage

1. Open [index.html](index.html) in your browser (or visit the [live demo](https://skot.github.io/pool_checkr/))
2. Paste a Stratum `mining.notify` JSON message. This needs to be valid JSON.
   - On Bitaxe this can be copied from the log in AxeOS.   
3. Click "Parse" or press enter.

## Technical Details

- **Prevhash Format**: Stratum sends the previous block hash as 8 little-endian uint32 words. The parser reverses the word order to display the standard Bitcoin block hash format.
- **BIP 34**: Block height is encoded in the coinbase scriptSig according to BIP 34.
- **Address Encoding**: Supports Base58Check (P2PKH, P2SH) and Bech32 (P2WPKH, P2WSH) address formats.
- **Verification**: Block height, prevhash and address links to [mempool.space](https://mempool.space) for verification.

## License

MIT

## Credits

- Inspired by the awesome research from [https://github.com/mweinberg/stratum-speed-test/](https://github.com/mweinberg/stratum-speed-test/)
- Retro Apple interface from [https://github.com/sakofchit/system.css](https://github.com/sakofchit/system.css)
- Chicago Kare font by Duane King - [https://github.com/duaneking/Chicago-Kare](https://github.com/duaneking/Chicago-Kare) (MIT License)
