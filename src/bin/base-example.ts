/* eslint-disable no-console */
import * as fs from 'fs';
import { ShipConsumer } from '../consumer/consumer.js';
import { StateHistoryConnection } from '../ship.js';
import { EOSJsDeserializer } from '../deserializer/eos-js-deserializer.js';
import { BlockProcessor } from '../processor/processor.js';
import { LocalAbiProvider } from '../abi/local.js';
import { LocalBlockRepository } from '../consumer/repositories/local.js';

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
                processor: (p): Promise<void> => {
                    fileOutput.write(JSON.stringify(p.delta));
                    fileOutput.write('\n');
                    return Promise.resolve();
                },
            },
            {
                table: '*',
                contract: 'atomicmarket',
                processor: (p): Promise<void> => {
                    fileOutput.write(JSON.stringify(p.delta));
                    fileOutput.write('\n');
                    return Promise.resolve();
                },
            },
        ],
        preBlockHook: [
            async (block): Promise<void> => {
                fileOutput.write(
                    `--------------------- Processing block ${block.this_block.block_num} - ${
                        block.this_block.block_id
                    } ----------- ${new Date().toISOString()}\n`
                );
                return Promise.resolve();
            },
        ],
        postBlockHook: [
            async (block): Promise<void> => {
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
