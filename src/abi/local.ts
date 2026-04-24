import { Abi } from 'eosjs/dist/eosjs-rpc-interfaces';

import { IAbiProvider } from '../types/interfaces.js';
import { JsonRpc } from 'eosjs';

interface IAbiHistory {
  abi: Abi;
  account: string;
  block_num: number;
}

interface ILocalAbiProviderParams {
  rpcEndpoint: string;
  fetchApi?: typeof globalThis.fetch;
}

export class LocalAbiProvider implements IAbiProvider {
  private rpc: JsonRpc;
  private savedAbis: IAbiHistory[] = [];

  constructor(private readonly params: ILocalAbiProviderParams) {
    this.rpc = new JsonRpc(params.rpcEndpoint, { fetch: params.fetchApi ?? fetch });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async init(): Promise<void> {}

  async getAbi(contract: string, blockNum: number): Promise<Abi> {
    const firstTry = this.savedAbis.find((row) => row.account === contract && blockNum >= row.block_num);

    if (firstTry) {
      return firstTry.abi;
    }

    const secondTry = this.savedAbis.find((row) => row.account === contract);

    if (secondTry) {
      return secondTry.abi;
    }

    const info = await this.rpc.get_info();
    const result = await this.rpc.get_abi(contract);

    if (!result.abi) {
      throw new Error(`No Abi found for ${contract}`);
    }

    await this.setAbi(contract, info.head_block_num, result.abi);

    return result.abi;
  }

  async setAbi(contract: string, blockNum: number, abi: Abi): Promise<void> {
    this.savedAbis.unshift({
      account: contract,
      block_num: blockNum,
      abi,
    });

    this.savedAbis.sort((a, b) => b.block_num - a.block_num);

    return Promise.resolve();
  }
}
