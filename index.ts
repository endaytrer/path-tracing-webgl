
import { Shader, uniform3f, uniformMatrix4fv, uniformTexture, source, uniform1f, uniform1i, uniform1fv } from './modules/shader.js';
import { RNG } from './rng.js';
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const shot = document.getElementById('shot') as HTMLButtonElement;
const af = document.getElementById('af') as HTMLButtonElement;
const objd = document.getElementById('objd') as HTMLInputElement;
const frame = document.getElementById('frame') as HTMLSelectElement;
const focalDisplay = document.getElementById('focal-display');
const apertureDisplay = document.getElementById('aperture-display');
const lens = document.getElementById('lens') as HTMLSelectElement;
const batch = document.getElementById('batch') as HTMLInputElement;
const exposureInput = document.getElementById('exposure') as HTMLInputElement;
const exposureDisplay = document.getElementById('exposure-display');
const generation = document.getElementById('generation');
const rangeFocal = document.getElementById('range-focal');
const rangeAperture = document.getElementById('range-aperture');
const fps = document.getElementById('fps');

let focalLength = 24;
let focalLengthMin = 24;
let focalLengthMax = 70;
let aperture = 2.8;
let apertureMin = 2.8;
let apertureMax = 22;
let rx = -0.2;
let ry = 2.94;
const translation: vec3 = [1.1211650110349594, 2.3, -4.993709615030947] ;

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
    smoothness: number = 0;
    opacity: number = 0;
    refract_rate: number = 0;
    constructor(position: vec3, radius: number, albedo: vec3, specular: vec3, smoothness: number, emission: vec3, opacity: number, refract_rate: number) {
        this.position = position;
        this.radius = radius;
        this.albedo = albedo;
        this.specular = specular;
        this.smoothness = smoothness;
        this.emission = emission;
        this.opacity = opacity;
        this.refract_rate = refract_rate;
    }
    toParam() {
        return [...this.position, this.radius, ...this.albedo, ...this.specular, ...this.emission, this.smoothness, this.opacity, this.refract_rate];
    }
}
const rng = new RNG(1145141919);
const spheres: Sphere[] = [];
for (let i = 0; i < 20; i++) {
    const radius = rng.nextFloat() * 0.3 + 0.2;
    const pos: vec3 = [rng.nextFloat() * 5 - 2.5, radius + rng.nextFloat() * 2.5, rng.nextFloat() * 5 - 2.5];
    let flag = true;
    for (const sphere of spheres) {
        if (Math.pow(sphere.position[0] - pos[0], 2) + Math.pow(sphere.position[1] - pos[1], 2)+ Math.pow(sphere.position[2] - pos[2], 2) < Math.pow(sphere.radius + radius, 2)) {
            flag = false;
            break;
        }
    }
    if (!flag) {
        i -= 1;
        continue;
    }
    const albedo: vec3 = [rng.nextFloat(), rng.nextFloat(), rng.nextFloat()];
    spheres.push(new Sphere(pos, radius, albedo, albedo, rng.nextFloat(), rng.nextFloat() > 0.2 ? [0, 0, 0]: [rng.nextFloat() * 40, rng.nextFloat() * 40, rng.nextFloat() * 40], rng.nextFloat() > 0.5 ? 0.5 * rng.nextFloat() : 1, 1 + rng.nextFloat() / 10))
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
    @uniform1f(0) focalLength = focalLength / 1000;
    @uniform1f(0) aperture = focalLength / aperture / 1000;
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
    @uniformTexture(0)
    skymap: HTMLImageElement;

    @uniform1i(1) frameCount = 0;
    @uniform1i(1) needRerender = 0;
}

function addScaleFocal(value: number) {
    const labels = Array.prototype.slice.call(rangeFocal.getElementsByClassName('val'));
    for (let i = 0; i < labels.length; i++) {
        labels[i].setAttribute('reuse', 'false');
    }
    const newLabels = [];
    for (let k = 5 * Math.floor(value / 5); k > focalLengthMin + 2; k -= 5) {
        if (k >= focalLengthMax - 2) continue;
        const deg = 3 * (k - value);
        if (deg < -60) break;
        newLabels.push([k, deg])
    }
    {
        const deg = 3 * (focalLengthMin - value);
        if (deg > -60)
            newLabels.push([focalLengthMin, deg])
    }
    for (let k = 5 * Math.ceil((value + 1) / 5); k < focalLengthMax - 2; k += 5) {
        if (k <= focalLengthMin + 2) continue;
        const deg = 3 * (k - value);
        if (deg > 60) break;
        newLabels.push([k, deg]);
    }
    {
        const deg = 3 * (focalLengthMax - value);
        if (deg < 60)
            newLabels.push([focalLengthMax, deg])
    }
    for (const newLabel of newLabels) {
        const [k, deg] = newLabel;
        let label = rangeFocal.querySelector(`.val-${k}`) as HTMLDivElement;
        if (label) {
            label.setAttribute('reuse', 'true');
            label.style.transform = `translateX(calc(${105 + 115.47 * Math.sin(deg / 180 * Math.PI)}px - 50%)) scaleX(${Math.cos(deg / 180 * Math.PI)})`;
        } else {
            label = document.createElement('div');
            label.innerText = k.toString();
            label.setAttribute('reuse', 'true');
            label.classList.add('val');
            label.classList.add(`val-${k}`);
            label.style.transform = `translateX(calc(${105 + 115.47 * Math.sin(deg / 180 * Math.PI)}px - 50%)) scaleX(${Math.cos(deg / 180 * Math.PI)})`;
            rangeFocal.appendChild(label);
        }
    }
    for (let i = 0; i < labels.length; i++) {
        if (labels[i].getAttribute('reuse') === 'false') {
            rangeFocal.removeChild(labels[i]);
        }
    }
}

