export type uniformType = '1i' | '1f' | '1fv' | '2f' | '3f' | '3fv' | 'Matrix4fv' | 'Matrix3fv';
export declare class Shader {
    private compiledInjections;
    private textureBindings;
    private static vsSource;
    private static copyFragShader;
    private __num_passes;
    private gl;
    private programs;
    private frameBuffers;
    private textures;
    private prevTextures;
    private finalProgram;
    private customTextures;
    private injections;
    private get numPasses();
    private rawSource;
    constructor(gl: WebGL2RenderingContext);
    private loadShader;
    private evaluateSources;
    compile(): void;
    private inject;
    render(): void;
    static uniformArgs(type: uniformType, pass: number): (target: Object, propertyName: string) => void;
    static uniformSingle(type: uniformType, pass: number): (target: Object, propertyName: string) => void;
    static uniformTexture(pass: number): (target: Object, propertyName: string) => void;
    static uniformMatrix(type: uniformType, pass: number, transpose: boolean): (target: Object, propertyName: string) => void;
    static source(pass: number): (target: Object, propertyName: string) => void;
}
export declare const uniform1f: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniform1fv: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniform1i: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniform2f: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniform3f: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniform3fv: (pass: number) => (target: Object, propertyName: string) => void;
export declare const uniformMatrix3fv: (pass: number, transposed: boolean) => (target: Object, propertyName: string) => void;
export declare const uniformMatrix4fv: (pass: number, transposed: boolean) => (target: Object, propertyName: string) => void;
export declare const uniformTexture: typeof Shader.uniformTexture;
export declare const source: typeof Shader.source;
