export declare class RNG {
    m: number;
    a: number;
    c: number;
    state: number;
    constructor(seed: any);
    nextInt(): number;
    nextFloat(): number;
}