function addScaleAper(value: number) {
    const labels = Array.prototype.slice.call(rangeAperture.getElementsByClassName('val'));
    for (let i = 0; i < labels.length; i++) {
        labels[i].setAttribute('reuse', 'false');
    }
    const newLabels = [];
    for (let k = Math.floor(value); k > apertureMin + 0.4; k -= 1) {
        if (k >= apertureMax - 0.4) continue;
        const deg = 15 * (k - value);
        if (deg < -60) break;
        newLabels.push([k, deg])
    }
    {
        const deg = 15 * (apertureMin - value);
        if (deg > -60)
            newLabels.push([apertureMin, deg])
    }
    for (let k = Math.ceil((value + 0.1)); k < apertureMax - 0.4; k += 1) {
        if (k <= apertureMin + 0.4) continue;
        const deg = 15 * (k - value);
        if (deg > 60) break;
        newLabels.push([k, deg]);
    }
    {
        const deg = 15 * (apertureMax - value);
        if (deg < 60)
            newLabels.push([apertureMax, deg])
    }
    for (const newLabel of newLabels) {
        const [k, deg] = newLabel;
        let label = rangeAperture.querySelector(`.val-${k * 10}`) as HTMLDivElement;
        if (label) {
            label.setAttribute('reuse', 'true');
            label.style.transform = `translateX(calc(${105 + 115.47 * Math.sin(deg / 180 * Math.PI)}px - 50%)) scaleX(${Math.cos(deg / 180 * Math.PI)})`;
        } else {
            label = document.createElement('div');
            label.innerText = k.toFixed(1);
            label.setAttribute('reuse', 'true');
            label.classList.add('val');
            label.classList.add(`val-${k * 10}`);
            label.style.transform = `translateX(calc(${105 + 115.47 * Math.sin(deg / 180 * Math.PI)}px - 50%)) scaleX(${Math.cos(deg / 180 * Math.PI)})`;
            rangeAperture.appendChild(label);
        }
    }
    for (let i = 0; i < labels.length; i++) {
        if (labels[i].getAttribute('reuse') === 'false') {
            rangeAperture.removeChild(labels[i]);
        }
    }
}



addScaleFocal(focalLength);
addScaleAper(aperture);

const gl = canvas.getContext('webgl2');
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
    rayTracer.skymap = await new Promise((res, rej) => {
        const image = new Image();
        image.onload = () => res(image);
        image.src = "textures/FS002_Sunrise.png"
    });
    rayTracer.source = await (await fetch('shaders/path.glsl')).text();
    rayTracer.postprocessor = await (await fetch('shaders/average.glsl')).text();
    rayTracer.compile();
    recalculateTransform();
    animation = requestAnimationFrame(renderLoop);
}
main()


const baseMatrix = [1,   0,   0,   0,
                    0,   1,   0,   0,
                    0,   0,   1,   0,
                    0,   0,   0,   1];

function recalculateTransform() {

    mat4.translate(rayTracer.cameraMatrix, baseMatrix, translation);
    mat4.rotateY(rayTracer.cameraMatrix, rayTracer.cameraMatrix, ry);
    mat4.rotateX(rayTracer.cameraMatrix, rayTracer.cameraMatrix, rx);
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
}
// events and controls;
let mouseDown = false;

let focalDown = false;
let aperDown = false;
let prevX = 0;
let prevF = 0;
let prevA = 0;

let lastPos: [number, number] | null = null;
let fNumber = 2.8;

canvas.addEventListener('mousedown', () => {
    mouseDown = true;
})

rangeFocal.addEventListener('mousedown', (ev) => {
    focalDown = true;
    prevX = ev.x;
    prevF = focalLength;
})
rangeAperture.addEventListener('mousedown', (ev) => {
    aperDown = true;
    prevX = ev.x;
    prevA = aperture;
})

window.addEventListener('mouseup', () => {
    mouseDown = false;
    focalDown = false;
    aperDown = false;
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
    } else if (focalDown) {
        focalLength = prevF - Math.floor((ev.x - prevX) / 5);
        focalLength = Math.max(focalLengthMin, focalLength);
        focalLength = Math.min(focalLengthMax, focalLength);
        changeFocal();
    } else if (aperDown) {
        aperture = prevA - Math.floor((ev.x - prevX) / 5) / 10;
        aperture = Math.max(apertureMin, aperture);
        aperture = Math.min(apertureMax, aperture);

        rayTracer.aperture = focalLength / aperture / 1000;
        apertureDisplay.innerText = aperture.toFixed(1);
        addScaleAper(aperture);
        rayTracer.needRerender = 1;
        rayTracer.frameCount = 0;
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
        saveBlob(blob, `photo-${frame.selectedIndex === 0 ? 'full' : 'aps-c'}-frame-${focalLength}mm-f${aperture}.png`)
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
    rayTracer.focalLength = focalLength / 1000;
    rayTracer.aperture = focalLength / aperture / 1000;

    addScaleFocal(focalLength);
    rayTracer.needRerender = 1;
    rayTracer.frameCount = 0;
    focalDisplay.innerText = focalLength + 'mm';
}

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
    focalLength = parseInt(minF);
    focalLengthMax = parseInt(maxF);
    focalLengthMin = parseInt(minF);
    apertureMin = parseFloat(maxAperture);
    aperture = parseFloat(maxAperture);
    apertureDisplay.innerText = maxAperture;
    addScaleAper(aperture);
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