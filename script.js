// Base58 encoding
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const NETWORKS = {
    mainnet: {
        name: 'Mainnet',
        p2pkhVersion: 0x00,
        p2shVersion: 0x05,
        bech32Hrp: 'bc',
        mempoolPrefix: 'https://mempool.space'
    },
    testnet4: {
        name: 'Testnet4',
        p2pkhVersion: 0x6f,
        p2shVersion: 0xc4,
        bech32Hrp: 'tb',
        mempoolPrefix: 'https://mempool.space/testnet4'
    }
};

function getNetworkConfig(networkId) {
    return NETWORKS[networkId] || NETWORKS.mainnet;
}

function base58Encode(buffer) {
    let num = BigInt('0x' + Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(''));
    let encoded = '';
    
    while (num > 0n) {
        const remainder = num % 58n;
        num = num / 58n;
        encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
    }
    
    // Add leading '1's for leading zero bytes
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
        encoded = '1' + encoded;
    }
    
    return encoded;
}

function sha256(hex) {
    const buffer = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return crypto.subtle.digest('SHA-256', buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

async function doubleSha256(hex) {
    const first = await sha256(hex);
    return sha256(first);
}

async function pubkeyHashToAddress(hash, version) {
    const versionedHash = version.toString(16).padStart(2, '0') + hash;
    const checksum = (await doubleSha256(versionedHash)).substring(0, 8);
    const fullHash = versionedHash + checksum;
    const bytes = new Uint8Array(fullHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return base58Encode(bytes);
}

// Bech32 encoding
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const value of values) {
        const top = chk >> 25;
        chk = (chk & 0x1ffffff) << 5 ^ value;
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) {
                chk ^= GEN[i];
            }
        }
    }
    return chk;
}

function bech32HrpExpand(hrp) {
    const ret = [];
    for (let i = 0; i < hrp.length; i++) {
        ret.push(hrp.charCodeAt(i) >> 5);
    }
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) {
        ret.push(hrp.charCodeAt(i) & 31);
    }
    return ret;
}

function bech32CreateChecksum(hrp, data, encodingConstant = 1) {
    const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
    const polymod = bech32Polymod(values) ^ encodingConstant;
    const ret = [];
    for (let i = 0; i < 6; i++) {
        ret.push((polymod >> 5 * (5 - i)) & 31);
    }
    return ret;
}

function convertBits(data, fromBits, toBits, pad = true) {
    let acc = 0;
    let bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;
    
    for (const value of data) {
        acc = (acc << fromBits) | value;
        bits += fromBits;
        while (bits >= toBits) {
            bits -= toBits;
            ret.push((acc >> bits) & maxv);
        }
    }
    
    if (pad) {
        if (bits > 0) {
            ret.push((acc << (toBits - bits)) & maxv);
        }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
        throw new Error('Invalid padding');
    }
    
    return ret;
}

function bech32Encode(hrp, witver, witprog) {
    const data = [witver].concat(convertBits(witprog, 8, 5));
    const checksum = bech32CreateChecksum(hrp, data, witver === 0 ? 1 : 0x2bc830a3);
    return hrp + '1' + data.concat(checksum).map(d => BECH32_CHARSET[d]).join('');
}

function segwitAddrEncode(hrp, witver, witprog) {
    return bech32Encode(hrp, witver, witprog);
}

// Reverse hex (for prevhash)
function reverseHex(hexString) {
    hexString = hexString.trim();
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString;
    }
    
    // Split into 4-byte (8 hex char) words and reverse their order
    const words = [];
    for (let i = 0; i < hexString.length; i += 8) {
        words.push(hexString.substring(i, i + 8));
    }
    return words.reverse().join('');
}

function hexToBytes(hex) {
    if (!hex) {
        return [];
    }
    return hex.match(/.{2}/g).map(byte => parseInt(byte, 16));
}

function littleEndianToNumber(hex) {
    if (!hex) {
        return 0;
    }
    return Number(BigInt('0x' + hex.match(/.{2}/g).reverse().join('')));
}

function hasBytes(hex, offset, byteCount) {
    return offset + byteCount * 2 <= hex.length;
}

