@group(0) @binding(0) var<storage, read> oldEntries: array<u32>;
@group(0) @binding(1) var<storage, read_write> newEntries: array<u32>;

const qbit1 = _Q1;
const qbit2 = _Q2;
const workgroupsPerDimension = _WORKGROUPSPERDIM;

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
    let row = id.x * workgroupsPerDimension + id.y;

    let rowToSwapTo = swapBits(row, qbit1, qbit2);

    newEntries[row] = oldEntries[rowToSwapTo];
}