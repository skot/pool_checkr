# Stratum Mining.Notify Parser

A tool to parse Bitcoin mining pool Stratum `mining.notify` messages and extract block information.

## Live Demo

🔗 [Try it online](https://skot.github.io/pool_checkr/)

## Features

- Parse `mining.notify` JSON messages
- Extract block height (BIP 34)
- Display previous block hash in standard format
- Parse coinbase transaction outputs
- Decode Bitcoin addresses (P2PKH, P2SH, P2WPKH, P2WSH)
- Convert timestamps to human-readable format
- Support for OP_RETURN outputs

## Usage

### Web Version

1. Open [index.html](index.html) in your browser (or visit the [live demo](https://skot.github.io/pool_checkr/))
2. Paste a Stratum `mining.notify` JSON message. This needs to be valid JSON.
   - On Bitaxe this can be copied from the log in AxeOS.   
4. Click "Parse" or press enter.

### Python Version

```bash
python notify_parser.py '{"params":["job_id","prevhash","coinbase1","coinbase2",[merkle_branches],"version","nbits","ntime",clean_jobs],"id":null,"method":"mining.notify"}'
```

Or pipe input:
```bash
echo '{"params":[...]}' | python notify_parser.py
```

## Example

Input:
```json
{"params":["6920bab400003e78","2054771533c6373887fb44c6081b230c58336592000189f80000000000000000","01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff3503a61e0e000489b4276904a9b1a0040c","0a636b706f6f6c112f736f6c6f2e636b706f6f6c2e6f72672fffffffff039987611200000000220020984a77c289084ff2d434c316bdada021c6c183d507c8a20d3b159b09ac02fe28fd0760000000000016001451ed61d2f6aa260cc72cdf743e4e436a82c010270000000000000000266a24aa21a9edb0a313a2d4aa37add593e7b0c6bff97083472d58501b3cc1b97ed24fb453444900000000",[],"20000000","1701e2a0","6927b489",true],"id":null,"method":"mining.notify"}
```

Output:
```
Block Height:     925350
Previous Hash:    0000000000000000000189f858336592081b230c87fb44c633c6373820547715
Timestamp:        2025-11-27 02:16:41 UTC
Coinbase Address: bc1qnp980s5fpp8l94p5cvttmtdqy8rvrq74qly2yrfmzkdsntqzlc5qkc4rkq
```

## Technical Details

- **Prevhash Format**: Stratum sends the previous block hash as 8 little-endian uint32 words. The parser reverses the word order to display the standard Bitcoin block hash format.
- **BIP 34**: Block height is encoded in the coinbase scriptSig according to BIP 34.
- **Address Encoding**: Supports Base58Check (P2PKH, P2SH) and Bech32 (P2WPKH, P2WSH) address formats.

## License

MIT

## Credits

- Inspired by the awesome research from [https://github.com/mweinberg/stratum-speed-test/](https://github.com/mweinberg/stratum-speed-test/)
- Chicago Kare font by Duane King - [https://github.com/duaneking/Chicago-Kare](https://github.com/duaneking/Chicago-Kare) (MIT License)
