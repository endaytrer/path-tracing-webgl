export type uniformType = '1i' | '1f' | '1fv' | '2f' | '3f' | '3fv' | 'Matrix4fv' | 'Matrix3fv';

export class Shader {
    private compiledInjections: {index: WebGLUniformLocation, name: string}[][] = [];
    private textureBindings: [WebGLUniformLocation, WebGLUniformLocation][] = [];
    private static vsSource = `#version 300 es
in vec2 a_position;
out vec2 vUV;
void main() {
    vUV = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0, 1);
}
`
    private static copyFragShader = `#version 300 es
precision mediump usampler2D;
precision highp float;
uniform usampler2D src;
in vec2 vUV;
out vec4 fragColor;
void main() {
    fragColor = vec4(texture(src, vUV)) / 65535.0;
}
`
    private __num_passes: number;
    private gl: WebGL2RenderingContext;
    private programs: WebGLProgram[] = [];
    private frameBuffers: WebGLFramebuffer[] = [];
    private textures: WebGLTexture[] = [];
    private prevTextures: WebGLTexture[] = [];
    private finalProgram: WebGLProgram;
    private customTextures: {[name: string]: WebGLTexture}[] = [];

    private injections(pass: number) {
        const ans = {}
        Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach((val) => {
            const prefix = `__inj_${pass}_`;
            if (val.startsWith(prefix)) {
                ans[val.substring(prefix.length)] = this[val];
            }
        })
        return ans;
    }
    private get numPasses(): number {
        return Object.getPrototypeOf(this).__num_passes;
    }
    private rawSource(pass: number) {
        return Object.getPrototypeOf(this)[`__raw_src_${pass}`];
    }

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }
    
    private loadShader(type: number, source: string): WebGLShader | null {
        const shader = this.gl.createShader(type);
        if (shader === null) return shader;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
          alert(
            `An error occurred compiling the shaders: ${this.gl.getShaderInfoLog(shader)}`
          );
          this.gl.deleteShader(shader);
          return null;
        }
        return shader;
    }
    private evaluateSources(): string[] {
        const ans = [];
        for (let i = 0; i < this.numPasses; i++) {
            const source = this.rawSource(i);
            if (source) ans.push(source.replaceAll(/\$\{(.*)\}/g, (_, p1) => eval(`this.${p1}`)));
            else {
                alert(`Source code of pass ${i} not found.`);
                ans.push(null);
            }
        }
        return ans;
    }
    public compile(): void {
        const sources = this.evaluateSources();
        this.programs = [];
        this.compiledInjections = [];
        this.customTextures = [];
        this.textureBindings = [];
        this.frameBuffers = [];
        this.textures = [];
        this.prevTextures = [];
        this.customTextures = [];
        for (let i = 0; i < this.numPasses; i++) {
            if (sources[i] === null) continue;
            const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, Shader.vsSource);
            const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, sources[i]);
            const program = this.gl.createProgram();
            if (program === null) continue;
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);

            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                alert(
                  `Unable to initialize the shader program: ${this.gl.getProgramInfoLog(
                    program
                  )}`
                );
                continue;
            }
            this.programs.push(program);

            const buffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
            const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
            const index = this.gl.getAttribLocation(program, "a_position");
            this.gl.vertexAttribPointer(index, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(index);
            const compiled = [];
            const customTexturePass = {};
            const passInjections = this.injections(i);
            for (const inj in passInjections) {
                const index = this.gl.getUniformLocation(program, inj);
                compiled.push({index, name: inj});
                if (passInjections[inj].type == 'Texture') {
                    const texture = this.gl.createTexture();
                    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, passInjections[inj].texture);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
                    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
                    customTexturePass[inj] = texture;
                }
            }
            this.compiledInjections.push(compiled);
            this.customTextures.push(customTexturePass);

            const frameBuffer = this.gl.createFramebuffer();
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
            const texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32UI, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, null);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);

            this.textures.push(texture);
            this.frameBuffers.push(frameBuffer);

            const prevTexture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, prevTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32UI, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, null);

            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            this.prevTextures.push(prevTexture);

            this.textureBindings.push([this.gl.getUniformLocation(program, 'src'), this.gl.getUniformLocation(program, 'prev')])
        }
        // final program
        {
            const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, Shader.vsSource);
            const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, Shader.copyFragShader);
            const program = this.gl.createProgram();
            if (program === null) {
                alert("cannot create final program");
                return;
            }
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);

            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                alert(
                  `Unable to initialize the shader program: ${this.gl.getProgramInfoLog(
                    program
                  )}`
                );
                return;
            }
            this.finalProgram = program;

            const buffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
            const positions = [1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0];
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
            const index = this.gl.getAttribLocation(program, "a_position");
            this.gl.vertexAttribPointer(index, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(index);
        }
    }
    private inject(pass: number) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[pass - 1]);
        this.gl.uniform1i(this.textureBindings[pass][0], 0);
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.prevTextures[pass]);
        this.gl.uniform1i(this.textureBindings[pass][1], 1);
        const base = this.gl.TEXTURE2;
        let customCount = 0;
        this.compiledInjections[pass].forEach((val) => {
            if (this.injections(pass)[val.name].type == 'Texture') {
                this.gl.activeTexture(base + customCount);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.customTextures[pass][val.name]);
                this.gl.uniform1i(val.index, 2 + customCount);
                customCount++;
                return;
            }
            if (this.injections(pass)[val.name].transpose !== undefined) {
                this.gl[`uniform${this.injections(pass)[val.name].type}`].apply(this.gl, [val.index, this.injections(pass)[val.name].transpose, ...this.injections(pass)[val.name].args]);
            } else {
                this.gl[`uniform${this.injections(pass)[val.name].type}`].apply(this.gl, [val.index, ...this.injections(pass)[val.name].args]);
            }
        });
    }
    public render() {
        for (let i = 0; i < this.programs.length; i++) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers[i]);
            this.gl.useProgram(this.programs[i]);
            this.inject(i);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.prevTextures[i]);
            this.gl.copyTexImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 0, 0, this.gl.canvas.width, this.gl.canvas.height, 0);
        }
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.useProgram(this.finalProgram);
        // inject src
        {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.programs.length - 1]);
            this.gl.uniform1i(this.gl.getUniformLocation(this.finalProgram, "src"), 0);
        }
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        // this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        // this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    public static uniformArgs(type: uniformType, pass: number) {
        return function(target: Object, propertyName: string) {
            if (!(target instanceof Shader)) return;
            const descriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args;
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = {type, args: v};
                }
            }
            Reflect.defineProperty(target, propertyName, descriptor);
        }
    }
    public static uniformSingle(type: uniformType, pass: number) {
        return function(target: Object, propertyName: string) {
            if (!(target instanceof Shader)) return;
            const descriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args[0];
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = {type, args: [v]};
                }
            }
            Reflect.defineProperty(target, propertyName, descriptor);
        }
    }
    public static uniformTexture(pass: number) {
        return function(target: Object, propertyName: string) {
            if (!(target instanceof Shader)) return;
            const descriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].texture;
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = {type: 'Texture', texture: v};
                }
            }
            Reflect.defineProperty(target, propertyName, descriptor);
        }
    }

    public static uniformMatrix(type: uniformType, pass: number, transpose: boolean) {
        return function(target: Object, propertyName: string) {
            if (!(target instanceof Shader)) return;
            const descriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args[0];
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = {type, args: [v], transpose};
                }
            }
            Reflect.defineProperty(target, propertyName, descriptor);
        }
    }
    
    public static source(pass: number) {
        return function (target: Object, propertyName: string) {
            if (!(target instanceof Shader)) return;
            const descriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: true,
                get() {
                    return target[`__raw_src_${pass}`];
                },
                set(v) {
                    if (!target.__num_passes) target.__num_passes = 1;
                    else target.__num_passes = Math.max(pass + 1, target.__num_passes);
                    target[`__raw_src_${pass}`] = v;
                }
            }
            Reflect.defineProperty(target, propertyName, descriptor);
        }
    }
}


export const uniform1f = (pass: number) => Shader.uniformSingle('1f', pass);
export const uniform1fv = (pass: number) => Shader.uniformSingle('1fv', pass);
export const uniform1i = (pass: number) => Shader.uniformSingle('1i', pass);
export const uniform2f = (pass: number) => Shader.uniformArgs('2f', pass);
export const uniform3f = (pass: number) => Shader.uniformArgs('3f', pass);
export const uniform3fv = (pass: number) => Shader.uniformSingle('3fv', pass);
export const uniformMatrix3fv = (pass: number, transposed: boolean) => Shader.uniformMatrix('Matrix3fv', pass, transposed);
export const uniformMatrix4fv = (pass: number, transposed: boolean) => Shader.uniformMatrix('Matrix4fv', pass, transposed);
export const uniformTexture = Shader.uniformTexture;
export const { source } = Shader;