class Shader {
    injections(pass) {
        const ans = {};
        Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach((val) => {
            const prefix = `__inj_${pass}_`;
            if (val.startsWith(prefix)) {
                ans[val.substring(prefix.length)] = this[val];
            }
        });
        return ans;
    }
    get numPasses() {
        return Object.getPrototypeOf(this).__num_passes;
    }
    rawSource(pass) {
        return Object.getPrototypeOf(this)[`__raw_src_${pass}`];
    }
    constructor(gl) {
        this.compiledInjections = [];
        this.textureBindings = [];
        this.programs = [];
        this.frameBuffers = [];
        this.textures = [];
        this.prevTextures = [];
        this.customTextures = [];
        this.gl = gl;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }
    loadShader(type, source) {
        const shader = this.gl.createShader(type);
        if (shader === null)
            return shader;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            alert(`An error occurred compiling the shaders: ${this.gl.getShaderInfoLog(shader)}`);
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
    evaluateSources() {
        const ans = [];
        for (let i = 0; i < this.numPasses; i++) {
            const source = this.rawSource(i);
            if (source)
                ans.push(source.replaceAll(/\$\{(.*)\}/g, (_, p1) => eval(`this.${p1}`)));
            else {
                alert(`Source code of pass ${i} not found.`);
                ans.push(null);
            }
        }
        return ans;
    }
    compile() {
        this.gl.getExtension('OES_texture_float');
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
            if (sources[i] === null)
                continue;
            const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, Shader.vsSource);
            const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, sources[i]);
            const program = this.gl.createProgram();
            if (program === null)
                continue;
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);
            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                alert(`Unable to initialize the shader program: ${this.gl.getProgramInfoLog(program)}`);
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
            function isPowerOf2(value) {
                return (value & (value - 1)) === 0;
            }
            for (const inj in passInjections) {
                const index = this.gl.getUniformLocation(program, inj);
                compiled.push({ index, name: inj });
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
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.RGB, this.gl.FLOAT, null);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
            this.textures.push(texture);
            this.frameBuffers.push(frameBuffer);
            const prevTexture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, prevTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.canvas.width, this.gl.canvas.height, 0, this.gl.RGB, this.gl.FLOAT, null);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);
            this.prevTextures.push(prevTexture);
            this.textureBindings.push([this.gl.getUniformLocation(program, 'src'), this.gl.getUniformLocation(program, 'prev')]);
        }
    }
    inject(pass) {
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[pass - 1]);
        this.gl.uniform1i(this.textureBindings[pass][0], 1);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.prevTextures[pass]);
        this.gl.uniform1i(this.textureBindings[pass][1], 0);
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
            }
            else {
                this.gl[`uniform${this.injections(pass)[val.name].type}`].apply(this.gl, [val.index, ...this.injections(pass)[val.name].args]);
            }
        });
    }
    render() {
        for (let i = 0; i < this.programs.length; i++) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers[i]);
            this.gl.useProgram(this.programs[i]);
            this.inject(i);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.prevTextures[i]);
            this.gl.copyTexImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, 0, 0, this.gl.canvas.width, this.gl.canvas.height, 0);
        }
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    static uniformArgs(type, pass) {
        return function (target, propertyName) {
            if (!(target instanceof Shader))
                return;
            const descriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args;
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = { type, args: v };
                }
            };
            Reflect.defineProperty(target, propertyName, descriptor);
        };
    }
    static uniformSingle(type, pass) {
        return function (target, propertyName) {
            if (!(target instanceof Shader))
                return;
            const descriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args[0];
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = { type, args: [v] };
                }
            };
            Reflect.defineProperty(target, propertyName, descriptor);
        };
    }
    static uniformTexture(pass) {
        return function (target, propertyName) {
            if (!(target instanceof Shader))
                return;
            const descriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].texture;
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = { type: 'Texture', texture: v };
                }
            };
            Reflect.defineProperty(target, propertyName, descriptor);
        };
    }
    static uniformMatrix(type, pass, transpose) {
        return function (target, propertyName) {
            if (!(target instanceof Shader))
                return;
            const descriptor = {
                configurable: true,
                enumerable: false,
                get() {
                    return target[`__inj_${pass}_` + propertyName].args[0];
                },
                set(v) {
                    target[`__inj_${pass}_` + propertyName] = { type, args: [v], transpose };
                }
            };
            Reflect.defineProperty(target, propertyName, descriptor);
        };
    }
    static source(pass) {
        return function (target, propertyName) {
            if (!(target instanceof Shader))
                return;
            const descriptor = {
                configurable: true,
                enumerable: true,
                get() {
                    return target[`__raw_src_${pass}`];
                },
                set(v) {
                    if (!target.__num_passes)
                        target.__num_passes = 1;
                    else
                        target.__num_passes = Math.max(pass + 1, target.__num_passes);
                    target[`__raw_src_${pass}`] = v;
                }
            };
            Reflect.defineProperty(target, propertyName, descriptor);
        };
    }
}
Shader.vsSource = `
        attribute vec2 a_position;
        varying vec2 vUV;
        void main() {
            vUV = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0, 1);
        }
    `;
export { Shader };
export const uniform1f = (pass) => Shader.uniformSingle('1f', pass);
export const uniform1fv = (pass) => Shader.uniformSingle('1fv', pass);
export const uniform1i = (pass) => Shader.uniformSingle('1i', pass);
export const uniform2f = (pass) => Shader.uniformArgs('2f', pass);
export const uniform3f = (pass) => Shader.uniformArgs('3f', pass);
export const uniform3fv = (pass) => Shader.uniformSingle('3fv', pass);
export const uniformMatrix3fv = (pass, transposed) => Shader.uniformMatrix('Matrix3fv', pass, transposed);
export const uniformMatrix4fv = (pass, transposed) => Shader.uniformMatrix('Matrix4fv', pass, transposed);
export const uniformTexture = Shader.uniformTexture;
export const { source } = Shader;
