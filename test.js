const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const script = fs.readFileSync('script.js', 'utf8');
const parserCode = script.slice(0, script.indexOf('// Main parse function'));
const context = {
    console,
    crypto: globalThis.crypto
};

vm.createContext(context);
vm.runInContext(parserCode, context);

const mainnetNotify = {
    method: 'mining.notify',
    params: [
        '9a',
        '1c56f09b286e29222b2055978fdb6ebb097d4cb0cce32574006ddea400000000',
        '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4f035b1d02412f706f676f6c6f202d20646563656e7472616c697a65206f7220646965202d20312e312e322e7234342e6732626639383661202d2068656c6c6f20776f726c642f08',
        'feffffff020000000000000000266a24aa21a9ed8386482ca64d091275d0dcd9f18fc3c39b7d62bc01d65cd4f99d673246c7ab8ed929072a0100000016001444cd28e821cc9efe4b17f767b2139756f5a5ed565a1d0200',
        [
            '2c54fb3f628ca144544d0771e4035b2e19d2702e3c19d1d58b696fc716983ca9',
            'a8e9ae84b5a3d9a41897832d2b17ae13e33d815aedb616fc8d22d388efbb3232',
            'b3713e83c4aa363257f7573e0ae76169cb54c269da55100f7bbdd68f68ab482b',
            'b3ae26b6f9592424ffdd0e4e27d798244d4e88acc9c8d6dcb0d45b79a3e26a06',
            '98ef38b3f7a51cc7193b9d9da751396188b64a322d19d7b65fa6f57782f0f470',
            '440be929bf6b4089b60c6ad01f2662dd8fbbe54d3e92769886e6d205159cb4c0',
            '962ada3336fe743e1440c8576d80fff24a57c36f2cfee9ed982bf07f5eac99ee'
        ],
        '20000000',
        '190376b6',
        '6a270e5f',
        true
    ]
};

const splitWithExtranonceNotify = {
    params: [
        '6a34867f000001a5',
        '888eb9ab6313592d5fbba79767d6612dd37225b80000a7c10000000000000000',
        '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff3503de8f0e000487a7346a0456a79a0c0c',
        '0a636b706f6f6c11476f42727272506f6f6c5f556d6272656cffffffff0274e8c41200000000160014a42f030892ebd38d0c07328e15234beb5cbd72bb0000000000000000266a24aa21a9ed21728b06621db2d8ed178e331d04ed74e6f15316e5672efccf3f2892740162b600000000',
        [
            'b609e9d54b259afc0f73aa4899924153264215d6a32612847ee24d538cae4fee',
            'f201a2f56ae431935d60ed1e3d8102beabdc87dd9559e156e7c0881572cbd225',
            '6a9aa7a9dc558bd722cd3fafedacf3507aba10f2d7e3226f95c5b72676a4f661',
            'b6edf86f0df9147adb1dd2d8c27af1190e84e748efdfb1eb9284de86087734be',
            '4be4be981606f506d20140764a2b3a64ec9ed3108782766ed11c5c4cdf978b1d',
            '75fd632bfea9c33fe3b42df9065c76cc0ebaeaa3b8d429b4115827d81efdf598',
            '0ca07765e44f531e140fac0b5d0f8d4fb3fad8d494c4d00667f2fcb29a65ef35',
            '8883b488fe0edaddf03c75064fbee09bfa622be0246ef33dad0db8ff6ed2c338',
            'ff5eafa3de2bebbc43fd73974fafdc1a5898a8f1e8cf2efcf8955f67c1cf7df4',
            'f7026bc29a83adef2f504e59bb4ffb2a2d575a469a25897ed614df9c23bf200e',
            '7357f959e8b04a74c62e1440fdbf83db95fb03e46bc60aa55e58e45fe3cdea5c',
            '09534ac6b120fb8653ef5198179778b2e62f907db538cb44b83cd1005161e878',
            '04ac7b8f472efa9165e32f43e544fe182141848c84b0f334a5f06a6ccf913da0'
        ],
        '20000000',
        '170240c3',
        '6a34a787',
        false
    ],
    id: null,
    method: 'mining.notify'
};

