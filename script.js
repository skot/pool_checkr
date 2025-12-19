// Base58 encoding
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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

function bech32CreateChecksum(hrp, data) {
    const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
    const polymod = bech32Polymod(values) ^ 1;
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
    const checksum = bech32CreateChecksum(hrp, data);
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

// Extract block height from coinbase
function extractHeightFromCoinbase(coinbasePart1, coinbasePart2) {
    try {
        // Skip: version (8) + input count (2) + prev txid (64) + prev output index (8) = 82 chars
        const scriptSigStart = 82;
        if (coinbasePart1.length < scriptSigStart + 2) {
            return { height: null, scriptSig: null };
        }
        
        const hex = coinbasePart1.substring(scriptSigStart);
        const scriptSigLength = parseInt(hex.substring(0, 2), 16);
        
        if (scriptSigLength < 1) {
            return { height: null, scriptSig: null };
        }
        
        // Extract the full scriptSig (may span part1 and part2)
        const scriptSigInPart1 = hex.substring(2);
        const neededFromPart2 = Math.max(0, scriptSigLength * 2 - scriptSigInPart1.length);
        const scriptSig = scriptSigInPart1 + coinbasePart2.substring(0, neededFromPart2);
        
        // Read the first byte to determine how height is encoded
        const firstByte = parseInt(hex.substring(2, 4), 16);
        
        let height = null;
        if (firstByte >= 1 && firstByte <= 75) {
            // Direct push of 1-75 bytes
            const heightBytes = hex.substring(4, 4 + firstByte * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        } else if (firstByte === 0x4c) {
            // OP_PUSHDATA1
            const dataLength = parseInt(hex.substring(4, 6), 16);
            const heightBytes = hex.substring(6, 6 + dataLength * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        } else if (firstByte === 0x4d) {
            // OP_PUSHDATA2
            const dataLength = parseInt(hex.substring(6, 8) + hex.substring(4, 6), 16);
            const heightBytes = hex.substring(8, 8 + dataLength * 2);
            height = parseInt(heightBytes.match(/.{2}/g).reverse().join(''), 16);
        }
        
        return { height, scriptSig };
    } catch (e) {
        return { height: null, scriptSig: null };
    }
}

// Parse varint from hex string starting at offset
// Returns {value, bytesConsumed} or null if invalid
function parseVarInt(hex, offset) {
    if (offset >= hex.length) return null;
    
    const firstByte = parseInt(hex.substring(offset, offset + 2), 16);
    offset += 2;
    
    if (firstByte < 0xfd) {
        return { value: firstByte, bytesConsumed: 1 };
    } else if (firstByte === 0xfd) {
        if (offset + 4 > hex.length) return null;
        const value = parseInt(hex.substring(offset, offset + 4).match(/.{2}/g).reverse().join(''), 16);
        return { value, bytesConsumed: 3 };
    } else if (firstByte === 0xfe) {
        if (offset + 8 > hex.length) return null;
        const value = parseInt(hex.substring(offset, offset + 8).match(/.{2}/g).reverse().join(''), 16);
        return { value, bytesConsumed: 5 };
    } else {
        if (offset + 16 > hex.length) return null;
        const value = parseInt(hex.substring(offset, offset + 16).match(/.{2}/g).reverse().join(''), 16);
        return { value, bytesConsumed: 9 };
    }
}

// Find the offset after the sequence field by parsing transaction structure
// This works with any sequence value, not just hardcoded patterns
function findSequenceEndOffset(coinbasePart1, coinbasePart2) {
    try {
        // First, check if coinbasePart2 starts with sequence + valid output count
        // This handles cases where scriptSig ends at the end of coinbasePart1
        // and sequence field is at the start of coinbasePart2
        if (coinbasePart2.length >= 10) {
            const potentialOutputCount = parseInt(coinbasePart2.substring(8, 10), 16);
            // If we have a valid output count after 8 hex chars (4 bytes = sequence field)
            if (potentialOutputCount >= 1 && potentialOutputCount <= 253) {
                // This is a valid pattern: sequence (4 bytes) followed by output count
                // Return offset after sequence field (8 hex chars into coinbasePart2)
                return coinbasePart1.length + 8;
            }
        }
        
        // Otherwise, parse the full transaction structure
        const fullHex = coinbasePart1 + coinbasePart2;
        
        if (fullHex.length < 90) {
            return null; // Too short to be a valid transaction
        }
        
        let offset = 0;
        
        // Skip version (4 bytes = 8 hex chars)
        offset += 8;
        
        // Parse input count (varint)
        const inputCountVar = parseVarInt(fullHex, offset);
        if (!inputCountVar || inputCountVar.value === 0) {
            return null;
        }
        offset += inputCountVar.bytesConsumed * 2; // Convert bytes to hex chars
        
        // Skip prevout (36 bytes = 72 hex chars: 32 bytes txid + 4 bytes index)
        offset += 72;
        
        // Parse scriptSig length
        // Note: scriptSig length is a compact size (not always a varint)
        // If < 0xfd, it's a single byte representing the length
        // Otherwise it's a varint (0xfd = 2 bytes, 0xfe = 4 bytes, 0xff = 8 bytes)
        const scriptSigLenByte = parseInt(fullHex.substring(offset, offset + 2), 16);
        let scriptSigLen;
        let scriptSigLenBytes;
        
        if (scriptSigLenByte < 0xfd) {
            scriptSigLen = scriptSigLenByte;
            scriptSigLenBytes = 1;
        } else {
            // It's a varint
            const scriptSigLenVar = parseVarInt(fullHex, offset);
            if (!scriptSigLenVar) {
                return null;
            }
            scriptSigLen = scriptSigLenVar.value;
            scriptSigLenBytes = scriptSigLenVar.bytesConsumed;
        }
        
        offset += scriptSigLenBytes * 2;
        
        // Skip scriptSig data
        offset += scriptSigLen * 2;
        
        // Now we're at the sequence field (4 bytes = 8 hex chars)
        // After sequence comes output count
        if (offset + 8 > fullHex.length) {
            return null;
        }
        
        // Verify that after sequence (8 hex chars) we have a valid output count
        const afterSequence = offset + 8;
        if (afterSequence + 2 <= fullHex.length) {
            const potentialOutputCount = parseInt(fullHex.substring(afterSequence, afterSequence + 2), 16);
            // Valid output count is 1-253 (0x01-0xfd for single-byte, or varint)
            if (potentialOutputCount >= 1 && potentialOutputCount <= 253) {
                return afterSequence; // Return offset after sequence field
            }
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Extract addresses from coinbase outputs
async function extractAddressesFromCoinbase(coinbasePart1, coinbasePart2) {
    const outputs = [];
    
    try {
        const coinbaseHex = coinbasePart2;
        
        if (coinbaseHex.length < 10) {
            return outputs;
        }
        
        // Find sequence offset by parsing transaction structure generically
        const sequenceEndOffset = findSequenceEndOffset(coinbasePart1, coinbasePart2);
        
        if (sequenceEndOffset === null) {
            return outputs;
        }
        
        // Convert absolute offset to offset within coinbasePart2
        // sequenceEndOffset is the offset after the sequence field in the full combined hex
        const part1Length = coinbasePart1.length;
        let offset = 0;
        
        if (sequenceEndOffset <= part1Length) {
            // Sequence is entirely in part1, output count starts at beginning of part2
            offset = 0;
        } else {
            // Sequence ends in part2 (or output count starts in part2)
            // Calculate where output count starts within part2
            offset = sequenceEndOffset - part1Length;
        }
        
        // Check for SegWit marker and flag
        if (offset < coinbaseHex.length - 4) {
            const marker = coinbaseHex.substring(offset, offset + 2);
            
            // If marker is 0x00 and next byte (flag) is 0x00 or 0x01, it's witness
            if (marker === '00' && coinbaseHex.length > offset + 2) {
                const flag = coinbaseHex.substring(offset + 2, offset + 4);
                if (flag === '00' || flag === '01') {
                    // SegWit transaction
                    offset += 4;
                }
            }
        }
        
        // Read output count
        const outputCount = parseInt(coinbaseHex.substring(offset, offset + 2), 16);
        offset += 2;
        
        // Parse each output
        for (let i = 0; i < outputCount; i++) {
            // Read value (8 bytes, little-endian)
            const valueLe = coinbaseHex.substring(offset, offset + 16);
            const valueBytes = valueLe.match(/.{2}/g).reverse().join('');
            const valueSatoshis = parseInt(valueBytes, 16);
            const valueBtc = valueSatoshis / 100000000;
            offset += 16;
            
            // Read scriptPubKey length
            const scriptLen = parseInt(coinbaseHex.substring(offset, offset + 2), 16);
            offset += 2;
            
            // Read scriptPubKey
            const scriptPubKey = coinbaseHex.substring(offset, offset + scriptLen * 2);
            offset += scriptLen * 2;
            
            // Determine output type and address
            let type = 'Unknown';
            let address = null;
            
            if (scriptPubKey.startsWith('76a914') && scriptPubKey.endsWith('88ac') && scriptLen === 25) {
                // P2PKH
                type = 'P2PKH';
                const pubkeyHash = scriptPubKey.substring(6, 46);
                address = await pubkeyHashToAddress(pubkeyHash, 0x00);
            } else if (scriptPubKey.startsWith('a914') && scriptPubKey.endsWith('87') && scriptLen === 23) {
                // P2SH
                type = 'P2SH';
                const scriptHash = scriptPubKey.substring(4, 44);
                address = await pubkeyHashToAddress(scriptHash, 0x05);
            } else if (scriptPubKey.startsWith('0014') && scriptLen === 22) {
                // P2WPKH
                type = 'P2WPKH';
                const pubkeyHash = scriptPubKey.substring(4);
                const witprog = pubkeyHash.match(/.{2}/g).map(b => parseInt(b, 16));
                address = segwitAddrEncode('bc', 0, witprog);
            } else if (scriptPubKey.startsWith('0020') && scriptLen === 34) {
                // P2WSH
                type = 'P2WSH';
                const scriptHash = scriptPubKey.substring(4);
                const witprog = scriptHash.match(/.{2}/g).map(b => parseInt(b, 16));
                address = segwitAddrEncode('bc', 0, witprog);
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
async function parseMiningNotify(notifyData) {
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
    
    // Extract addresses from coinbase outputs
    result.outputs = await extractAddressesFromCoinbase(coinbasePart1, coinbasePart2);
    
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
    
    if (!input) {
        outputDiv.innerHTML = '<fieldset><legend>Error</legend><p>Please enter a mining.notify JSON string</p></fieldset>';
        outputDiv.classList.add('visible');
        return;
    }
    
    try {
        const data = JSON.parse(input);
        const result = await parseMiningNotify(data);
        
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
            <span class="output-label">Block Height:</span>
            <span class="output-value">${result.height !== null ? `<a href="https://mempool.space/block/${result.height}" target="_blank">${result.height}</a>` : 'Unable to extract'}</span>
        </div>`;
        
        html += `<div class="output-item">
            <span class="output-label">Previous Hash:</span>
            <span class="output-value"><a href="https://mempool.space/block/${result.prevhash}" target="_blank">${result.prevhash}</a></span>
        </div>`;
        
        if (result.scriptSig) {
            // Convert hex to ASCII
            let ascii = '';
            for (let i = 0; i < result.scriptSig.length; i += 2) {
                const byte = parseInt(result.scriptSig.substr(i, 2), 16);
                ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            }
            html += `<div class="output-item">
                <span class="output-label">ScriptSig:</span>
                <span class="output-value">${ascii}</span>
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
                    <span class="output-value">${output.address !== 'OP_RETURN' && output.address !== 'Unknown' && output.address !== '(Null Data)' ? `<a href="https://mempool.space/address/${output.address}" target="_blank">${output.address}</a>` : output.address}</span>
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
