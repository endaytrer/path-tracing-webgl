#version 300 es
precision highp float;

struct Sphere {
    vec3 position;
    float radius;
    vec3 albedo;
    vec3 specular;
    float smoothness;
    vec3 emission;
    float opacity;
    float refract_rate;
};

uniform float t;
uniform float w;
uniform float h;
uniform float aperture;
uniform float focalLength;
uniform float objectDistance;
uniform float frameSize;
uniform mat4 cameraMatrix;
uniform float sphereParams[${sphereParams.length}];
uniform int batchSize;
uniform float exposure;
uniform sampler2D skymap;
out uvec4 fragColor;

Sphere spheres[${sphereParams.length / 16}];

float shaderseed;
vec2 coord;

const float PI = 3.141592654;
const float INF = 1.0 / 0.0;
float rand() {
    float result = fract(sin(shaderseed / 100.0 * dot(coord, vec2(12.9898, 78.233))) * 437.5453);
    shaderseed += 1.0;
    return result;
}

struct Ray {
    vec3 origin;
    vec3 direction;
    vec3 energy;
};

struct RayHit
{
    vec3 position;
    float dist;
    vec3 normal;
    vec3 albedo;
    vec3 specular;
    vec3 emission;
    float smoothness;
    float opacity;
    float refract_rate;
};

struct Plane {
    vec3 position;
    vec3 normal;
    vec3 albedo;
    vec3 specular;
    float smoothness;
    vec3 emission;
    float opacity;
    float refract_rate;
};


Ray createRay(vec3 origin, vec3 direction) {
    Ray ray;
    ray.origin = origin;
    ray.direction = direction;
    ray.energy = vec3(1.0, 1.0, 1.0);
    return ray;
}

RayHit createRayHit()
{
    RayHit hit;
    hit.position = vec3(0.0, 0.0, 0.0);
    hit.dist = INF;
    hit.normal = vec3(0.0, 0.0, 0.0);
    hit.albedo = vec3(0.0, 0.0, 0.0);
    hit.specular = vec3(0.0, 0.0, 0.0);
    hit.emission = vec3(0.0, 0.0, 0.0);
    hit.smoothness = 0.0;
    return hit;
}
void intersectSphere(Ray ray, inout RayHit bestHit, Sphere sphere)
{
    // Calculate distance along the ray where the sphere is intersected
    vec3 d = ray.origin - sphere.position;
    float p1 = -dot(ray.direction, d);
    float p2sqr = p1 * p1 - dot(d, d) + sphere.radius * sphere.radius;
    if (p2sqr < 0.0)
        return;
    float p2 = sqrt(p2sqr);
    float t = p1 - p2 > 0.0 ? p1 - p2 : p1 + p2;
    if (t > 0.0 && t < bestHit.dist)
    {
        bestHit.dist = t;
        bestHit.position = ray.origin + t * ray.direction;
        bestHit.normal = normalize(bestHit.position - sphere.position);
        bestHit.albedo = sphere.albedo;
        bestHit.specular = sphere.specular;
        bestHit.emission = sphere.emission;
        bestHit.smoothness = sphere.smoothness;
        bestHit.opacity = sphere.opacity;
        bestHit.refract_rate = sphere.refract_rate;
    }
}
void intersectPlane(Ray ray, inout RayHit bestHit, Plane plane)
{
    float t = dot(plane.normal, plane.position - ray.origin) / dot(plane.normal, ray.direction);
    if (t > 0.0 && t < bestHit.dist) {
        bestHit.dist = t;
        bestHit.position = ray.origin + t * ray.direction;
        bestHit.normal = plane.normal;
        bestHit.albedo = plane.albedo;
        bestHit.specular = plane.specular;
        bestHit.emission = plane.emission;
        bestHit.smoothness = plane.smoothness;
        bestHit.opacity = plane.opacity;
        bestHit.refract_rate = plane.refract_rate;
    }
}

mat3 GetTangentSpace(vec3 normal)
{
    // Choose a helper vector for the cross product
    vec3 helper = vec3(1, 0, 0);
    if (abs(normal.x) > 0.99)
        helper = vec3(0, 0, 1);

    // Generate vectors
    vec3 tangent = normalize(cross(normal, helper));
    vec3 binormal = normalize(cross(normal, tangent));
    return mat3(tangent, binormal, normal);
}
vec3 SampleHemisphere(vec3 normal, float alpha)
{
    // Sample the hemisphere, where alpha determines the kind of the sampling
    float cosTheta = pow(rand(), 1.0 / (alpha + 1.0));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float phi = 2.0 * PI * rand();
    vec3 tangentSpaceDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);

    // Transform direction to world space
    return GetTangentSpace(normal) * tangentSpaceDir;
}

