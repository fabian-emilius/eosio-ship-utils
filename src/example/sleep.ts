export async function sleep(timeMs: number): Promise<void> {
    return new Promise((res) => setTimeout(res, timeMs));
}
