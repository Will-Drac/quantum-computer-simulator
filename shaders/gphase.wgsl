@group(0) @binding(0) var realTexture: texture_storage_2d<r32float, read_write>;
@group(0) @binding(1) var imaginaryTexture: texture_storage_2d<r32float, read_write>;

_CONTROLS
const numControls = _NUMCONTROLS;
const phase = _PHASE;

// thanks to chatgpt for this
fn bitEquals(x: u32, bit_index: u32, value: u32) -> bool {
    return ((x >> bit_index) & 1u) == (value & 1u);
}

@compute @workgroup_size(1) fn gphaseReal(
    @builtin(global_invocation_id) id: vec3u
) {
    let col = id.x;

    var satisfiedControl = true;
    for (var i = 0; i < numControls; i++) {
        if (!bitEquals(col, controls[i][0], controls[i][1])) {
            satisfiedControl = false;
            break;
        }
    }

    if (satisfiedControl) {
        textureStore(realTexture, vec2u(id.x, id.x), vec4f(cos(phase)));
        textureStore(imaginaryTexture, vec2u(id.x, id.x), vec4f(sin(phase)));
    }
    else {
        textureStore(realTexture, vec2u(id.x, id.x), vec4f(1));
    }
}