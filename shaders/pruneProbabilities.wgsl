@group(0) @binding(0) var<storage, read> probabilities: array<f32>;
@group(0) @binding(1) var<storage, read_write> probabilitiesPruned: array<f32>;

const workgroupsPerDimension = _WORKGROUPSPERDIM;
const size = _SIZE;
const qbit: u32 = _QBIT;

fn powU(base: u32, exponent: u32) -> u32 {
    var prod: u32 = 1;

    for (var i: u32 = 0; i < exponent; i++) {
        prod *= base;
    }

    return prod;
}

@compute @workgroup_size(1) fn pruneProbabilities(
    @builtin(global_invocation_id) id: vec3u
) {
    let newRow = id.x * workgroupsPerDimension + id.y;

    let twoQbit = powU(2, qbit);

    let oldRow = newRow % twoQbit + 2*twoQbit * (newRow/twoQbit);

    if (newRow < size) {
        probabilitiesPruned[newRow] = probabilities[oldRow];
    }
}