@group(0) @binding(0) var originalVector: texture_2d<f32>;
@group(0) @binding(1) var outputVector: texture_storage_2d<r32float, read_write>;

const qbit = _QBIT;
const newState = _NEWSTATE;

// thanks to chatgpt for this
fn bitEquals(x: u32, bit_index: u32, value: u32) -> bool {
    return ((x >> bit_index) & 1u) == (value & 1u);
}


@compute @workgroup_size(1)fn swapQbits(
    @builtin(global_invocation_id) id: vec3u
) {
    if bitEquals(id.x, qbit, 1 - newState) {
        textureStore(outputVector, id.xy, vec4f(0));
    } else {
        textureStore(outputVector, id.xy, textureLoad(originalVector, id.xy, 0));
    }
}