function readHex(hex, cursor, byteCount) {
    if (!hasBytes(hex, cursor.offset, byteCount)) {
        throw new Error('Unexpected end of coinbase transaction');
    }
    const value = hex.substring(cursor.offset, cursor.offset + byteCount * 2);
    cursor.offset += byteCount * 2;
    return value;
}

function readCompactSize(hex, cursor) {
    const first = parseInt(readHex(hex, cursor, 1), 16);

    if (first < 0xfd) {
        return first;
    }

    if (first === 0xfd) {
        return littleEndianToNumber(readHex(hex, cursor, 2));
    }

    if (first === 0xfe) {
        return littleEndianToNumber(readHex(hex, cursor, 4));
    }

    return littleEndianToNumber(readHex(hex, cursor, 8));
}

function skipInputsPrefix(coinbasePart1) {
    const cursor = { offset: 0 };

    readHex(coinbasePart1, cursor, 4);

    const marker = coinbasePart1.substring(cursor.offset, cursor.offset + 2);
    const flag = coinbasePart1.substring(cursor.offset + 2, cursor.offset + 4);
    if (marker === '00' && flag !== '00' && hasBytes(coinbasePart1, cursor.offset, 2)) {
        readHex(coinbasePart1, cursor, 2);
    }

    const inputCount = readCompactSize(coinbasePart1, cursor);
    if (inputCount < 1) {
        throw new Error('Coinbase transaction has no inputs');
    }

    readHex(coinbasePart1, cursor, 36);
    const scriptSigLength = readCompactSize(coinbasePart1, cursor);
    const scriptSigBytesInPart1 = Math.max(0, (coinbasePart1.length - cursor.offset) / 2);

    return {
        cursor,
        scriptSigLength,
        scriptSigBytesInPart1,
        missingScriptSigBytes: Math.max(0, scriptSigLength - scriptSigBytesInPart1)
    };
}

function parseOutputsAtOffset(coinbasePart2, offset) {
    const cursor = { offset };
    const outputCount = readCompactSize(coinbasePart2, cursor);

    if (outputCount < 1 || outputCount > Math.floor((coinbasePart2.length - cursor.offset) / 18)) {
        throw new Error('Implausible coinbase output count');
    }

    const outputs = [];

    for (let i = 0; i < outputCount; i++) {
        const valueLe = readHex(coinbasePart2, cursor, 8);
        const scriptLen = readCompactSize(coinbasePart2, cursor);
        const scriptPubKey = readHex(coinbasePart2, cursor, scriptLen);

        outputs.push({
            value_satoshis: littleEndianToNumber(valueLe),
            scriptPubKey,
            scriptLen
        });
    }

    if (!hasBytes(coinbasePart2, cursor.offset, 4)) {
        throw new Error('Coinbase transaction is missing locktime');
    }

    return outputs;
}

function findCoinbaseOutputOffset(coinbasePart1, coinbasePart2) {
    const { missingScriptSigBytes } = skipInputsPrefix(coinbasePart1);
    const splitOffsets = [0, missingScriptSigBytes * 2]
        .filter((offset, index, offsets) => offset >= 0 && offset + 8 <= coinbasePart2.length && offsets.indexOf(offset) === index);
    const candidateOutputOffsets = [];

    for (const splitOffset of splitOffsets) {
        candidateOutputOffsets.push(splitOffset);
        candidateOutputOffsets.push(splitOffset + 8);
    }

    for (let offset = 0; offset < coinbasePart2.length; offset += 2) {
        candidateOutputOffsets.push(offset);
    }

    const uniqueOutputOffsets = candidateOutputOffsets
        .filter((offset, index, offsets) => offset >= 0 && offset < coinbasePart2.length && offsets.indexOf(offset) === index);

    for (const outputOffset of uniqueOutputOffsets) {
        try {
            parseOutputsAtOffset(coinbasePart2, outputOffset);
            return outputOffset;
        } catch (e) {
            // Try the next split style.
        }
    }

    throw new Error('Unable to locate coinbase outputs');
}

function findCoinbaseOutputRecords(coinbasePart1, coinbasePart2) {
    return parseOutputsAtOffset(coinbasePart2, findCoinbaseOutputOffset(coinbasePart1, coinbasePart2));
}

