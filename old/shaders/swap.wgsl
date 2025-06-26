@group(0) @binding(0) var originalVector: texture_2d<f32>;
@group(0) @binding(1) var outputVector: texture_storage_2d<r32float, read_write>;

const qbit1 = _Q1;
const qbit2 = _Q2;

// thanks to chatgpt for this
fn swapBits(x: u32, i: u32, j: u32) -> u32 {
    // Get the ith and jth bits
    let biti = (x >> i) & 1u;
    let bitj = (x >> j) & 1u;

    // If they are the same, no need to swap
    if biti == bitj {
        return x;
    }

    // Create a mask with 1s at positions i and j
    let mask = (1u << i) | (1u << j);

    // Toggle both bits using XOR
    return x ^ mask;
}


@compute @workgroup_size(1)fn swapQbits(
    @builtin(global_invocation_id) id: vec3u
) {
    // the value at id.xy in outputVector will become the value at idToSwapTo in the input vector
    let idToSwapTo = vec2u(swapBits(id.x, qbit1, qbit2), id.y);

    let swappedValue = textureLoad(originalVector, idToSwapTo, 0);

    textureStore(outputVector, id.xy, swappedValue);
}