const splitScriptSigNotify = {
    params: [
        '6920bab4000047bc',
        '8fac96113217eef74ec3ec400b34987b489e53d4000163d80000000000000000',
        '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff35031b1f0e00048bbc286904d59913070c',
        '0a636b706f6f6c112f736f6c6f2e636b706f6f6c2e6f72672fffffffff03f09b611200000000220020984a77c289084ff2d434c316bdada021c6c183d507c8a20d3b159b09ac02fe28680860000000000016001451ed61d2f6aa260cc72cdf743e4e436a82c010270000000000000000266a24aa21a9edb5a38fddd376539446a962ea90a7963c89ff48d9bf4290dedae724d72ffb301100000000',
        [
            'c808ea0fd2eed06037eae273768532a1db62190ba8d414e668938067f5533731',
            'd46e3b3013f53e0c71b6445dd90667ce51cbf0843ce83f328f702bfb483914f1',
            'd8ecaa4be97093f6cfdbe8687613cbba0da25ecbbfc06d47a40ab201ea6be80c',
            '36ac3fead2c31a1e3740d1f0b1f30a7be46b429ef450ed8334555b78ddc07623',
            '9b4be441297da8d86ba1c8804d9a8f814e948edfcce9006e9e3e74152287587e',
            '1b9b66cb7ed88fd4dc4f93832da4a9ff216d0c2fb66239e5e6a1fc1e869cd4bb',
            '0041c994084bafcbb588c8af6ef66b47da85ed83b7adc069b904d08b3ebf2fcc',
            'eaa7fb1923d369263d9a9908f094c0a7e97f8b8fa6ff7694b7fdd0e6e5782a93',
            'c3128580771fdca4e125b6aa386338751b5946fb328f7ffdaf84abb7c6b5ad29',
            '448691df57854bb67dc89d422b8f1a1aa38343b57b3c9b15aa15a91ccae00e20',
            '96906cd8215c6386c48574f5d6cc86398315ba5a85a41bbd787c14401b0c0a17',
            'd78a2117e44b4a7bdeb47d9b25a5335127c70bf071cd35d030356bc0a1004934'
        ],
        '20000000',
        '1701e2a0',
        '6928bc8b',
        true
    ],
    id: null,
    method: 'mining.notify'
};

async function run() {
    const mainnet = context.getNetworkConfig('mainnet');
    const parsed = await context.parseMiningNotify(mainnetNotify, mainnet);

    assert.strictEqual(parsed.height, 138587);
    assert.strictEqual(parsed.outputs.map(output => output.type).join(','), 'OP_RETURN,P2WPKH');
    assert.strictEqual(parsed.outputs[1].address, 'bc1qgnxj36ppej00ujch7anmyyuh2m66tm2kdp932g');
    assert.strictEqual(parsed.outputs[1].value_satoshis, 5000079833);

    const outputCountSplit = structuredClone(mainnetNotify);
    outputCountSplit.params[2] += 'feffffff';
    outputCountSplit.params[3] = outputCountSplit.params[3].slice(8);

    const parsedOutputCountSplit = await context.parseMiningNotify(outputCountSplit, mainnet);
    assert.strictEqual(parsedOutputCountSplit.outputs[1].address, 'bc1qgnxj36ppej00ujch7anmyyuh2m66tm2kdp932g');

    const parsedSplitWithExtranonce = await context.parseMiningNotify(splitWithExtranonceNotify, mainnet);
    assert.strictEqual(parsedSplitWithExtranonce.height, 954334);
    assert.strictEqual(parsedSplitWithExtranonce.outputs.map(output => output.type).join(','), 'P2WPKH,OP_RETURN');
    assert.strictEqual(parsedSplitWithExtranonce.outputs[0].address, 'bc1q5shsxzyja0fc6rq8x28p2g6tadwt6u4ms9c24x');
    assert.strictEqual(parsedSplitWithExtranonce.outputs[0].value_satoshis, 314894452);

    const parsedSplitScriptSig = await context.parseMiningNotify(splitScriptSigNotify, mainnet);
    assert.strictEqual(parsedSplitScriptSig.height, 925467);
    assert.strictEqual(parsedSplitScriptSig.scriptSigAscii, '........(i......[12 bytes extranonce].ckpool./solo.ckpool.org/');
    assert.strictEqual(parsedSplitScriptSig.outputs.map(output => output.type).join(','), 'P2WSH,P2WPKH,OP_RETURN');
    assert.strictEqual(parsedSplitScriptSig.outputs[0].address, 'bc1qnp980s5fpp8l94p5cvttmtdqy8rvrq74qly2yrfmzkdsntqzlc5qkc4rkq');
    assert.strictEqual(parsedSplitScriptSig.outputs[1].address, 'bc1q28kkr5hk4gnqe3evma6runjrd2pvqyp8fpwfzu');

    console.log('All parser tests passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