RayHit trace(Ray ray) {
    RayHit bestHit = createRayHit();


    Plane plane;
    plane.position = vec3(0.0, 0.0, 0.0);
    plane.normal = vec3(0.0, 1.0, 0.0);
    plane.albedo = vec3(0.2, 0.2, 0.2);
    plane.specular = vec3(1.0, 0.78, 0.34);
    plane.emission = vec3(0.0, 0.0, 0.0);
    plane.smoothness = 0.0;
    plane.opacity = 1.0;
    intersectPlane(ray, bestHit, plane);

    for (int i = 0; i < ${sphereParams.length / 16}; i++) {
        intersectSphere(ray, bestHit, spheres[i]);
    }
    return bestHit;
}
vec3 shade(inout Ray ray, RayHit hit)
{
    if (hit.dist < INF)
    {
        float roulette = rand();
        if (roulette > hit.opacity) {
            float refract_ratio;
            vec3 normal;
            if (dot(ray.direction, hit.normal) > 0.0) {
                // refract out
                refract_ratio = hit.refract_rate;
                ray.origin = hit.position + hit.normal * 0.001;
                normal = -hit.normal;
            } else {
                // refract in
                refract_ratio = 1.0 / hit.refract_rate;
                ray.origin = hit.position - hit.normal * 0.001;
                normal = hit.normal;
            }
            ray.direction = refract(ray.direction, normal, refract_ratio);
            ray.energy = normalize(hit.albedo) * dot(ray.energy, normalize(hit.albedo));
        } else {
            ray.origin = hit.position + hit.normal * 0.001;
            roulette = rand();
            vec3 sampled = SampleHemisphere(hit.normal, 1.0);
            if (roulette > hit.smoothness) {
                ray.direction = sampled;
                ray.energy *= hit.albedo;
            } else {
                ray.direction = sampled * (1.0 - hit.smoothness) + hit.smoothness * reflect(ray.direction, hit.normal);
                ray.energy *= hit.specular;
            }
        }
        return hit.emission;
    }
    else
    {
        ray.direction = normalize(ray.direction);
        return texture(skymap, vec2(atan(ray.direction.z, ray.direction.x) / 2.0 + PI / 2.0, acos(ray.direction.y)) / PI).xyz;
    }
}
Ray createCameraRay() {
    float r = sqrt(rand() * aperture * aperture / 4.0);

    float theta = rand() * 2.0 * PI;
    float imageDistance = focalLength * objectDistance / (objectDistance - focalLength);

    // Transform the camera origin to world space
    float verticalSize = frameSize / w * h;
    float displacementX = -frameSize / 2.0 + frameSize * coord.x / w;
    float displacementY = -verticalSize / 2.0 + verticalSize * coord.y / h;
    vec3 origin = (cameraMatrix * vec4(r * cos(theta), r * sin(theta), 0.0, 1.0)).xyz;
    // Invert the perspective projection of the view-space position
    vec3 dest = (cameraMatrix * vec4(displacementX / imageDistance * objectDistance, displacementY  / imageDistance * objectDistance, -objectDistance, 1.0)).xyz;
    // Transform the direction from camera to world space and normalize
    return createRay(origin, normalize(dest - origin));
}


void main() {
    for (int i = 0; i < ${sphereParams.length / 16}; i++) {
        spheres[i].position = vec3(sphereParams[i * 16 + 0], sphereParams[i * 16 + 1], sphereParams[i * 16 + 2]);
        spheres[i].radius = sphereParams[i * 16 + 3];
        spheres[i].albedo = vec3(sphereParams[i * 16 + 4], sphereParams[i * 16 + 5], sphereParams[i * 16 + 6]);
        spheres[i].specular = vec3(sphereParams[i * 16 + 7], sphereParams[i * 16 + 8], sphereParams[i * 16 + 9]);
        spheres[i].emission = vec3(sphereParams[i * 16 + 10], sphereParams[i * 16 + 11], sphereParams[i * 16 + 12]);
        spheres[i].smoothness = sphereParams[i * 16 + 13];
        spheres[i].opacity = sphereParams[i * 16 + 14];
        spheres[i].refract_rate = sphereParams[i * 16 + 15];
    }
    shaderseed = fract(fract(t * 0.212) + gl_FragCoord.x * 1.232 + gl_FragCoord.y * -2.381);
    coord = vec2(gl_FragCoord.x, gl_FragCoord.y);

    vec3 result = vec3(0.0, 0.0, 0.0);
    for (int b = 0; b < ${batchSize}; b++) {

        Ray ray = createCameraRay();
        for (int i = 0; i < ${reflects}; i++)
        {
            RayHit hit = trace(ray);
            result += ray.energy * shade(ray, hit);
            if (hit.dist >= INF || length(ray.energy) < 0.0001)
                break;
        }
    }
    fragColor = uvec4(exposure * result / float(batchSize) * 65535.0, 65535);
}