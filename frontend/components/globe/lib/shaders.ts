/**
 * Procedural GLSL materials for the Aurora globe. Everything is generated on
 * the GPU — no external texture binaries. Geography is stylized (domain-warped
 * value noise), but the day/night terminator is driven by a real sun-direction
 * uniform for a genuine real-time feel.
 */
import { AdditiveBlending, BackSide, Color, ShaderMaterial, Vector3 } from "three";
import { ATMOSPHERE_RADIUS, PALETTE } from "./constants";

/** Compact hash + 3D value-noise + fbm shared by the surface shaders. */
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p){
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
          mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
          mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p){
    float v = 0.0;
    float a = 0.5;
    for(int i = 0; i < 5; i++){
      v += a * vnoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`;

const SURFACE_VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  void main(){
    vObjPos = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EARTH_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDir;
  uniform vec3 uOceanDay;
  uniform vec3 uOceanNight;
  uniform vec3 uLandDay;
  uniform vec3 uLandNight;
  uniform vec3 uCityLight;
  uniform vec3 uAtmosphere;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  ${NOISE_GLSL}
  void main(){
    vec3 n = normalize(vWorldNormal);

    // Domain-warped continents from object-space position (fixed to geometry).
    vec3 q = vObjPos * 1.7;
    float warp = fbm(q + 3.1);
    float continents = fbm(q * 1.15 + vec3(warp) * 1.6);
    float land = smoothstep(0.52, 0.60, continents);

    // Coastline / relief detail.
    float detail = fbm(vObjPos * 6.0);

    vec3 oceanDay = mix(uOceanDay, uOceanDay * 1.35, detail);
    vec3 landDay = mix(uLandDay * 0.75, uLandDay * 1.2, detail);
    vec3 dayCol = mix(oceanDay, landDay, land);
    vec3 nightCol = mix(uOceanNight, uLandNight, land);

    // Day/night from the real sun direction.
    float sun = dot(n, normalize(uSunDir));
    float dayF = smoothstep(-0.12, 0.28, sun);

    vec3 color = mix(nightCol, dayCol, dayF);

    // City lights glimmer on the night side over land.
    float cityMask = land * smoothstep(0.68, 0.86, fbm(vObjPos * 9.0));
    color += uCityLight * cityMask * (1.0 - dayF) * 1.4;

    // Specular sheen on oceans facing the sun.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 h = normalize(normalize(uSunDir) + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * (1.0 - land) * dayF;
    color += vec3(0.5, 0.7, 0.9) * spec * 0.6;

    // Atmospheric rim on the lit limb.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color += uAtmosphere * fres * (0.25 + 0.75 * dayF) * 0.7;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vObjPos;
  ${NOISE_GLSL}
  void main(){
    vec3 drift = vec3(uTime * 0.006, 0.0, uTime * 0.004);
    float c = fbm(vObjPos * 2.6 + drift);
    c = smoothstep(0.55, 0.85, c);
    if(c < 0.01) discard;

    vec3 n = normalize(vWorldNormal);
    float dayF = smoothstep(-0.1, 0.35, dot(n, normalize(uSunDir)));
    vec3 col = mix(vec3(0.15, 0.18, 0.28), vec3(1.0), dayF);
    gl_FragColor = vec4(col, c * (0.25 + 0.6 * dayF));
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalView;
  void main(){
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMO_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uColorWarm;
  varying vec3 vNormalView;
  void main(){
    // Back-side shell: glow strongest at the silhouette.
    float intensity = pow(0.72 - dot(vNormalView, vec3(0.0, 0.0, 1.0)), 3.2);
    intensity = clamp(intensity, 0.0, 1.0);
    vec3 col = mix(uColor, uColorWarm, intensity * 0.5);
    gl_FragColor = vec4(col, intensity);
  }
`;

export function createEarthMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SURFACE_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uSunDir: { value: new Vector3(1, 0, 0) },
      uOceanDay: { value: new Color(PALETTE.oceanDay) },
      uOceanNight: { value: new Color(PALETTE.oceanNight) },
      uLandDay: { value: new Color(PALETTE.landDay) },
      uLandNight: { value: new Color(PALETTE.landNight) },
      uCityLight: { value: new Color(PALETTE.cityLight) },
      uAtmosphere: { value: new Color(PALETTE.atmosphere) },
    },
  });
}

export function createCloudMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SURFACE_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: new Vector3(1, 0, 0) },
      uTime: { value: 0 },
    },
  });
}

export function createAtmosphereMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    transparent: true,
    blending: AdditiveBlending,
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color(PALETTE.atmosphere) },
      uColorWarm: { value: new Color(PALETTE.atmosphereWarm) },
    },
  });
}

/** Radius helper re-export so components don't need two imports. */
export { ATMOSPHERE_RADIUS };
