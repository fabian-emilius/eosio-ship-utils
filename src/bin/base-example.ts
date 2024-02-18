import * as fs from 'fs';
import fetch from 'node-fetch';
import { ShipConsumer } from '../consumer/consumer';
import { StateHistoryConnection } from '../ship';
import { EOSJsDeserializer } from '../deserializer/eos-js-deserializer';
import { BlockProcessor } from '../processor/processor';
import { LocalAbiProvider } from '../abi/local';
import { LocalBlockRepository } from '../consumer/repositories/local';

async function start(): Promise<void> {
    const endpoint = '-';
    const deserializer = new EOSJsDeserializer({ threads: 1 });
    const ship = new StateHistoryConnection({
        endpoint,
        deserializer,
        connectionOptions: {
            allow_empty_deltas: true,
            allow_empty_blocks: false,
            allow_empty_traces: true,
            min_block_confirmation: 1,
        },
    });

    ship.on('error', console.error);
    ship.on('info', console.info);
    ship.on('debug', console.log);

    const fileOutput = fs.createWriteStream('out.out');

    const abi = new LocalAbiProvider({
        fetchApi: fetch,
        rpcEndpoint: 'https://rpc-wax-testnet.eu.aws.pink.gg',
    });

    await abi.init();

    const processor = new BlockProcessor({
        deserializer: deserializer,
        abiProvider: abi,

        failOnDeserializationError: false,

        deltaListeners: [
            {
                table: '*',
                contract: 'atomicassets',
                processor: (p) => {
                    fileOutput.write(JSON.stringify(p.delta));
                    fileOutput.write('\n');
                    return Promise.resolve();
                },
            },
            {
                table: '*',
                contract: 'atomicmarket',
                processor: (p) => {
                    fileOutput.write(JSON.stringify(p.delta));
                    fileOutput.write('\n');
                    return Promise.resolve();
                },
            },
        ],
        preBlockHook: [
            async (block) => {
                fileOutput.write(
                    `--------------------- Processing block ${block.this_block.block_num} - ${
                        block.this_block.block_id
                    } ----------- ${new Date().toISOString()}\n`
                );
                return Promise.resolve();
            },
        ],
        postBlockHook: [
            async (block) => {
                fileOutput.write(
                    `############## Finished Processing block ${block.this_block.block_num} - ${
                        block.this_block.block_id
                    } ############# ${new Date().toISOString()}\n`
                );
                return Promise.resolve();
            },
        ],
    });

    processor.addTraceListener({
        account: '*',
        name: 'transfer',
        processor: (trace) => {
            console.log(JSON.stringify(trace.trace));
            return Promise.resolve();
        },
    });

    processor.on('warn', console.warn);

    const consumer = new ShipConsumer({
        repository: new LocalBlockRepository(198572556),
        consumerOptions: {
            end_block: 198572656,
            fetch_deltas: true,
            max_messages_in_flight: 1,
            irreversible_only: false,
        },
        processor,
        blockDelay: 0,
    });

    await ship.startProcessing(consumer);
}

void start();
