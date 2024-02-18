export class Semaphore {
    private counter = 0;
    private waiting: { resolve(): unknown; reject(): unknown }[] = [];

    constructor(private readonly max: number) {}

    private take(): void {
        if (this.waiting.length > 0 && this.counter < this.max) {
            this.counter++;
            const promise = this.waiting.shift();
            void promise.resolve();
        }
    }

    async executeLimited<T>(cb: () => Promise<T>): Promise<T> {
        try {
            await this.acquire();
            return await cb();
        } finally {
            this.release();
        }
    }

    acquire(): Promise<void> {
        if (this.counter < this.max) {
            this.counter++;
            return Promise.resolve();
        } else {
            return new Promise<void>((resolve, reject) => {
                this.waiting.push({ resolve, reject });
            });
        }
    }

    release(): void {
        this.counter--;
        this.take();
    }
}
