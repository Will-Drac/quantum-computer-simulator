@group(0) @binding(0) var<storage, read> oldReal: array<f32>;
@group(0) @binding(1) var<storage, read> oldImag: array<f32>;
@group(0) @binding(2) var<storage, read_write> newReal: array<f32>;
@group(0) @binding(3) var<storage, read_write> newImag: array<f32>;

const size = _SIZE;
const workgroupsPerDimension = _WORKGROUPSPERDIM;

_SWAPS;

fn swapBits(bits: u32, swaps: array<vec2u, _NUMSWAPS>) -> u32 {
    var newBits = bits;

    for (var k = _NUMSWAPS - 1; k >= 0; k--) {
        let i = swaps[k].x;
        let j = swaps[k].y;

        // extract bits at positions i and j
        let biti = (newBits >> i) & 1u;
        let bitj = (newBits >> j) & 1u;

        // if they are different, toggle both
        if (biti != bitj) {
            newBits = newBits ^ ((1u << i) | (1u << j));
        }
    }
    return newBits;
}


@compute @workgroup_size(1) fn stateQbitSwap(
    @builtin(global_invocation_id) id: vec3u
) {
    let newRow: u32 = id.x * workgroupsPerDimension + id.y;

    if (newRow < size) {
        let oldRow = swapBits(newRow, swaps);

        newReal[newRow] = oldReal[oldRow];
        newImag[newRow] = oldImag[oldRow];
    }
}