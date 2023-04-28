
import { Shader, uniform3f, uniformMatrix4fv, source, uniform1f, uniform1i, uniform3fv, uniform1fv } from './modules/shader.js';
import { RNG } from './rng.js';
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const shot = document.getElementById('shot') as HTMLButtonElement;
const af = document.getElementById('af') as HTMLButtonElement;
const objd = document.getElementById('objd') as HTMLInputElement;
const focal = document.getElementById('focal') as HTMLInputElement;
const frame = document.getElementById('frame') as HTMLSelectElement;
const focalDisplay = document.getElementById('focal-display');
const apertureInput = document.getElementById('aperture') as HTMLInputElement;
const apertureDisplay = document.getElementById('aperture-display');
const lens = document.getElementById('lens') as HTMLSelectElement;
const batch = document.getElementById('batch') as HTMLInputElement;
const exposureInput = document.getElementById('exposure') as HTMLInputElement;
const exposureDisplay = document.getElementById('exposure-display');
const generation = document.getElementById('generation');
const fps = document.getElementById('fps');



let animation: number;
canvas.width = 1500;
canvas.height = 1000;
type vec3 = [number, number, number];
class Sphere {
    position: vec3 = [0, 0, 0];
    radius: number = 0;
    albedo: vec3 = [0, 0, 0];
    specular: vec3 = [0, 0, 0];
    emission: vec3 = [0, 0, 0];
    smoothness: vec3 = [0, 0, 0];
    constructor(position: vec3, radius: number, albedo: vec3, emission: vec3) {
        this.position = position;
        this.radius = radius;
        this.albedo = albedo;
        this.emission = emission;
    }
    toParam() {
        return [...this.position, this.radius, ...this.albedo, ...this.specular, ...this.emission, this.smoothness];
    }
}
const rng = new RNG(1);
const spheres: Sphere[] = [];
spheres.push(new Sphere([0, 0, -10], 1.5, [0.4, 0.4, 0.4], [0, 0, 0]))
spheres.push(new Sphere([0, 0.4, -4], 0.4, [0.9, 0.2, 0.2], [0, 0, 0]))
spheres.push(new Sphere([-0.5, 0.8, -8], 0.3, [1, 1, 1], [10, 10, 10]))
for (let i = 0; i < 8; i++) {
    spheres.push(new Sphere([rng.nextFloat() * 4 - 2, rng.nextFloat(), rng.nextFloat() * 4 - 2], rng.nextFloat() * 0.3 + 0.2, [rng.nextFloat(), rng.nextFloat(), rng.nextFloat()], rng.nextFloat() > 0.3 ? [0, 0, 0]: [rng.nextFloat() * 10, rng.nextFloat() * 10, rng.nextFloat() * 10]))
}
class RayTracer extends Shader {
    @source(0)
    source: string;

    @source(1)
    postprocessor: string;
    @uniform3f(0)
    color: [number, number, number] = [0.1, 0.5, 1.0];

    reflects = 6;
    @uniform1i(0) batchSize = parseInt(batch.value);
    @uniform1f(0) t = 0;
    @uniform1f(0) w = canvas.width;
    @uniform1f(0) h = canvas.height;
    @uniform1f(0) focalLength = parseInt(focal.value) / 1000;
    @uniform1f(0) aperture = parseInt(focal.value) / parseFloat(apertureInput.value) / 1000;
    @uniform1f(0) objectDistance = parseFloat(objd.value);
    @uniform1f(0) frameSize = parseFloat(frame.value);
    @uniform1f(0) exposure = Math.exp(parseFloat(exposureInput.value));
    @uniformMatrix4fv(0, false)
    cameraMatrix = [1,   0,   0,   0,
                    0,   1,   0,   0,
                    0,   0,   1,   0,
                    0,   0,   0,   1];
    @uniform1fv(0)
    sphereParams = spheres.map((val) => val.toParam()).flat();

    @uniform1i(1) frameCount = 0;
    @uniform1i(1) needRerender = 0;
}


const gl = canvas.getContext('webgl');
const rayTracer = new RayTracer(gl);
let times = [];
let then = 0;
let ans = 0;
function renderLoop(now: number) {
    now *= 0.001;
    const deltaTime = now - then;
    then = now;
    generation.innerText = (deltaTime * 1000).toFixed(2) + 'ms'
    if (times.length > 16) ans -= times.shift();
    times.push(deltaTime);
    ans += deltaTime;
    fps.innerText = (1 / ans * times.length).toFixed(2);
    rayTracer.t = now;
    rayTracer.frameCount += 1;
    requestAnimationFrame(renderLoop);
    rayTracer.render();

    rayTracer.needRerender = 0;
}
async function main() {
    rayTracer.source = await (await fetch('shaders/path.glsl')).text();
    rayTracer.postprocessor = await (await fetch('shaders/average.glsl')).text();
    rayTracer.compile();
    mat4.translate(rayTracer.cameraMatrix, baseMatrix, translation);
    mat4.rotateX(rayTracer.cameraMatrix, rayTracer.cameraMatrix, rx);
    mat4.rotateY(rayTracer.cameraMatrix, rayTracer.cameraMatrix, ry);
    animation = requestAnimationFrame(renderLoop);
}
main()


const baseMatrix = [1,   0,   0,   0,
                    0,   1,   0,   0,
                    0,   0,   1,   0,
                    0,   0,   0,   1];
let rx = -0.05;
let ry = 0;
const translation: vec3 = [0, 0.7, 1.5];

function recalculateTransform() {

    mat4.translate(rayTracer.cameraMatrix, baseMatrix, translation);
    mat4.rotateY(rayTracer.cameraMatrix, rayTracer.cameraMatrix, ry);
    mat4.rotateX(rayTracer.cameraMatrix, rayTracer.cameraMatrix, rx);
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
}
// events and controls;
let mouseDown = false;
let lastPos: [number, number] | null = null;
let fNumber = 2.8;

