# spring-ship-tools

TypeScript library for connecting to and consuming EOSIO/Antelope/Spring State History (Ship) WebSocket endpoints. 
Subscribe to blockchain blocks, action traces, and table deltas with support for both single-threaded and multi-threaded deserialization.

## Features

- WebSocket connection management with automatic reconnection
- Block, action trace, and table delta subscriptions
- ABI caching and deserialization via eosjs
- Multi-threaded deserialization using worker threads
- Promise queue for controlled message processing
- TypeScript-first with full type definitions

## Requirements

- Node.js >= 22
- An EOSIO/Antelope node with the State History Plugin enabled

## Installation

```bash
npm install spring-ship-tools
```

## Quick Start

```typescript
import {
    StateHistoryConnection,
    ShipConsumer,
    BlockProcessor,
    EOSJsDeserializer,
    LocalAbiProvider,
    LocalBlockRepository,
} from 'spring-ship-tools';

async function main() {
    const deserializer = new EOSJsDeserializer({ threads: 1 });

    const ship = new StateHistoryConnection({
        endpoint: 'ws://your-ship-endpoint:8080',
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

    const abi = new LocalAbiProvider({
        rpcEndpoint: 'https://your-rpc-endpoint',
    });
    await abi.init();

    const processor = new BlockProcessor({
        deserializer,
        abiProvider: abi,
        failOnDeserializationError: false,
        deltaListeners: [
            {
                table: '*',
                contract: 'eosio.token',
                processor: async ({ delta }) => {
                    console.log('Delta:', delta);
                },
            },
        ],
    });

    processor.addTraceListener({
        account: 'eosio.token',
        name: 'transfer',
        processor: async ({ trace }) => {
            console.log('Transfer:', trace);
        },
    });

    const consumer = new ShipConsumer({
        repository: new LocalBlockRepository(START_BLOCK_NUM),
        consumerOptions: {
            end_block: END_BLOCK_NUM,
            fetch_deltas: true,
            max_messages_in_flight: 1,
            irreversible_only: false,
        },
        processor,
        blockDelay: 0,
    });

    await ship.startProcessing(consumer);
}

void main();
```

## API

### `StateHistoryConnection`

Manages the WebSocket connection to a Ship endpoint.

```typescript
const ship = new StateHistoryConnection({
    endpoint: string,              // Ship WebSocket URL
    deserializer: IDeserializer,
    connectionOptions: {
        allow_empty_deltas: boolean,
        allow_empty_blocks: boolean,
        allow_empty_traces: boolean,
        min_block_confirmation: number,
    },
});
```

Events: `info`, `debug`, `error`, `warning`

### `BlockProcessor`

Registers listeners for action traces and table deltas.

```typescript
// Listen to table deltas
processor.addDeltaListener({
    contract: string,   // contract account name, or '*' for all
    table: string,      // table name, or '*' for all
    processor: (params) => Promise<void>,
});

// Listen to action traces
processor.addTraceListener({
    account: string,    // contract account name, or '*' for all
    name: string,       // action name, or '*' for all
    processor: (params) => Promise<void>,
});
```

Block lifecycle hooks can be passed via `preBlockHook` and `postBlockHook` arrays in the constructor options.

Events: `warn`

### `EOSJsDeserializer` / `ParallelDeserializer`

```typescript
// Single-threaded
const deserializer = new EOSJsDeserializer({ threads: 1 });

// Multi-threaded
const deserializer = new EOSJsDeserializer({ threads: 4 });
```

### `LocalAbiProvider`

Fetches and caches contract ABIs from an EOSIO/Antelope RPC endpoint. Uses Node's built-in `fetch` by default.

```typescript
const abi = new LocalAbiProvider({
    rpcEndpoint: 'https://your-rpc-endpoint',
    fetchApi: customFetch,  // optional, defaults to global fetch
});
await abi.init();
```

### `LocalBlockRepository`

In-memory block repository that tracks the last processed block number.

```typescript
const repository = new LocalBlockRepository(startBlockNum);
```

### `ShipConsumer`

Configures block consumption behavior.

```typescript
const consumer = new ShipConsumer({
    repository: IProcessedBlockRepository,
    processor: IBlockProcessor,
    blockDelay: number,          // milliseconds to wait between blocks
    consumerOptions: {
        end_block: number,
        fetch_deltas: boolean,
        max_messages_in_flight: number,
        irreversible_only: boolean,
    },
});
```

## Interfaces

You can implement your own providers and processors against these interfaces:

- `IAbiProvider` — ABI lookup and caching
- `IBlockProcessor` — block processing logic
- `IProcessedBlockRepository` — block tracking/persistence
- `IShipConsumer` — consumer configuration