function hexToAscii(hex) {
    let ascii = '';

    for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
    }

    return ascii;
}

// Extract block height from coinbase
function extractHeightFromCoinbase(coinbasePart1, coinbasePart2) {
    try {
        const { cursor, scriptSigLength, scriptSigBytesInPart1 } = skipInputsPrefix(coinbasePart1);
        const scriptSigPart1 = coinbasePart1.substring(cursor.offset, cursor.offset + scriptSigLength * 2);
        let scriptSigPart2 = '';
        let unknownScriptSigBytes = Math.max(0, scriptSigLength - scriptSigBytesInPart1);

        try {
            const outputOffset = findCoinbaseOutputOffset(coinbasePart1, coinbasePart2);
            const sequenceOffset = outputOffset - 8;
            if (sequenceOffset > 0) {
                scriptSigPart2 = coinbasePart2.substring(0, sequenceOffset);
                unknownScriptSigBytes = Math.max(0, scriptSigLength - scriptSigBytesInPart1 - scriptSigPart2.length / 2);
            }
        } catch (e) {
            scriptSigPart2 = coinbasePart2.substring(0, unknownScriptSigBytes * 2);
            unknownScriptSigBytes = Math.max(0, unknownScriptSigBytes - scriptSigPart2.length / 2);
        }

        const scriptSig = scriptSigPart1 + scriptSigPart2;
        
        if (scriptSigLength < 1) {
            return { height: null, scriptSig: null, scriptSigAscii: null };
        }

        // Read the first byte to determine how height is encoded
        const firstByte = parseInt(scriptSig.substring(0, 2), 16);
        
        let height = null;
        if (firstByte >= 1 && firstByte <= 75) {
            // Direct push of 1-75 bytes
            const heightBytes = scriptSig.substring(2, 2 + firstByte * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        } else if (firstByte === 0x4c) {
            // OP_PUSHDATA1
            const dataLength = parseInt(scriptSig.substring(2, 4), 16);
            const heightBytes = scriptSig.substring(4, 4 + dataLength * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        } else if (firstByte === 0x4d) {
            // OP_PUSHDATA2
            const dataLength = parseInt(scriptSig.substring(4, 6) + scriptSig.substring(2, 4), 16);
            const heightBytes = scriptSig.substring(6, 6 + dataLength * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        }
        
        const placeholder = unknownScriptSigBytes > 0 ? `[${unknownScriptSigBytes} bytes extranonce]` : '';
        const scriptSigAscii = hexToAscii(scriptSigPart1) + placeholder + hexToAscii(scriptSigPart2);

        return { height, scriptSig, scriptSigAscii };
    } catch (e) {
        return { height: null, scriptSig: null, scriptSigAscii: null };
    }
}

// Extract addresses from coinbase outputs
async function extractAddressesFromCoinbase(coinbasePart1, coinbasePart2, network = NETWORKS.mainnet) {
    const outputs = [];
    
    try {
        const outputRecords = findCoinbaseOutputRecords(coinbasePart1, coinbasePart2);

        for (const outputRecord of outputRecords) {
            const valueSatoshis = outputRecord.value_satoshis;
            const valueBtc = valueSatoshis / 100000000;
            const scriptPubKey = outputRecord.scriptPubKey;
            const scriptLen = outputRecord.scriptLen;

            let type = 'Unknown';
            let address = null;
            
            if (scriptPubKey.startsWith('76a914') && scriptPubKey.endsWith('88ac') && scriptLen === 25) {
                // P2PKH
                type = 'P2PKH';
                const pubkeyHash = scriptPubKey.substring(6, 46);
                address = await pubkeyHashToAddress(pubkeyHash, network.p2pkhVersion);
            } else if (scriptPubKey.startsWith('a914') && scriptPubKey.endsWith('87') && scriptLen === 23) {
                // P2SH
                type = 'P2SH';
                const scriptHash = scriptPubKey.substring(4, 44);
                address = await pubkeyHashToAddress(scriptHash, network.p2shVersion);
            } else if (scriptPubKey.startsWith('0014') && scriptLen === 22) {
                // P2WPKH
                type = 'P2WPKH';
                const pubkeyHash = scriptPubKey.substring(4);
                const witprog = pubkeyHash.match(/.{2}/g).map(b => parseInt(b, 16));
                address = segwitAddrEncode(network.bech32Hrp, 0, witprog);
            } else if (scriptPubKey.startsWith('0020') && scriptLen === 34) {
                // P2WSH
                type = 'P2WSH';
                const scriptHash = scriptPubKey.substring(4);
                const witprog = scriptHash.match(/.{2}/g).map(b => parseInt(b, 16));
                address = segwitAddrEncode(network.bech32Hrp, 0, witprog);
            } else if (scriptPubKey.startsWith('5120') && scriptLen === 34) {
                // P2TR
                type = 'P2TR';
                const taprootKey = scriptPubKey.substring(4);
                address = segwitAddrEncode(network.bech32Hrp, 1, hexToBytes(taprootKey));
            } else if (scriptPubKey.startsWith('6a')) {
                // OP_RETURN
                type = 'OP_RETURN';
                address = '(Null Data)';
            }
            
            outputs.push({
                value_satoshis: valueSatoshis,
                value_btc: valueBtc,
                type: type,
                address: address || 'Unable to decode'
            });
        }
    } catch (e) {
        console.error('Error extracting addresses:', e);
    }
    
    return outputs;
}

// Parse mining.notify
async function parseMiningNotify(notifyData, network = NETWORKS.mainnet) {
    const result = {};
    
    let params;
    if (notifyData.params) {
        params = notifyData.params;
    } else if (Array.isArray(notifyData)) {
        params = notifyData;
    } else {
        throw new Error("Invalid format: expected 'params' in dict or array");
    }
    
    if (params.length < 9) {
        throw new Error(`Invalid mining.notify: expected at least 9 parameters, got ${params.length}`);
    }
    
    result.job_id = params[0];
    
    // Previous hash
    const prevhashLe = params[1];
    result.prevhash = reverseHex(prevhashLe);
    
    // Extract block height and scriptSig
    const coinbasePart1 = params[2];
    const coinbasePart2 = params[3];
    const heightData = extractHeightFromCoinbase(coinbasePart1, coinbasePart2);
    result.height = heightData.height;
    result.scriptSig = heightData.scriptSig;
    result.scriptSigAscii = heightData.scriptSigAscii;
    
    // Extract addresses from coinbase outputs
    result.outputs = await extractAddressesFromCoinbase(coinbasePart1, coinbasePart2, network);
    
    // Additional fields
    result.version = params[5];
    result.nbits = params[6];
    result.ntime = params[7];
    result.clean_jobs = params[8];
    
    return result;
}

// Main parse function
async function parseNotify() {
    const input = document.getElementById('notifyInput').value.trim();
    const outputDiv = document.getElementById('output');
    const network = getNetworkConfig(document.getElementById('networkSelect').value);
    
    if (!input) {
        outputDiv.innerHTML = '<fieldset><legend>Error</legend><p>Please enter a mining.notify JSON string</p></fieldset>';
        outputDiv.classList.add('visible');
        return;
    }
    
    try {
        const data = JSON.parse(input);
        const result = await parseMiningNotify(data, network);
        
        // Convert ntime to readable date
        const ntimeInt = parseInt(result.ntime, 16);
        const ntimeDate = new Date(ntimeInt * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        
        // Build output HTML
        let html = '<fieldset><legend>Parsed Results</legend>';
        
        html += `<div class="output-item">
            <span class="output-label">Job ID:</span>
            <span class="output-value">${result.job_id}</span>
        </div>`;

        html += `<div class="output-item">
            <span class="output-label">Network:</span>
            <span class="output-value">${network.name}</span>
        </div>`;
        
        html += `<div class="output-item">
            <span class="output-label">Block Height:</span>
            <span class="output-value">${result.height !== null ? `<a href="${network.mempoolPrefix}/block/${result.height}" target="_blank">${result.height}</a>` : 'Unable to extract'}</span>
        </div>`;
        
        html += `<div class="output-item">
            <span class="output-label">Previous Hash:</span>
            <span class="output-value"><a href="${network.mempoolPrefix}/block/${result.prevhash}" target="_blank">${result.prevhash}</a></span>
        </div>`;
        
        if (result.scriptSig) {
            html += `<div class="output-item">
                <span class="output-label">ScriptSig:</span>
                <span class="output-value">${result.scriptSigAscii || hexToAscii(result.scriptSig)}</span>
            </div>`;
        }
        
        html += `<div class="output-item">
            <span class="output-label">Block Version:</span>
            <span class="output-value">${result.version}</span>
        </div>`;
        
        // Convert nBits to difficulty
        const nbitsInt = parseInt(result.nbits, 16);
        const exponent = nbitsInt >>> 24;
        const coefficient = nbitsInt & 0xffffff;
        const target = coefficient * Math.pow(2, 8 * (exponent - 3));
        const maxTarget = 0xffff * Math.pow(2, 8 * (0x1d - 3));
        const difficulty = maxTarget / target;
        
        let difficultyStr;
        if (difficulty >= 1e12) {
            difficultyStr = `${(difficulty / 1e12).toFixed(2)} T`;
        } else if (difficulty >= 1e9) {
            difficultyStr = `${(difficulty / 1e9).toFixed(2)} G`;
        } else if (difficulty >= 1e6) {
            difficultyStr = `${(difficulty / 1e6).toFixed(2)} M`;
        } else if (difficulty >= 1e3) {
            difficultyStr = `${(difficulty / 1e3).toFixed(2)} K`;
        } else {
            difficultyStr = difficulty.toFixed(2);
        }
        
        html += `<div class="output-item">
            <span class="output-label">Difficulty (nBits):</span>
            <span class="output-value">${result.nbits} (${difficultyStr})</span>
        </div>`;
        
        html += `<div class="output-item">
            <span class="output-label">Timestamp (nTime):</span>
            <span class="output-value">${result.ntime} (${ntimeDate})</span>
        </div>`;
        
        html += `<div class="output-item">
            <span class="output-label">Clean Jobs:</span>
            <span class="output-value">${result.clean_jobs}</span>
        </div>`;
        
        // Coinbase outputs
        if (result.outputs && result.outputs.length > 0) {
            html += '<div class="coinbase-outputs">';
            html += '<div class="coinbase-title">Coinbase Outputs:</div>';
            
            result.outputs.forEach((output, i) => {
                html += '<div class="output-entry">';
                html += `<div class="output-entry-title">Output ${i + 1}:</div>`;
                html += `<div class="output-item">
                    <span class="output-label">Value:</span>
                    <span class="output-value">${output.value_btc.toFixed(8)} BTC (${output.value_satoshis.toLocaleString()} satoshis)</span>
                </div>`;
                html += `<div class="output-item">
                    <span class="output-label">Type:</span>
                    <span class="output-value">${output.type}</span>
                </div>`;
                html += `<div class="output-item">
                    <span class="output-label">Address:</span>
                    <span class="output-value">${output.address !== 'OP_RETURN' && output.address !== 'Unknown' && output.address !== '(Null Data)' ? `<a href="${network.mempoolPrefix}/address/${output.address}" target="_blank">${output.address}</a>` : output.address}</span>
                </div>`;
                html += '</div>';
            });
            
            html += '</div>';
        }
        
        html += '</fieldset>';
        
        outputDiv.innerHTML = html;
        outputDiv.classList.add('visible');
        
    } catch (e) {
        outputDiv.innerHTML = `<fieldset><legend>Error</legend><p>${e.message}</p></fieldset>`;
        outputDiv.classList.add('visible');
    }
}

// Clear input function
function clearInput() {
    document.getElementById('notifyInput').value = '';
    document.getElementById('output').innerHTML = '';
    document.getElementById('output').classList.remove('visible');
    document.getElementById('notifyInput').focus();
}

// Allow Enter key to parse (with Ctrl/Cmd modifier to avoid interfering with line breaks)
document.getElementById('notifyInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        parseNotify();
    }
});

// Make Parse button respond to Return key when textarea is focused
document.getElementById('notifyInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        parseNotify();
    }
});