canvas.addEventListener('mousedown', (ev) => {
    mouseDown = true;
})
window.addEventListener('mouseup', (ev) => {
    mouseDown = false;
})

window.addEventListener('mouseleave', (ev) => {
    lastPos = null;
    mouseDown = false;
})
window.addEventListener('mousemove', (ev) => {
    if (lastPos === null) {
        lastPos = [ev.x, ev.y];
        return;
    }
    const moveX = ev.x - lastPos[0];
    const moveY = ev.y - lastPos[1];
    lastPos = [ev.x, ev.y];
    if (mouseDown) {
        rx -= 0.001 * moveY;
        ry -= 0.001 * moveX;
        recalculateTransform();
    }
})

window.addEventListener('keydown', (ev) => {
    const mag = 0.05;
    switch(ev.key) {
        case 'w': {
            translation[0] -= mag * Math.sin(ry);
            translation[2] -= mag * Math.cos(ry);
            recalculateTransform();
            break;
        } case 's': {
            translation[0] += mag * Math.sin(ry);
            translation[2] += mag * Math.cos(ry);
            recalculateTransform();
            break;
        } case 'a': {
            translation[0] -= mag * Math.cos(ry);
            translation[2] += mag * Math.sin(ry);
            recalculateTransform();
            break;
        } case 'd': {
            translation[0] += mag * Math.cos(ry);
            translation[2] -= mag * Math.sin(ry);
            recalculateTransform();
            break;
        } case 'Shift': {
            translation[1] += mag;
            recalculateTransform();
            break;
        } case 'Control': {
            translation[1] -= mag;
            recalculateTransform();
            break;
        }
    }
})

shot.addEventListener('click', () => {
    rayTracer.render();
    // ctx.drawImage(canvas, 0, 0);
    canvas.toBlob((blob) => {
        saveBlob(blob, `photo-${frame.selectedIndex === 0 ? 'full' : 'aps-c'}-frame-${focal.value}mm-f${apertureInput.value}.png`)
    });
})
const saveBlob = (function() {
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    return function saveData(blob, fileName) {
       const url = window.URL.createObjectURL(blob);
       a.href = url;
       a.download = fileName;
       a.click();
    };
  }());


// autofocus

function distPlane(origin: vec3, direction: vec3, position: vec3, normal: vec3): number {
    const t = normal.reduce((p, v, i) => p + v * (position[i] - origin[i]), 0) / normal.reduce((p, v, i) => p + v * direction[i], 0);
    return t > 0 ? t : Infinity;

}
function distSphere(origin: vec3, direction: vec3, sphere: Sphere): number {
    const d: vec3 = [origin[0] - sphere.position[0], origin[1] - sphere.position[1], origin[2] - sphere.position[2]];
    const p1 = -direction.reduce((prev, val, idx) => prev + val * d[idx], 0);
    const p2sqr = p1 * p1 - d.reduce((prev, val) => prev + val * val, 0) + sphere.radius * sphere.radius;
    if (p2sqr < 0.0) return Infinity;
    const p2 = Math.sqrt(p2sqr);
    const t = p1 - p2 > 0 ? p1 - p2 : p1 + p2;
    return t > 0 ? t : Infinity;
}
af.addEventListener('click', () => {
    let direction: vec3 = [0, 0, 0];
    let distance = 100000000.0;
    mat4.multiply(direction, rayTracer.cameraMatrix, [0, 0, -1, 1]);
    direction = direction.slice(0, 3).map((val, idx) => val - translation[idx]) as vec3;

    // ground plane;
    distance = Math.min(distance, distPlane(translation, direction, [0, 0, 0], [0, 1, 0]));
    for (const sphere of spheres) {
        distance = Math.min(distance, distSphere(translation, direction, sphere));
    }
    rayTracer.objectDistance = distance;
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
    objd.value = distance.toString();
})

objd.addEventListener('change', () => {
    rayTracer.objectDistance = parseFloat(objd.value);
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
}) 

frame.addEventListener('change', () => {
    rayTracer.frameSize = parseFloat(frame.value);
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
})
const changeFocal = () => {
    rayTracer.focalLength = parseFloat(focal.value) / 1000;
    rayTracer.aperture = parseFloat(focal.value) / parseFloat(apertureInput.value) / 1000;
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
    focalDisplay.innerText = focal.value + 'mm';
}
focal.addEventListener('input', changeFocal)

apertureInput.addEventListener('input', () => {
    rayTracer.aperture = parseFloat(focal.value) / parseFloat(apertureInput.value) / 1000;
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
    apertureDisplay.innerText = apertureInput.value;
})
lens.addEventListener('change', () => {
    const {value} = lens;
    const [p1, maxAperture] = value.split('/');
    let minF: string, maxF: string;
    if (p1.includes('-')) {
        [minF, maxF] = p1.split('-');
    } else {
        minF = p1;
        maxF = p1;
    }
    focal.min = minF;
    focal.max = maxF;
    focal.value = minF;
    apertureInput.min = maxAperture;
    apertureInput.value = maxAperture;
    apertureDisplay.innerText = apertureInput.value;
    changeFocal();
})
batch.addEventListener('change', () => {
    rayTracer.render();
    rayTracer.batchSize = parseInt(batch.value) || 1;
    rayTracer.compile();
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
})
exposureInput.addEventListener('input', () => {
    rayTracer.exposure = Math.exp(parseFloat(exposureInput.value));
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
    exposureDisplay.innerText = ((parseFloat(exposureInput.value) > 0) ? '+' : '') + parseFloat(exposureInput.value).toFixed(1)
})